import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = {
  'Cache-Control': 'no-store',
};

type MercadoPagoPlan = {
  id?: string;
  status?: string;
  reason?: string;
};

type MercadoPagoSubscription = {
  id?: string;
  status?: string;
  next_payment_date?: string;
  external_reference?: string;
};

type MercadoPagoError = {
  message?: string;
  error?: string;
  status?: number;
  cause?: unknown;
};

async function readJson(
  response: Response
): Promise<Record<string, unknown> | null> {
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
   * Rota exclusivamente temporária.
   * Bloqueada em produção.
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
     * PASSO 1
     *
     * Criamos um plano temporário
     * R$ 10/mês SEM free trial.
     *
     * Não utilizamos X-scope: stage.
     */
    const planResponse =
      await fetch(
        'https://api.mercadopago.com/preapproval_plan',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Content-Type':
              'application/json',
          },

          cache: 'no-store',

          body: JSON.stringify({
            reason:
              'MirraCRM Recurring Test R$10',

            auto_recurring: {
              frequency: 1,

              frequency_type:
                'months',

              transaction_amount:
                10,

              currency_id:
                'BRL',
            },

            back_url:
              'https://develop-mirracrm.vercel.app/cadastro/pagamento/teste-recorrencia',
          }),
        }
      );

    const planResult =
      await readJson(
        planResponse
      );

    if (!planResponse.ok) {
      console.error(
        'Mercado Pago test plan:',
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
            'create_plan',

          error:
            'Mercado Pago recusou a criação do plano temporário.',

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

    const planId =
      String(
        plan?.id || ''
      ).trim();

    if (!planId) {
      return NextResponse.json(
        {
          ok: false,

          stage:
            'create_plan',

          error:
            'Mercado Pago criou o plano sem retornar o ID.',
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    /*
     * PASSO 2
     *
     * Agora criamos a assinatura
     * usando exatamente o modelo
     * COM PLANO ASSOCIADO.
     */
    const externalReference =
      `MIRRACRM_RECURRING_TEST_${Date.now()}`;

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

          body: JSON.stringify({
            preapproval_plan_id:
              planId,

            reason:
              'MirraCRM Recurring Test R$10',

            external_reference:
              externalReference,

            payer_email:
              payerEmail,

            card_token_id:
              cardTokenId,

            status:
              'authorized',
          }),
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

          /*
           * Importante:
           * se chegarmos aqui, o plano
           * temporário já foi criado.
           */
          planId,

          error:
            'O plano temporário foi criado, mas o Mercado Pago recusou a assinatura.',

          providerStatus:
            subscriptionResponse.status,

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
            'create_subscription',

          planId,

          error:
            'Mercado Pago criou a assinatura sem retornar o ID.',
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    /*
     * SUCESSO
     *
     * Nenhuma credencial ou
     * card_token_id é devolvido.
     */
    return NextResponse.json(
      {
        ok: true,

        test:
          'associated_plan_no_trial',

        planId,

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
