'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  User,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { useCRMStore } from '@/src/store/crmStore';
import { useTranslation } from '@/src/lib/useTranslation';
import { supabase } from '@/src/lib/supabaseClient';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface WhatsAppLead {
  id: string;
  nome: string;
  nome_empresa: string;
  telefone_celular: string;
  stage: string;
  temperatura: string;
}

interface AssignedProfile {
  id: string;
  name: string;
  email: string;
}

interface WhatsAppConversation {
  id: string;
  scope_key: string;
  lead_id: string | null;
  phone_number: string;
  contact_name: string | null;
  assigned_user_id: string | null;
  status: 'open' | 'closed';
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  created_at: string;
  updated_at: string;

  leads?: WhatsAppLead | WhatsAppLead[] | null;

  profiles?:
    | AssignedProfile
    | AssignedProfile[]
    | null;
}

interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  meta_message_id: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  sender_phone: string | null;
  recipient_phone: string | null;
  content: string | null;
  media_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  status:
    | 'received'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed'
    | null;
  sent_by_user_id: string | null;
  created_at: string;
}

interface WhatsAppAccount {
  id: string;
  scope_key: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  status: 'active' | 'inactive' | 'error';
}

function getRelationOne<T>(
  relation: T | T[] | null | undefined
): T | null {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

function formatPhone(
  phone: string | null | undefined
): string {
  if (!phone) {
    return '';
  }

  const digits = phone.replace(/\D/g, '');

  if (
    digits.startsWith('55') &&
    digits.length >= 12
  ) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);

    if (number.length === 9) {
      return `+55 (${ddd}) ${number.slice(
        0,
        5
      )}-${number.slice(5)}`;
    }

    if (number.length === 8) {
      return `+55 (${ddd}) ${number.slice(
        0,
        4
      )}-${number.slice(4)}`;
    }
  }

  return `+${digits}`;
}

function formatConversationDate(
  iso: string | null
): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();

  const sameDay =
    date.toDateString() ===
    now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  }

  return date.toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
    }
  );
}

function formatMessageTime(
  iso: string
): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}

function getMessageStatusIcon(
  status: WhatsAppMessage['status']
) {
  if (status === 'read') {
    return (
      <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
    );
  }

  if (status === 'delivered') {
    return (
      <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
    );
  }

  if (status === 'sent') {
    return (
      <Check className="w-3.5 h-3.5 text-muted-foreground" />
    );
  }

  if (status === 'failed') {
    return (
      <AlertCircle className="w-3.5 h-3.5 text-destructive" />
    );
  }

  return (
    <Clock className="w-3 h-3 text-muted-foreground" />
  );
}

