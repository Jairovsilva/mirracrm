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

    /*
     * Buscar a conversa exclusivamente
     * dentro do ambiente do usuário.
     */
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

    /*
     * AUTORIZAÇÃO:
     *
     * Proprietários e administradores podem
     * acessar todas as conversas do
     * próprio ambiente.
     *
     * Vendedores podem acessar somente
     * conversas atribuídas a eles.
     *
     * Conversas sem responsável ficam
     * disponíveis apenas para owner/admin.
     */
    const isManager =
      requester.role === 'owner' ||
      requester.role === 'admin';

    const canAccessConversation =
      conversation.scope_key ===
        requester.scopeKey &&
      (
        isManager ||
        conversation.assigned_user_id ===
          requester.userId
      );

    if (!canAccessConversation) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Conversa não encontrada.',
        },
        { status: 404 }
      );
    }

    /*
     * Buscar mensagens somente depois
     * de confirmar a autorização.
     *
     * O filtro por scope_key reforça
     * o isolamento entre ambientes.
     */
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
      .eq(
        'scope_key',
        requester.scopeKey
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
     *
     * Usamos service_role porque usuários
     * não possuem UPDATE direto por RLS.
     *
     * Esta operação só acontece depois
     * da validação de autorização acima.
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
