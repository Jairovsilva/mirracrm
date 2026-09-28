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
   * TESTE TEMPORÁRIO DE BILLING
   * ==========================================
   *
   * Valida o pipeline completo de uma
   * assinatura recorrente Mercado Pago:
   *
   * 1. assinatura trialing;
   * 2. primeira fatura;
   * 3. trialing -> active;
   * 4. segunda fatura;
   * 5. criação automática da renovação;
   * 6. extensão por exatamente um mês;
   * 7. repetição da segunda fatura;
   * 8. idempotência;
   * 9. rollback de todos os dados fictícios.
   *
   * Esta rota NÃO chama o Mercado Pago.
   * Esta rota NÃO realiza cobrança.
   */

  /*
   * Nunca disponibilizar o teste
   * em produção.
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
   * Proteção adicional da rota.
   *
   * Reutilizamos temporariamente o segredo
   * de setup existente apenas no Preview.
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
     * Cliente Supabase administrativo.
     *
     * A service role é necessária porque
     * todos os RPCs financeiros recusam
     * execução por usuários comuns.
     */
    const admin =
      getAdminSupabase();

    /*
     * Executa o teste transacional completo.
     */
    const {
      data,
      error,
    } = await admin.rpc(
      'test_mercado_pago_subscription_invoice_pipeline'
    );

    /*
     * IMPORTANTE:
     *
     * O teste de sucesso termina
     * propositalmente com uma exception.
     *
     * Isso garante rollback de:
     *
     * - conta fictícia;
     * - assinatura fictícia;
     * - pedidos;
     * - pagamentos;
     * - aplicações financeiras.
     */
    if (error) {
      const message =
        String(
          error.message || ''
        );

      const successMarker =
        'TEST_OK_MP_SUBSCRIPTION_INVOICE_FIRST_RENEWAL_IDEMPOTENCY_ROLLBACK';

      if (
        message.includes(
          successMarker
        )
      ) {
        return NextResponse.json(
          {
            ok: true,

            test:
              'mercado_pago_subscription_invoice_pipeline',

            result:
              successMarker,

            firstPayment: true,

            renewal: true,

            invoiceIdempotency: true,

            rollback: true,
          },
          {
            status: 200,
            headers: noStore,
          }
        );
      }

      /*
       * Qualquer outra exception é
       * uma falha verdadeira do teste.
       */
      console.error(
        'Teste de faturas recorrentes falhou:',
        error
      );

      return NextResponse.json(
        {
          ok: false,

          test:
            'mercado_pago_subscription_invoice_pipeline',

          error:
            message,

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
     * Não esperamos retorno normal.
     *
     * Se isso acontecer, significa que
     * a exception responsável pelo rollback
     * não foi executada.
     */
    return NextResponse.json(
      {
        ok: false,

        test:
          'mercado_pago_subscription_invoice_pipeline',

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
      'Erro inesperado no teste de billing:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        test:
          'mercado_pago_subscription_invoice_pipeline',

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
 * GET não executa operação financeira.
 *
 * Serve apenas para confirmar qual versão
 * da rota temporária está publicada.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,

      route:
        'MirraCRM temporary Mercado Pago invoice test',

      test:
        'mercado_pago_subscription_invoice_pipeline',

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
