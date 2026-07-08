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
  tipoConta: 'PF' | 'PJ';
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
        return {
          leads: [
            ...state.leads,
            {
              ...newLead,
              valorProposta: newLead.valorProposta ?? 0,
              id: Math.random().toString(36).substring(2, 9),
              activities: [],
              userId: user ? user.id : 'system',
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
        const cleanEmail = email.toLowerCase().trim();
        const domain = cleanEmail.split('@')[1] || '';
        const isPF = PUBLIC_DOMAINS.includes(domain);
        
        // Ativa dinamicamente o identificador único da gaveta deste usuário/empresa
        const tenantKey = isPF 
          ? `corca_crm_tenant_pf_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '')}`
          : `corca_crm_tenant_pj_${domain.split('.')[0].toUpperCase()}`;

        if (typeof window !== 'undefined') {
          const storedData = localStorage.getItem(tenantKey);
          if (storedData) {
            try {
              const parsed = JSON.parse(storedData);
              const targetUser = parsed.state?.registeredUsers?.find(
                (u: any) => u.email.toLowerCase().trim() === cleanEmail
              );

              if (targetUser) {
                // Seleciona a partição exclusiva e reconstrói o estado imediatamente
                localStorage.setItem('corca_crm_active_tenant_key', tenantKey);
                set({
                  currentUser: targetUser,
                  registeredUsers: parsed.state.registeredUsers || [],
                  leads: parsed.state.leads || [],
                  alerts: parsed.state.alerts || []
                });
                return true;
              }
            } catch (e) {
              console.error(e);
            }
          }
        }

        // Fallback global legível para transição suave
        const state = get();
        const globalUser = state.registeredUsers.find((u) => u.email.toLowerCase().trim() === cleanEmail);
        if (globalUser) {
          set({ currentUser: globalUser });
          return true;
        }
        return false;
      },

      register: (email, _password) => {
        const cleanEmail = email.toLowerCase().trim();
        const domain = cleanEmail.split('@')[1] || 'empresa';
        const isPF = PUBLIC_DOMAINS.includes(domain);

        let companyName = '';
        let tipo: 'PF' | 'PJ' = 'PJ';

        if (isPF) {
          // Geração de ID amigável de exibição interna de Pessoa Física (Garante gaveta individual)
          companyName = `CONTA_PESSOAL_${cleanEmail.split('@')[0].toUpperCase()}`;
          tipo = 'PF';
        } else {
          companyName = domain.split('.')[0].toUpperCase();
          tipo = 'PJ';
        }

        const newUser: User = {
          id: Math.random().toString(36).substring(2, 9),
          email: cleanEmail,
          role: 'admin_principal',
          empresa: companyName,
          tipoConta: tipo
        };

        const tenantKey = isPF 
          ? `corca_crm_tenant_pf_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '')}`
          : `corca_crm_tenant_pj_${companyName}`;

        if (typeof window !== 'undefined') {
          localStorage.setItem('corca_crm_active_tenant_key', tenantKey);
        }

        set({
          registeredUsers: [newUser],
          currentUser: newUser,
          leads: [], 
          alerts: []
        });

        return true;
      },

      logout: () => {
        set({ currentUser: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('corca_crm_active_tenant_key');
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
          tipoConta: admin.tipoConta
        };

        set({ registeredUsers: [...state.registeredUsers, newVendedor] });
        return { success: true, message: `Vendedor ${nomeVendedor} adicionado com sucesso à organização!` };
      },

      getCompanyUsers: () => {
        return get().registeredUsers;
      },

      // RETORNO PURE ARRAY ESTÁTICO (ANTI-LOOP):
      // Isolado nativamente pelo interceptor do Storage na inicialização.
      getCompanyLeads: () => {
        const state = get();
        const user = state.currentUser;
        if (!user) return [];
        
        // Vendedores enxergam apenas seus leads dentro da base já segregada fisicamente
        if (user.role === 'vendedor') {
          return state.leads.filter((l) => l.userId === user.id);
        }
        return state.leads;
      }
    }),
    {
      name: 'corca_crm_storage',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        
        // Interceptador arquitetural estrito: isola chaves físicas no localStorage por Tenant
        return {
          getItem: (name) => {
            const activeTenant = localStorage.getItem('corca_crm_active_tenant_key');
            return localStorage.getItem(activeTenant || name);
          },
          setItem: (name, value) => {
            const activeTenant = localStorage.getItem('corca_crm_active_tenant_key');
            localStorage.setItem(activeTenant || name, value);
          },
          removeItem: (name) => {
            const activeTenant = localStorage.getItem('corca_crm_active_tenant_key');
            localStorage.removeItem(activeTenant || name);
          }
        };
      }),
    }
  )
);