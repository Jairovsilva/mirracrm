import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const SETUP_SECRET = process.env.MERCADO_PAGO_SETUP_SECRET;

type PlanKey = 'basic_monthly' | 'pro_monthly';

type PlanDefinition = {
  key: PlanKey;
  reason: string;
  frequency: number;
  frequencyType: 'months';
  amount: number;
};

type MercadoPagoPlan = {
  id?: string;
  reason?: string;
  status?: string;

  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number | string;
    currency_id?: string;

    free_trial?: {
      frequency?: number;
      frequency_type?: string;
    };
  };
};

type MercadoPagoSearchResponse = {
  paging?: {
    offset?: number;
    limit?: number;
    total?: number;
  };

  results?: MercadoPagoPlan[];

  message?: string;
  error?: string;
};

type MercadoPagoCreateResponse = MercadoPagoPlan & {
  message?: string;
  error?: string;
  cause?: unknown;
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
    key: 'pro_monthly',
    reason: 'MirraCRM Pro - Mensal',
    frequency: 1,
    frequencyType: 'months',
    amount: 1497,
  },
];

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

function amountsEqual(
  first: number | string | undefined,
  second: number
) {
  if (first === undefined) {
    return false;
  }

  const normalized =
    typeof first === 'number'
      ? first
      : Number(first);

  return (
    Number.isFinite(normalized) &&
    Math.abs(normalized - second) < 0.001
  );
}

function isMatchingPlan(
  existing: MercadoPagoPlan,
  desired: PlanDefinition
) {
  const recurring = existing.auto_recurring;

  if (!recurring) {
    return false;
  }

  return (
    existing.reason === desired.reason &&
    existing.status === 'active' &&
    recurring.frequency === desired.frequency &&
    recurring.frequency_type === desired.frequencyType &&
    amountsEqual(
      recurring.transaction_amount,
      desired.amount
    ) &&
    recurring.currency_id === 'BRL'
  );
}

async function searchPlans(): Promise<MercadoPagoPlan[]> {
  const url = new URL(
    'https://api.mercadopago.com/preapproval_plan/search'
  );

  url.searchParams.set('status', 'active');
  url.searchParams.set('sort', 'date_created');
  url.searchParams.set('criteria', 'asc');

  const response = await fetch(url.toString(), {
    method: 'GET',

    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },

    cache: 'no-store',
  });

  let data: MercadoPagoSearchResponse | null = null;

  try {
    data =
      (await response.json()) as MercadoPagoSearchResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    console.error(
      'Falha ao consultar planos Mercado Pago:',
      {
        status: response.status,
        response: data,
      }
    );

    throw new Error(
      `Mercado Pago recusou a consulta de planos (${response.status}).`
    );
  }

  /*
   * IMPORTANTE:
   * Guardamos results em uma variável antes
   * da validação para que o TypeScript faça
   * corretamente o narrowing quando data
   * puder ser null.
   */
  const results = data?.results;

  return Array.isArray(results)
    ? results
    : [];
}

async function createPlan(
  plan: PlanDefinition,
  backUrl: string
): Promise<MercadoPagoCreateResponse> {
  const response = await fetch(
    'https://api.mercadopago.com/preapproval_plan',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        reason: plan.reason,

        auto_recurring: {
          frequency: plan.frequency,
          frequency_type: plan.frequencyType,
          transaction_amount: plan.amount,
          currency_id: 'BRL',

          free_trial: {
            frequency: 13,
            frequency_type: 'days',
          },
        },

        back_url: backUrl,
      }),

      cache: 'no-store',
    }
  );

  let data: MercadoPagoCreateResponse | null = null;

  try {
    data =
      (await response.json()) as MercadoPagoCreateResponse;
  } catch {
    data = null;
  }

  if (!response.ok || !data?.id) {
    console.error(
      'Falha ao criar plano Mercado Pago:',
      {
        key: plan.key,
        status: response.status,
        response: data,
      }
    );

    throw new Error(
      `Falha ao criar o plano ${plan.key} (${response.status}).`
    );
  }

  return data;
}

export async function POST(
  request: NextRequest
) {
  /*
   * Essas variáveis são verificadas
   * antes de qualquer chamada externa.
   */
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

  /*
   * Endpoint administrativo temporário.
   * O segredo nunca é enviado ao Mercado Pago.
   */
  const authorization =
    request.headers.get('authorization');

  const expectedAuthorization =
    `Bearer ${SETUP_SECRET}`;

  if (authorization !== expectedAuthorization) {
    return json(
      {
        ok: false,
        error: 'Não autorizado.',
      },
      401
    );
  }

  try {
    /*
     * Primeiro consultamos o Mercado Pago.
     *
     * Isso evita recriar deliberadamente
     * um plano que já existe.
     */
    let existingPlans = await searchPlans();

    const origin = request.nextUrl.origin;

    const backUrl =
      `${origin}/cadastro/pagamento`;

    const results: Array<{
      key: PlanKey;
      id: string;
      action: 'existing' | 'created';
      amount: number;
      trialDays: number;
    }> = [];

    /*
     * Criamos somente os planos MENSAIS.
     *
     * Basic anual e Pro anual ficam fora
     * de preapproval_plan porque a API
     * retornou o limite de R$ 4.000 para
     * a cobrança testada.
     */
    for (const plan of PLANS) {
      const existing =
        existingPlans.find((candidate) =>
          isMatchingPlan(candidate, plan)
        );

      if (existing?.id) {
        results.push({
          key: plan.key,
          id: existing.id,
          action: 'existing',
          amount: plan.amount,
          trialDays: 13,
        });

        continue;
      }

      /*
       * Não encontramos um plano ativo
       * exatamente compatível.
       */
      const created =
        await createPlan(plan, backUrl);

      /*
       * createPlan já garante que existe
       * um ID antes de retornar, mas
       * mantemos a proteção também aqui.
       */
      if (!created.id) {
        throw new Error(
          `Mercado Pago não retornou ID para ${plan.key}.`
        );
      }

      results.push({
        key: plan.key,
        id: created.id,
        action: 'created',
        amount: plan.amount,
        trialDays: 13,
      });

      /*
       * Mantemos a lista local atualizada
       * durante esta mesma execução.
       */
      existingPlans = [
        ...existingPlans,
        created,
      ];
    }

    return json({
      ok: true,

      message:
        'Planos mensais do MirraCRM verificados.',

      plans: results,

      /*
       * Mantemos os valores anuais na
       * resposta apenas como informação.
       *
       * Nenhum preapproval_plan anual
       * é criado por esta rota.
       */
      annual: {
        basic: {
          amount: 5389.2,
          recurringPlan: false,
        },

        pro: {
          amount: 16167.6,
          recurringPlan: false,
        },
      },
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
          error instanceof Error
            ? error.message
            : 'Não foi possível concluir o setup dos planos.',
      },
      502
    );
  }
}
