'use client';

/**
 * CorçaCRM — Store v4 (Supabase — persistência real entre navegadores/dispositivos)
 *
 * ARQUITETURA:
 * - Autenticação e dados agora vivem no Supabase (Postgres + Auth), não mais no localStorage.
 * - A visibilidade de leads é garantida em duas camadas:
 *   1) Row Level Security no banco (fonte da verdade — não pode ser burlada pelo cliente)
 *   2) Os selects já vêm filtrados: owner/admin recebem todos os leads da empresa,
 *      vendedor recebe apenas os leads que ele mesmo criou.
 * - Preferências de UI (tema/idioma) continuam no localStorage por serem dados
 *   não sensíveis e não precisarem sincronizar entre dispositivos.
 * - A interface pública do store (nomes de funções e campos) foi mantida igual
 *   à versão anterior — nenhum componente que consome o store precisa mudar.
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
// Não é um dado novo salvo no banco — é calculado a partir das atividades que
// já existem, olhando a atividade mais recente do lead.

export type LeadCardStatus = 'perdido_pos_reuniao' | 'reuniao_marcada' | 'retornar_ligacao' | 'normal';

export function getLeadCardStatus(lead: Lead): LeadCardStatus {
  // Prioridade máxima: lead perdido (motivoPerda preenchido). Como a
  // automação move o lead para "Fim de Cadência" assim que a reunião é
  // perdida, não dependemos mais da etapa atual para manter o card vermelho.
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

// ─── Preferências de UI (continuam locais — não sensíveis, não precisam sincronizar)

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
    // storage full or blocked
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

      // ── ALTERADO: role calculado ANTES do signUp para poder ser enviado
      // como metadata. Assim, o gatilho do banco (handle_new_user) já cria
      // o perfil com os dados CORRETOS desde o primeiro instante — funciona
      // igual, esteja a confirmação de e-mail ligada ou desligada. ──
      const { data: countInScope } = await supabase.rpc('count_profiles_in_scope', { p_scope_key: scopeKey });
      const role: UserRole = (countInScope ?? 0) === 0 ? 'owner' : 'vendedor';

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: clean,
        password,
        options: {
          data: {
            name: name.trim(),
            role,
            account_type: accountType,
            scope_key: scopeKey,
            company_name: companyName,
          },
        },
      });

      if (signUpError || !signUpData.user) {
        const msg = signUpError?.message?.toLowerCase() ?? '';
        if (msg.includes('already registered') || msg.includes('already exists')) {
          return { ok: false, error: 'Este email já está cadastrado. Faça login.' };
        }
        return { ok: false, error: signUpError?.message || 'Erro ao cadastrar.' };
      }

      // upsert em vez de insert: se já existir uma linha para este id (por
      // exemplo, criada pelo gatilho automático do banco), ATUALIZAMOS
      // com os dados corretos em vez de travar tentando criar duplicata.
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
        return { ok: false, error: profileError.message };
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
        saveUIPrefs(currentUser.email, { theme, language, sidebarOpen });
      }

      // scope: 'local' limpa a sessão salva neste navegador sem depender de
      // uma chamada de rede bem-sucedida ao servidor — evita que uma falha
      // de rede deixe o token antigo "preso" no localStorage.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.error('Erro ao encerrar sessão no Supabase (logout local prosseguirá mesmo assim):', err);
      }

      // Limpeza manual de segurança: garante que nenhum resquício de sessão
      // fique salvo, mesmo que o signOut() acima falhe silenciosamente por
      // qualquer motivo (garante que a tela de login não "puxe" a sessão
      // antiga de volta).
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

      // ── ALTERADO: redirecionamento feito AQUI DENTRO, no próprio store —
      // garante que o usuário só é levado para a tela de login DEPOIS que a
      // sessão já foi completamente limpa, não importa qual botão/tela
      // chamou o logout() (Sidebar, Configurações, evento customizado, etc). ──
      if (typeof window !== 'undefined') {
        window.location.replace('/');
      }
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

      // 📉 Automação: reunião perdida → move automaticamente para "Fim de Cadência"
      // Só dispara quando o motivo de perda está sendo preenchido agora E o
      // lead ainda está na etapa "Reunião".
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

      // .select() após o delete devolve as linhas que realmente foram excluídas.
      // Se vier vazio, a exclusão foi bloqueada (ex.: permissão) e não devemos
      // remover o card da tela — senão ele "volta" no próximo carregamento.
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

      // Atualiza o updated_at do lead no banco (best-effort, não bloqueia a UI)
      supabase.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', leadId).then();

      // 🔔 Alerta automático: ligação sem sucesso → lembrete de retorno
      if (isFailedContactAttempt(content)) {
        const lead = next.find((l) => l.id === leadId);
        await get().addAlert({
          type: 'warning',
          title: '📞 Retornar ligação',
          message: `A tentativa de contato com ${lead?.nome ?? 'este lead'}${lead?.nomeEmpresa ? ` (${lead.nomeEmpresa})` : ''} não teve sucesso. Lembre-se de retornar a ligação.`,
          leadId,
        });
      }

      // 📅 Automação: reunião marcada → move o card para a etapa "Reunião" + alerta
      if (type === 'reuniao' || isMeetingScheduled(content)) {
        const leadAtual = next.find((l) => l.id === leadId);
        if (leadAtual && leadAtual.stage !== 'reuniao') {
          await get().moveLead(leadId, 'reuniao');
        }
        await get().addAlert({
          type: 'success',
          title: '📅 Reunião agendada',
          message: `Reunião marcada com ${leadAtual?.nome ?? 'este lead'}${leadAtual?.nomeEmpresa ? ` (${leadAtual.nomeEmpresa})` : ''}. O card foi movido para a etapa Reunião.`,
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
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (error || !data) return;
      set({ alerts: data.map(mapAlertRow) });
    },

    addAlert: async (data) => {
      const { currentUser, alerts } = get();
      if (!currentUser) return;

      const { data: inserted, error } = await supabase
        .from('alerts')
        .insert({
          user_id: currentUser.id,
          type: data.type,
          title: data.title,
          message: data.message,
          lead_id: data.leadId ?? null,
          read: false,
        })
        .select()
        .single();

      if (error || !inserted) {
        console.error('Erro ao criar alerta:', error);
        return;
      }

      set({ alerts: [...alerts, mapAlertRow(inserted)] });
    },

    markAlertRead: async (id) => {
      const { currentUser, alerts } = get();
      if (!currentUser) return;
      const { error } = await supabase.from('alerts').update({ read: true }).eq('id', id);
      if (error) return;
      set({ alerts: alerts.map((a) => (a.id === id ? { ...a, read: true } : a)) });
    },

    dismissAlert: async (id) => {
      const { currentUser, alerts } = get();
      if (!currentUser) return;
      const { error } = await supabase.from('alerts').delete().eq('id', id);
      if (error) return;
      set({ alerts: alerts.filter((a) => a.id !== id) });
    },

    markAllRead: async () => {
      const { currentUser, alerts } = get();
      if (!currentUser) return;
      const { error } = await supabase.from('alerts').update({ read: true }).eq('user_id', currentUser.id);
      if (error) return;
      set({ alerts: alerts.map((a) => ({ ...a, read: true })) });
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

    getCompanyMembers: async () => {
      const { currentUser } = get();
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('scope_key', currentUser.scopeKey);

      if (error || !data) return [];
      return data.map(mapProfileRow);
    },

    inviteTeamMember: async (email, name, role, password) => {
      const { currentUser, accessToken } = get();
      if (!currentUser || !accessToken) return { ok: false, error: 'Não autenticado.' };
      if (currentUser.role !== 'owner' && currentUser.role !== 'admin') {
        return { ok: false, error: 'Apenas admins podem convidar membros.' };
      }

      try {
        const res = await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, password, role, accessToken }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          return { ok: false, error: json.error || 'Erro ao criar usuário.' };
        }
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Erro de conexão.' };
      }
    },
  };
});

// ─── Session Restore (call this in app root) ───────────────────────────────────

export async function restoreSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return false;

  const { data: profileRow, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profileRow) return false;

  const profile = mapProfileRow(profileRow);
  const uiPrefs = storageGet<UIPrefs>(KEYS.ui(profile.email), { theme: 'dark', language: 'pt', sidebarOpen: true });

  useCRMStore.setState({
    currentUser: profile,
    accessToken: session.access_token,
    theme: uiPrefs.theme,
    language: uiPrefs.language,
    sidebarOpen: uiPrefs.sidebarOpen,
  });

  await useCRMStore.getState().loadLeads();
  await useCRMStore.getState().loadAlerts();

  return true;
}

// ─── Daily alert automation ────────────────────────────────────────────────────

export function runDailyAlertAutomation(): void {
  const state = useCRMStore.getState();
  const { currentUser, leads, addAlert } = state;
  if (!currentUser) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const lastRun = storageGet<string>(`corca_v3::automation::${currentUser.id}`, '');
  if (lastRun === todayStr) return;
  storageSet(`corca_v3::automation::${currentUser.id}`, todayStr);

  const myLeads = leads;

  // 🔄 Leads perdidos após reunião há 4+ meses → sugerir retomar contato
  const FOUR_MONTHS_MS = 4 * 30 * 24 * 60 * 60 * 1000;
  const lostAfterMeetingToRevisit = myLeads.filter((l) => {
    if (!(l.motivoPerda && l.motivoPerda.trim() !== '')) return false;
    const lostSince = new Date(l.updatedAt).getTime();
    return Date.now() - lostSince >= FOUR_MONTHS_MS;
  });

  if (lostAfterMeetingToRevisit.length > 0) {
    addAlert({
      type: 'info',
      title: `🔄 ${lostAfterMeetingToRevisit.length} lead(s) perdido(s) há 4+ meses`,
      message: `Pode ser hora de retomar contato: ${lostAfterMeetingToRevisit.slice(0, 3).map((l) => l.nome).join(', ')}${lostAfterMeetingToRevisit.length > 3 ? ` e mais ${lostAfterMeetingToRevisit.length - 3}` : ''}. Talvez haja uma nova oportunidade.`,
    });
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const staleLeads = myLeads.filter((l) => {
    const lastActivity = l.activities.length > 0
      ? new Date(l.activities[l.activities.length - 1].date)
      : new Date(l.createdAt);
    return lastActivity < threeDaysAgo && l.stage !== 'fim_cadencia';
  });

  if (staleLeads.length > 0) {
    addAlert({
      type: 'warning',
      title: `⏰ ${staleLeads.length} leads sem atividade há 3+ dias`,
      message: `Leads parados: ${staleLeads.slice(0, 3).map((l) => l.nome).join(', ')}${staleLeads.length > 3 ? ` e mais ${staleLeads.length - 3}` : ''}. Faça follow-up hoje!`,
    });
  }

  const hotNoContact = myLeads.filter((l) => {
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
      message: `Não perca oportunidades quentes! Entre em contato agora: ${hotNoContact.slice(0, 2).map((l) => l.nome).join(', ')}.`,
    });
  }

  if (today.getDay() === 1) {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const callsLastWeek = myLeads.reduce((sum, l) =>
      sum + l.activities.filter((a) => a.type === 'telefone' && new Date(a.date) > lastWeek).length, 0);
    const meetingsLastWeek = myLeads.filter((l) =>
      l.stage === 'reuniao' || l.activities.some((a) => a.type === 'reuniao' && new Date(a.date) > lastWeek)).length;

    addAlert({
      type: 'info',
      title: '📊 Resumo semanal',
      message: `Semana passada: ${callsLastWeek} ligações, ${meetingsLastWeek} reuniões agendadas. Meta: 100 ligações e 6 reuniões/semana.`,
    });

    const noMeeting = myLeads.filter((l) =>
      l.stage === 'entrada' || l.stage === 'enriquecer'
    ).filter((l) => {
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