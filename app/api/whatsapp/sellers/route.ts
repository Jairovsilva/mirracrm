import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminSupabase,
  getRequesterContext,
} from '@/src/lib/whatsapp/server';

export async function GET(request: NextRequest) {
  try {
    const requester = await getRequesterContext(request);

    if (!requester) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sessão inválida.',
        },
        { status: 401 }
      );
    }

    // Somente proprietários e administradores
    // podem consultar a lista de vendedores.
    if (
      requester.role !== 'owner' &&
      requester.role !== 'admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Acesso não autorizado.',
        },
        { status: 403 }
      );
    }

    // Busca somente vendedores do mesmo ambiente.
    const { data, error } = await getAdminSupabase()
      .from('profiles')
      .select('id,name,email')
      .eq('scope_key', requester.scopeKey)
      .eq('role', 'vendedor')
      .order('name', { ascending: true });

    if (error) {
      console.error(
        'Erro ao listar vendedores WhatsApp:',
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error: 'Não foi possível carregar os vendedores.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sellers: data || [],
    });
  } catch (error) {
    console.error(
      'Erro inesperado ao listar vendedores WhatsApp:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: 'Erro inesperado.',
      },
      { status: 500 }
    );
  }
}
