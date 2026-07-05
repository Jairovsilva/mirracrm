import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Lead {
  id: string;
  name: string;
  company: string;
  value: number;
  status: 'lead' | 'contacted' | 'proposal' | 'won' | 'lost';
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  userOwner?: string; // Engenharia: Identifica o dono do lead
}

interface CRMState {
  leads: Lead[];
  theme: 'light' | 'dark';
  addLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => void;
  updateLeadStatus: (id: string, status: Lead['status']) => void;
  toggleTheme: () => void;
  clearStorage: () => void;
}

export const useCRMStore = create<CRMState>()(
  persist(
    (set) => ({
      leads: [
        // Leads de exemplo universais
        { id: '1', name: 'Roberto Silva', company: 'Acme Corp', value: 15000, status: 'lead', createdAt: new Date().toISOString(), userOwner: 'system' },
        { id: '2', name: 'Ana Costa', company: 'TechSolutions', value: 48000, status: 'proposal', createdAt: new Date().toISOString(), userOwner: 'system' }
      ],
      theme: 'dark',

      addLead: (newLead) => set((state) => {
        // Captura dinamicamente quem está logado no momento do cadastro
        const currentUser = typeof window !== 'undefined' ? localStorage.getItem('crm_current_user') || 'comum' : 'comum';
        return {
          leads: [
            ...state.leads,
            {
              ...newLead,
              id: Math.random().toString(36).substring(2, 9),
              createdAt: new Date().toISOString(),
              userOwner: currentUser // Atribui o lead estritamente ao e-mail logado
            }
          ]
        };
      }),

      updateLeadStatus: (id, status) => set((state) => ({
        leads: state.leads.map((lead) => 
          lead.id === id ? { ...lead, status } : lead
        )
      })),

      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark'
      })),

      clearStorage: () => set({ leads: [] })
    }),
    {
      name: 'corca_crm_storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);