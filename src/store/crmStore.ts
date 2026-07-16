'use client';

/**
 * CorçaCRM — Store v4.1 (Supabase — persistência real entre navegadores/dispositivos)
 * * ATUALIZAÇÕES DE SEGURANÇA E REGISTRO BLINDADO:
 * - Correção do bug de latência de sessão no cadastro (Erro 42501 - RLS) utilizando setSession explícito.
 * - Adicionado delay de sincronização mecânica para permitir propagação de JWT.
 * - Mantida compatibilidade total de tipos e interfaces com o restante do projeto Next.js.
 */

import { create } from 'zustand';
import { supabase } from '@/src/lib/supabaseClient';

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
  readonly scopeKey: string;
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

  const rootDomain = domain.replace(/^(mail|email|smtp|correio)\./i, '');

  return {
    scopeKey: `PJ::${rootDomain}`,
    accountType: 'PJ',
    companyName: rootDomain.split('.')[0].charAt(0).toUpperCase() + rootDomain.split('.')[0].slice(1),
  };
}

// ─── Detecção de tentativa de contato sem sucesso ──────────────────────────────

const FAILED_CONTACT_KEYWORDS = [
  'nao atendeu', 'nao atende', 'sem sucesso', 'sem retorno', 'nao retornou',
  'nao consegui contato', 'nao conseguiu contato', 'nao consegui falar',
  'nao consegui contata', 'caixa postal', 'numero errado', 'nao localizado',
  'ocupado', 'ligacao caiu', 'desligou na ligacao', 'nao atendeu a ligacao',
  'tentativa sem sucesso', 'sem exito', 'recado deixado', 'nao quis falar',
  'ninguem atendeu', 'chamada nao completada', 'nao foi possivel contatar',
  'sem contato', 'nao respondeu',
];

function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isFailedContactAttempt(content: string): boolean {
  const normalized = normalizeText(content);
  return FAILED_CONTACT_KEYWORDS.some((kw) => normalized.includes(kw));
}

// ─── Detecção de reunião marcada ────────────────────────────────────────────────

const MEETING_SCHEDULED_KEYWORDS = [
  'reuniao marcada', 'reuniao agendada', 'agendei reuniao', 'agendada reuniao',
  'reuniao confirmada', 'marcamos reuniao', 'reuniao remarcada', 'call marcada',
  'call agendada', 'agendado reuniao', 'marcou reuniao', 'reuniao para',
  'confirmou reuniao', 'reuniao confirmou',
];

function isMeetingScheduled(content: string): boolean {
  const normalized = normalizeText(content);
  return MEETING_SCHEDULED_KEYWORDS.some((kw) => normalized.includes(kw));
}

// ─── Status visual do card (usado pelo Kanban para colorir o card) ─────────────

export type LeadCardStatus = 'perdido_pos_reuniao' | 'reuniao_marcada' | 'retornar_ligacao' | 'normal';

export function getLeadCardStatus(lead: Lead): LeadCardStatus {
  if (lead.motivoPerda && lead.motivoPerda.trim() !== '') {
    return 'perdido_pos_reuniao';
  }

  if (!lead.activities || lead.activities.length === 0) return 'normal';
  const last = lead.activities[lead.activities.length - 1];
  if (last.type === 'reuniao' || isMeetingScheduled(last.content)) return 'reuniao_marcada';
  if (isFailedContactAttempt(last.content)) return 'retornar_ligacao';
  return 'normal';
}

// ─── Mappers (linhas do banco em snake_case → objetos camelCase da store) ──────

function mapProfileRow(row: any): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    accountType: row.account_type,
    scopeKey: row.scope_key,
    companyName: row.company_name,
    createdAt: row.created_at,
  };
}

