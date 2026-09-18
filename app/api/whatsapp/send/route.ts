import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  getAdminSupabase,
  getRequesterContext,
  isWithin24HourWindow,
} from '@/src/lib/whatsapp/server';

export const runtime = 'nodejs';

interface WhatsAppAccountForSend {
  id: string;
  phone_number_id: string;
  status:
    | 'active'
    | 'inactive'
    | 'error';
  access_token_secret_id:
    | string
    | null;
}

function getGraphVersion(): string {
  return (
    process.env
      .WHATSAPP_GRAPH_API_VERSION ||
    'v23.0'
  );
}

/**
 * Recupera o token correto para a conta.
 *
 * PRIORIDADE:
 *
 * 1. Token individual da conta,
 *    armazenado no Supabase Vault.
 *
 * 2. Fallback para o token global
 *    SOMENTE quando o phone_number_id
 *    da conta for exatamente o número
 *    de teste configurado no Vercel.
 *
 * Dessa forma, uma conta real nunca
 * utilizará acidentalmente o token
 * global do ambiente de teste.
 */
async function getAccountAccessToken(
  admin: ReturnType<
    typeof getAdminSupabase
  >,
  account: WhatsAppAccountForSend
): Promise<string> {
  /**
   * Conta conectada pelo Embedded
   * Signup: token individual no Vault.
   */
  if (
    account.access_token_secret_id
  ) {
    const {
      data: tokenData,
      error: tokenError,
    } = await admin.rpc(
      'get_whatsapp_access_token',
      {
        p_secret_id:
          account.access_token_secret_id,
      }
    );

    if (tokenError) {
      console.error(
        'Erro ao recuperar token WhatsApp do Vault:',
        tokenError
      );

      throw new Error(
        'Não foi possível acessar a credencial desta conta do WhatsApp.'
      );
    }

    const token = String(
      tokenData || ''
    ).trim();

    if (!token) {
      throw new Error(
        'A credencial desta conta do WhatsApp não foi encontrada.'
      );
    }

    return token;
  }

  /**
   * Compatibilidade temporária com
   * a conta antiga de teste.
   *
   * O fallback é permitido somente
   * se o número da conversa for
   * exatamente o phone_number_id
   * configurado no Vercel.
   */
  const legacyPhoneNumberId =
    String(
      process.env
        .WHATSAPP_PHONE_NUMBER_ID ||
        ''
    ).trim();

  const legacyAccessToken =
    String(
      process.env
        .WHATSAPP_ACCESS_TOKEN ||
        ''
    ).trim();

  if (
    legacyPhoneNumberId &&
    legacyAccessToken &&
    account.phone_number_id ===
      legacyPhoneNumberId
  ) {
    return legacyAccessToken;
  }

  /**
   * Uma conta real sem segredo no
   * Vault não pode usar o token
   * global como fallback.
   */
  throw new Error(
    'Esta conta do WhatsApp não possui uma credencial válida. Reconecte a conta pelo Embedded Signup.'
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    /**
     * 1. Autenticar usuário.
     */
    const requester =
      await getRequesterContext(
        request
      );

    if (!requester) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sessão inválida.',
        },
        {
          status: 401,
        }
      );
    }

    /**
     * 2. Validar payload.
     */
    let body: any;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Corpo da requisição inválido.',
        },
        {
          status: 400,
        }
      );
    }

    const conversationId =
      String(
        body?.conversationId ||
          ''
      ).trim();

    const message =
      String(
        body?.message || ''
      ).trim();

    if (
      !conversationId ||
      !message
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'conversationId e message são obrigatórios.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      message.length > 4096
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Mensagem excede o limite permitido.',
        },
        {
          status: 400,
        }
      );
    }

    const admin =
      getAdminSupabase();

    /**
     * 3. Buscar conversa dentro
     * do mesmo scope do usuário.
     *
     * Também carregamos o
     * responsável pela conversa
     * e o access_token_secret_id
     * da conta WhatsApp.
     */
    const {
      data: conversation,
      error: conversationError,
    } = await admin
      .from(
        'whatsapp_conversations'
      )
      .select(`
        id,
        scope_key,
        assigned_user_id,
        phone_number,
        last_inbound_at,
        whatsapp_account_id,
        whatsapp_accounts (
          id,
          phone_number_id,
          status,
          access_token_secret_id
        )
      `)
      .eq(
        'id',
        conversationId
      )
      .eq(
        'scope_key',
        requester.scopeKey
      )
      .single();

    if (
      conversationError ||
      !conversation
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Conversa não encontrada.',
        },
        {
          status: 404,
        }
      );
    }

    /**
     * 4. AUTORIZAÇÃO DO ATENDIMENTO.
     *
     * Proprietários e administradores
     * podem atender todas as conversas
     * do próprio ambiente.
     *
     * Vendedores podem enviar mensagens
     * somente nas conversas atribuídas
     * a eles.
     *
     * A verificação acontece ANTES
     * de recuperar credenciais e
     * ANTES de chamar a Meta.
     */
    const isManager =
      requester.role === 'owner' ||
      requester.role === 'admin';

    if (
      !isManager &&
      conversation.assigned_user_id !==
        requester.userId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Você não tem permissão para enviar mensagens nesta conversa.',
        },
        {
          status: 403,
        }
      );
    }

    /**
     * 5. Regra de atendimento
     * dentro da janela de 24 horas.
     */
    if (
      !isWithin24HourWindow(
        conversation.last_inbound_at
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            'OUTSIDE_24H_WINDOW',
          error:
            'A janela de atendimento de 24 horas terminou. Para iniciar uma nova conversa será necessário utilizar um template aprovado.',
        },
        {
          status: 409,
        }
      );
    }

    /**
     * Supabase pode retornar a
     * relação como objeto ou array.
     */
    const accountRaw =
      conversation
        .whatsapp_accounts as unknown;

    const accountData =
      Array.isArray(accountRaw)
        ? accountRaw[0]
        : accountRaw;

    const account =
      accountData as
        | WhatsAppAccountForSend
        | null
        | undefined;

    if (
      !account ||
      account.status !== 'active'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Conta WhatsApp não está ativa.',
        },
        {
          status: 400,
        }
      );
    }

    const phoneNumberId =
      String(
        account.phone_number_id ||
          ''
      ).trim();

    if (!phoneNumberId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'A conta WhatsApp não possui phone_number_id válido.',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * 6. Recuperar a credencial
     * específica da conta.
     *
     * Para contas Embedded Signup,
     * ela vem do Supabase Vault.
     */
    const accessToken =
      await getAccountAccessToken(
        admin,
        account
      );

    const graphVersion =
      getGraphVersion();

    /**
     * 7. Enviar mensagem para
     * a Meta Cloud API.
     */
    const url =
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
        phoneNumberId
      )}/messages`;

    const metaResponse =
      await fetch(url, {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          messaging_product:
            'whatsapp',

          recipient_type:
            'individual',

          to:
            conversation.phone_number,

          type: 'text',

          text: {
            preview_url: false,
            body: message,
          },
        }),

        cache: 'no-store',
      });

    const metaJson =
      await metaResponse.json();

    /**
     * 8. Tratar erro da Meta.
     */
    if (!metaResponse.ok) {
      console.error(
        'Erro Meta Send API:',
        {
          status:
            metaResponse.status,

          code:
            metaJson?.error
              ?.code,

          subcode:
            metaJson?.error
              ?.error_subcode,

          type:
            metaJson?.error
              ?.type,

          message:
            metaJson?.error
              ?.message,

          fbtraceId:
            metaJson?.error
              ?.fbtrace_id,
        }
      );

      return NextResponse.json(
        {
          ok: false,

          error:
            metaJson?.error
              ?.message ||
            'A Meta rejeitou o envio.',

          metaCode:
            metaJson?.error
              ?.code ||
            null,

          metaSubcode:
            metaJson?.error
              ?.error_subcode ||
            null,
        },
        {
          status:
            metaResponse.status,
        }
      );
    }

    const metaMessageId =
      metaJson?.messages?.[0]
        ?.id || null;

    const now =
      new Date().toISOString();

    /**
     * 9. Registrar mensagem
     * enviada no MirraCRM.
     */
    const {
      data:
        insertedMessage,
      error: insertError,
    } = await admin
      .from(
        'whatsapp_messages'
      )
      .insert({
        scope_key:
          requester.scopeKey,

        conversation_id:
          conversationId,

        meta_message_id:
          metaMessageId,

        direction:
          'outbound',

        message_type:
          'text',

        /**
         * Mantemos aqui o
         * comportamento existente
         * do projeto.
         */
        sender_phone:
          phoneNumberId,

        recipient_phone:
          conversation.phone_number,

        content:
          message,

        status:
          'sent',

        sent_by_user_id:
          requester.userId,

        raw_payload:
          metaJson,

        created_at:
          now,
      })
      .select()
      .single();

    if (insertError) {
      /**
       * A Meta já aceitou a
       * mensagem neste ponto.
       *
       * Portanto não podemos
       * retornar "envio falhou"
       * apenas porque o registro
       * local apresentou erro.
       */
      console.error(
        'Mensagem enviada pela Meta, mas falhou ao salvar no banco:',
        insertError
      );
    }

    /**
     * 10. Atualizar resumo da
     * conversa.
     */
    const {
      error:
        conversationUpdateError,
    } = await admin
      .from(
        'whatsapp_conversations'
      )
      .update({
        last_message_preview:
          message,

        last_message_at:
          now,

        updated_at:
          now,
      })
      .eq(
        'id',
        conversationId
      )
      .eq(
        'scope_key',
        requester.scopeKey
      );

    if (
      conversationUpdateError
    ) {
      console.error(
        'Mensagem enviada, mas falhou ao atualizar a conversa:',
        conversationUpdateError
      );
    }

    /**
     * 11. Resposta para o
     * frontend.
     *
     * Nenhum access token ou
     * identificador do Vault é
     * retornado.
     */
    return NextResponse.json({
      ok: true,

      message:
        insertedMessage ||
        null,

      metaMessageId,
    });
  } catch (error: unknown) {
    console.error(
      'Erro send WhatsApp:',
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Erro inesperado.';

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
