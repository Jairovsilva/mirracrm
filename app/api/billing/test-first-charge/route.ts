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
   * ==========================================
   * ROTA TEMPORÁRIA DE TESTE DE BILLING
   * ==========================================
   *
   * Testa:
   *
   * active
   *   ↓
   * criação da renovação mensal
   *   ↓
   * pagamento aprovado simulado
   *   ↓
   * aplicação da renovação
   *   ↓
   * extensão do período
   *   ↓
   * reenvio do mesmo pagamento
   *   ↓
   * idempotência
   *   ↓
   * rollback
   *
   * Esta rota NÃO chama o Mercado Pago.
   * Esta rota NÃO realiza cobrança real.
   *
   * O teste SQL termina propositalmente
   * com exception para reverter todos os
   * registros fictícios criados.
   */

  /*
   * Segurança adicional:
   * nunca permitir esta rota em produção.
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
   * Reutilizamos temporariamente o segredo
   * de setup que já existe no Preview.
   *
   * O segredo nunca deve ser colocado
   * diretamente no código.
   */
  const expectedSecret =
    process.env.MERCADO_PAGO_SETUP_SECRET;

  const receivedSecret =
    request.headers.get(
      'x-setup-secret'
    );

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
    /*
     * Cliente administrativo.
     *
     * SUPABASE_SERVICE_ROLE_KEY faz com que
     * auth.role() dentro dos RPCs protegidos
     * seja service_role.
     */
    const admin =
      getAdminSupabase();

    /*
     * Executa o teste transacional criado
     * no PostgreSQL.
     */
    const {
      data,
      error,
    } = await admin.rpc(
      'test_monthly_renewal_pipeline'
    );

    /*
     * IMPORTANTE:
     *
     * O resultado de sucesso chega como
     * "erro" propositalmente.
     *
     * A função PostgreSQL lança:
     *
     * TEST_OK_MONTHLY_RENEWAL_AND_
     * IDEMPOTENCY_ROLLBACK
     *
     * justamente para forçar rollback de
     * todos os dados fictícios do teste.
     */
    if (error) {
      const message =
        String(
          error.message || ''
        );

      if (
        message.includes(
          'TEST_OK_MONTHLY_RENEWAL_AND_IDEMPOTENCY_ROLLBACK'
        )
      ) {
        return NextResponse.json(
          {
            ok: true,

            test:
              'monthly_renewal_pipeline',

            result:
              'TEST_OK_MONTHLY_RENEWAL_AND_IDEMPOTENCY_ROLLBACK',

            renewal: true,

            idempotency: true,

            rollback: true,
          },
          {
            status: 200,
            headers: noStore,
          }
        );
      }

      /*
       * Qualquer outro erro significa
       * falha verdadeira no teste.
       */
      console.error(
        'Teste de renovação mensal falhou:',
        error
      );

      return NextResponse.json(
        {
          ok: false,

          test:
            'monthly_renewal_pipeline',

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
     * Não deveríamos chegar aqui.
     *
     * Se a função retornar normalmente,
     * significa que o rollback proposital
     * não aconteceu.
     */
    return NextResponse.json(
      {
        ok: false,

        test:
          'monthly_renewal_pipeline',

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
      'Erro inesperado no teste de renovação:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        test:
          'monthly_renewal_pipeline',

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

/*
 * GET serve apenas para verificar que
 * a rota temporária está publicada.
 *
 * Não executa nenhum teste financeiro.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,

      route:
        'MirraCRM temporary monthly renewal test',

      test:
        'monthly_renewal_pipeline',

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
