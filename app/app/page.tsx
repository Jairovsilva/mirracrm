'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCRMStore, restoreSession, runDailyAlertAutomation } from '@/src/store/crmStore';
import { supabase } from '@/src/lib/supabaseClient';

import { Sidebar } from '@/src/components/layout/Sidebar';
import { Header } from '@/src/components/layout/Header';

import { DashboardView } from '@/src/components/views/DashboardView';
import KanbanView from '@/src/components/views/KanbanView';
import { LeadsView } from '@/src/components/views/LeadsView';
import { WhatsAppView } from '@/src/components/views/WhatsAppView';
import { AnalyticsView } from '@/src/components/views/AnalyticsView';
import { TeamView } from '@/src/components/views/TeamView';
import { SettingsView } from '@/src/components/views/SettingsView';

import { LeadDetailDrawer } from '@/src/components/leads/LeadDetailDrawer';
import { LeadFormModal } from '@/src/components/leads/LeadFormModal';
import { AlertsPanel } from '@/src/components/alerts/AlertsPanel';
import { AIAssistant } from '@/src/components/AIAssistant';

export type ViewType =
  | 'dashboard'
  | 'kanban'
  | 'leads'
  | 'whatsapp'
  | 'analytics'
  | 'team'
  | 'settings';

type BillingStatus = {
  account: {
    id: string;
    companyName: string;
    isLegacyFree: boolean;
  };
  subscription: {
    status: string;
    effectiveStatus: string;
    trialEndsAt: string | null;
    trialDaysRemaining: number | null;
    hasAccess: boolean;
  };
  plan: {
    id: string;
    name: string;
  } | null;
};

export default function AppPage() {
  const theme = useCRMStore((s) => s.theme);

  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [showAlerts, setShowAlerts] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadFormId, setLeadFormId] = useState<string | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [checkingBilling, setCheckingBilling] = useState(false);

  const checkBilling = useCallback(async () => {
    setCheckingBilling(true);
    setBillingError(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      const token = sessionData.session?.access_token;

      if (sessionError || !token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch('/api/billing/status', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Não foi possível consultar sua assinatura.'
        );
      }

      if (
        !result.subscription ||
        typeof result.subscription.hasAccess !== 'boolean'
      ) {
        throw new Error('Resposta de assinatura inválida.');
      }

      setBilling(result as BillingStatus);
    } catch (error) {
      setBilling(null);
      setBillingError(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar sua assinatura.'
      );
    } finally {
      setCheckingBilling(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const restored = await restoreSession();

      if (!mounted) return;

      if (!restored) {
        window.location.replace('/');
        return;
      }

      setIsAuthorized(true);
      setIsLoading(false);
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;

    checkBilling();
  }, [isAuthorized, checkBilling]);

  useEffect(() => {
    if (!isAuthorized || !billing?.subscription.hasAccess) return;

    runDailyAlertAutomation();
  }, [isAuthorized, billing]);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const handleLogoutEvent = async () => {
      await useCRMStore.getState().logout();
      window.location.replace('/');
    };

    window.addEventListener('crm_logout_trigger', handleLogoutEvent);

    return () => {
      window.removeEventListener('crm_logout_trigger', handleLogoutEvent);
    };
  }, []);

  // Reconsulta a assinatura quando o usuário volta à aba.
  useEffect(() => {
    if (!isAuthorized) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkBilling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthorized, checkBilling]);

  const handleLogout = async () => {
    await useCRMStore.getState().logout();
    window.location.replace('/');
  };

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

  if (isLoading || !isAuthorized || checkingBilling || (!billing && !billingError)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground font-sans">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">
            Verificando sua sessão e assinatura...
          </p>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (billingError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-5 shadow-lg">
          <h1 className="text-2xl font-bold">Não foi possível verificar sua assinatura</h1>
          <p className="text-sm text-muted-foreground">{billingError}</p>
          <button
            onClick={checkBilling}
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            Tentar novamente
          </button>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-border px-4 py-3 font-semibold"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  if (billing && !billing.subscription.hasAccess) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center space-y-6 shadow-xl">
          <div className="text-5xl">🔒</div>
          <h1 className="text-3xl font-bold">Sua assinatura precisa de atenção</h1>
          <p className="text-muted-foreground leading-relaxed">
            Seu período gratuito terminou ou sua assinatura não está vigente.
            Seus dados continuam armazenados, mas o acesso às funcionalidades
            do CRM está temporariamente suspenso.
          </p>
          <div className="rounded-xl border border-border bg-background p-4 text-sm">
            <p className="font-semibold">Empresa: {billing.account.companyName}</p>
            <p className="mt-1 text-muted-foreground">
              Situação: {billing.subscription.effectiveStatus === 'expired'
                ? 'Período encerrado'
                : billing.subscription.effectiveStatus}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            A contratação online será disponibilizada após a integração de pagamentos.
          </p>
          <button
            onClick={checkBilling}
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            Verificar assinatura novamente
          </button>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-border px-4 py-3 font-semibold"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  const isTrial = billing?.subscription.status === 'trialing';
  const daysRemaining = billing?.subscription.trialDaysRemaining ?? 0;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden flex-col">
      <div className="w-full bg-amber-500/90 dark:bg-amber-600/80 text-black dark:text-white text-[11px] font-semibold text-center py-1 px-4 flex items-center justify-center gap-2 shrink-0 z-50">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-sm leading-none">🛠️</span>
          DEVELOP — AMBIENTE DE TESTE
        </span>
      </div>

      {isTrial && (
        <div className="w-full bg-blue-600 text-white text-center text-xs sm:text-sm font-semibold py-2 px-4 shrink-0">
          🎁 Seu teste gratuito está ativo.{' '}
          {daysRemaining === 1
            ? 'Resta 1 dia.'
            : `Restam ${daysRemaining} dias.`}
          {' '}Aproveite para conhecer o MirraCRM!
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
        />

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

            {activeView === 'whatsapp' && <WhatsAppView />}
            {activeView === 'analytics' && <AnalyticsView />}
            {activeView === 'team' && <TeamView />}
            {activeView === 'settings' && <SettingsView />}
          </main>
        </div>

        {showAlerts && (
          <AlertsPanel onClose={() => setShowAlerts(false)} />
        )}

        {leadFormOpen && (
          <LeadFormModal
            leadId={leadFormId}
            onClose={() => setLeadFormOpen(false)}
          />
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

        <AIAssistant />
      </div>
    </div>
  );
}
