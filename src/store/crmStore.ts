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

  addLead: (lead: Omit<Lead, 'id' | 'activities' | 'userId' | 'createdAt'>) => void;
  updateLead: (id: string, updates: Partial<Omit<Lead, 'id' | 'userId' | 'createdAt'>>) => void;
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

const seedLeads = (): Lead[] => {
  const now = new Date().toISOString();
  return [
    {
      id: '1', nome: 'Roberto Silva', cargo: 'CEO', emailCorporativo: 'roberto@acme.com',
      telefoneCelular: '+55 11 99999-0001', telefoneFixo: '', nomeEmpresa: 'Acme Corp',
      cnpj: '', linkedin: '', stage: 'entrada', temperatura: 'morno',
      valorProposta: 15000, activities: [], userId: 'system', createdAt: now,
    },
    {
      id: '2', nome: 'Ana Costa', cargo: 'CTO', emailCorporativo: 'ana@techsol.com',
      telefoneCelular: '+55 11 99999-0002', telefoneFixo: '', nomeEmpresa: 'TechSolutions',
      cnpj: '', linkedin: '', stage: 'reuniao', temperatura: 'quente',
      valorProposta: 48000, activities: [], userId: 'system', createdAt: now,
    },
  ];
};

const seedAlerts = (): Alert[] => [
  { id: 'a1', type: 'warning', message: 'Lead "Ana Costa" está há 5 dias sem contato.', read: false },
  { id: 'a2', type: 'success', message: 'Negócio de R$ 48.000 movido para Reunião.', read: false },
  { id: 'a3', type: 'info', message: '2 novos leads importados via Excel.', read: true },
];

export const useCRMStore = create<CRMState>()(
  persist(
    (set, get) => ({
      leads: seedLeads(),
      alerts: seedAlerts(),
      theme: 'dark',
      currentLanguage: 'pt',
      currentUser: null,
      registeredUsers: [],

      addLead: (newLead) => set((state) => {
        const currentUser = state.currentUser;
        const userId = currentUser?.id || 'system';
        return {
          leads: [
            ...state.leads,
            {
              ...newLead,
              valorProposta: newLead.valorProposta ?? 0,
              id: Math.random().toString(36).substring(2, 9),
              activities: [],
              userId,
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
          if (typeof window !== 'undefined') {
            localStorage.setItem('crm_current_user', user.email);
            localStorage.setItem('crm_session_active', 'true');
          }
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
        const company = domain.split('.')[0].toUpperCase();
        const newUser: User = {
          id: Math.random().toString(36).substring(2, 9),
          email: cleanEmail,
          role: 'admin_principal',
          empresa: company,
        };
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('crm_current_user', newUser.email);
          localStorage.setItem('crm_session_active', 'true');
        }

        set({
          registeredUsers: [...state.registeredUsers, newUser],
          currentUser: newUser,
        });
        return true;
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('crm_current_user');
          localStorage.removeItem('crm_session_active');
        }
        set({ currentUser: null });
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      },

      clearStorage: () => set({ leads: [], alerts: [] }),

      registerVendedor: (email, nomeVendedor) => {
        const state = get();
        const admin = state.currentUser;
        if (!admin || admin.role !== 'admin_principal') {
          return { success: false, message: 'Apenas Administradores Principais podem criar vendedores.' };
        }

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
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(`crm_pwd_${cleanEmail}`, '123456');
          localStorage.setItem(`crm_name_${cleanEmail}`, nomeVendedor);
        }

        return { success: true, message: `Vendedor ${nomeVendedor} adicionado com sucesso à empresa ${admin.empresa}!` };
      },

      getCompanyUsers: () => {
        const state = get();
        if (!state.currentUser) return [];
        return state.registeredUsers.filter((u) => u.empresa === state.currentUser?.empresa);
      },

      getCompanyLeads: () => {
        const state = get();
        const user = state.currentUser;
        if (!user) return [];

        const companyUserIds = state.registeredUsers
          .filter((u) => u.empresa === user.empresa)
          .map((u) => u.id);

        if (user.role === 'vendedor' || user.role === 'usuario' || user.role === 'User') {
          return state.leads.filter((l) => l.userId === user.id);
        }

        if (user.role === 'admin_principal') {
          return state.leads.filter((l) => 
            companyUserIds.includes(l.userId) || 
            l.userId === user.id || 
            l.userId === 'system' || 
            !l.userId
          );
        }

        return state.leads.filter((l) => companyUserIds.includes(l.userId));
      }
    }),
    {
      name: 'corca_crm_storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const activeUser = localStorage.getItem('crm_current_user');
          const tenantKey = activeUser ? `${name}_${btoa(activeUser).replace(/=/g, '')}` : name;
          return localStorage.getItem(tenantKey);
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          const activeUser = localStorage.getItem('crm_current_user');
          const tenantKey = activeUser ? `${name}_${btoa(activeUser).replace(/=/g, '')}` : name;
          localStorage.setItem(tenantKey, value);
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return;
          const activeUser = localStorage.getItem('crm_current_user');
          const tenantKey = activeUser ? `${name}_${btoa(activeUser).replace(/=/g, '')}` : name;
          localStorage.removeItem(tenantKey);
        }
      }))
    }
  ]
);