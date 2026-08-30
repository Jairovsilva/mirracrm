import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
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
      data,
      error,
    } = await requester.client
      .from(
        'whatsapp_conversations'
      )
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
      .eq(
        'scope_key',
        requester.scopeKey
      )
      .order(
        'last_message_at',
        {
          ascending: false,
          nullsFirst: false,
        }
      );

    if (error) {
      console.error(
        'Erro ao carregar conversas:',
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversations:
        data || [],
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