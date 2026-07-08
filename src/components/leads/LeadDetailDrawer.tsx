'use client';

import { useState } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore, type ActivityType } from '@/src/store/crmStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TemperatureBadge } from '@/src/components/leads/TemperatureBadge';
import { StageBadge } from '@/src/components/leads/StageBadge';
import {
  X, Mail, Phone, PhoneCall, Building2, Linkedin, Briefcase, FileText, DollarSign,
  Pencil, Trash2, Calendar, StickyNote, Send, Clock, MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadDetailDrawerProps {
  leadId: string;
  onClose: () => void;
  onEdit: () => void;
}

const activityIcons: Record<ActivityType, typeof Phone> = {
  telefone: Phone,
  email: Mail,
  reuniao: Calendar,
  nota: StickyNote,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
};

const activityColors: Record<ActivityType, string> = {
  telefone: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  email: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  reuniao: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  nota: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400',
  whatsapp: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400',
  linkedin: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
};

export function LeadDetailDrawer({ leadId, onClose, onEdit }: LeadDetailDrawerProps) {
  const { t } = useTranslation();
  const lead = useCRMStore((s) => s.leads.find((l) => l.id === leadId));
  const addActivity = useCRMStore((s) => s.addActivity);
  const deleteLead = useCRMStore((s) => s.deleteLead);
  const [activityType, setActivityType] = useState<ActivityType>('nota');
  const [activityContent, setActivityContent] = useState('');

  if (!lead) return null;

  const handleAddActivity = () => {
    if (!activityContent.trim()) return;
    addActivity(leadId, activityType, activityContent);
    setActivityContent('');
  };

  const handleDelete = () => {
    if (confirm(t.lead.deleteConfirm)) {
      deleteLead(leadId);
      onClose();
    }
  };

  const infoItems = [
    { icon: Briefcase, label: t.lead.role, value: lead.cargo },
    { icon: Mail, label: t.lead.email, value: lead.emailCorporativo },
    { icon: Phone, label: t.lead.cellPhone, value: lead.telefoneCelular },
    { icon: PhoneCall, label: t.lead.landline, value: lead.telefoneFixo },
    { icon: Building2, label: t.lead.company, value: lead.nomeEmpresa },
    { icon: FileText, label: t.lead.cnpj, value: lead.cnpj },
    { icon: Linkedin, label: t.lead.linkedin, value: lead.linkedin },
  ].filter((item) => item.value);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-card shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg shrink-0">
              {lead.nome[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg truncate">{lead.nome}</h2>
              <p className="text-sm text-muted-foreground truncate">{lead.nomeEmpresa}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Badges & value */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <TemperatureBadge temperature={lead.temperatura} />
              <StageBadge stage={lead.stage} />
            </div>
            {lead.valorProposta ? (
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <DollarSign className="w-4 h-4 text-success" />
                <span>R$ {lead.valorProposta.toLocaleString('pt-BR')}</span>
              </div>
            ) : null}
          </div>

          {/* Info grid */}
          <div className="px-6 py-4 space-y-3 border-b border-border">
            {infoItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium truncate">{item.value}</p>
                  </div>
                </div>
              );
            })}
            {lead.motivoPerda && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t.lead.lossReason}</p>
                  <p className="text-sm font-medium">{lead.motivoPerda}</p>
                </div>
              </div>
            )}
          </div>

          {/* Activities */}
          <div className="px-6 py-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t.lead.activities}
              <span className="text-xs text-muted-foreground font-normal">({lead.activities.length})</span>
            </h3>

            {/* Add activity */}
            <div className="space-y-2 mb-4">
              <div className="flex gap-1.5">
                {(['telefone', 'email', 'reuniao', 'nota'] as ActivityType[]).map((type) => {
                  const Icon = activityIcons[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setActivityType(type)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all',
                        activityType === type
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary'
                      )}
                      title={t.lead.activityType[type]}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{t.lead.activityType[type]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder={t.lead.writeNote}
                  value={activityContent}
                  onChange={(e) => setActivityContent(e.target.value)}
                  className="min-h-[44px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleAddActivity();
                    }
                  }}
                />
                <Button onClick={handleAddActivity} size="icon" className="shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Activity list */}
            {lead.activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">{t.lead.noActivities}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...lead.activities].reverse().map((activity) => {
                  const Icon = activityIcons[activity.type];
                  return (
                    <div key={activity.id} className="flex gap-3 animate-fade-in">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', activityColors[activity.type])}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {t.lead.activityType[activity.type]}
                          </span>
                          <span className="text-xs text-muted-foreground">{activity.date}</span>
                        </div>
                        <p className="text-sm mt-0.5">{activity.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border flex gap-2 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            {t.common.edit}
          </Button>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
