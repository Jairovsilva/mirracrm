import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Stage = 'entrada' | 'enriquecer' | 'reuniao' | 'fim_cadencia';
export type Temperature = 'frio' | 'morno' | 'quente';
export type ActivityType = 'telefone' | 'email' | 'reuniao' | 'nota';
export type Language = 'pt' | 'en' | 'es';

export interface Activity {
  id: string;
  type: ActivityType;
  content: string;
  date: string;
}

export interface Lead {
  id: string;
  nome: string;
  cargo: string;
  emailCorporativo: string;
  linkedin: string;
  telefoneCelular: string;
  telefoneFixo: string;
  nomeEmpresa: string;
  cnpj: string;
  temperatura: Temperature;
  stage: Stage;
  valorProposta?: number;
  motivoPerda?: string;
  activities: Activity[];
  userId?: string;
}

export interface User {
  id: string;
  email: string;
  empresa: string;
  role: string;
  passwordHash: string;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'success';
  message: string;
  read: boolean;
}

interface CRMState {
  leads: Lead[];
  alerts: Alert[];
  currentUser: User | null;
  registeredUsers: User[];
  theme: 'light' | 'dark';
  currentLanguage: Language;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
  login: (email: string, password: string) => boolean;
  register: (email: string, password: string) => boolean;
  restoreSession: (email: string) => void;
  addLead: (lead: Omit<Lead, 'id' | 'activities' | 'userId'>) => void;
  updateLeadStage: (id: string, stage: Stage) => void;
  updateLead: (id: string, updatedFields: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addActivity: (leadId: string, type: ActivityType, content: string) => void;
  markAlertRead: (id: string) => void;
  dismissAlert: (id: string) => void;
}

export const useCRMStore = create<CRMState>()(
  persist(
    (set, get) => ({
      leads: [
        {
          id: 'l1', nome: 'Rodrigo Silva', cargo: 'Diretor de TI', emailCorporativo: 'rodrigo@techcorp.com.br',
          linkedin: 'linkedin.com/in/rodrigo', telefoneCelular: '11999999999', telefoneFixo: '1133333333',
          nomeEmpresa: 'TechCorp', cnpj: '12.345.678/0001-00', temperatura: 'quente', stage: 'entrada',
          valorProposta: 75000, activities: [], userId: 'u1',
        },
        {
          id: 'l2', nome: 'Ana Costa', cargo: 'CEO', emailCorporativo: 'ana@techsolutions.com',
          linkedin: 'linkedin.com/in/anacosta', telefoneCelular: '11888888888', telefoneFixo: '1144444444',
          nomeEmpresa: 'TechSolutions', cnpj: '98.765.432/0001-10', temperatura: 'morno', stage: 'reuniao',
          valorProposta: 48000, activities: [], userId: 'u1',
        },
      ],
      alerts: [
        { id: '1', message: 'Preencher motivo de perda para os 94 leads que recusaram reunião.', type: 'warning', read: false },
        { id: '2', message: 'Lembrete Diário: Você tem 4 reuniões sem proposta anexada nesta semana.', type: 'info', read: false },
      ],
      currentUser: null,
      registeredUsers: [],
      theme: 'dark',
      currentLanguage: 'pt',

      setLanguage: (lang) => set({ currentLanguage: lang }),

      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark',
      })),

      login: (email, password) => {
        const { registeredUsers } = get();
        const user = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user || user.passwordHash !== password) {
          return false;
        }
        set({ currentUser: user });
        return true;
      },

      register: (email, password) => {
        const domain = email.split('@')[1];
        const invalidDomains = ['gmail.com', 'gmail.com.br', 'hotmail.com', 'outlook.com', 'yahoo.com', 'github.com'];
        if (invalidDomains.includes(domain?.toLowerCase())) {
          return false;
        }
        const { registeredUsers } = get();
        const userExists = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (userExists) {
          return false;
        }
        const empresa = domain.split('.')[0].toUpperCase();
        const newUser: User = {
          id: 'u_' + Date.now(),
          email,
          empresa,
          role: registeredUsers.length === 0 ? 'admin_principal' : 'vendedor',
          passwordHash: password,
        };
        set({ registeredUsers: [...registeredUsers, newUser], currentUser: newUser });
        return true;
      },

      restoreSession: (email) => {
        const { registeredUsers, currentUser } = get();
        if (currentUser) return;
        const user = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user) {
          set({ currentUser: user });
          return;
        }
        const domain = email.split('@')[1] || 'empresa';
        const empresa = domain.split('.')[0].toUpperCase();
        const newUser: User = {
          id: 'restored_' + Date.now(),
          email,
          empresa,
          role: 'admin_principal',
          passwordHash: 'sso_verified_token',
        };
        set({ registeredUsers: [...registeredUsers, newUser], currentUser: newUser });
      },

      addLead: (leadData) => set((state) => ({
        leads: [...state.leads, {
          ...leadData,
          id: Math.random().toString(36).substring(2, 9),
          activities: [],
          userId: state.currentUser?.id || 'u1',
        }],
      })),

      updateLeadStage: (id, stage) => set((state) => ({
        leads: state.leads.map(l => l.id === id ? { ...l, stage } : l),
      })),

      updateLead: (id, updatedFields) => set((state) => ({
        leads: state.leads.map(l => l.id === id ? { ...l, ...updatedFields } : l),
      })),

      deleteLead: (id) => set((state) => ({
        leads: state.leads.filter(l => l.id !== id),
      })),

      addActivity: (leadId, type, content) => set((state) => ({
        leads: state.leads.map(l => l.id === leadId ? {
          ...l,
          activities: [...l.activities, {
            id: 'a_' + Date.now(),
            type,
            content,
            date: new Date().toISOString(),
          }],
        } : l),
      })),

      markAlertRead: (id) => set((state) => ({
        alerts: state.alerts.map(a => a.id === id ? { ...a, read: true } : a),
      })),

      dismissAlert: (id) => set((state) => ({
        alerts: state.alerts.filter(a => a.id !== id),
      })),
    }),
    {
      name: 'corca_crm_storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
