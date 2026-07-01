import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Definição estrita das interfaces do CRM para o TypeScript não quebrar o build na Vercel
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
}

interface CRMState {
  leads: Lead[];
  theme: 'light' | 'dark';
  addLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => void;
  updateLeadStatus: (id: string, status: Lead['status']) => void;
  toggleTheme: () => void;
  clearStorage: () => void;
}

// Engenharia Sênior: Criação da Store usando o middleware 'persist'
// Isso força o Zustand a salvar AUTOMATICAMENTE qualquer alteração (novas empresas/leads) 
// no localStorage do navegador sob a chave 'corca_crm_storage'.
export const useCRMStore = create<CRMState>()(
  persist(
    (set) => ({
      leads: [
        // Leads iniciais padrão (Stubs/Mock) caso o storage esteja vazio na primeira execução
        { id: '1', name: 'Roberto Silva', company: 'Acme Corp', value: 15000, status: 'lead', createdAt: new Date().toISOString() },
        { id: '2', name: 'Ana Costa', company: 'TechSolutions', value: 48000, status: 'proposal', createdAt: new Date().toISOString() }
      ],
      theme: 'dark',

      addLead: (newLead) => set((state) => ({
        leads: [
          ...state.leads,
          {
            ...newLead,
            id: Math.random().toString(36).substring(2, 9),
            createdAt: new Date().toISOString()
          }
        ]
      })),

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
      name: 'corca_crm_storage', // Nome da chave que será gravada no navegador
      storage: createJSONStorage(() => localStorage), // Define o localStorage como banco seguro
    }
  )
);
