'use client';
import React, { useState, useEffect } from 'react';
import Sidebar from '@/src/components/layout/Sidebar';
import Header from '@/src/components/layout/Header';
import KanbanBoard from '@/src/components/KanbanBoard';
import Dashboard from '@/src/components/Dashboard';
import AIAssistant from '@/src/components/AIAssistant'; // Ativação do Agente de IA do Gemini
import { useCRMStore } from '@/src/store/crmStore';

export default function CRMAppShell() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const { theme } = useCRMStore();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('crm_session_active');
      
      if (!session) {
        window.location.href = '/';
      } else {
        setIsAuthorized(true);
        setIsLoading(false);
      }

      const handleLogoutEvent = () => {
        localStorage.removeItem('crm_session_active');
        window.location.href = '/';
      };

      window.addEventListener('crm_logout_trigger', handleLogoutEvent);
      return () => window.removeEventListener('crm_logout_trigger', handleLogoutEvent);
    }
  }, []);

  if (typeof window !== 'undefined' && !window.logout) {
    window.logout = () => {
      localStorage.removeItem('crm_session_active');
      window.location.href = '/';
    };
  }

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-sans">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-slate-400">Autenticando chaves de segurança do workspace...</p>
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
      theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
      />

      <div className="flex flex-col flex-1 w-full overflow-y-auto">
        <Header setSidebarOpen={setSidebarOpen} />

        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto pb-24">
          {activeTab === 'pipeline' && <KanbanBoard />}
          {activeTab === 'dashboard' && <Dashboard />}
          
          {activeTab === 'contacts' && (
            <div className={`p-6 border rounded-xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h2 className="text-xl font-bold mb-2">Módulo Contatos Rápidos</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Barra de busca reativa e listagem de contatos corporativos mapeados.</p>
            </div>
          )}
          
          {activeTab === 'alerts' && (
            <div className={`p-6 border rounded-xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h2 className="text-xl font-bold mb-2">Alertas & Notificações Ativas</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Lembretes gerados por automação e análises preditivas dos leads.</p>
            </div>
          )}
          
          {activeTab === 'reports' && (
            <div className={`p-6 border rounded-xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h2 className="text-xl font-bold mb-2">Relatórios Analíticos</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Acompanhamento e exportação de taxas de conversão históricas da equipe.</p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={`p-6 border rounded-xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h2 className="text-xl font-bold mb-2">Configurações do Workspace</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Ajustes de permissões do time, regras comerciais e integrações de API.</p>
            </div>
          )}
        </main>
      </div>

      {/* Agente de IA flutuante renderizado globalmente sobre o painel */}
      <AIAssistant />
    </div>
  );
}
