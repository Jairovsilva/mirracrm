'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Stage = 'entrada' | 'enriquecer' | 'reuniao' | 'fim_cadencia';
export type Temperature = 'frio' | 'morno' | 'quente';
export type ActivityType = 'telefone' | 'email' | 'reuniao' | 'nota' | 'whatsapp' | 'linkedin';
export type Theme = 'light' | 'dark';
export type Language = 'pt' | 'en' | 'es';
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
  scopeKey: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountType: 'PF' | 'PJ';
  scopeKey: string;
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

// ─── Domínios gratuitos ───────────────────────────────────────────────────────

const FREE_DOMAINS = new Set([
  'gmail.com','googlemail.com','outlook.com','hotmail.com','hotmail.com.br',
  'live.com','msn.com','yahoo.com','yahoo.com.br','yahoo.co.uk','icloud.com',
  'me.com','mac.com','uol.com.br','bol.com.br','terra.com.br','ig.com.br',
  'r7.com','globomail.com','protonmail.com','proton.me','tutanota.com',
  'aol.com','zoho.com','yandex.com','mail.com','gmx.com','gmx.net',
  'tempmail.com','guerrillamail.com',
]);

const STAGE_PROBABILITY: Record<Stage, number> = {
  entrada: 0.05,
  enriquecer: 0.15,
  reuniao: 0.40,
  fim_cadencia: 0.70,
};

// ─── Função pura de escopo — determinística, sem estado ──────────────────────

export function deriveScopeKey(email: string): {
  scopeKey: string;
  accountType: 'PF' | 'PJ';
  companyName: string;
} {
  const clean = email.toLowerCase().trim();
  const domain = clean.split('@')[1] ?? 'desconhecido';

  if (FREE_DOMAINS.has(domain)) {
    const user = clean.split('@')[0];
    return {
      scopeKey: `PF::${clean}`,
      accountType: 'PF',
      companyName: `Conta Pessoal (${user})`,
    };
  }

  const root = domain.replace(/^(mail|email|smtp|correio)\./i, '');
  const name = root.split('.')[0];
  return {
    scopeKey: `PJ::${root}`,
    accountType: 'PJ',
    companyName: name.charAt(0).toUpperCase() + name.slice(1),
  };
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function simpleHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16) + '_' + s.length;
}

// ─── Chaves de storage por namespace ─────────────────────────────────────────

const SK = {
  users:      'corca_v3::users',
  session:    'corca_v3::session',
  leads:      (scope: string)  => `corca_v3::leads::${scope}`,
  alerts:     (userId: string) => `corca_v3::alerts::${userId}`,
  ui:         (email: string)  => `corca_v3::ui::${email}`,
  automation: (userId: string) => `corca_v3::auto::${userId}`,
};

type UsersMap = Record<string, { profile: UserProfile; hash: string }>;

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}

function lsSet<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

