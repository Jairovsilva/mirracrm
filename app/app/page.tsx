'use client';

import { useState, useEffect } from 'react';
import { useCRMStore } from '@/src/store/crmStore';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { Header } from '@/src/components/layout/Header';
import { DashboardView } from '@/src/components/views/DashboardView';
import { KanbanView } from '@/src/components/views/KanbanView';
import { LeadsView } from '@/src/components/views/LeadsView';
import { AnalyticsView } from '@/src/components/views/AnalyticsView';
import { TeamView } from '@/src/components/views/TeamView';
import { SettingsView } from '@/src/components/views/SettingsView';
import { LeadDetailDrawer } from '@/src/components/leads/LeadDetailDrawer';
import { LeadFormModal } from '@/src/components/leads/LeadFormModal';
import { AlertsPanel } from '@/src/components/alerts/AlertsPanel';

export type ViewType = 'dashboard' | 'kanban' | 'leads' | 'analytics' | 'team' | 'settings';

export default function AppPage() {
  const restoreSession = useCRMStore((s) => s.restoreSession);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [showAlerts, setShowAlerts] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadFormId, setLeadFormId] = useState<string | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const session = localStorage.getItem('crm_session_active');
    if (!session) {
      window.location.href = '/';
      return;
    }

    restoreSession(session);
    setIsAuthorized(true);
    setIsLoading(false);
  }, [restoreSession]);

  const handleAddLead = () => {
    setLeadFormId(null);
    setLeadFormOpen(true);
  };

  const handleEditLead = (id: string) => {
    setLeadFormId(id);
    setLeadFormOpen(true);
  };

  const handleOpenLead = (id: string) => {
    setDetailLeadId(id);
  };

  const handleViewKanban = () => {
    setActiveView('kanban');
  };

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
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <Header
          onAddLead={handleAddLead}
          onToggleAlerts={() => setShowAlerts(!showAlerts)}
          showAlerts={showAlerts}
        />

        <main className="flex-1 overflow-y-auto">
          {activeView === 'dashboard' && (
            <DashboardView
              onOpenLead={handleOpenLead}
              onAddLead={handleAddLead}
              onViewKanban={handleViewKanban}
            />
          )}
          {activeView === 'kanban' && (
            <KanbanView
              onOpenLead={handleOpenLead}
              onAddLead={handleAddLead}
              onEditLead={handleEditLead}
            />
          )}
          {activeView === 'leads' && (
            <LeadsView
              onOpenLead={handleOpenLead}
              onAddLead={handleAddLead}
              onEditLead={handleEditLead}
            />
          )}
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'team' && <TeamView />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>

      {showAlerts && <AlertsPanel onClose={() => setShowAlerts(false)} />}

      {leadFormOpen && (
        <LeadFormModal leadId={leadFormId} onClose={() => setLeadFormOpen(false)} />
      )}

      {detailLeadId && (
        <LeadDetailDrawer
          leadId={detailLeadId}
          onClose={() => setDetailLeadId(null)}
          onEdit={() => {
            handleEditLead(detailLeadId);
            setDetailLeadId(null);
          }}
        />
      )}
    </div>
  );
}
