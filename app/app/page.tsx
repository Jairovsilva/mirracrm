'use client';

import { useEffect, useState } from 'react';
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
  const currentUser = useCRMStore((s) => s.currentUser);
  const theme = useCRMStore((s) => s.theme);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('corca-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('corca-theme', 'light');
      }
    }
  }, [theme]);

  useEffect(() => {
    if (mounted && !currentUser) {
      window.location.href = '/';
    }
  }, [mounted, currentUser]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const handleOpenLead = (id: string) => setSelectedLeadId(id);
  const handleCloseLead = () => setSelectedLeadId(null);
  const handleAddLead = () => {
    setEditingLeadId(null);
    setShowLeadForm(true);
  };
  const handleEditLead = (id: string) => {
    setEditingLeadId(id);
    setShowLeadForm(true);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onAddLead={handleAddLead}
          onToggleAlerts={() => setShowAlerts(!showAlerts)}
          showAlerts={showAlerts}
        />
        <main className="flex-1 overflow-auto scrollbar-thin">
          {activeView === 'dashboard' && (
            <DashboardView onOpenLead={handleOpenLead} onAddLead={handleAddLead} onViewKanban={() => setActiveView('kanban')} />
          )}
          {activeView === 'kanban' && (
            <KanbanView onOpenLead={handleOpenLead} onAddLead={handleAddLead} onEditLead={handleEditLead} />
          )}
          {activeView === 'leads' && (
            <LeadsView onOpenLead={handleOpenLead} onAddLead={handleAddLead} onEditLead={handleEditLead} />
          )}
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'team' && <TeamView />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>

      {selectedLeadId && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          onClose={handleCloseLead}
          onEdit={() => {
            handleEditLead(selectedLeadId);
            handleCloseLead();
          }}
        />
      )}

      {showLeadForm && (
        <LeadFormModal
          leadId={editingLeadId}
          onClose={() => {
            setShowLeadForm(false);
            setEditingLeadId(null);
          }}
        />
      )}

      {showAlerts && <AlertsPanel onClose={() => setShowAlerts(false)} />}
    </div>
  );
}