function mapLeadRow(row: any, activities: Activity[]): Lead {
  return {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo ?? '',
    emailCorporativo: row.email_corporativo ?? '',
    telefoneCelular: row.telefone_celular ?? '',
    telefoneFixo: row.telefone_fixo ?? '',
    nomeEmpresa: row.nome_empresa ?? '',
    cnpj: row.cnpj ?? '',
    linkedin: row.linkedin ?? '',
    stage: row.stage,
    temperatura: row.temperatura,
    valorProposta: Number(row.valor_proposta ?? 0),
    probabilidade: Number(row.probabilidade ?? 0),
    motivoPerda: row.motivo_perda ?? undefined,
    motivoSemReuniao: row.motivo_sem_reuniao ?? undefined,
    activities,
    scopeKey: row.scope_key,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivityRow(row: any): Activity {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    content: row.content,
    userId: row.user_id,
  };
}

function mapAlertRow(row: any): Alert {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    leadId: row.lead_id ?? undefined,
    createdAt: row.created_at,
  };
}

// ─── Preferências de UI locais ───────────────────────────────────────────────

const KEYS = {
  ui: (email: string) => `corca_v3::ui::${email}`,
};

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
    // storage block / full
  }
}

// ─── Store Interface ───────────────────────────────────────────────────────────

interface CRMState {
  currentUser: UserProfile | null;
  accessToken: string | null;

  theme: Theme;
  language: Language;
  sidebarOpen: boolean;

  leads: Lead[];
  alerts: Alert[];

  // ── Auth ────────────────────────────────────────────────────────────────
  register: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;

  // ── Leads ───────────────────────────────────────────────────────────────
  loadLeads: () => Promise<void>;
  addLead: (data: Omit<Lead, 'id' | 'activities' | 'scopeKey' | 'createdByUserId' | 'createdAt' | 'updatedAt' | 'probabilidade'>) => Promise<void>;
  updateLead: (id: string, data: Partial<Omit<Lead, 'id' | 'scopeKey' | 'createdByUserId' | 'createdAt'>>) => Promise<void>;
  moveLead: (id: string, stage: Stage) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  deleteLeads: (ids: string[]) => Promise<void>;
  addActivity: (leadId: string, type: ActivityType, content: string) => Promise<void>;

  // ── Alerts ──────────────────────────────────────────────────────────────
  loadAlerts: () => Promise<void>;
  markAlertRead: (id: string) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addAlert: (alert: Omit<Alert, 'id' | 'read' | 'createdAt'>) => Promise<void>;

  // ── UI ──────────────────────────────────────────────────────────────────
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  setSidebarOpen: (open: boolean) => void;

  // ── Team (PJ only) ──────────────────────────────────────────────────────
  getCompanyMembers: () => Promise<UserProfile[]>;
  inviteTeamMember: (email: string, name: string, role: UserRole, password: string) => Promise<{ ok: boolean; error?: string }>;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useCRMStore = create<CRMState>()((set, get) => {

  function saveUIPrefs(email: string, prefs: UIPrefs): void {
    saveUIPrefsInternal(email, prefs);
  }

  function saveUIPrefsInternal(email: string, prefs: UIPrefs): void {
    storageSet(KEYS.ui(email), prefs);
  }

  return {
    currentUser: null,
    accessToken: null,
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

      const { scopeKey, accountType, companyName } = deriveScopeKey(clean);

      // 1. SignUp no Supabase
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: clean,
        password,
      });

      if (signUpError || !signUpData.user) {
        const msg = signUpError?.message?.toLowerCase() ?? '';
        if (msg.includes('already registered') || msg.includes('already exists')) {
          return { ok: false, error: 'Este email já está cadastrado. Faça login.' };
        }
        return { ok: false, error: signUpError?.message || 'Erro ao cadastrar.' };
      }

      // ⚡ CORREÇÃO CRUCIAL (Sincronização Ativa de Sessão para RLS)
      if (signUpData.session) {
        await supabase.auth.setSession({
          access_token: signUpData.session.access_token,
          refresh_token: signUpData.session.refresh_token,
        });
      }

      // Delay de estabilização de sessão no banco (250 milissegundos)
      await new Promise((resolve) => setTimeout(resolve, 250));

      const { data: countInScope } = await supabase.rpc('count_profiles_in_scope', { p_scope_key: scopeKey });
      const role: UserRole = (countInScope ?? 0) === 0 ? 'owner' : 'vendedor';

      // 2. Escrita do Perfil com sessão de autenticação ativa garantida
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: signUpData.user.id,
          email: clean,
          name: name.trim(),
          role,
          account_type: accountType,
          scope_key: scopeKey,
          company_name: companyName,
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        const temSessao = !!signUpData.session;
        const urlAtual = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NÃO DEFINIDA';
        const detalhes = [
          `Mensagem: ${profileError.message}`,
          profileError.code ? `Código: ${profileError.code}` : '',
          (profileError as any).details ? `Detalhes: ${(profileError as any).details}` : '',
          (profileError as any).hint ? `Dica: ${(profileError as any).hint}` : '',
          `Sessão criada no signUp: ${temSessao ? 'SIM' : 'NÃO'}`,
          `Projeto Supabase em uso: ${urlAtual}`,
        ].filter(Boolean).join(' | ');

        console.error('Erro detalhado ao criar perfil:', detalhes);
        return { ok: false, error: detalhes };
      }

