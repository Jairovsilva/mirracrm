import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { accessToken } = await req.json();

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sessão ausente. Faça login novamente.',
        },
        { status: 400 }
      );
    }

    // Mantém o mesmo padrão de autenticação já utilizado pelo MirraCRM.
    const requesterClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: userData, error: userError } =
      await requesterClient.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sessão inválida. Faça login novamente.',
        },
        { status: 401 }
      );
    }

    /*
     * Não consultamos email_oauth_credentials aqui.
     * Access token e refresh token do Google nunca são enviados
     * para o navegador.
     */
    const { data: account, error: accountError } =
      await requesterClient
        .from('email_accounts')
        .select(
          'id, provider, email_address, display_name, status, last_error, connected_at'
        )
        .eq('user_id', userData.user.id)
        .eq('provider', 'google')
        .maybeSingle();

    if (accountError) {
      console.error(
        'Erro ao consultar conta de e-mail:',
        accountError
      );

      return NextResponse.json(
        {
          ok: false,
          error: 'Não foi possível consultar a conta de e-mail.',
        },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json({
        ok: true,
        connected: false,
        account: null,
      });
    }

    return NextResponse.json({
      ok: true,
      connected: account.status === 'active',
      account: {
        id: account.id,
        provider: account.provider,
        emailAddress: account.email_address,
        displayName: account.display_name,
        status: account.status,
        lastError: account.last_error,
        connectedAt: account.connected_at,
      },
    });
  } catch (err: any) {
    console.error(
      'Erro inesperado ao consultar conta de e-mail:',
      err
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Erro inesperado ao consultar a conta de e-mail.',
      },
      { status: 500 }
    );
  }
}