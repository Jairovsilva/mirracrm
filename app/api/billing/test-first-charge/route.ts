import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = {
  'Cache-Control': 'no-store',
};

function getAdminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      'Configuração do Supabase ausente.'
    );
  }

  return createClient(
    url,
    serviceRole,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function POST(
  request: NextRequest
) {
  /*
   * ROTA EXCLUSIVAMENTE TEMPORÁRIA
   * PARA TESTE DE BILLING.
   *
   * Ela só funciona em Preview/develop.
   * Em produção, responde 404.
   */
  if (
    process.env.VERCEL_ENV === 'production'
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Not found.',
      },
      {
        status: 404,
        headers: noStore,
      }
    );
  }

  /*
   * Usaremos o mesmo segredo temporário
   * que já existe no Preview para o setup
   * do Mercado Pago.
   *
   * Não coloque esse segredo no código.
   */
  const expectedSecret =
    process.env.MERCADO_PAGO_SETUP_SECRET;

  const receivedSecret =
    request.headers.get('x-setup-secret');

  if (
    !expectedSecret ||
    !receivedSecret ||
    receivedSecret !== expectedSecret
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Unauthorized.',
      },
      {
        status: 401,
        headers: noStore,
      }
    );
  }

  try {
    const admin =
      getAdminSupabase();

    /*
     * A chamada Supabase abaixo usa
     * SUPABASE_SERVICE_ROLE_KEY.
     *
     * Portanto auth.role() dentro do
     * PostgreSQL será service_role.
     */
    const {
      data,
      error,
    } = await admin.rpc(
      'test_first_mercado_pago_charge'
    );

    /*
     * TEST_OK... chega como "erro"
     * propositalmente.
     *
     * A exception dentro da função força
     * rollback de TODOS os dados fictícios
     * criados pelo teste.
     */
    if (error) {
      const message =
        String(error.message || '');

      if (
        message.includes(
          'TEST_OK_FIRST_MP_CHARGE_ROLLBACK'
        )
      ) {
        return NextResponse.json(
          {
            ok: true,
            test:
              'first_mercado_pago_charge',
            result:
              'TEST_OK_FIRST_MP_CHARGE_ROLLBACK',
            rollback: true,
          },
          {
            status: 200,
            headers: noStore,
          }
        );
      }

      console.error(
        'Teste financeiro falhou:',
        error
      );

      return NextResponse.json(
        {
          ok: false,
          test:
            'first_mercado_pago_charge',
          error: message,
          code:
            error.code || null,
          details:
            error.details || null,
          hint:
            error.hint || null,
        },
        {
          status: 500,
          headers: noStore,
        }
      );
    }

    /*
     * Não esperamos chegar aqui porque
     * o teste termina propositalmente
     * com exception para garantir rollback.
     */
    return NextResponse.json(
      {
        ok: false,
        test:
          'first_mercado_pago_charge',
        error:
          'O teste terminou sem executar o rollback proposital.',
        unexpectedData:
          data ?? null,
      },
      {
        status: 500,
        headers: noStore,
      }
    );
  } catch (error) {
    console.error(
      'Erro inesperado no teste financeiro:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado.',
      },
      {
        status: 500,
        headers: noStore,
      }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route:
        'MirraCRM temporary billing test',
      production:
        process.env.VERCEL_ENV ===
        'production',
    },
    {
      status: 200,
      headers: noStore,
    }
  );
}
