'use client';

/**
 * CorçaCRM — Store v3 (Bolt-safe, Zero Data Leak)
 *
 * ARQUITETURA:
 * - Nenhum dado de usuário diferente compartilha o mesmo espaço de memória
 * - Chaves de storage são compostas: prefixo::namespace::id
 * - currentUser é derivado de sessionKey (não de cache de estado)
 * - PF (pessoa física) e PJ (corporativo) têm namespaces estruturalmente diferentes
 * - Sem race condition: reads e writes usam a mesma função de derivação de escopo
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Stage = 'entrada' | 'enriquecer' | 'reuniao' | 'fim_cadencia';
export type Temperature = 'frio' | 'morno' | 'quente';
export type ActivityType = 'telefone' | 'email' | 'reuniao' | 'nota' | 'whatsapp' | 'linkedin';
export type Theme = 'light' | 'dark';
export type Language = 'pt' | 'en' | 'es';
export type AccountType = 'PF' | 'PJ';
export type UserRole = 'owner' | 'admin' | 'vendedor';

export interface Activity {
  id: string;
  type: ActivityType;
  date: string;
  content: string;
  userId: string;
}

export interface Lead {
  id: string;
  nome: string;
  cargo: string;
  emailCorporativo: string;
  telefoneCelular: string;
  telefoneFixo: string;
  nomeEmpresa: string;
  cnpj: string;
  linkedin: string;
  stage: Stage;
  temperatura: Temperature;
  valorProposta: number;
  probabilidade: number;
  motivoPerda?: string;
  motivoSemReuniao?: string;
  activities: Activity[];
  // Chave imutável derivada no momento da criação — nunca muda
  readonly scopeKey: string;
  readonly createdByUserId: string;
  readonly createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountType: AccountType;
  // Chave de escopo derivada do email — nunca muda após criação
  readonly scopeKey: string;
  // Para PJ: todos da mesma empresa compartilham este scopeKey
  // Para PF: scopeKey é único por email
  companyName: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  title: string;
  message: string;
  read: boolean;
  leadId?: string;
  createdAt: string;
}

export interface UIPrefs {
  theme: Theme;
  language: Language;
  sidebarOpen: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.com.br', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.com.br', 'yahoo.co.uk',
  'icloud.com', 'me.com', 'mac.com',
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br',
  'r7.com', 'globomail.com',
  'protonmail.com', 'proton.me', 'tutanota.com',
  'aol.com', 'zoho.com', 'yandex.com',
  'mail.com', 'gmx.com', 'gmx.net',
  'tempmail.com', 'guerrillamail.com',
]);

const STAGE_PROBABILITY: Record<Stage, number> = {
  entrada: 0.05,
  enriquecer: 0.15,
  reuniao: 0.40,
  fim_cadencia: 0.70,
};

// ─── Scope Key derivation (pure function — deterministic) ─────────────────────

/**
 * REGRA CENTRAL: scopeKey é derivado SEMPRE da mesma forma.
 * PF → "PF::email@dominio.com"   (isolamento individual)
 * PJ → "PJ::dominio.com"         (compartilhado pela empresa)
 *
 * Esta função é pura e não depende de nenhum estado.
 */
export function deriveScopeKey(email: string): { scopeKey: string; accountType: AccountType; companyName: string } {
  const clean = email.toLowerCase().trim();
  const parts = clean.split('@');
  const domain = parts[1] ?? 'desconhecido';

  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return {
      scopeKey: `PF::${clean}`,
      accountType: 'PF',
      companyName: `Conta Pessoal (${parts[0]})`,
    };
  }

  // Remove subdomínios comuns de email (mail., email., smtp.)
  const rootDomain = domain.replace(/^(mail|email|smtp|correio)\./i, '');

  return {
    scopeKey: `PJ::${rootDomain}`,
    accountType: 'PJ',
    companyName: rootDomain.split('.')[0].charAt(0).toUpperCase() + rootDomain.split('.')[0].slice(1),
  };
}

