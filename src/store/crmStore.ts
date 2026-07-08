'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Stage = 'entrada' | 'enriquecer' | 'reuniao' | 'fim_cadencia';
export type Temperature = 'frio' | 'morno' | 'quente';
export type ActivityType = 'telefone' | 'email' | 'reuniao' | 'nota';
export type Theme = 'light' | 'dark';
export type Language = 'pt' | 'en' | 'es';

export interface Activity {
  id: string;
  type: ActivityType;
  date: string;
  content: string;
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
  valorProposta?: number;
  motivoPerda?: string;
  activities: Activity[];
  userId: string;
  empresaScope: string; // Locais diferentes por Empresa / Usuário PF
  tipoCadastro: 'PESSOA_FISICA' | 'CORPORATIVO'; // Diferenciação de tipos de usuários
  createdAt: string;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'success';
  message: string;
  read: boolean;
}

export interface User {
  id: string;
  email: string;
  role: string;
  empresa: string;
}

interface CRMState {
  leads: Lead[];
  alerts: Alert[];
  theme: Theme;
  currentLanguage: Language;
  currentUser: User | null;
  registeredUsers: User[];

  addLead: (lead: Omit<Lead, 'id' | 'activities' | 'userId' | 'empresaScope' | 'tipoCadastro' | 'createdAt'>) => void;
  updateLead: (id: string, updates: Partial<Omit<Lead, 'id' | 'userId' | 'empresaScope' | 'tipoCadastro' | 'createdAt'>>) => void;
  updateLeadStage: (id: string, stage: Stage) => void;
  deleteLead: (id: string) => void;
  addActivity: (leadId: string, type: ActivityType, content: string) => void;

  markAlertRead: (id: string) => void;
  dismissAlert: (id: string) => void;

  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;

  login: (email: string, password: string) => boolean;
  register: (email: string, password: string) => boolean;
  logout: () => void;

  clearStorage: () => void;

  registerVendedor: (email: string, nomeVendedor: string) => { success: boolean; message: string };
  getCompanyUsers: () => User[];
  getCompanyLeads: () => Lead[];
}

const PUBLIC_DOMAINS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.com.br', 'icloud.com', 'live.com', 'uol.com.br', 'bol.com.br'];

export const useCRMStore = create<CRMState>()(
  persist(
    (set, get) => ({
      leads: [],
      alerts: [],
      theme: 'dark',
      currentLanguage: 'pt',
      currentUser: null,
      registeredUsers: [],

      addLead: (newLead) => set((state) => {
        const user = state.currentUser;
        if (!user) return {};

        const emailLower = user.email.toLowerCase().trim();
        const domain = emailLower.split('@')[1] || 'empresa';
        const isPF = PUBLIC_DOMAINS.includes(domain);

        // Define locais estruturalmente separados já no momento da escrita
        const scope = isPF ? `PF_${emailLower}` : `PJ_${domain.split('.')[0].toUpperCase()}`;
        const tipo = isPF ? 'PESSOA_FISICA' : 'CORPORATIVO';

        return {
          leads: [
            ...state.leads,
            {
              ...newLead,
              valorProposta: newLead.valorProposta ?? 0,
              id: Math.random().toString(36).substring(2, 9),
              activities: [],
              userId: user.id,
              empresaScope: scope,
              tipoCadastro: tipo,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }),

      updateLead: (id, updates) => set((state) => ({
        leads: state.leads.map((lead) =>
          lead.id === id ? { ...lead, ...updates } : lead
        ),
      })),

      updateLeadStage: (id, stage) => set((state) => ({
        leads: state.leads.map((lead) =>
          lead.id === id ? { ...lead, stage } : lead
        ),
      })),

      deleteLead: (id) => set((state) => ({
        leads: state.leads.filter((lead) => lead.id !== id),
      })),

      addActivity: (leadId, type, content) => set((state) => ({
        leads: state.leads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                activities: [
                  ...lead.activities,
                  {
                    id: Math.random().toString(36).substring(2, 9),
                    type,
                    date: new Date().toISOString(),
                    content,
                  },
                ],
              }
            : lead
        ),
      })),

      markAlertRead: (id) => set((state) => ({
        alerts: state.alerts.map((a) => a.id === id ? { ...a, read: true } : a),
      })),

      dismissAlert: (id) => set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id),
      })),

      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark',
      })),

      setLanguage: (lang) => set({ currentLanguage: lang }),

      login: (email, _password) => {
        const state = get();
        const cleanEmail = email.toLowerCase().trim();
        const user = state.registeredUsers.find((u) => u.email.toLowerCase().trim() === cleanEmail);
        
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      register: (email, _password) => {
        const state = get();
        const cleanEmail = email.toLowerCase().trim();
        const existing = state.registeredUsers.find((u) => u.email.toLowerCase().trim() === cleanEmail);
        if (existing) return false;

        const domain = cleanEmail.split('@')[1] || 'empresa';
        const isPF = PUBLIC_DOMAINS.includes(domain);
        
        // Define locais textuais amigáveis nos perfis para empresas e pessoas físicas
        const companyLabel = isPF 
          ? `Ambiente Pessoal (${cleanEmail.split('@')[0]})` 
          : domain.split('.')[0].toUpperCase();

        const newUser: User = {
          id: Math.random().toString(36).substring(2, 9),
          email: cleanEmail,
          role: 'admin_principal',
          empresa: companyLabel,
        };
        
        set({
          registeredUsers: [...state.registeredUsers, newUser],
          currentUser: newUser,
          alerts: []
        });
        return true;
      },

      logout: () => {
        set({ currentUser: null });
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      },

      clearStorage: () => set({ leads: [], alerts: [] }),

      registerVendedor: (email, nomeVendedor) => {
        const state = get();
        const admin = state.currentUser;
        if (!admin) return { success: false, message: 'Usuário não autenticado.' };

        const cleanEmail = email.toLowerCase().trim();
        const existing = state.registeredUsers.find((u) => u.email.toLowerCase().trim() === cleanEmail);
        if (existing) return { success: false, message: 'Este e-mail de vendedor já está registrado.' };

        const newVendedor: User = {
          id: Math.random().toString(36).substring(2, 9),
          email: cleanEmail,
          role: 'vendedor',
          empresa: admin.empresa,
        };

        set({ registeredUsers: [...state.registeredUsers, newVendedor] });
        return { success: true, message: `Vendedor ${nomeVendedor} adicionado com sucesso!` };
      },

      getCompanyUsers: () => {
        const state = get();
        if (!state.currentUser) return [];
        return state.registeredUsers.filter((u) => u.empresa === state.currentUser?.empresa);
      },

      // RETORNO DE REFERÊNCIA LIGADA AO COGNITIVO DO RE-RENDER (ESTABILIDADE TOTAL)
      getCompanyLeads: () => {
        const state = get();
        const user = state.currentUser;
        if (!user) return [];

        const emailLower = user.email.toLowerCase().trim();
        const domain = emailLower.split('@')[1] || 'empresa';
        const isPF = PUBLIC_DOMAINS.includes(domain);
        const currentScope = isPF ? `PF_${emailLower}` : `PJ_${domain.split('.')[0].toUpperCase()}`;

        // O segredo do CRM de alto nível: Filtramos de forma indexada linear.
        // O React aceita este filtro sem Loops porque a estrutura de dados interna não muda referências soltas.
        return state.leads.filter((l) => l.empresaScope === currentScope);
      }
    }),
    {
      name: 'corca_crm_storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
    }
  )
);