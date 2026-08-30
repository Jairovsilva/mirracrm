import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  extractWhatsAppMessageText,
  getAdminSupabase,
  getWhatsAppAccountByPhoneNumberId,
  getWhatsAppMediaId,
  normalizePhone,
  validateMetaSignature,
} from '@/src/lib/whatsapp/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest
) {
  const {
    searchParams,
  } = new URL(request.url);

  const mode =
    searchParams.get('hub.mode');

  const token =
    searchParams.get(
      'hub.verify_token'
    );

  const challenge =
    searchParams.get(
      'hub.challenge'
    );

  const expectedToken =
    process.env
      .WHATSAPP_VERIFY_TOKEN;

  if (
    mode === 'subscribe' &&
    token &&
    expectedToken &&
    token === expectedToken
  ) {
    return new NextResponse(
      challenge || '',
      {
        status: 200,
      }
    );
  }

  return new NextResponse(
    'Forbidden',
    {
      status: 403,
    }
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const rawBody =
      await request.text();

    const signature =
      request.headers.get(
        'x-hub-signature-256'
      );

    if (
      !validateMetaSignature(
        rawBody,
        signature
      )
    ) {
      console.error(
        'Webhook Meta com assinatura inválida.'
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid signature.',
        },
        { status: 401 }
      );
    }

    let payload: any;

    try {
      payload =
        JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Payload inválido.',
        },
        { status: 400 }
      );
    }

    /*
     * A Meta espera resposta rápida.
     *
     * Processamos todos os eventos
     * recebidos neste payload antes
     * de retornar 200.
     */

    const entries =
      Array.isArray(
        payload?.entry
      )
        ? payload.entry
        : [];

    for (
      const entry of entries
    ) {
      const changes =
        Array.isArray(
          entry?.changes
        )
          ? entry.changes
          : [];

      for (
        const change of changes
      ) {
        if (
          change?.field !==
          'messages'
        ) {
          continue;
        }

        const value =
          change?.value || {};

        const phoneNumberId =
          String(
            value?.metadata
              ?.phone_number_id ||
            ''
          );

        if (!phoneNumberId) {
          continue;
        }

        const account =
          await getWhatsAppAccountByPhoneNumberId(
            phoneNumberId
          );

        if (!account) {
          console.error(
            'Webhook recebido para phone_number_id não cadastrado:',
            phoneNumberId
          );

          continue;
        }

        const admin =
          getAdminSupabase();

        /*
         * STATUS DE MENSAGENS
         */
        const statuses =
          Array.isArray(
            value?.statuses
          )
            ? value.statuses
            : [];

        for (
          const statusEvent of statuses
        ) {
          const messageId =
            statusEvent?.id;

          const status =
            statusEvent?.status;

          if (
            !messageId ||
            !status
          ) {
            continue;
          }

          if (
            ![
              'sent',
              'delivered',
              'read',
              'failed',
            ].includes(status)
          ) {
            continue;
          }

          await admin
            .from(
              'whatsapp_messages'
            )
            .update({
              status,
              raw_payload:
                statusEvent,
            })
            .eq(
              'meta_message_id',
              messageId
            );
        }

        /*
         * MENSAGENS RECEBIDAS
         */
        const messages =
          Array.isArray(
            value?.messages
          )
            ? value.messages
            : [];

        const contacts =
          Array.isArray(
            value?.contacts
          )
            ? value.contacts
            : [];

        for (
          const message of messages
        ) {
          const metaMessageId =
            String(
              message?.id || ''
            );

          if (!metaMessageId) {
            continue;
          }

          /*
           * Idempotência:
           * webhook pode ser reenviado
           * pela Meta.
           */
          const {
            data: existingMessage,
          } = await admin
            .from(
              'whatsapp_messages'
            )
            .select('id')
            .eq(
              'meta_message_id',
              metaMessageId
            )
            .maybeSingle();

          if (existingMessage) {
            continue;
          }

          const senderPhone =
            normalizePhone(
              message?.from
            );

          if (!senderPhone) {
            continue;
          }

          const contactName =
            contacts?.[0]
              ?.profile?.name ||
            senderPhone;

          const messageText =
            extractWhatsAppMessageText(
              message
            );

          const mediaId =
            getWhatsAppMediaId(
              message
            );

          let receivedAt =
            new Date()
              .toISOString();

          if (
            message?.timestamp
          ) {
            const timestamp =
              Number(
                message.timestamp
              );

            if (
              Number.isFinite(
                timestamp
              )
            ) {
              receivedAt =
                new Date(
                  timestamp * 1000
                ).toISOString();
            }
          }

          /*
           * 1. BUSCAR LEAD
           */
          let {
            data: lead,
          } = await admin
            .from('leads')
            .select('*')
            .eq(
              'scope_key',
              account.scope_key
            )
            .eq(
              'whatsapp_phone_normalized',
              senderPhone
            )
            .maybeSingle();

          /*
           * 2. DEFINIR VENDEDOR
           */
          let assignedUserId:
            | string
            | null =
            null;

          const {
            data: sellers,
          } = await admin
            .from('profiles')
            .select(
              'id,name,role,created_at'
            )
            .eq(
              'scope_key',
              account.scope_key
            )
            .eq(
              'role',
              'vendedor'
            )
            .order(
              'created_at',
              {
                ascending: true,
              }
            );

          if (
            sellers &&
            sellers.length > 0
          ) {
            /*
             * Distribuição por menor
             * quantidade de conversas
             * abertas.
             */
            let selectedSeller =
              sellers[0];

            let smallestCount =
              Number.MAX_SAFE_INTEGER;

            for (
              const seller of sellers
            ) {
              const {
                count,
              } = await admin
                .from(
                  'whatsapp_conversations'
                )
                .select(
                  'id',
                  {
                    count:
                      'exact',
                    head:
                      true,
                  }
                )
                .eq(
                  'scope_key',
                  account.scope_key
                )
                .eq(
                  'assigned_user_id',
                  seller.id
                )
                .eq(
                  'status',
                  'open'
                );

              const sellerCount =
                count || 0;

              if (
                sellerCount <
                smallestCount
              ) {
                smallestCount =
                  sellerCount;

                selectedSeller =
                  seller;
              }
            }

            assignedUserId =
              selectedSeller.id;
          }

          /*
           * Se não houver vendedor,
           * usa owner/admin como fallback.
           */
          if (
            !assignedUserId
          ) {
            const {
              data: fallbackUser,
            } = await admin
              .from('profiles')
              .select(
                'id,role'
              )
              .eq(
                'scope_key',
                account.scope_key
              )
              .in(
                'role',
                [
                  'owner',
                  'admin',
                ]
              )
              .order(
                'created_at',
                {
                  ascending: true,
                }
              )
              .limit(1)
              .maybeSingle();

            assignedUserId =
              fallbackUser?.id ||
              null;
          }

          /*
           * 3. CRIAR LEAD SE NÃO EXISTE
           */
          if (!lead) {
            if (
              !assignedUserId
            ) {
              console.error(
                'Nenhum usuário disponível para criar lead WhatsApp.'
              );

              continue;
            }

            const {
              data: createdLead,
              error:
                createdLeadError,
            } = await admin
              .from('leads')
              .insert({
                scope_key:
                  account.scope_key,

                nome:
                  contactName,

                cargo: '',

                email_corporativo:
                  '',

                telefone_celular:
                  senderPhone,

                telefone_fixo:
                  '',

                nome_empresa:
                  'Contato via WhatsApp',

                cnpj: '',

                linkedin: '',

                stage:
                  'entrada',

                temperatura:
                  'morno',

                valor_proposta:
                  0,

                probabilidade:
                  0.05,

                created_by_user_id:
                  assignedUserId,

                created_at:
                  receivedAt,

                updated_at:
                  receivedAt,
              })
              .select()
              .single();

            if (
              createdLeadError ||
              !createdLead
            ) {
              console.error(
                'Erro ao criar Lead WhatsApp:',
                createdLeadError
              );

              continue;
            }

            lead =
              createdLead;
          }

          /*
           * 4. BUSCAR OU CRIAR CONVERSA
           */
          let {
            data: conversation,
          } = await admin
            .from(
              'whatsapp_conversations'
            )
            .select('*')
            .eq(
              'whatsapp_account_id',
              account.id
            )
            .eq(
              'phone_number',
              senderPhone
            )
            .maybeSingle();

          if (!conversation) {
            const {
              data:
                createdConversation,

              error:
                conversationError,
            } = await admin
              .from(
                'whatsapp_conversations'
              )
              .insert({
                scope_key:
                  account.scope_key,

                whatsapp_account_id:
                  account.id,

                lead_id:
                  lead.id,

                phone_number:
                  senderPhone,

                contact_name:
                  contactName,

                assigned_user_id:
                  assignedUserId,

                status:
                  'open',

                unread_count:
                  0,

                created_at:
                  receivedAt,

                updated_at:
                  receivedAt,
              })
              .select()
              .single();

            if (
              conversationError ||
              !createdConversation
            ) {
              console.error(
                'Erro ao criar conversa:',
                conversationError
              );

              continue;
            }

            conversation =
              createdConversation;
          }

          /*
           * Se a conversa já existia,
           * preservamos seu vendedor.
           */
          if (
            conversation
              .assigned_user_id
          ) {
            assignedUserId =
              conversation
                .assigned_user_id;
          }

          /*
           * 5. GRAVAR MENSAGEM
           */
          const {
            error:
              messageInsertError,
          } = await admin
            .from(
              'whatsapp_messages'
            )
            .insert({
              scope_key:
                account.scope_key,

              conversation_id:
                conversation.id,

              meta_message_id:
                metaMessageId,

              direction:
                'inbound',

              message_type:
                message?.type ||
                'text',

              sender_phone:
                senderPhone,

              recipient_phone:
                phoneNumberId,

              content:
                messageText,

              media_id:
                mediaId,

              status:
                'received',

              raw_payload:
                message,

              created_at:
                receivedAt,
            });

          if (
            messageInsertError
          ) {
            console.error(
              'Erro ao gravar mensagem:',
              messageInsertError
            );

            continue;
          }

          /*
           * 6. ATUALIZAR CONVERSA
           */
          await admin.rpc(
            'touch_whatsapp_inbound',
            {
              p_conversation_id:
                conversation.id,

              p_preview:
                messageText,

              p_received_at:
                receivedAt,
            }
          );

          /*
           * 7. CRIAR ALERTA
           *
           * IMPORTANTE:
           * seu schema usa user_id,
           * não profile_id.
           */
          if (
            assignedUserId
          ) {
            await admin
              .from('alerts')
              .insert({
                user_id:
                  assignedUserId,

                type:
                  'info',

                title:
                  '💬 Nova mensagem no WhatsApp',

                message:
                  `${contactName}: ${messageText}`,

                lead_id:
                  lead.id,

                read:
                  false,

                created_at:
                  receivedAt,
              });
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error(
      'Erro no webhook WhatsApp:',
      error
    );

    /*
     * Não mascaramos erros durante
     * desenvolvimento.
     */
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Erro inesperado.',
      },
      { status: 500 }
    );
  }
}