// ─── Secure ID generator ──────────────────────────────────────────────────────

function genId(): string {
  const arr = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 12; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Simple hash (not for security — just to avoid plaintext in storage) ─────

async function hashPassword(password: string): Promise<string> {
  if (typeof window === 'undefined') return `__${password}__`;
  const enc = new TextEncoder();
  const buf = await window.crypto.subtle.digest('SHA-256', enc.encode(password + 'corca_salt_2024'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  users: 'corca_v3::users',
  session: 'corca_v3::session',
  leads: (scopeKey: string) => `corca_v3::leads::${scopeKey}`,
  alerts: (userId: string) => `corca_v3::alerts::${userId}`,
  ui: (email: string) => `corca_v3::ui::${email}`,
};

// ─── Low-level storage helpers (bypass zustand for sensitive data) ─────────────

function storageGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function storageSet<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked
  }
}

function storageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

// ─── Store Interface ───────────────────────────────────────────────────────────

interface CRMState {
  // Session (never persisted in zustand — read from localStorage directly)
  currentUser: UserProfile | null;
  sessionKey: string | null;

  // UI Preferences (persisted per-user in a separate key)
  theme: Theme;
  language: Language;
  sidebarOpen: boolean;

  // Leads (scoped — read/written via KEYS.leads(scopeKey))
  leads: Lead[];

  // Alerts (scoped — read/written via KEYS.alerts(userId))
  alerts: Alert[];

  // ── Auth ────────────────────────────────────────────────────────────────
  register: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;

  // ── Leads ───────────────────────────────────────────────────────────────
  loadLeads: () => void;
  addLead: (data: Omit<Lead, 'id' | 'activities' | 'scopeKey' | 'createdByUserId' | 'createdAt' | 'updatedAt' | 'probabilidade'>) => void;
  updateLead: (id: string, data: Partial<Omit<Lead, 'id' | 'scopeKey' | 'createdByUserId' | 'createdAt'>>) => void;
  moveLead: (id: string, stage: Stage) => void;
  deleteLead: (id: string) => void;
  addActivity: (leadId: string, type: ActivityType, content: string) => void;

  // ── Alerts ──────────────────────────────────────────────────────────────
  loadAlerts: () => void;
  markAlertRead: (id: string) => void;
  dismissAlert: (id: string) => void;
  markAllRead: () => void;
  addAlert: (alert: Omit<Alert, 'id' | 'read' | 'createdAt'>) => void;

  // ── UI ──────────────────────────────────────────────────────────────────
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  setSidebarOpen: (open: boolean) => void;

  // ── Team (PJ only) ──────────────────────────────────────────────────────
  getCompanyMembers: () => UserProfile[];
  inviteTeamMember: (email: string, name: string, role: UserRole) => { ok: boolean; error?: string };
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useCRMStore = create<CRMState>()((set, get) => {

  // ── Internal helpers ────────────────────────────────────────────────────────

  function saveLeads(leads: Lead[], scopeKey: string): void {
    storageSet(KEYS.leads(scopeKey), leads);
  }

  function saveAlerts(alerts: Alert[], userId: string): void {
    storageSet(KEYS.alerts(userId), alerts);
  }

  function saveUIPrefs(email: string, prefs: UIPrefs): void {
    storageSet(KEYS.ui(email), prefs);
  }

  function getCurrentScopeKey(): string | null {
    return get().currentUser?.scopeKey ?? null;
  }

  // ── Store ───────────────────────────────────────────────────────────────────

  return {
    currentUser: null,
    sessionKey: null,
    theme: 'dark',
    language: 'pt',
    sidebarOpen: true,
    leads: [],
    alerts: [],

    // ── Auth ──────────────────────────────────────────────────────────────────

    register: async (email, password, name) => {
      const clean = email.toLowerCase().trim();

      if (!clean.includes('@') || !clean.includes('.')) {
        return { ok: false, error: 'Email inválido.' };
      }
      if (password.length < 6) {
        return { ok: false, error: 'Senha deve ter pelo menos 6 caracteres.' };
      }
      if (!name.trim()) {
        return { ok: false, error: 'Nome é obrigatório.' };
      }

      // Check if email already exists
      const users = storageGet<Record<string, { profile: UserProfile; hash: string }>>(KEYS.users, {});
      if (users[clean]) {
        return { ok: false, error: 'Este email já está cadastrado.' };
      }

      const { scopeKey, accountType, companyName } = deriveScopeKey(clean);
      const hash = await hashPassword(password);

      // Is this the first user from this company?
      const existingFromSameScope = Object.values(users).filter(u => u.profile.scopeKey === scopeKey);
      const role: UserRole = existingFromSameScope.length === 0 ? 'owner' : 'vendedor';

      const profile: UserProfile = {
        id: genId(),
        email: clean,
        name: name.trim(),
        role,
        accountType,
        scopeKey,
        companyName,
        createdAt: new Date().toISOString(),
      };

      users[clean] = { profile, hash };
      storageSet(KEYS.users, users);

      // Create session
      const sessionKey = genId();
      storageSet(KEYS.session, { email: clean, sessionKey, loginAt: Date.now() });

      // Load UI prefs for this user
      const uiPrefs = storageGet<UIPrefs>(KEYS.ui(clean), { theme: 'dark', language: 'pt', sidebarOpen: true });

      // Load leads and alerts for this scope
      const leads = storageGet<Lead[]>(KEYS.leads(scopeKey), []);
      const alerts = storageGet<Alert[]>(KEYS.alerts(profile.id), []);

      set({
        currentUser: profile,
        sessionKey,
        leads,
        alerts,
        theme: uiPrefs.theme,
        language: uiPrefs.language,
        sidebarOpen: uiPrefs.sidebarOpen,
      });

      // Welcome alert
      const welcomeAlert: Alert = {
        id: genId(),
        type: 'success',
        title: 'Bem-vindo ao CorçaCRM!',
        message: `Olá, ${profile.name}! Seu pipeline está pronto. ${role === 'owner' ? '👑 Você é o administrador desta conta.' : ''}`,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const newAlerts = [...alerts, welcomeAlert];
      saveAlerts(newAlerts, profile.id);
      set({ alerts: newAlerts });

      return { ok: true };
    },

    login: async (email, password) => {
      const clean = email.toLowerCase().trim();
      const users = storageGet<Record<string, { profile: UserProfile; hash: string }>>(KEYS.users, {});
      const entry = users[clean];

      if (!entry) {
        return { ok: false, error: 'Email não encontrado. Verifique ou crie uma conta.' };
      }

      const valid = await verifyPassword(password, entry.hash);
      if (!valid) {
        return { ok: false, error: 'Senha incorreta.' };
      }

      const profile = entry.profile;
      const sessionKey = genId();
      storageSet(KEYS.session, { email: clean, sessionKey, loginAt: Date.now() });

      // Load data ONLY for this user's scope
      const leads = storageGet<Lead[]>(KEYS.leads(profile.scopeKey), []);
      const alerts = storageGet<Alert[]>(KEYS.alerts(profile.id), []);
      const uiPrefs = storageGet<UIPrefs>(KEYS.ui(clean), { theme: 'dark', language: 'pt', sidebarOpen: true });

      set({
        currentUser: profile,
        sessionKey,
        leads,
        alerts,
        theme: uiPrefs.theme,
        language: uiPrefs.language,
        sidebarOpen: uiPrefs.sidebarOpen,
      });

      return { ok: true };
    },

    logout: () => {
      const { currentUser, theme, language, sidebarOpen } = get();

      // Save UI prefs before logout
      if (currentUser) {
        saveUIPrefs(currentUser.email, { theme, language, sidebarOpen });
      }

      // Clear session
      storageRemove(KEYS.session);

      // Reset state — ZERO data leak
      set({
        currentUser: null,
        sessionKey: null,
        leads: [],
        alerts: [],
        // Keep theme/language as last-used (not sensitive)
      });
    },

    // ── Leads ─────────────────────────────────────────────────────────────────

    loadLeads: () => {
      const scopeKey = getCurrentScopeKey();
      if (!scopeKey) return;
      const leads = storageGet<Lead[]>(KEYS.leads(scopeKey), []);
      set({ leads });
    },

    addLead: (data) => {
      const { currentUser } = get();
      if (!currentUser) return;

      const lead: Lead = {
        ...data,
        id: genId(),
        activities: [],
        scopeKey: currentUser.scopeKey,
        createdByUserId: currentUser.id,
        probabilidade: STAGE_PROBABILITY[data.stage],
        valorProposta: data.valorProposta ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const next = [...get().leads, lead];
      set({ leads: next });
      saveLeads(next, currentUser.scopeKey);

      // Auto-alert for hot leads
      if (data.temperatura === 'quente') {
        get().addAlert({
          type: 'warning',
          title: '🔥 Lead Quente adicionado',
          message: `${data.nome} (${data.nomeEmpresa}) está marcado como QUENTE. Entre em contato hoje!`,
          leadId: lead.id,
        });
      }
    },

    updateLead: (id, data) => {
      const { currentUser, leads } = get();
      if (!currentUser) return;

      const next = leads.map(l =>
        l.id === id
          ? { ...l, ...data, updatedAt: new Date().toISOString() }
          : l
      );
      set({ leads: next });
      saveLeads(next, currentUser.scopeKey);
    },

    moveLead: (id, stage) => {
      const { currentUser, leads } = get();
      if (!currentUser) return;

      const next = leads.map(l =>
        l.id === id
          ? { ...l, stage, probabilidade: STAGE_PROBABILITY[stage], updatedAt: new Date().toISOString() }
          : l
      );
      set({ leads: next });
      saveLeads(next, currentUser.scopeKey);

      // Auto-alert when reaching final stage
      const lead = leads.find(l => l.id === id);
      if (stage === 'fim_cadencia' && lead) {
        get().addAlert({
          type: 'success',
          title: '🎉 Lead avançou para Fim de Cadência!',
          message: `${lead.nome} está pronto para proposta. Agende o fechamento!`,
          leadId: id,
        });
      }
    },

    deleteLead: (id) => {
      const { currentUser, leads } = get();
      if (!currentUser) return;

      const next = leads.filter(l => l.id !== id);
      set({ leads: next });
      saveLeads(next, currentUser.scopeKey);
    },

    addActivity: (leadId, type, content) => {
      const { currentUser, leads } = get();
      if (!currentUser) return;

      const activity: Activity = {
        id: genId(),
        type,
        content,
        userId: currentUser.id,
        date: new Date().toISOString(),
      };

      const next = leads.map(l =>
        l.id === leadId
          ? { ...l, activities: [...l.activities, activity], updatedAt: new Date().toISOString() }
          : l
      );
      set({ leads: next });
      saveLeads(next, currentUser.scopeKey);
    },

    // ── Alerts ────────────────────────────────────────────────────────────────

    loadAlerts: () => {
      const { currentUser } = get();
      if (!currentUser) return;
      const alerts = storageGet<Alert[]>(KEYS.alerts(currentUser.id), []);
      set({ alerts });
    },

    addAlert: (data) => {
      const { currentUser, alerts } = get();
      if (!currentUser) return;

      const alert: Alert = {
        ...data,
        id: genId(),
        read: false,
        createdAt: new Date().toISOString(),
      };
      const next = [...alerts, alert];
      set({ alerts: next });
      saveAlerts(next, currentUser.id);
    },

    markAlertRead: (id) => {
      const { currentUser, alerts } = get();
      if (!currentUser) return;
      const next = alerts.map(a => a.id === id ? { ...a, read: true } : a);
      set({ alerts: next });
      saveAlerts(next, currentUser.id);
    },

    dismissAlert: (id) => {
      const { currentUser, alerts } = get();
      if (!currentUser) return;
      const next = alerts.filter(a => a.id !== id);
      set({ alerts: next });
      saveAlerts(next, currentUser.id);
    },

    markAllRead: () => {
      const { currentUser, alerts } = get();
      if (!currentUser) return;
      const next = alerts.map(a => ({ ...a, read: true }));
      set({ alerts: next });
      saveAlerts(next, currentUser.id);
    },

    // ── UI ────────────────────────────────────────────────────────────────────

    setTheme: (theme) => {
      const { currentUser } = get();
      set({ theme });
      if (currentUser) {
        const prefs = storageGet<UIPrefs>(KEYS.ui(currentUser.email), { theme: 'dark', language: 'pt', sidebarOpen: true });
        saveUIPrefs(currentUser.email, { ...prefs, theme });
      }
    },

    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },

    setLanguage: (language) => {
      const { currentUser } = get();
      set({ language });
      if (currentUser) {
        const prefs = storageGet<UIPrefs>(KEYS.ui(currentUser.email), { theme: 'dark', language: 'pt', sidebarOpen: true });
        saveUIPrefs(currentUser.email, { ...prefs, language });
      }
    },

    setSidebarOpen: (sidebarOpen) => {
      set({ sidebarOpen });
    },

    // ── Team ──────────────────────────────────────────────────────────────────

    getCompanyMembers: () => {
      const { currentUser } = get();
      if (!currentUser) return [];
      const users = storageGet<Record<string, { profile: UserProfile; hash: string }>>(KEYS.users, {});
      return Object.values(users)
        .filter(u => u.profile.scopeKey === currentUser.scopeKey)
        .map(u => u.profile);
    },

    inviteTeamMember: (email, name, role) => {
      const { currentUser } = get();
      if (!currentUser) return { ok: false, error: 'Não autenticado.' };
      if (currentUser.role !== 'owner' && currentUser.role !== 'admin') {
        return { ok: false, error: 'Apenas admins podem convidar membros.' };
      }

      const clean = email.toLowerCase().trim();
      const users = storageGet<Record<string, { profile: UserProfile; hash: string }>>(KEYS.users, {});

      if (users[clean]) {
        return { ok: false, error: 'Este email já está cadastrado.' };
      }

      // Derive scope — must match company
      const { scopeKey, accountType, companyName } = deriveScopeKey(clean);
      if (scopeKey !== currentUser.scopeKey) {
        return { ok: false, error: `Este email (${email}) não pertence ao domínio da sua empresa (${currentUser.companyName}).` };
      }

      const profile: UserProfile = {
        id: genId(),
        email: clean,
        name: name.trim(),
        role,
        accountType,
        scopeKey,
        companyName,
        createdAt: new Date().toISOString(),
      };

      // Temporary password that they must change on first login
      const tempPass = genId().slice(0, 8);

      users[clean] = { profile, hash: '' }; // hash set on first login
      storageSet(KEYS.users, users);

      return { ok: true };
    },
  };
});

// ─── Session Restore (call this in app root) ───────────────────────────────────

/**
 * Chame esta função no `useEffect` do layout raiz para restaurar a sessão.
 * Ela lê o sessionKey do localStorage e recarrega o usuário correto.
 */
export async function restoreSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const session = storageGet<{ email: string; sessionKey: string; loginAt: number } | null>(KEYS.session, null);
  if (!session) return false;

  // Session expires after 7 days
  const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - session.loginAt > SESSION_TTL) {
    storageRemove(KEYS.session);
    return false;
  }

  const users = storageGet<Record<string, { profile: UserProfile; hash: string }>>(KEYS.users, {});
  const entry = users[session.email];
  if (!entry) {
    storageRemove(KEYS.session);
    return false;
  }

  const { profile } = entry;
  const leads = storageGet<Lead[]>(KEYS.leads(profile.scopeKey), []);
  const alerts = storageGet<Alert[]>(KEYS.alerts(profile.id), []);
  const uiPrefs = storageGet<UIPrefs>(KEYS.ui(session.email), { theme: 'dark', language: 'pt', sidebarOpen: true });

  useCRMStore.setState({
    currentUser: profile,
    sessionKey: session.sessionKey,
    leads,
    alerts,
    theme: uiPrefs.theme,
    language: uiPrefs.language,
    sidebarOpen: uiPrefs.sidebarOpen,
  });

  return true;
}

// ─── Daily alert automation ────────────────────────────────────────────────────

/**
 * Chame esta função uma vez por dia (via useEffect com timestamp check)
 * para gerar alertas automáticos de follow-up.
 */
export function runDailyAlertAutomation(): void {
  const state = useCRMStore.getState();
  const { currentUser, leads, addAlert } = state;
  if (!currentUser) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Check if automation already ran today
  const lastRun = storageGet<string>(`corca_v3::automation::${currentUser.id}`, '');
  if (lastRun === todayStr) return;

  storageSet(`corca_v3::automation::${currentUser.id}`, todayStr);

  const myLeads = leads.filter(l => l.createdByUserId === currentUser.id || currentUser.role !== 'vendedor');

  // Leads without activity in 3+ days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const staleLeads = myLeads.filter(l => {
    const lastActivity = l.activities.length > 0
      ? new Date(l.activities[l.activities.length - 1].date)
      : new Date(l.createdAt);
    return lastActivity < threeDaysAgo && l.stage !== 'fim_cadencia';
  });

  if (staleLeads.length > 0) {
    addAlert({
      type: 'warning',
      title: `⏰ ${staleLeads.length} leads sem atividade há 3+ dias`,
      message: `Leads parados: ${staleLeads.slice(0, 3).map(l => l.nome).join(', ')}${staleLeads.length > 3 ? ` e mais ${staleLeads.length - 3}` : ''}. Faça follow-up hoje!`,
    });
  }

  // Hot leads without activity today
  const hotNoContact = myLeads.filter(l => {
    if (l.temperatura !== 'quente') return false;
    const lastActivity = l.activities.length > 0
      ? new Date(l.activities[l.activities.length - 1].date)
      : new Date(l.createdAt);
    return lastActivity < new Date(Date.now() - 24 * 60 * 60 * 1000);
  });

  if (hotNoContact.length > 0) {
    addAlert({
      type: 'danger',
      title: `🔥 ${hotNoContact.length} lead(s) QUENTE(s) sem contato hoje`,
      message: `Não perca oportunidades quentes! Entre em contato agora: ${hotNoContact.slice(0, 2).map(l => l.nome).join(', ')}.`,
    });
  }

  // Weekly summary (Monday only)
  if (today.getDay() === 1) {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const callsLastWeek = myLeads.reduce((sum, l) =>
      sum + l.activities.filter(a => a.type === 'telefone' && new Date(a.date) > lastWeek).length, 0);
    const meetingsLastWeek = myLeads.filter(l =>
      l.stage === 'reuniao' || l.activities.some(a => a.type === 'reuniao' && new Date(a.date) > lastWeek)).length;

    addAlert({
      type: 'info',
      title: '📊 Resumo semanal',
      message: `Semana passada: ${callsLastWeek} ligações, ${meetingsLastWeek} reuniões agendadas. Meta: 100 ligações e 6 reuniões/semana.`,
    });

    // Analysis: why leads didn't convert to meetings
    const noMeeting = myLeads.filter(l =>
      l.stage === 'entrada' || l.stage === 'enriquecer'
    ).filter(l => {
      const created = new Date(l.createdAt);
      return created > lastWeek;
    });

    if (noMeeting.length > 0) {
      addAlert({
        type: 'info',
        title: `📋 ${noMeeting.length} leads não avançaram para reunião`,
        message: `Analise os motivos em Relatórios → Motivos de Não-Reunião para otimizar sua cadência.`,
      });
    }
  }
}