      const profile: UserProfile = {
        id: signUpData.user.id,
        email: clean,
        name: name.trim(),
        role,
        accountType,
        scopeKey,
        companyName,
        createdAt: new Date().toISOString(),
      };

      const uiPrefs = storageGet<UIPrefs>(KEYS.ui(clean), { theme: 'dark', language: 'pt', sidebarOpen: true });

      set({
        currentUser: profile,
        accessToken: signUpData.session?.access_token ?? null,
        leads: [],
        alerts: [],
        theme: uiPrefs.theme,
        language: uiPrefs.language,
        sidebarOpen: uiPrefs.sidebarOpen,
      });

      await get().addAlert({
        type: 'success',
        title: 'Bem-vindo ao CorçaCRM!',
        message: `Olá, ${profile.name}! Seu pipeline está pronto. ${role === 'owner' ? '👑 Você é o administrador desta conta.' : ''}`,
      });

      return { ok: true };
    },

    login: async (email, password) => {
      const clean = email.toLowerCase().trim();

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: clean,
        password,
      });

      if (signInError || !signInData.user) {
        return { ok: false, error: 'Email ou senha incorretos.' };
      }

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signInData.user.id)
        .single();

      if (profileError || !profileRow) {
        return { ok: false, error: 'Perfil não encontrado. Contate o administrador.' };
      }

      const profile = mapProfileRow(profileRow);
      const uiPrefs = storageGet<UIPrefs>(KEYS.ui(clean), { theme: 'dark', language: 'pt', sidebarOpen: true });

      set({
        currentUser: profile,
        accessToken: signInData.session?.access_token ?? null,
        theme: uiPrefs.theme,
        language: uiPrefs.language,
        sidebarOpen: uiPrefs.sidebarOpen,
      });

      await get().loadLeads();
      await get().loadAlerts();

      return { ok: true };
    },

    logout: async () => {
      const { currentUser, theme, language, sidebarOpen } = get();
      if (currentUser) {
        saveUIPrefsInternal(currentUser.email, { theme, language, sidebarOpen });
      }

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.error('Erro ao encerrar sessão no Supabase (logout local prosseguirá mesmo assim):', err);
      }

      if (typeof window !== 'undefined') {
        try {
          Object.keys(localStorage)
            .filter((key) => key.startsWith('sb-') && key.includes('-auth-token'))
            .forEach((key) => localStorage.removeItem(key));
        } catch (err) {
          console.error('Erro na limpeza manual de sessão:', err);
        }
      }

      set({
        currentUser: null,
        accessToken: null,
        leads: [],
        alerts: [],
      });
    },

    changePassword: async (newPassword) => {
      if (newPassword.length < 6) {
        return { ok: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },

    // ── Leads ─────────────────────────────────────────────────────────────────

    loadLeads: async () => {
      const { currentUser } = get();
      if (!currentUser) return;

      const { data: leadRows, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('scope_key', currentUser.scopeKey)
        .order('created_at', { ascending: true });

      if (leadsError || !leadRows) {
        console.error('Erro ao carregar leads:', leadsError);
        return;
      }

      const leadIds = leadRows.map((r: any) => r.id);
      const activitiesByLead: Record<string, Activity[]> = {};

      if (leadIds.length > 0) {
        const { data: activityRows, error: activitiesError } = await supabase
          .from('activities')
          .select('*')
          .in('lead_id', leadIds)
          .order('date', { ascending: true });

        if (!activitiesError && activityRows) {
          for (const row of activityRows) {
            const activity = mapActivityRow(row);
            const leadId = row.lead_id as string;
            if (!activitiesByLead[leadId]) activitiesByLead[leadId] = [];
            activitiesByLead[leadId].push(activity);
          }
        }
      }

      const leads = leadRows.map((row: any) => mapLeadRow(row, activitiesByLead[row.id] ?? []));
      set({ leads });
    },

    addLead: async (data) => {
      const { currentUser } = get();
      if (!currentUser) return;

      const insertPayload = {
        scope_key: currentUser.scopeKey,
        nome: data.nome,
        cargo: data.cargo,
        email_corporativo: data.emailCorporativo,
        telefone_celular: data.telefoneCelular,
        telefone_fixo: data.telefoneFixo,
        nome_empresa: data.nomeEmpresa,
        cnpj: data.cnpj,
        linkedin: data.linkedin,
        stage: data.stage,
        temperatura: data.temperatura,
        valor_proposta: data.valorProposta ?? 0,
        probabilidade: STAGE_PROBABILITY[data.stage],
        motivo_perda: data.motivoPerda ?? null,
        created_by_user_id: currentUser.id,
      };

      const { data: inserted, error } = await supabase
        .from('leads')
        .insert(insertPayload)
        .select()
        .single();

      if (error || !inserted) {
        console.error('Erro ao criar lead:', error);
        return;
      }

      const newLead = mapLeadRow(inserted, []);
      set({ leads: [...get().leads, newLead] });

      if (data.temperatura === 'quente') {
        await get().addAlert({
          type: 'warning',
          title: '🔥 Lead Quente adicionado',
          message: `${data.nome} (${data.nomeEmpresa}) está marcado como QUENTE. Entre em contato hoje!`,
          leadId: newLead.id,
        });
      }
    },

    updateLead: async (id, data) => {
      const { currentUser, leads } = get();
      if (!currentUser) return;

      const leadAtual = leads.find((l) => l.id === id);

      const perdaSendoPreenchida = data.motivoPerda !== undefined && data.motivoPerda.trim() !== '';
      const deveMoverParaFimDeCadencia =
        perdaSendoPreenchida && leadAtual?.stage === 'reuniao' && data.stage === undefined;

      const finalData = deveMoverParaFimDeCadencia
        ? { ...data, stage: 'fim_cadencia' as Stage }
        : data;

      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (finalData.nome !== undefined) payload.nome = finalData.nome;
      if (finalData.cargo !== undefined) payload.cargo = finalData.cargo;
      if (finalData.emailCorporativo !== undefined) payload.email_corporativo = finalData.emailCorporativo;
      if (finalData.telefoneCelular !== undefined) payload.telefone_celular = finalData.telefoneCelular;
      if (finalData.telefoneFixo !== undefined) payload.telefone_fixo = finalData.telefoneFixo;
      if (finalData.nomeEmpresa !== undefined) payload.nome_empresa = finalData.nomeEmpresa;
      if (finalData.cnpj !== undefined) payload.cnpj = finalData.cnpj;
      if (finalData.linkedin !== undefined) payload.linkedin = finalData.linkedin;
      if (finalData.stage !== undefined) payload.stage = finalData.stage;
      if (finalData.temperatura !== undefined) payload.temperatura = finalData.temperatura;
      if (finalData.valorProposta !== undefined) payload.valor_proposta = finalData.valorProposta;
      if (finalData.motivoPerda !== undefined) payload.motivo_perda = finalData.motivoPerda;
      if (finalData.motivoSemReuniao !== undefined) payload.motivo_sem_reuniao = finalData.motivoSemReuniao;

      const { error } = await supabase.from('leads').update(payload).eq('id', id);
      if (error) {
        console.error('Erro ao atualizar lead:', error);
        return;
      }

      const next = leads.map((l) => (l.id === id ? { ...l, ...finalData, updatedAt: new Date().toISOString() } : l));
      set({ leads: next });
    },

    moveLead: async (id, stage) => {
      const { currentUser, leads } = get();
      if (!currentUser) return;

      const probabilidade = STAGE_PROBABILITY[stage];

      const { error } = await supabase
        .from('leads')
        .update({ stage, probabilidade, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Erro ao mover lead:', error);
        return;
      }

      const next = leads.map((l) =>
        l.id === id ? { ...l, stage, probabilidade, updatedAt: new Date().toISOString() } : l
      );
      set({ leads: next });

      const lead = leads.find((l) => l.id === id);
      if (stage === 'fim_cadencia' && lead) {
        await get().addAlert({
          type: 'success',
          title: '🎉 Lead avançou para Fim de Cadência!',
          message: `${lead.nome} está pronto para proposta. Agende o fechamento!`,
          leadId: id,
        });
      }
    },

    deleteLead: async (id) => {
      const { currentUser, leads } = get();
      if (!currentUser) return;

      const { data, error } = await supabase.from('leads').delete().eq('id', id).select();

      if (error) {
        console.error('Erro ao excluir lead:', error);
        alert('Não foi possível excluir este lead. Você pode não ter permissão para isso.');
        return;
      }

      if (!data || data.length === 0) {
        console.warn('Exclusão bloqueada por permissão: nenhum lead foi removido no banco.', id);
        alert('Não foi possível excluir este lead (sem permissão). Fale com o administrador da conta.');
        return;
      }

      set({ leads: leads.filter((l) => l.id !== id) });
    },

    deleteLeads: async (ids) => {
      const { currentUser, leads } = get();
      if (!currentUser || ids.length === 0) return;

      const { data, error } = await supabase.from('leads').delete().in('id', ids).select();

      if (error) {
        console.error('Erro ao excluir leads em lote:', error);
        alert('Não foi possível excluir os leads selecionados.');
        return;
      }

      const deletedIds = new Set((data ?? []).map((row: any) => row.id));

      if (deletedIds.size === 0) {
        console.warn('Exclusão em lote bloqueada por permissão: nenhum lead foi removido no banco.');
        alert('Não foi possível excluir os leads selecionados (sem permissão).');
        return;
      }

      if (deletedIds.size < ids.length) {
        console.warn(`Apenas ${deletedIds.size} de ${ids.length} leads foram excluídos (permissão parcial).`);
      }

      set({ leads: leads.filter((l) => !deletedIds.has(l.id)) });
    },

    addActivity: async (leadId, type, content) => {
      const { currentUser, leads } = get();
      if (!currentUser) return;

      const { data: inserted, error } = await supabase
        .from('activities')
        .insert({ lead_id: leadId, type, content, user_id: currentUser.id })
        .select()
        .single();

      if (error || !inserted) {
        console.error('Erro ao registrar atividade:', error);
        return;
      }

      const activity = mapActivityRow(inserted);

      const next = leads.map((l) =>
        l.id === leadId
          ? { ...l, activities: [...l.activities, activity], updatedAt: new Date().toISOString() }
          : l
      );
      set({ leads: next });

      supabase.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', leadId).then();

      if (isFailedContactAttempt(content)) {
        const lead = next.find((l) => l.id === leadId);
        await get().addAlert({
          type: 'warning',
          title: '📞 Retornar ligação',
          message: `A tentativa de contato com ${lead?.nome ?? 'este lead'}${lead?.nomeEmpresa ? ` (${lead.nomeEmpresa})` : ''} não teve sucesso. Lembre-se de retornar a ligação.`,
          leadId,
        });
      }

      if (type === 'reuniao' || isMeetingScheduled(content)) {
        const leadAtual = next.find((l) => l.id === leadId);
        if (leadAtual && leadAtual.stage !== 'reuniao') {
          await get().moveLead(leadId, 'reuniao');
        }
        await get().addAlert({
          type: 'success',
          title: '📅 Reunião agendada',
          message: `Reunião agendada com sucesso para o lead ${leadAtual?.nome ?? ''}`,
          leadId,
        });
      }
    },

    // ── Alerts ────────────────────────────────────────────────────────────────

    loadAlerts: async () => {
      const { currentUser } = get();
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('profile_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar alertas:', error);
        return;
      }

      set({ alerts: (data ?? []).map(mapAlertRow) });
    },

    markAlertRead: async (id) => {
      const { error } = await supabase.from('alerts').update({ read: true }).eq('id', id);
      if (error) {
        console.error('Erro ao ler alerta:', error);
        return;
      }
      set({ alerts: get().alerts.map((a) => (a.id === id ? { ...a, read: true } : a)) });
    },

    dismissAlert: async (id) => {
      const { error } = await supabase.from('alerts').delete().eq('id', id);
      if (error) {
        console.error('Erro ao descartar alerta:', error);
        return;
      }
      set({ alerts: get().alerts.filter((a) => a.id !== id) });
    },

    markAllRead: async () => {
      const { currentUser } = get();
      if (!currentUser) return;

      const { error } = await supabase.from('alerts').update({ read: true }).eq('profile_id', currentUser.id);
      if (error) {
        console.error('Erro ao ler alertas em lote:', error);
        return;
      }
      set({ alerts: get().alerts.map((a) => ({ ...a, read: true })) });
    },

    addAlert: async (alert) => {
      const { currentUser } = get();
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('alerts')
        .insert({
          profile_id: currentUser.id,
          type: alert.type,
          title: alert.title,
          message: alert.message,
          lead_id: alert.leadId,
          read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao registrar alerta no banco:', error);
        return;
      }

      set({ alerts: [mapAlertRow(data), ...get().alerts] });
    },

    // ── UI ────────────────────────────────────────────────────────────────────

    setTheme: (theme) => {
      const { currentUser, language, sidebarOpen } = get();
      set({ theme });
      if (currentUser) {
        saveUIPrefsInternal(currentUser.email, { theme, language, sidebarOpen });
      }
    },

    toggleTheme: () => {
      const { currentUser, theme, language, sidebarOpen } = get();
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      set({ theme: nextTheme });
      if (currentUser) {
        saveUIPrefsInternal(currentUser.email, { theme: nextTheme, language, sidebarOpen });
      }
    },

    setLanguage: (language) => {
      const { currentUser, theme, sidebarOpen } = get();
      set({ language });
      if (currentUser) {
        saveUIPrefsInternal(currentUser.email, { theme, language, sidebarOpen });
      }
    },

    setSidebarOpen: (sidebarOpen) => {
      const { currentUser, theme, language } = get();
      set({ sidebarOpen });
      if (currentUser) {
        saveUIPrefsInternal(currentUser.email, { theme, language, sidebarOpen });
      }
    },

    // ── Team ──────────────────────────────────────────────────────────────────

    getCompanyMembers: async () => {
      const { currentUser } = get();
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('scope_key', currentUser.scopeKey);

      if (error) {
        console.error('Erro ao buscar membros:', error);
        return [];
      }

      return (data ?? []).map(mapProfileRow);
    },

    inviteTeamMember: async (email, name, role, password) => {
      const { currentUser } = get();
      if (!currentUser) return { ok: false, error: 'Usuário não autenticado.' };

      const clean = email.toLowerCase().trim();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: clean,
        password,
      });

      if (signUpError || !signUpData.user) {
        return { ok: false, error: signUpError?.message || 'Erro ao criar conta do vendedor.' };
      }

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: signUpData.user.id,
          email: clean,
          name: name.trim(),
          role,
          account_type: currentUser.accountType,
          scope_key: currentUser.scopeKey,
          company_name: currentUser.companyName,
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        console.error('Erro ao criar perfil do vendedor convidado:', profileError);
        return { ok: false, error: profileError.message };
      }

      return { ok: true };
    },
  };
});