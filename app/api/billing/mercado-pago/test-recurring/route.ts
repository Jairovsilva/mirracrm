import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

const TEST_PLAN_ID =
  '244ac3a842a94b5c8f0dee36679f33d8';

const BACK_URL =
  'https://develop-mirracrm.vercel.app/cadastro/pagamento/teste-recorrencia';

const noStore = {
  'Cache-Control': 'no-store',
};

type MercadoPagoError = {
  message?: string;
  error?: string;
  status?: number;
  cause?: unknown;
};

type MercadoPagoPlan = {
  id?: string;
  status?: string;
  reason?: string;

  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?:
      | number
      | string;
    currency_id?: string;
  };
};

type MercadoPagoSubscription = {
  id?: string;
  status?: string;
  next_payment_date?: string;
  external_reference?: string;
  preapproval_plan_id?: string;
};

async function readJson(
  response: Response
): Promise<Record<
  string,
  unknown
> | null> {
  const text =
    await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(
      text
    ) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest
) {
  /*
   * Rota temporária.
   * Nunca disponível em produção.
   */
  if (
    process.env.VERCEL_ENV ===
    'production'
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

  const accessToken =
    process.env
      .MERCADO_PAGO_ACCESS_TOKEN
      ?.trim();

  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,

        error:
          'MERCADO_PAGO_ACCESS_TOKEN não configurado.',
      },
      {
        status: 503,
        headers: noStore,
      }
    );
  }

  try {
    const body =
      (await request.json()) as {
        cardTokenId?: string;
        payerEmail?: string;
      };

    const cardTokenId =
      String(
        body?.cardTokenId || ''
      ).trim();

    const payerEmail =
      String(
        body?.payerEmail || ''
      )
        .trim()
        .toLowerCase();

    if (
      !cardTokenId ||
      !payerEmail
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'Token do cartão ou e-mail ausente.',
        },
        {
          status: 400,
          headers: noStore,
        }
      );
    }

    /*
     * =====================================================
     * PASSO 1
     * CONFIRMAR O PLANO QUE JÁ CRIAMOS
     * =====================================================
     *
     * Não criaremos mais nenhum plano.
     */
    const planResponse =
      await fetch(
        `https://api.mercadopago.com/preapproval_plan/${TEST_PLAN_ID}`,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Content-Type':
              'application/json',
          },

          cache: 'no-store',
        }
      );

    const planResult =
      await readJson(
        planResponse
      );

    if (!planResponse.ok) {
      console.error(
        'Mercado Pago get test plan:',
        planResponse.status,
        planResult
      );

      const providerError =
        planResult as
          | MercadoPagoError
          | null;

      return NextResponse.json(
        {
          ok: false,

          stage:
            'get_plan',

          planId:
            TEST_PLAN_ID,

          error:
            'Não foi possível consultar o plano temporário.',

          providerStatus:
            planResponse.status,

          providerMessage:
            providerError?.message ??
            providerError?.error ??
            null,

          providerCause:
            providerError?.cause ??
            null,
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    const plan =
      planResult as
        | MercadoPagoPlan
        | null;

    if (
      !plan ||
      plan.id !== TEST_PLAN_ID
    ) {
      return NextResponse.json(
        {
          ok: false,

          stage:
            'validate_plan',

          error:
            'O Mercado Pago retornou um plano diferente do esperado.',
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    if (
      plan.status !== 'active'
    ) {
      return NextResponse.json(
        {
          ok: false,

          stage:
            'validate_plan',

          planId:
            TEST_PLAN_ID,

          error:
            `O plano temporário não está ativo. Status: ${plan.status ?? 'desconhecido'}.`,
        },
        {
          status: 409,
          headers: noStore,
        }
      );
    }

    const planAmount =
      Number(
        plan.auto_recurring
          ?.transaction_amount
      );

    const planCurrency =
      plan.auto_recurring
        ?.currency_id;

    const planFrequency =
      plan.auto_recurring
        ?.frequency;

    const planFrequencyType =
      plan.auto_recurring
        ?.frequency_type;

    if (
      planAmount !== 10 ||
      planCurrency !== 'BRL' ||
      planFrequency !== 1 ||
      planFrequencyType !==
        'months'
    ) {
      return NextResponse.json(
        {
          ok: false,

          stage:
            'validate_plan',

          planId:
            TEST_PLAN_ID,

          error:
            'O plano temporário não possui a configuração esperada de R$ 10/mês em BRL.',

          plan: {
            amount:
              planAmount,

            currency:
              planCurrency ??
              null,

            frequency:
              planFrequency ??
              null,

            frequencyType:
              planFrequencyType ??
              null,

            status:
              plan.status ??
              null,
          },
        },
        {
          status: 409,
          headers: noStore,
        }
      );
    }

    /*
     * =====================================================
     * PASSO 2
     * CRIAR SOMENTE A ASSINATURA
     * =====================================================
     */

    const now =
      Date.now();

    /*
     * Início 5 minutos à frente.
     */
    const startDate =
      new Date(
        now +
          5 * 60 * 1000
      ).toISOString();

    /*
     * Vigência de aproximadamente
     * um ano.
     */
    const endDate =
      new Date(
        now +
          365 *
            24 *
            60 *
            60 *
            1000
      ).toISOString();

    const externalReference =
      `MIRRACRM_RECURRING_TEST_${Date.now()}`;

    /*
     * Estrutura baseada no exemplo
     * oficial do Mercado Pago para
     * assinatura COM plano associado.
     */
    const subscriptionPayload = {
      preapproval_plan_id:
        TEST_PLAN_ID,

      reason:
        'MirraCRM Recurring Test R$10',

      external_reference:
        externalReference,

      payer_email:
        payerEmail,

      card_token_id:
        cardTokenId,

      auto_recurring: {
        frequency: 1,

        frequency_type:
          'months',

        start_date:
          startDate,

        end_date:
          endDate,

        transaction_amount:
          10,

        currency_id:
          'BRL',
      },

      back_url:
        BACK_URL,

      status:
        'authorized',
    };

    const subscriptionResponse =
      await fetch(
        'https://api.mercadopago.com/preapproval',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Content-Type':
              'application/json',
          },

          cache: 'no-store',

          body:
            JSON.stringify(
              subscriptionPayload
            ),
        }
      );

    const subscriptionResult =
      await readJson(
        subscriptionResponse
      );

    if (
      !subscriptionResponse.ok
    ) {
      console.error(
        'Mercado Pago test subscription:',
        subscriptionResponse.status,
        subscriptionResult
      );

      const providerError =
        subscriptionResult as
          | MercadoPagoError
          | null;

      return NextResponse.json(
        {
          ok: false,

          stage:
            'create_subscription',

          planId:
            TEST_PLAN_ID,

          error:
            'Mercado Pago recusou a assinatura vinculada ao plano temporário.',

          providerStatus:
            subscriptionResponse.status,

          providerMessage:
            providerError?.message ??
            providerError?.error ??
            null,

          providerCause:
            providerError?.cause ??
            null,

          /*
           * Apenas dados não sensíveis
           * para diagnóstico.
           *
           * NÃO devolvemos cardTokenId
           * nem Access Token.
           */
          requestConfiguration: {
            amount:
              10,

            currency:
              'BRL',

            frequency:
              1,

            frequencyType:
              'months',

            startDate,

            endDate,

            status:
              'authorized',

            hasPlanId:
              true,

            hasBackUrl:
              true,

            hasCardToken:
              true,

            payerEmail:
              payerEmail,
          },
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    /*
     * =====================================================
     * SUCESSO
     * =====================================================
     */

    const subscription =
      subscriptionResult as
        | MercadoPagoSubscription
        | null;

    const subscriptionId =
      String(
        subscription?.id || ''
      ).trim();

    if (!subscriptionId) {
      return NextResponse.json(
        {
          ok: false,

          stage:
            'validate_subscription',

          planId:
            TEST_PLAN_ID,

          error:
            'Mercado Pago criou a assinatura, mas não retornou o ID.',
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,

        test:
          'associated_plan_no_trial',

        planId:
          TEST_PLAN_ID,

        subscriptionId,

        status:
          subscription?.status ??
          null,

        nextPaymentDate:
          subscription
            ?.next_payment_date ??
          null,

        externalReference,

        amount:
          10,

        currency:
          'BRL',

        billingCycle:
          'monthly',

        freeTrial:
          false,

        startDate,

        endDate,
      },
      {
        status: 200,
        headers: noStore,
      }
    );
  } catch (error) {
    console.error(
      'Recurring associated-plan test unexpected error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        stage:
          'unexpected',

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
