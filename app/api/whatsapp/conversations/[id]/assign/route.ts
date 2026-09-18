import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminSupabase,
  getRequesterContext,
} from '@/src/lib/whatsapp/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requester = await getRequesterContext(request);

    if (!requester) {
      return NextResponse.json(
        { ok: false, error: 'Sessão inválida.' },
        { status: 401 }
      );
    }

    const isManager =
      requester.role === 'owner' ||
      requester.role === 'admin';

    if (!isManager) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Apenas proprietários e administradores podem distribuir conversas.',
        },
        { status: 403 }
      );
    }

    const conversationId = String(params.id || '').trim();

    if (!UUID_PATTERN.test(conversationId)) {
      return NextResponse.json(
        { ok: false, error: 'ID da conversa inválido.' },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Corpo da requisição inválido.' },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== 'object' ||
      !('assignedUserId' in body)
    ) {
      return NextResponse.json(
        { ok: false, error: 'assignedUserId é obrigatório.' },
        { status: 400 }
      );
    }

    const value = (
      body as { assignedUserId: unknown }
    ).assignedUserId;

    if (
      value !== null &&
      (typeof value !== 'string' ||
        !UUID_PATTERN.test(value))
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'assignedUserId deve ser um UUID válido ou null.',
        },
        { status: 400 }
      );
    }

    const assignedUserId = value as string | null;
    const admin = getAdminSupabase();

    const {
      data: conversation,
      error: conversationError,
    } = await admin
      .from('whatsapp_conversations')
      .select('id,scope_key')
      .eq('id', conversationId)
      .eq('scope_key', requester.scopeKey)
      .maybeSingle();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { ok: false, error: 'Conversa não encontrada.' },
        { status: 404 }
      );
    }

    if (assignedUserId !== null) {
      const {
        data: seller,
        error: sellerError,
      } = await admin
        .from('profiles')
        .select('id,role,scope_key')
        .eq('id', assignedUserId)
        .eq('scope_key', requester.scopeKey)
        .maybeSingle();

      if (
        sellerError ||
        !seller ||
        seller.role !== 'vendedor'
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Vendedor inválido ou pertencente a outro ambiente.',
          },
          { status: 400 }
        );
      }
    }

    const {
      data: updated,
      error: updateError,
    } = await admin
      .from('whatsapp_conversations')
      .update({
        assigned_user_id: assignedUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('scope_key', requester.scopeKey)
      .select(`
        id,
        scope_key,
        lead_id,
        phone_number,
        contact_name,
        assigned_user_id,
        status,
        unread_count,
        last_message_preview,
        last_message_at,
        last_inbound_at,
        created_at,
        updated_at,
        leads (
          id,
          nome,
          nome_empresa,
          telefone_celular,
          stage,
          temperatura
        ),
        profiles:assigned_user_id (
          id,
          name,
          email
        )
      `)
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Não foi possível atualizar a atribuição.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversation: updated,
    });
  } catch (error: unknown) {
    console.error('Erro ao atribuir conversa:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Erro inesperado ao atribuir conversa.',
      },
      { status: 500 }
    );
  }
}
