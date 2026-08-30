'use client';

import { useMemo, useState } from 'react';

import {
  MessageCircle,
  Search,
  WifiOff,
  Users,
  Inbox,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  ArrowRight,
} from 'lucide-react';

import { useCRMStore } from '@/src/store/crmStore';
import { useTranslation } from '@/src/lib/useTranslation';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Input } from '@/components/ui/input';

export function WhatsAppView() {
  const { t } = useTranslation();

  const currentUser = useCRMStore(
    (s) => s.currentUser
  );

  const leads = useCRMStore(
    (s) => s.leads
  );

  const [search, setSearch] = useState('');

  /**
   * Nesta primeira etapa ainda não carregamos conversas
   * da tabela whatsapp_conversations.
   *
   * O array vazio é intencional.
   *
   * Na etapa Supabase ele será substituído pelos dados
   * reais do workspace autenticado.
   */
  const conversations: Array<{
    id: string;
    name: string;
    phone: string;
    lastMessage: string;
    unreadCount: number;
  }> = [];

  const filteredConversations = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    if (!normalizedSearch) {
      return conversations;
    }

    return conversations.filter(
      (conversation) =>
        conversation.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        conversation.phone
          .toLowerCase()
          .includes(normalizedSearch) ||
        conversation.lastMessage
          .toLowerCase()
          .includes(normalizedSearch)
    );
  }, [search]);

  const companyName =
    currentUser?.companyName ||
    'Workspace';

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                {t.whatsapp.title}
              </h1>

              <p className="text-sm text-muted-foreground mt-0.5">
                {t.whatsapp.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm">
          <WifiOff className="w-4 h-4 text-amber-500" />

          <span className="text-muted-foreground">
            {t.whatsapp.status}:
          </span>

          <span className="font-semibold">
            {t.whatsapp.disconnected}
          </span>
        </div>
      </div>

      {/* Indicadores iniciais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t.whatsapp.inbox}
                </p>

                <p className="text-2xl font-bold mt-2">
                  0
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t.whatsapp.unread}
                </p>

                <p className="text-2xl font-bold mt-2">
                  0
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Leads no CRM
                </p>

                <p className="text-2xl font-bold mt-2">
                  {leads.length}
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Workspace
                </p>

                <p className="text-sm font-semibold mt-2 truncate max-w-[160px]">
                  {companyName}
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Área principal */}
      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-[560px]">
        {/* Lista de conversas */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              {t.whatsapp.conversations}
            </CardTitle>

            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 translate-y-[-25%] w-4 h-4 text-muted-foreground" />

              <Input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder={t.whatsapp.search}
                className="pl-9"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredConversations.length === 0 ? (
              <div className="min-h-[410px] flex flex-col items-center justify-center text-center px-6">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Inbox className="w-6 h-6 text-muted-foreground" />
                </div>

                <p className="font-semibold text-sm">
                  {t.whatsapp.noConversations}
                </p>

                <p className="text-xs text-muted-foreground mt-2 max-w-[240px] leading-relaxed">
                  As conversas aparecerão aqui assim que a integração com o WhatsApp Business estiver ativa.
                </p>
              </div>
            ) : (
              <div>
                {filteredConversations.map(
                  (conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className="w-full text-left px-4 py-4 border-b border-border hover:bg-secondary/60 transition-colors"
                    >
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <MessageCircle className="w-5 h-5 text-emerald-600" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">
                              {conversation.name}
                            </p>

                            {conversation.unreadCount > 0 && (
                              <span className="min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {
                                  conversation.unreadCount
                                }
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {conversation.lastMessage}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Painel da conversa */}
        <Card className="overflow-hidden flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-6">
              <Smartphone className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h2 className="text-xl font-bold">
              {t.whatsapp.connectionPending}
            </h2>

            <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed">
              {
                t.whatsapp
                  .connectionPendingDescription
              }
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-3xl mt-8">
              <div className="rounded-xl border border-border p-4 bg-secondary/20 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      1
                    </span>
                  </div>

                  <p className="text-sm font-semibold">
                    WhatsApp
                  </p>
                </div>

                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Cliente envia uma mensagem pelo WhatsApp Business.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4 bg-secondary/20 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      2
                    </span>
                  </div>

                  <p className="text-sm font-semibold">
                    MirraCRM
                  </p>
                </div>

                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  O contato é identificado ou transformado automaticamente em lead.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4 bg-secondary/20 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      3
                    </span>
                  </div>

                  <p className="text-sm font-semibold">
                    Vendedor
                  </p>
                </div>

                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  O vendedor atende pelo CRM sem precisar alternar entre sistemas.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border px-5 py-4 bg-secondary/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />

                <span>
                  {t.whatsapp.leadsReady}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                Supabase
                <ArrowRight className="w-3 h-3" />
                Meta Cloud API
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Informação técnica */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>

            <div>
              <p className="text-sm font-semibold">
                {t.whatsapp.leadsReady}
              </p>

              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {
                  t.whatsapp
                    .leadsReadyDescription
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}