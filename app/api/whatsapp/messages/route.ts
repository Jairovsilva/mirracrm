import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  getAdminSupabase,
  getRequesterContext,
} from '@/src/lib/whatsapp/server';

export async function GET(
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

    const {
      searchParams,
    } = new URL(request.url);

    const conversationId =
      searchParams.get(
        'conversationId'
      );

    if (!conversationId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'conversationId é obrigatório.',
        },
        { status: 400 }
      );
    }

    const {
      data: conversation,
      error: conversationError,
    } = await requester.client
      .from(
        'whatsapp_conversations'
      )
      .select(
        'id,scope_key,assigned_user_id'
      )
      .eq(
        'id',
        conversationId
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

    const {
      data: messages,
      error: messagesError,
    } = await requester.client
      .from(
        'whatsapp_messages'
      )
      .select(`
        id,
        conversation_id,
        meta_message_id,
        direction,
        message_type,
        sender_phone,
        recipient_phone,
        content,
        media_id,
        media_url,
        media_mime_type,
        status,
        sent_by_user_id,
        created_at
      `)
      .eq(
        'conversation_id',
        conversationId
      )
      .order(
        'created_at',
        {
          ascending: true,
        }
      );

    if (messagesError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            messagesError.message,
        },
        { status: 400 }
      );
    }

    /*
     * Marcação de "lido no CRM".
     * Usamos service_role porque usuários
     * não possuem UPDATE direto por RLS.
     */
    const admin =
      getAdminSupabase();

    await admin
      .from(
        'whatsapp_conversations'
      )
      .update({
        unread_count: 0,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        conversationId
      )
      .eq(
        'scope_key',
        requester.scopeKey
      );

    return NextResponse.json({
      ok: true,
      messages:
        messages || [],
    });
  } catch (error: any) {
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