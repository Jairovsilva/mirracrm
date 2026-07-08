'use client';

import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { Button } from '@/components/ui/button';
import { X, Bell, Info, AlertTriangle, CheckCircle2, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertsPanelProps {
  onClose: () => void;
}

const alertConfig = {
  info: { icon: Info, classes: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' },
  warning: { icon: AlertTriangle, classes: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
  success: { icon: CheckCircle2, classes: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
};

export function AlertsPanel({ onClose }: AlertsPanelProps) {
  const { t } = useTranslation();
  const alerts = useCRMStore((s) => s.alerts);
  const markAlertRead = useCRMStore((s) => s.markAlertRead);
  const dismissAlert = useCRMStore((s) => s.dismissAlert);

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40 animate-fade-in" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-card shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <h2 className="font-bold">{t.alerts.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bell className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">{t.alerts.noAlerts}</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const config = alertConfig[alert.type];
              const Icon = config.icon;
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'flex gap-3 p-3.5 rounded-lg border transition-all animate-fade-in',
                    alert.read ? 'border-border bg-card' : 'border-primary/30 bg-primary/5'
                  )}
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', config.classes)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-relaxed', !alert.read && 'font-medium')}>{alert.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {!alert.read && (
                        <button
                          onClick={() => markAlertRead(alert.id)}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Marcar como lido
                        </button>
                      )}
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                        Descartar
                      </button>
                    </div>
                  </div>
                  {!alert.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
