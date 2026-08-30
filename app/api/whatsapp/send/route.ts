import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  assertWhatsAppEnvironment,
  getAdminSupabase,
  getRequesterContext,
  isWithin24HourWindow,
} from '@/src/lib/whatsapp/server';

export async function POST(
  request: NextRequest
) {
  try {
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
        { status: 401 }
      );
    }

    const body =
      await request.json();

    const conversationId =
      String(
        body?.conversationId ||
        ''
      ).trim();

    const message =
      String(
        body?.message ||
        ''
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
        { status: 400 }
      );
    }

    if (
      message.length >
      4096
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Mensagem excede o limite permitido.',
        },
        { status: 400 }
      );
    }

    const admin =
      getAdminSupabase();

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
        phone_number,
        last_inbound_at,
        whatsapp_account_id,
        whatsapp_accounts (
          id,
          phone_number_id,
          status
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
        { status: 404 }
      );
    }

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
        { status: 409 }
      );
    }

    const accountRaw =
      conversation
        .whatsapp_accounts as any;

    const account =
      Array.isArray(accountRaw)
        ? accountRaw[0]
        : accountRaw;

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
        { status: 400 }
      );
    }

    const env =
      assertWhatsAppEnvironment();

    const phoneNumberId =
      account.phone_number_id;

    const url =
      `https://graph.facebook.com/${env.graphVersion}/${phoneNumberId}/messages`;

    const metaResponse =
      await fetch(
        url,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${env.accessToken}`,

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
        }
      );

    const metaJson =
      await metaResponse.json();

    if (!metaResponse.ok) {
      console.error(
        'Erro Meta Send API:',
        metaJson
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            metaJson?.error?.message ||
            'A Meta rejeitou o envio.',
          meta: metaJson,
        },
        {
          status:
            metaResponse.status,
        }
      );
    }

    const metaMessageId =
      metaJson?.messages?.[0]?.id ||
      null;

    const now =
      new Date().toISOString();

    const {
      data: insertedMessage,
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
      console.error(
        'Mensagem enviada mas falhou ao salvar:',
        insertError
      );
    }

    await admin
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
      );

    return NextResponse.json({
      ok: true,
      message:
        insertedMessage,

      metaMessageId,
    });
  } catch (error: any) {
    console.error(
      'Erro send WhatsApp:',
      error
    );

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