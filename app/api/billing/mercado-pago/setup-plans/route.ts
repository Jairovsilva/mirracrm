import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCESS_TOKEN =
  process.env.MERCADO_PAGO_ACCESS_TOKEN;

const SETUP_SECRET =
  process.env.MERCADO_PAGO_SETUP_SECRET;

type PlanDefinition = {
  key: string;
  reason: string;
  frequency: number;
  frequencyType: 'months';
  amount: number;
};

const PLANS: PlanDefinition[] = [
  {
    key: 'basic_monthly',
    reason: 'MirraCRM Basic - Mensal',
    frequency: 1,
    frequencyType: 'months',
    amount: 499,
  },
  {
    key: 'basic_annual',
    reason: 'MirraCRM Basic - Anual',
    frequency: 12,
    frequencyType: 'months',
    amount: 5389.2,
  },
  {
    key: 'pro_monthly',
    reason: 'MirraCRM Pro - Mensal',
    frequency: 1,
    frequencyType: 'months',
    amount: 1497,
  },
  {
    key: 'pro_annual',
    reason: 'MirraCRM Pro - Anual',
    frequency: 12,
    frequencyType: 'months',
    amount: 16167.6,
  },
];

type MercadoPagoPlanResponse = {
  id?: string;
  status?: string;
  reason?: string;
  init_point?: string;
  message?: string;
  error?: string;
  cause?: unknown;
};

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(
  request: NextRequest
) {
  if (!ACCESS_TOKEN) {
    return json(
      {
        ok: false,
        error:
          'MERCADO_PAGO_ACCESS_TOKEN não configurado.',
      },
      500
    );
  }

  if (!SETUP_SECRET) {
    return json(
      {
        ok: false,
        error:
          'MERCADO_PAGO_SETUP_SECRET não configurado.',
      },
      500
    );
  }

  const authorization =
    request.headers.get('authorization');

  const expectedAuthorization =
    `Bearer ${SETUP_SECRET}`;

  if (
    authorization !==
    expectedAuthorization
  ) {
    return json(
      {
        ok: false,
        error: 'Não autorizado.',
      },
      401
    );
  }

  const origin =
    request.nextUrl.origin;

  const backUrl =
    `${origin}/cadastro/pagamento`;

  const createdPlans: Array<{
    key: string;
    id: string;
    status: string | null;
    amount: number;
    frequency: number;
    frequencyType: string;
  }> = [];

  try {
    /*
     * IMPORTANTE:
     *
     * Esta rota é para SETUP.
     * Execute apenas uma vez.
     *
     * Cada execução cria novos planos
     * no Mercado Pago.
     */
    for (const plan of PLANS) {
      const response = await fetch(
        'https://api.mercadopago.com/preapproval_plan',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${ACCESS_TOKEN}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            reason: plan.reason,

            auto_recurring: {
              frequency:
                plan.frequency,

              frequency_type:
                plan.frequencyType,

              transaction_amount:
                plan.amount,

              currency_id: 'BRL',

              free_trial: {
                frequency: 13,
                frequency_type:
                  'days',
              },
            },

            back_url: backUrl,
          }),

          cache: 'no-store',
        }
      );

      let data:
        | MercadoPagoPlanResponse
        | null = null;

      try {
        data =
          (await response.json()) as
            MercadoPagoPlanResponse;
      } catch {
        data = null;
      }

      if (
        !response.ok ||
        !data?.id
      ) {
        console.error(
          'Falha ao criar plano Mercado Pago:',
          {
            key: plan.key,
            status:
              response.status,
            response: data,
          }
        );

        return json(
          {
            ok: false,

            error:
              `Falha ao criar o plano ${plan.key}.`,

            mercadoPagoStatus:
              response.status,

            mercadoPagoResponse:
              data,
          },
          502
        );
      }

      createdPlans.push({
        key: plan.key,
        id: data.id,
        status:
          data.status ?? null,
        amount: plan.amount,
        frequency:
          plan.frequency,
        frequencyType:
          plan.frequencyType,
      });
    }

    return json({
      ok: true,

      message:
        'Planos criados no Mercado Pago.',

      warning:
        'Guarde os IDs e desative/remova esta rota após concluir o setup.',

      plans: createdPlans,
    });
  } catch (error) {
    console.error(
      'Erro no setup de planos Mercado Pago:',
      error
    );

    return json(
      {
        ok: false,
        error:
          'Não foi possível concluir o setup dos planos.',
      },
      500
    );
  }
}
