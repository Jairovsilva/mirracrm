'use client';

import { useRef, useState } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore, type ActivityType } from '@/src/store/crmStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TemperatureBadge } from '@/src/components/leads/TemperatureBadge';
import { StageBadge } from '@/src/components/leads/StageBadge';
import {
  X, Mail, Phone, PhoneCall, Building2, Linkedin, Briefcase, FileText, DollarSign,
  Pencil, Trash2, Calendar, StickyNote, Send, Clock, MessageCircle, Paperclip,
  Loader2, AlertCircle, CheckCircle2,
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

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LeadDetailDrawer({ leadId, onClose, onEdit }: LeadDetailDrawerProps) {
  const { t } = useTranslation();
  const lead = useCRMStore((s) => s.leads.find((l) => l.id === leadId));
  const addActivity = useCRMStore((s) => s.addActivity);
  const deleteLead = useCRMStore((s) => s.deleteLead);
  const loadLeads = useCRMStore((s) => s.loadLeads);
  const accessToken = useCRMStore((s) => s.accessToken);

  const [activityType, setActivityType] = useState<ActivityType>('nota');
  const [activityContent, setActivityContent] = useState('');

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const emailAttachmentInputRef = useRef<HTMLInputElement>(null);

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

  const openEmailComposer = () => {
    const recipient = (lead.emailCorporativo || '').trim();

    if (!isValidEmail(recipient)) {
      alert('Este lead não possui um endereço de e-mail válido.');
      return;
    }

    setEmailTo(recipient);
    setEmailSubject(`Contato MirraCRM - ${lead.nome}`);
    setEmailBody(`Olá ${lead.nome},\n\n`);
    setEmailAttachments([]);
    setEmailMessage(null);
    setEmailOpen(true);
  };

  const closeEmailComposer = () => {
    if (sendingEmail) return;
    setEmailOpen(false);
    setEmailMessage(null);
    setEmailAttachments([]);
    if (emailAttachmentInputRef.current) {
      emailAttachmentInputRef.current.value = '';
    }
  };

  const handleEmailButtonClick = (type: ActivityType) => {
    if (type === 'email') {
      openEmailComposer();
      return;
    }
    setActivityType(type);
  };

  const handleEmailAttachments = (files: FileList | null) => {
    if (!files) return;

    const incoming = Array.from(files);

    if (emailAttachments.length + incoming.length > MAX_ATTACHMENTS) {
      setEmailMessage({ type: 'error', text: 'Você pode anexar no máximo 5 arquivos.' });
      if (emailAttachmentInputRef.current) emailAttachmentInputRef.current.value = '';
      return;
    }

    const oversized = incoming.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setEmailMessage({
        type: 'error',
        text: `O arquivo "${oversized.name}" ultrapassa o limite de 10 MB.`,
      });
      if (emailAttachmentInputRef.current) emailAttachmentInputRef.current.value = '';
      return;
    }

    setEmailAttachments((current) => [...current, ...incoming]);
    setEmailMessage(null);
    if (emailAttachmentInputRef.current) emailAttachmentInputRef.current.value = '';
  };

  const removeEmailAttachment = (index: number) => {
    setEmailAttachments((current) => current.filter((_, i) => i !== index));
  };

  const handleSendEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidEmail(emailTo)) {
      setEmailMessage({ type: 'error', text: 'Informe um endereço de e-mail válido.' });
      return;
    }

    if (!emailSubject.trim()) {
      setEmailMessage({ type: 'error', text: 'Informe o assunto do e-mail.' });
      return;
    }

    if (!emailBody.trim()) {
      setEmailMessage({ type: 'error', text: 'Escreva a mensagem do e-mail.' });
      return;
    }

    if (!accessToken) {
      setEmailMessage({
        type: 'error',
        text: 'Sua sessão expirou. Entre novamente no MirraCRM e tente de novo.',
      });
      return;
    }

    setSendingEmail(true);
    setEmailMessage(null);

    try {
      const formData = new FormData();
      formData.append('accessToken', accessToken);
      formData.append('leadId', lead.id);
      formData.append('to', emailTo.trim());
      formData.append('subject', emailSubject.trim());
      formData.append('body', emailBody);

      emailAttachments.forEach((file) => {
        formData.append('attachments', file);
      });

      const response = await fetch('/api/email/send', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const message =
          data?.error ||
          data?.message ||
          'Não foi possível enviar o e-mail. Verifique a conexão do Gmail em Configurações.';
        throw new Error(message);
      }

      await loadLeads();

      setEmailMessage({
        type: 'success',
        text: 'Gmail aceitou o envio com sucesso.',
      });

      setEmailAttachments([]);
      if (emailAttachmentInputRef.current) {
        emailAttachmentInputRef.current.value = '';
      }
    } catch (error) {
      setEmailMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.',
      });
    } finally {
      setSendingEmail(false);
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
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-card shadow-2xl z-50 flex flex-col animate-slide-in-right">
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

        <div className="flex-1 overflow-y-auto scrollbar-thin">
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

          <div className="px-6 py-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t.lead.activities}
              <span className="text-xs text-muted-foreground font-normal">({lead.activities.length})</span>
            </h3>

            <div className="space-y-2 mb-4">
              <div className="flex gap-1.5">
                {(['telefone', 'email', 'reuniao', 'nota'] as ActivityType[]).map((type) => {
                  const Icon = activityIcons[type];
                  return (
                    <button
                      key={type}
                      onClick={() => handleEmailButtonClick(type)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all',
                        type === 'email'
                          ? 'border-border text-muted-foreground hover:bg-secondary hover:text-primary'
                          : activityType === type
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border text-muted-foreground hover:bg-secondary'
                      )}
                      title={type === 'email' ? 'Enviar e-mail pelo Gmail' : t.lead.activityType[type]}
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

      {emailOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeEmailComposer}
          />

          <div className="relative z-[71] w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold">Enviar e-mail</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Envie mensagens e propostas diretamente pelo Gmail conectado ao MirraCRM.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEmailComposer}
                disabled={sendingEmail}
                className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-40"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-5 space-y-4">
              {emailMessage && (
                <div
                  className={cn(
                    'rounded-xl border p-3 text-sm flex items-start gap-2',
                    emailMessage.type === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  )}
                >
                  {emailMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{emailMessage.text}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-muted-foreground">Para</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  disabled={sendingEmail}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Assunto</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  disabled={sendingEmail}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Mensagem</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  disabled={sendingEmail}
                  rows={9}
                  className="mt-1.5 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
                />
              </div>

              <div>
                <input
                  ref={emailAttachmentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleEmailAttachments(e.target.files)}
                  disabled={sendingEmail || emailAttachments.length >= MAX_ATTACHMENTS}
                />

                <button
                  type="button"
                  onClick={() => emailAttachmentInputRef.current?.click()}
                  disabled={sendingEmail || emailAttachments.length >= MAX_ATTACHMENTS}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  <Paperclip className="w-4 h-4" />
                  Anexar arquivo
                </button>

                <span className="ml-2 text-[10px] text-muted-foreground">
                  Até 5 arquivos, máximo 10 MB cada.
                </span>

                {emailAttachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {emailAttachments.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 shrink-0 text-primary" />
                          <span className="truncate">{file.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEmailAttachment(index)}
                          disabled={sendingEmail}
                          className="p-1 rounded-md hover:bg-background text-muted-foreground hover:text-destructive disabled:opacity-40"
                          aria-label={`Remover ${file.name}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={closeEmailComposer}
                  disabled={sendingEmail}
                  className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={sendingEmail || !isValidEmail(emailTo) || !emailSubject.trim() || !emailBody.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-opacity disabled:opacity-40"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar e-mail
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
