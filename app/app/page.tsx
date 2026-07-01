'use client';
import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import KanbanBoard from '@/components/KanbanBoard';
import Dashboard from '@/components/Dashboard';

export default function CRMAppShell() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('crm_session_active');
      if (!session) {
        window.location.href = '/';
      } else {
        setIsAuthorized(true);
      }
    }
  }, []);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-slate-400">Verificando chaves de segurança corporativas...</p>
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans">
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
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
              <h2 className="text-xl font-bold mb-2">Módulo Contatos Rápidos</h2>
              <p className="text-xs text-slate-400">Barra de busca reativa e listagem de contatos corporativos mapeados.</p>
            </div>
          )}
          
          {activeTab === 'alerts' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
              <h2 className="text-xl font-bold mb-2">Alertas & Notificações Ativas</h2>
              <p className="text-xs text-slate-400">Lembretes gerados por automação e análises preditivas dos leads.</p>
            </div>
          )}
          
          {activeTab === 'reports' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
              <h2 className="text-xl font-bold mb-2">Relatórios Analíticos</h2>
              <p className="text-xs text-slate-400">Acompanhamento e exportação de taxas de conversão históricas da equipe.</p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
              <h2 className="text-xl font-bold mb-2">Configurações do Workspace</h2>
              <p className="text-xs text-slate-400">Ajustes de permissões do time, regras comerciais e integrações de API.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}