export function WhatsAppView() {
  const { t } = useTranslation();

  const currentUser = useCRMStore(
    (state) => state.currentUser
  );

  const leads = useCRMStore(
    (state) => state.leads
  );

  const [account, setAccount] =
    useState<WhatsAppAccount | null>(null);

  const [
    conversations,
    setConversations,
  ] = useState<WhatsAppConversation[]>(
    []
  );

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState<string | null>(null);

  const [messages, setMessages] =
    useState<WhatsAppMessage[]>([]);

  const [search, setSearch] =
    useState('');

  const [messageText, setMessageText] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(false);

  const [sending, setSending] =
    useState(false);

  const [connecting, setConnecting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement>(null);

  const selectedConversation =
    useMemo(
      () =>
        conversations.find(
          (conversation) =>
            conversation.id ===
            selectedConversationId
        ) || null,
      [
        conversations,
        selectedConversationId,
      ]
    );

  const getAccessToken =
    useCallback(async () => {
      const {
        data: sessionData,
      } =
        await supabase.auth.getSession();

      return (
        sessionData.session
          ?.access_token || null
      );
    }, []);

  const apiFetch =
    useCallback(
      async (
        url: string,
        options: RequestInit = {}
      ) => {
        const token =
          await getAccessToken();

        if (!token) {
          throw new Error(
            'Sessão expirada. Faça login novamente.'
          );
        }

        const response = await fetch(
          url,
          {
            ...options,
            headers: {
              ...(options.headers || {}),
              Authorization:
                `Bearer ${token}`,
              'Content-Type':
                'application/json',
            },
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          const apiError =
            new Error(
              data?.error ||
                'Erro na operação.'
            );

          (apiError as any).code =
            data?.code;

          throw apiError;
        }

        return data;
      },
      [getAccessToken]
    );

  const loadAccount =
    useCallback(async () => {
      if (!currentUser) {
        return;
      }

      const {
        data,
        error: accountError,
      } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq(
          'scope_key',
          currentUser.scopeKey
        )
        .eq('status', 'active')
        .maybeSingle();

      if (accountError) {
        console.error(
          'Erro ao consultar conta WhatsApp:',
          accountError
        );

        return;
      }

      setAccount(
        (data as WhatsAppAccount) ||
          null
      );
    }, [currentUser]);

  const loadConversations =
    useCallback(
      async (
        silent = false
      ) => {
        if (!currentUser) {
          return;
        }

        if (!silent) {
          setLoading(true);
        }

        try {
          const data =
            await apiFetch(
              '/api/whatsapp/conversations'
            );

          const nextConversations =
            (data.conversations ||
              []) as WhatsAppConversation[];

          setConversations(
            nextConversations
          );

          setSelectedConversationId(
            (current) => {
              if (
                current &&
                nextConversations.some(
                  (conversation) =>
                    conversation.id ===
                    current
                )
              ) {
                return current;
              }

              return (
                nextConversations[0]
                  ?.id || null
              );
            }
          );

          setError(null);
        } catch (requestError: any) {
          console.error(
            requestError
          );

          if (!silent) {
            setError(
              requestError?.message ||
                'Erro ao carregar conversas.'
            );
          }
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [
        apiFetch,
        currentUser,
      ]
    );

  const loadMessages =
    useCallback(
      async (
        conversationId: string,
        silent = false
      ) => {
        if (!conversationId) {
          return;
        }

        if (!silent) {
          setLoadingMessages(true);
        }

        try {
          const data =
            await apiFetch(
              `/api/whatsapp/messages?conversationId=${encodeURIComponent(
                conversationId
              )}`
            );

          setMessages(
            (data.messages ||
              []) as WhatsAppMessage[]
          );

          setConversations(
            (current) =>
              current.map(
                (conversation) =>
                  conversation.id ===
                  conversationId
                    ? {
                        ...conversation,
                        unread_count: 0,
                      }
                    : conversation
              )
          );

          setError(null);
        } catch (requestError: any) {
          console.error(
            requestError
          );

          if (!silent) {
            setError(
              requestError?.message ||
                'Erro ao carregar mensagens.'
            );
          }
        } finally {
          if (!silent) {
            setLoadingMessages(false);
          }
        }
      },
      [apiFetch]
    );

  const handleSetup =
    useCallback(async () => {
      setConnecting(true);
      setError(null);

      try {
        await apiFetch(
          '/api/whatsapp/setup',
          {
            method: 'POST',
            body: JSON.stringify({}),
          }
        );

        await loadAccount();
        await loadConversations();

        setError(null);
      } catch (setupError: any) {
        setError(
          setupError?.message ||
            'Não foi possível configurar o WhatsApp.'
        );
      } finally {
        setConnecting(false);
      }
    }, [
      apiFetch,
      loadAccount,
      loadConversations,
    ]);

  const handleSend =
    useCallback(async () => {
      if (
        !selectedConversationId ||
        !messageText.trim() ||
        sending
      ) {
        return;
      }

      const content =
        messageText.trim();

      setSending(true);
      setError(null);

      try {
        await apiFetch(
          '/api/whatsapp/send',
          {
            method: 'POST',
            body: JSON.stringify({
              conversationId:
                selectedConversationId,
              message: content,
            }),
          }
        );

        setMessageText('');

        await loadMessages(
          selectedConversationId,
          true
        );

        await loadConversations(
          true
        );
      } catch (sendError: any) {
        if (
          sendError?.code ===
          'OUTSIDE_24H_WINDOW'
        ) {
          setError(
            'A janela de atendimento de 24 horas terminou. Para falar novamente com esse contato será necessário utilizar um template aprovado pela Meta.'
          );
        } else {
          setError(
            sendError?.message ||
              'Não foi possível enviar a mensagem.'
          );
        }
      } finally {
        setSending(false);
      }
    }, [
      apiFetch,
      loadConversations,
      loadMessages,
      messageText,
      selectedConversationId,
      sending,
    ]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const initialize =
      async () => {
        await loadAccount();
        await loadConversations();
      };

    initialize();
  }, [
    currentUser,
    loadAccount,
    loadConversations,
  ]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    loadMessages(
      selectedConversationId
    );
  }, [
    selectedConversationId,
    loadMessages,
  ]);

  /*
   * Supabase Realtime.
   *
   * Conversas e mensagens são atualizadas
   * automaticamente quando o webhook grava
   * novos dados.
   */
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const channel =
      supabase
        .channel(
          `mirra-whatsapp-${currentUser.id}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'whatsapp_conversations',
            filter:
              `scope_key=eq.${currentUser.scopeKey}`,
          },
          () => {
            loadConversations(true);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'whatsapp_messages',
            filter:
              `scope_key=eq.${currentUser.scopeKey}`,
          },
          (payload: any) => {
            const conversationId =
              payload?.new
                ?.conversation_id ||
              payload?.old
                ?.conversation_id;

            if (
              conversationId &&
              conversationId ===
                selectedConversationId
            ) {
              loadMessages(
                conversationId,
                true
              );
            }

            loadConversations(true);
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    currentUser,
    loadConversations,
    loadMessages,
    selectedConversationId,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: 'smooth',
      }
    );
  }, [messages]);

  const filteredConversations =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return conversations;
      }

      return conversations.filter(
        (conversation) => {
          const lead =
            getRelationOne(
              conversation.leads
            );

          const seller =
            getRelationOne(
              conversation.profiles
            );

          return [
            conversation.contact_name,
            conversation.phone_number,
            conversation.last_message_preview,
            lead?.nome,
            lead?.nome_empresa,
            seller?.name,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(term)
            );
        }
      );
    }, [
      conversations,
      search,
    ]);

  const totalUnread =
    conversations.reduce(
      (sum, conversation) =>
        sum +
        (conversation.unread_count ||
          0),
      0
    );

  const openConversations =
    conversations.filter(
      (conversation) =>
        conversation.status ===
        'open'
    ).length;

  const selectedLead =
    getRelationOne(
      selectedConversation?.leads
    );

  const selectedSeller =
    getRelationOne(
      selectedConversation?.profiles
    );

  const canSendFreeText =
    (() => {
      if (
        !selectedConversation
          ?.last_inbound_at
      ) {
        return false;
      }

      const lastInbound =
        new Date(
          selectedConversation.last_inbound_at
        ).getTime();

      if (
        Number.isNaN(
          lastInbound
        )
      ) {
        return false;
      }

      return (
        Date.now() -
          lastInbound <=
        24 * 60 * 60 * 1000
      );
    })();

  return (
    <div className="p-4 md:p-6 max-w-[1800px] mx-auto space-y-5 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div>
            <h1 className="text-2xl font-bold">
              {t.whatsapp.title}
            </h1>

            <p className="text-sm text-muted-foreground">
              {t.whatsapp.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {account ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-sm">
              <Wifi className="w-4 h-4 text-emerald-500" />

              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Conectado
              </span>

              {account.display_phone_number && (
                <span className="text-muted-foreground">
                  {
                    account.display_phone_number
                  }
                </span>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm">
              <WifiOff className="w-4 h-4 text-amber-500" />

              <span className="text-muted-foreground">
                {t.whatsapp.status}:
              </span>

              <span className="font-semibold">
                {
                  t.whatsapp
                    .disconnected
                }
              </span>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              loadAccount();
              loadConversations();
            }}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Atualizar
          </Button>

          {!account &&
            (currentUser?.role ===
              'owner' ||
              currentUser?.role ===
                'admin') && (
              <Button
                type="button"
                size="sm"
                onClick={
                  handleSetup
                }
                disabled={
                  connecting
                }
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Settings2 className="w-4 h-4 mr-2" />
                )}

                Ativar integração
              </Button>
            )}
        </div>
      </div>

      {/* ERRO */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />

          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              Atenção
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setError(null)
            }
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  Conversas abertas
                </p>

                <p className="text-2xl font-bold mt-2">
                  {openConversations}
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
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  Não lidas
                </p>

                <p className="text-2xl font-bold mt-2">
                  {totalUnread}
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  Leads no CRM
                </p>

                <p className="text-2xl font-bold mt-2">
                  {leads.length}
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  WhatsApp
                </p>

                <p className="text-sm font-semibold mt-2">
                  {account
                    ? 'Ativo'
                    : 'Aguardando conexão'}
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* INBOX */}
      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 h-[calc(100vh-310px)] min-h-[600px]">
        {/* CONVERSAS */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="border-b border-border pb-4 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Conversas
            </CardTitle>

            <div className="relative pt-2">
              <Search className="absolute left-3 top-[22px] w-4 h-4 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Buscar conversa..."
                className="pl-9"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-7 h-7 animate-spin mb-3" />
                <p className="text-sm">
                  Carregando conversas...
                </p>
              </div>
            ) : filteredConversations.length ===
              0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Inbox className="w-6 h-6 text-muted-foreground" />
                </div>

                <p className="text-sm font-semibold">
                  Nenhuma conversa
                </p>

                <p className="text-xs text-muted-foreground mt-2">
                  As conversas recebidas pelo WhatsApp aparecerão aqui.
                </p>
              </div>
            ) : (
              filteredConversations.map(
                (conversation) => {
                  const lead =
                    getRelationOne(
                      conversation.leads
                    );

                  const active =
                    conversation.id ===
                    selectedConversationId;

                  return (
                    <button
                      key={
                        conversation.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedConversationId(
                          conversation.id
                        )
                      }
                      className={`w-full text-left px-4 py-4 border-b border-border transition-colors ${
                        active
                          ? 'bg-primary/10'
                          : 'hover:bg-secondary/60'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="w-11 h-11 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">
                              {lead?.nome ||
                                conversation.contact_name ||
                                formatPhone(
                                  conversation.phone_number
                                )}
                            </p>

                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatConversationDate(
                                conversation.last_message_at
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground truncate flex-1">
                              {conversation.last_message_preview ||
                                'Nova conversa'}
                            </p>

                            {conversation.unread_count >
                              0 && (
                              <span className="min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {
                                  conversation.unread_count
                                }
                              </span>
                            )}
                          </div>

                          {lead?.nome_empresa && (
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">
                              {
                                lead.nome_empresa
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                }
              )
            )}
          </CardContent>
        </Card>

        {/* CHAT */}
        <Card className="overflow-hidden flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center">
                <Smartphone className="w-9 h-9 text-emerald-500" />
              </div>

              <h2 className="text-xl font-bold mt-6">
                Central WhatsApp
              </h2>

              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Selecione uma conversa para visualizar o histórico e atender o cliente sem sair do MirraCRM.
              </p>

              {!account && (
                <div className="mt-6 inline-flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <WifiOff className="w-4 h-4" />
                  Integração ainda não conectada
                </div>
              )}
            </div>
          ) : (
            <>
              {/* CABEÇALHO DO CHAT */}
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-500" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {selectedLead?.nome ||
                        selectedConversation.contact_name ||
                        formatPhone(
                          selectedConversation.phone_number
                        )}
                    </p>

                    <p className="text-xs text-muted-foreground truncate">
                      {formatPhone(
                        selectedConversation.phone_number
                      )}

                      {selectedLead?.nome_empresa
                        ? ` • ${selectedLead.nome_empresa}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-2">
                  {selectedSeller && (
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Responsável
                      </p>

                      <p className="text-xs font-semibold">
                        {
                          selectedSeller.name
                        }
                      </p>
                    </div>
                  )}

                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* MENSAGENS */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 bg-secondary/10">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <MessageCircle className="w-9 h-9 opacity-30" />

                    <p className="text-sm mt-3">
                      Nenhuma mensagem registrada.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map(
                      (message) => {
                        const outbound =
                          message.direction ===
                          'outbound';

                        return (
                          <div
                            key={
                              message.id
                            }
                            className={`flex ${
                              outbound
                                ? 'justify-end'
                                : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                outbound
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'bg-card border border-border rounded-bl-md'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.content ||
                                  `[${message.message_type}]`}
                              </p>

                              <div
                                className={`flex items-center justify-end gap-1.5 mt-1 ${
                                  outbound
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                <span className="text-[10px]">
                                  {formatMessageTime(
                                    message.created_at
                                  )}
                                </span>

                                {outbound &&
                                  getMessageStatusIcon(
                                    message.status
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}

                    <div
                      ref={
                        messagesEndRef
                      }
                    />
                  </div>
                )}
              </div>

              {/* JANELA 24 HORAS */}
              {!canSendFreeText && (
                <div className="px-4 py-2.5 border-t border-amber-500/20 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400">
                  A janela de atendimento de 24 horas não está aberta. O envio de texto livre fica bloqueado; posteriormente adicionaremos templates aprovados.
                </div>
              )}

              {/* COMPOSER */}
              <div className="p-4 border-t border-border bg-card shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    value={
                      messageText
                    }
                    onChange={(
                      event
                    ) =>
                      setMessageText(
                        event.target
                          .value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                          'Enter' &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={
                      !account ||
                      !canSendFreeText ||
                      sending
                    }
                    placeholder={
                      canSendFreeText
                        ? 'Digite sua mensagem...'
                        : 'Aguardando nova mensagem do cliente ou template aprovado...'
                    }
                    rows={1}
                    className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                  />

                  <Button
                    type="button"
                    size="icon"
                    className="h-11 w-11 rounded-xl shrink-0"
                    onClick={
                      handleSend
                    }
                    disabled={
                      !account ||
                      !canSendFreeText ||
                      !messageText.trim() ||
                      sending
                    }
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground mt-2">
                  Enter envia • Shift + Enter cria uma nova linha
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}