function lsDel(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

// ─── Interface do store ───────────────────────────────────────────────────────

interface CRMState {
  currentUser: UserProfile | null;
  leads: Lead[];
  alerts: Alert[];
  theme: Theme;
  language: Language;
  sidebarOpen: boolean;

  // Auth — 100% síncronos
  login:    (email: string, password: string) => boolean;
  register: (email: string, password: string, name?: string) => boolean;
  logout:   () => void;

  // Leads
  addLead:         (data: Omit<Lead, 'id'|'activities'|'scopeKey'|'createdByUserId'|'createdAt'|'updatedAt'|'probabilidade'>) => void;
  updateLead:      (id: string, data: Partial<Lead>) => void;
  deleteLead:      (id: string) => void;
  updateLeadStage: (id: string, stage: Stage) => void;
  addActivity:     (leadId: string, type: ActivityType, content: string) => void;

  // Compatibilidade total com código existente
  getCompanyLeads: () => Lead[];

  // Alerts
  addAlert:      (a: Omit<Alert, 'id'|'read'|'createdAt'>) => void;
  markAlertRead: (id: string) => void;
  dismissAlert:  (id: string) => void;
  markAllRead:   () => void;

  // UI
  toggleTheme:    () => void;
  setTheme:       (t: Theme) => void;
  setLanguage:    (l: Language) => void;
  setSidebarOpen: (v: boolean) => void;

  // Equipe
  getCompanyUsers:  () => UserProfile[];
  registerVendedor: (email: string, name: string, role?: UserRole) => { success: boolean; message: string };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCRMStore = create<CRMState>()(
  persist(
    (set, get) => {

      function saveLeads(leads: Lead[], scope: string) {
        lsSet(SK.leads(scope), leads);
      }

      function saveAlerts(alerts: Alert[], userId: string) {
        lsSet(SK.alerts(userId), alerts);
      }

      return {
        currentUser: null,
        leads: [],
        alerts: [],
        theme: 'dark',
        language: 'pt',
        sidebarOpen: true,

        // ── Auth ────────────────────────────────────────────────────────────

        register: (email, password, name) => {
          const clean = email.toLowerCase().trim();
          const users = lsGet<UsersMap>(SK.users, {});

          if (users[clean]) return false;

          const { scopeKey, accountType, companyName } = deriveScopeKey(clean);
          const hash = simpleHash(password + 'corca2024');

          const sameScope = Object.values(users).filter(u => u.profile.scopeKey === scopeKey);
          const role: UserRole = sameScope.length === 0 ? 'owner' : 'vendedor';

          const profile: UserProfile = {
            id: genId(),
            email: clean,
            name: name?.trim() || clean.split('@')[0],
            role,
            accountType,
            scopeKey,
            companyName,
            createdAt: new Date().toISOString(),
          };

          users[clean] = { profile, hash };
          lsSet(SK.users, users);
          lsSet(SK.session, { email: clean, at: Date.now() });

          const leads  = lsGet<Lead[]>(SK.leads(scopeKey), []);
          const prevAlerts = lsGet<Alert[]>(SK.alerts(profile.id), []);
          const ui     = lsGet<{ theme: Theme; language: Language }>(SK.ui(clean), { theme: 'dark', language: 'pt' });

          const welcome: Alert = {
            id: genId(),
            type: 'success',
            title: 'Bem-vindo ao CorçaCRM!',
            message: `Olá! Seu pipeline está pronto. ${role === 'owner' ? '👑 Você é o administrador desta conta.' : ''}`,
            read: false,
            createdAt: new Date().toISOString(),
          };

          const newAlerts = [...prevAlerts, welcome];
          saveAlerts(newAlerts, profile.id);

          set({
            currentUser: profile,
            leads,
            alerts: newAlerts,
            theme: ui.theme,
            language: ui.language,
          });

          return true;
        },

        login: (email, password) => {
          const clean = email.toLowerCase().trim();
          const users = lsGet<UsersMap>(SK.users, {});
          const entry = users[clean];

          if (!entry) return false;

          const hash = simpleHash(password + 'corca2024');
          if (hash !== entry.hash) return false;

          const profile = entry.profile;
          lsSet(SK.session, { email: clean, at: Date.now() });

          const leads  = lsGet<Lead[]>(SK.leads(profile.scopeKey), []);
          const alerts = lsGet<Alert[]>(SK.alerts(profile.id), []);
          const ui     = lsGet<{ theme: Theme; language: Language }>(SK.ui(clean), { theme: 'dark', language: 'pt' });

          set({
            currentUser: profile,
            leads,
            alerts,
            theme: ui.theme,
            language: ui.language,
          });

          return true;
        },

        logout: () => {
          const { currentUser, theme, language } = get();
          if (currentUser) {
            lsSet(SK.ui(currentUser.email), { theme, language });
          }
          lsDel(SK.session);
          set({ currentUser: null, leads: [], alerts: [] });
        },

        // ── Leads ────────────────────────────────────────────────────────────

        // Compatibilidade total — componentes antigos continuam funcionando
        getCompanyLeads: () => get().leads,

        addLead: (data) => {
          const { currentUser, leads } = get();
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

          const next = [...leads, lead];
          set({ leads: next });
          saveLeads(next, currentUser.scopeKey);

          if (data.temperatura === 'quente') {
            get().addAlert({
              type: 'warning',
              title: '🔥 Lead Quente adicionado!',
              message: `${data.nome} (${data.nomeEmpresa}) está quente. Entre em contato hoje!`,
              leadId: lead.id,
            });
          }
        },

        updateLead: (id, data) => {
          const { currentUser, leads } = get();
          if (!currentUser) return;
          const next = leads.map(l =>
            l.id === id ? { ...l, ...data, updatedAt: new Date().toISOString() } : l
          );
          set({ leads: next });
          saveLeads(next, currentUser.scopeKey);
        },

        updateLeadStage: (id, stage) => {
          const { currentUser, leads } = get();
          if (!currentUser) return;
          const next = leads.map(l =>
            l.id === id
              ? { ...l, stage, probabilidade: STAGE_PROBABILITY[stage], updatedAt: new Date().toISOString() }
              : l
          );
          set({ leads: next });
          saveLeads(next, currentUser.scopeKey);

          if (stage === 'fim_cadencia') {
            const lead = leads.find(l => l.id === id);
            if (lead) {
              get().addAlert({
                type: 'success',
                title: '🎉 Lead avançou para Fim de Cadência!',
                message: `${lead.nome} está pronto para proposta. Não deixe esfriar!`,
                leadId: id,
              });
            }
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

        // ── Alerts ───────────────────────────────────────────────────────────

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

        // ── UI ───────────────────────────────────────────────────────────────

        setTheme: (theme) => {
          set({ theme });
          const { currentUser } = get();
          if (currentUser) {
            const ui = lsGet<{ theme: Theme; language: Language }>(SK.ui(currentUser.email), { theme: 'dark', language: 'pt' });
            lsSet(SK.ui(currentUser.email), { ...ui, theme });
          }
        },

        toggleTheme: () => {
          const next = get().theme === 'dark' ? 'light' : 'dark';
          get().setTheme(next);
        },

        setLanguage: (language) => {
          set({ language });
          const { currentUser } = get();
          if (currentUser) {
            const ui = lsGet<{ theme: Theme; language: Language }>(SK.ui(currentUser.email), { theme: 'dark', language: 'pt' });
            lsSet(SK.ui(currentUser.email), { ...ui, language });
          }
        },

        setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

        // ── Equipe ───────────────────────────────────────────────────────────

        getCompanyUsers: () => {
          const { currentUser } = get();
          if (!currentUser) return [];
          const users = lsGet<UsersMap>(SK.users, {});
          return Object.values(users)
            .filter(u => u.profile.scopeKey === currentUser.scopeKey)
            .map(u => u.profile);
        },

        registerVendedor: (email, name, role = 'vendedor') => {
          const { currentUser } = get();
          if (!currentUser) return { success: false, message: 'Não autenticado.' };
          if (currentUser.role !== 'owner' && currentUser.role !== 'admin') {
            return { success: false, message: 'Apenas admins podem convidar membros.' };
          }

          const clean = email.toLowerCase().trim();
          const users = lsGet<UsersMap>(SK.users, {});
          if (users[clean]) return { success: false, message: 'Email já cadastrado.' };

          const { scopeKey } = deriveScopeKey(clean);
          if (scopeKey !== currentUser.scopeKey) {
            return { success: false, message: 'Este email não pertence ao domínio da sua empresa.' };
          }

          const profile: UserProfile = {
            id: genId(),
            email: clean,
            name: name.trim(),
            role,
            accountType: currentUser.accountType,
            scopeKey: currentUser.scopeKey,
            companyName: currentUser.companyName,
            createdAt: new Date().toISOString(),
          };

          users[clean] = { profile, hash: simpleHash('trocar123' + 'corca2024') };
          lsSet(SK.users, users);
          return { success: true, message: `${name} adicionado com sucesso!` };
        },
      };
    },
    {
      name: 'corca_v3_main',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      // Persiste só preferências — dados sensíveis ficam em chaves separadas
      partialize: (s) => ({
        theme: s.theme,
        language: s.language,
        sidebarOpen: s.sidebarOpen,
      }),
    }
  )
);

// ─── Restaurar sessão (síncrono) ──────────────────────────────────────────────

export function restoreSession(): boolean {
  if (typeof window === 'undefined') return false;

  const session = lsGet<{ email: string; at: number } | null>(SK.session, null);
  if (!session) return false;

  if (Date.now() - session.at > 7 * 24 * 60 * 60 * 1000) {
    lsDel(SK.session);
    return false;
  }

  const users = lsGet<UsersMap>(SK.users, {});
  const entry = users[session.email];
  if (!entry) { lsDel(SK.session); return false; }

  const { profile } = entry;
  const leads  = lsGet<Lead[]>(SK.leads(profile.scopeKey), []);
  const alerts = lsGet<Alert[]>(SK.alerts(profile.id), []);
  const ui     = lsGet<{ theme: Theme; language: Language }>(SK.ui(session.email), { theme: 'dark', language: 'pt' });

  useCRMStore.setState({
    currentUser: profile,
    leads,
    alerts,
    theme: ui.theme,
    language: ui.language,
  });

  return true;
}

// ─── Automação diária ─────────────────────────────────────────────────────────

export function runDailyAlertAutomation(): void {
  const state = useCRMStore.getState();
  const { currentUser, leads, addAlert } = state;
  if (!currentUser) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const lastRun  = lsGet<string>(SK.automation(currentUser.id), '');
  if (lastRun === todayStr) return;
  lsSet(SK.automation(currentUser.id), todayStr);

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const stale = leads.filter(l => {
    const last = l.activities.length > 0
      ? new Date(l.activities[l.activities.length - 1].date)
      : new Date(l.createdAt);
    return last < threeDaysAgo && l.stage !== 'fim_cadencia';
  });

  if (stale.length > 0) {
    addAlert({
      type: 'warning',
      title: `⏰ ${stale.length} leads sem atividade há 3+ dias`,
      message: `${stale.slice(0, 3).map(l => l.nome).join(', ')}${stale.length > 3 ? ` e mais ${stale.length - 3}` : ''}. Faça follow-up hoje!`,
    });
  }

  const hotStale = leads.filter(l => {
    if (l.temperatura !== 'quente') return false;
    const last = l.activities.length > 0
      ? new Date(l.activities[l.activities.length - 1].date)
      : new Date(l.createdAt);
    return last < new Date(Date.now() - 24 * 60 * 60 * 1000);
  });

  if (hotStale.length > 0) {
    addAlert({
      type: 'danger',
      title: `🔥 ${hotStale.length} lead(s) QUENTE(s) sem contato hoje`,
      message: `${hotStale.slice(0, 2).map(l => l.nome).join(', ')} precisam de atenção imediata!`,
    });
  }

  if (new Date().getDay() === 1) {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const calls = leads.reduce((n, l) =>
      n + l.activities.filter(a => a.type === 'telefone' && new Date(a.date) > lastWeek).length, 0);
    const meetings = leads.filter(l =>
      l.activities.some(a => a.type === 'reuniao' && new Date(a.date) > lastWeek)).length;

    addAlert({
      type: 'info',
      title: '📊 Resumo semanal',
      message: `Semana passada: ${calls} ligações e ${meetings} reuniões. Meta: 100 ligações e 6 reuniões/semana.`,
    });
  }
}