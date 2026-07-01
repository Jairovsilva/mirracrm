import { create } from 'zustand';

export type Stage = 'entrada' | 'enriquecer' | 'reuniao' | 'fim_cadencia';
export type Temperature = 'frio' | 'morno' | 'quente';
export type ActivityType = 'telefone' | 'email' | 'reuniao' | 'nota';

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
  userId: string;
}

export interface User {
  id: string;
  email: string;
  empresa: string;
  role: 'admin_principal' | 'vendedor';
  passwordHash: string;
}

export interface Alert {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  read: boolean;
}

interface CRMState {
  currentLanguage: 'pt' | 'en' | 'es';
  theme: 'light' | 'dark';
  currentUser: User | null;
  registeredUsers: User[];
  leads: Lead[];
  alerts: Alert[];
  setLanguage: (lang: 'pt' | 'en' | 'es') => void;
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

export const useCRMStore = create<CRMState>((set, get) => ({
  currentLanguage: 'pt',
  theme: 'dark',
  currentUser: null,
  registeredUsers: [],
  alerts: [
    { id: '1', message: 'Preencher motivo de perda para os 94 leads que recusaram reunião.', type: 'warning', read: false },
    { id: '2', message: 'Lembrete Diário: Você tem 4 reuniões sem proposta anexada nesta semana.', type: 'info', read: false }
  ],
  leads: [
    {
      id: 'l1', nome: 'Rodrigo Silva', cargo: 'Diretor de TI', emailCorporativo: 'rodrigo@techcorp.com.br',
      linkedin: 'linkedin.com/in/rodrigo', telefoneCelular: '11999999999', telefoneFixo: '1133333333',
      nomeEmpresa: 'TechCorp', cnpj: '12.345.678/0001-00', temperatura: 'quente', stage: 'entrada',
      valorProposta: 15000, activities: [], userId: 'u1'
    }
  ],

  setLanguage: (lang) => set({ currentLanguage: lang }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  register: (email, password) => {
    const domain = email.split('@')[1];
    const invalidDomains = ['gmail.com', 'gmail.com.br', 'hotmail.com', 'outlook.com', 'yahoo.com', 'github.com'];

    if (invalidDomains.includes(domain.toLowerCase())) {
      alert("Apenas e-mails corporativos são permitidos para cadastro!");
      return false;
    }

    const { registeredUsers } = get();
    const userExists = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (userExists) {
      alert("Este e-mail já está cadastrado. Vá para a aba Entrar.");
      return false;
    }

    const sameDomainUser = registeredUsers.find(u => u.empresa === domain.split('.')[0].toUpperCase());
    const role = sameDomainUser ? 'vendedor' : 'admin_principal';

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      empresa: domain.split('.')[0].toUpperCase(),
      role,
      passwordHash: password
    };

    set({ registeredUsers: [...registeredUsers, newUser], currentUser: newUser });
    alert(`Cadastro realizado! Você é o ${role === 'admin_principal' ? 'Administrador Principal' : 'Vendedor'} da empresa ${newUser.empresa}`);
    return true;
  },

  login: (email, password) => {
    const { registeredUsers } = get();
    const user = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || user.passwordHash !== password) {
      alert("Usuário não encontrado ou senha incorreta!");
      return false;
    }

    set({ currentUser: user });
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
      id: Math.random().toString(36).substr(2, 9),
      activities: [],
      userId: state.currentUser?.id || 'u1'
    }]
  })),

  updateLeadStage: (id, stage) => set((state) => ({
    leads: state.leads.map(l => l.id === id ? { ...l, stage } : l)
  })),

  updateLead: (id, updatedFields) => set((state) => ({
    leads: state.leads.map(l => l.id === id ? { ...l, ...updatedFields } : l)
  })),

  deleteLead: (id) => set((state) => ({
    leads: state.leads.filter(l => l.id !== id)
  })),

  addActivity: (leadId, type, content) => set((state) => ({
    leads: state.leads.map(l => l.id === leadId ? {
      ...l,
      activities: [...l.activities, { id: Date.now().toString(), type, content, date: new Date().toLocaleDateString() }]
    } : l)
  })),

  markAlertRead: (id) => set((state) => ({ alerts: state.alerts.map(a => a.id === id ? { ...a, read: true } : a) })),
  dismissAlert: (id) => set((state) => ({ alerts: state.alerts.filter(a => a.id !== id) }))
}));
