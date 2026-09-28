import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const MERCADO_PAGO_ACCESS_TOKEN =
  process.env.MERCADO_PAGO_ACCESS_TOKEN;

/*
 * IDs criados e confirmados no
 * Mercado Pago em ambiente de teste.
 *
 * Basic mensal: R$ 499
 * Pro mensal: R$ 1.497
 */
const MERCADO_PAGO_PLAN_IDS = {
  basic:
    'f986bff15fc44ea8a9673d2efb17d6d4',

  pro:
    '8d98b9b4c91c484da7cb77b036b8b3b9',
} as const;

type MonthlyPlan =
  keyof typeof MERCADO_PAGO_PLAN_IDS;

type RequestBody = {
  planId?: unknown;
  billingCycle?: unknown;
  cardTokenId?: unknown;
};

type MercadoPagoSubscriptionResponse = {
  id?: string;
  status?: string;
  external_reference?: string;
  preapproval_plan_id?: string;
  payer_id?: number;
  payer_email?: string;
  init_point?: string;

  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number;
    currency_id?: string;
    start_date?: string;
    end_date?: string;
  };

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

function getBearerToken(
  request: NextRequest
) {
  const authorization =
    request.headers.get(
      'authorization'
    );

  if (
    !authorization ||
    !authorization.startsWith(
      'Bearer '
    )
  ) {
    return null;
  }

  const token =
    authorization
      .slice('Bearer '.length)
      .trim();

  return token || null;
}

function isMonthlyPlan(
  value: string
): value is MonthlyPlan {
  return (
    value === 'basic' ||
    value === 'pro'
  );
}

export async function POST(
  request: NextRequest
) {
  /*
   * 1. Verificação de configuração.
   */
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return json(
      {
        ok: false,
        error:
          'Configuração do Supabase incompleta.',
      },
      500
    );
  }

  if (
    !MERCADO_PAGO_ACCESS_TOKEN
  ) {
    return json(
      {
        ok: false,
        error:
          'MERCADO_PAGO_ACCESS_TOKEN não configurado.',
      },
      500
    );
  }

  /*
   * 2. Usuário precisa estar
   * autenticado no MirraCRM.
   */
  const accessToken =
    getBearerToken(request);

  if (!accessToken) {
    return json(
      {
        ok: false,
        error:
          'Autenticação necessária.',
      },
      401
    );
  }

  const supabaseAuth =
    createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  const {
    data: userData,
    error: userError,
  } =
    await supabaseAuth.auth.getUser(
      accessToken
    );

  const user = userData.user;

  if (
    userError ||
    !user ||
    !user.email
  ) {
    return json(
      {
        ok: false,
        error:
          'Sessão inválida ou expirada.',
      },
      401
    );
  }

  /*
   * 3. Lemos somente os campos
   * necessários.
   *
   * Nunca recebemos número do cartão,
   * CVV ou validade nesta API.
   */
  let body: RequestBody;

  try {
    body =
      (await request.json()) as
        RequestBody;
  } catch {
    return json(
      {
        ok: false,
        error:
          'Corpo da requisição inválido.',
      },
      400
    );
  }

  const planId =
    typeof body.planId === 'string'
      ? body.planId.trim()
      : '';

  const billingCycle =
    typeof body.billingCycle ===
    'string'
      ? body.billingCycle.trim()
      : '';

  const cardTokenId =
    typeof body.cardTokenId ===
    'string'
      ? body.cardTokenId.trim()
      : '';

  if (!isMonthlyPlan(planId)) {
    return json(
      {
        ok: false,
        error:
          'Plano inválido.',
      },
      400
    );
  }

  /*
   * Esta API é exclusivamente
   * para recorrência mensal.
   *
   * O anual terá fluxo próprio.
   */
  if (
    billingCycle !== 'monthly'
  ) {
    return json(
      {
        ok: false,
        error:
          'Esta rota aceita somente cobrança mensal.',
      },
      400
    );
  }

  if (!cardTokenId) {
    return json(
      {
        ok: false,
        error:
          'Token do cartão não informado.',
      },
      400
    );
  }

  /*
   * Limite defensivo.
   * O token é opaco para o MirraCRM.
   */
  if (cardTokenId.length > 500) {
    return json(
      {
        ok: false,
        error:
          'Token do cartão inválido.',
      },
      400
    );
  }

  const admin =
    createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  /*
   * 4. Descobrimos a conta de billing
   * exclusivamente pelo usuário
   * autenticado.
   *
   * O frontend não escolhe account_id.
   */
  const {
    data: membership,
    error: membershipError,
  } = await admin
    .from('billing_memberships')
    .select(
      'billing_account_id'
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (
    membershipError ||
    !membership
  ) {
    console.error(
      'Falha ao localizar billing membership:',
      membershipError
    );

    return json(
      {
        ok: false,
        error:
          'Conta de cobrança não encontrada.',
      },
      404
    );
  }

  const billingAccountId =
    membership.billing_account_id;

  /*
   * 5. Conferimos a assinatura interna
   * atual antes de conversar com o MP.
   */
  const {
    data: internalSubscription,
    error: subscriptionError,
  } = await admin
    .from('billing_subscriptions')
    .select(
      [
        'id',
        'billing_account_id',
        'plan_id',
        'status',
        'billing_cycle',
        'trial_starts_at',
        'trial_ends_at',
        'provider',
        'provider_subscription_id',
      ].join(',')
    )
    .eq(
      'billing_account_id',
      billingAccountId
    )
    .maybeSingle();

  if (
    subscriptionError ||
    !internalSubscription
  ) {
    console.error(
      'Falha ao localizar billing subscription:',
      subscriptionError
    );

    return json(
      {
        ok: false,
        error:
          'Assinatura interna não encontrada.',
      },
      404
    );
  }

  /*
   * Se já existe uma assinatura
   * Mercado Pago vinculada, não criamos
   * outra automaticamente.
   *
   * Isso evita duas recorrências para
   * a mesma conta.
   */
  if (
    internalSubscription
      .provider_subscription_id
  ) {
    return json(
      {
        ok: false,
        error:
          'Esta conta já possui uma assinatura de pagamento vinculada.',
        code:
          'SUBSCRIPTION_ALREADY_LINKED',
      },
      409
    );
  }

  /*
   * 6. Confirmamos que o plano existe
   * no nosso próprio banco.
   *
   * Não confiamos apenas no parâmetro
   * enviado pelo navegador.
   */
  const {
    data: billingPlan,
    error: planError,
  } = await admin
    .from('billing_plans')
    .select(
      'id, monthly_price_cents, is_active'
    )
    .eq('id', planId)
    .eq('is_active', true)
    .maybeSingle();

  if (
    planError ||
    !billingPlan
  ) {
    console.error(
      'Falha ao validar billing plan:',
      planError
    );

    return json(
      {
        ok: false,
        error:
          'Plano de cobrança não encontrado.',
      },
      400
    );
  }

  /*
   * Proteção adicional para impedir
   * divergência silenciosa entre
   * Supabase e Mercado Pago.
   */
  const expectedAmountCents =
    planId === 'basic'
      ? 49900
      : 149700;

  if (
    billingPlan
      .monthly_price_cents !==
    expectedAmountCents
  ) {
    console.error(
      'Preço interno divergente do Mercado Pago:',
      {
        planId,
        databaseAmount:
          billingPlan
            .monthly_price_cents,
        expectedAmount:
          expectedAmountCents,
      }
    );

    return json(
      {
        ok: false,
        error:
          'Configuração de preço inconsistente.',
      },
      500
    );
  }

  /*
   * 7. Criamos/reutilizamos a ordem
   * interna ANTES da assinatura externa.
   *
   * O UUID da ordem será nossa
   * external_reference.
   */
  const {
    data: orderResult,
    error: orderError,
  } = await admin.rpc(
    'create_or_reuse_billing_order',
    {
      p_billing_account_id:
        billingAccountId,

      p_plan_id:
        planId,

      p_billing_cycle:
        'monthly',

      p_amount_cents:
        expectedAmountCents,

      p_currency:
        'BRL',

      p_provider:
        'mercado_pago',
    }
  );

  if (orderError) {
    console.error(
      'Falha ao criar/reutilizar billing order:',
      orderError
    );

    return json(
      {
        ok: false,
        error:
          'Não foi possível preparar a assinatura.',
      },
      500
    );
  }

  /*
   * O RPC pode retornar uma linha,
   * um array com uma linha ou,
   * dependendo da assinatura SQL,
   * diretamente um objeto.
   */
  const order =
    Array.isArray(orderResult)
      ? orderResult[0]
      : orderResult;

  if (
    !order ||
    typeof order.id !== 'string'
  ) {
    console.error(
      'RPC não retornou billing order válida:',
      orderResult
    );

    return json(
      {
        ok: false,
        error:
          'A ordem de cobrança não foi criada corretamente.',
      },
      500
    );
  }

  const orderId = order.id;

  /*
   * 8. Criamos a assinatura no
   * Mercado Pago.
   *
   * O cartão já deve ter sido
   * tokenizado pelo MercadoPago.js
   * no navegador.
   */
  const mercadoPagoPlanId =
    MERCADO_PAGO_PLAN_IDS[planId];

  const mercadoPagoResponse =
    await fetch(
      'https://api.mercadopago.com/preapproval',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,

          'Content-Type':
            'application/json',

          /*
           * Evita que uma repetição
           * acidental da mesma ordem
           * seja tratada como uma
           * nova intenção pelo nosso
           * lado da integração.
           */
          'X-Idempotency-Key':
            orderId,
        },

        body: JSON.stringify({
          preapproval_plan_id:
            mercadoPagoPlanId,

          external_reference:
            orderId,

          payer_email:
            user.email,

          card_token_id:
            cardTokenId,

          status:
            'authorized',

          back_url:
            `${request.nextUrl.origin}/cadastro/pagamento`,
        }),

        cache: 'no-store',
      }
    );

  let mercadoPago:
    | MercadoPagoSubscriptionResponse
    | null = null;

  try {
    mercadoPago =
      (await mercadoPagoResponse.json()) as
        MercadoPagoSubscriptionResponse;
  } catch {
    mercadoPago = null;
  }

  if (
    !mercadoPagoResponse.ok ||
    !mercadoPago?.id
  ) {
    console.error(
      'Mercado Pago recusou a criação da assinatura:',
      {
        status:
          mercadoPagoResponse.status,

        response:
          mercadoPago,
      }
    );

    return json(
      {
        ok: false,

        error:
          'O Mercado Pago não conseguiu criar a assinatura.',

        providerStatus:
          mercadoPagoResponse.status,
      },
      502
    );
  }

  /*
   * 9. Verificação defensiva.
   *
   * Uma assinatura criada para outro
   * plano não pode ser vinculada
   * silenciosamente à nossa conta.
   */
  if (
    mercadoPago
      .preapproval_plan_id &&
    mercadoPago
      .preapproval_plan_id !==
      mercadoPagoPlanId
  ) {
    console.error(
      'Mercado Pago retornou plano inesperado:',
      {
        expected:
          mercadoPagoPlanId,

        received:
          mercadoPago
            .preapproval_plan_id,

        providerSubscriptionId:
          mercadoPago.id,
      }
    );

    return json(
      {
        ok: false,
        error:
          'O provedor retornou uma assinatura inconsistente.',
      },
      502
    );
  }

  /*
   * 10. Persistimos o vínculo.
   *
   * IMPORTANTE:
   * não mudamos o status interno para
   * "active".
   *
   * O usuário continua "trialing"
   * durante os 13 dias.
   */
  const {
    data: updatedSubscription,
    error: updateSubscriptionError,
  } = await admin
    .from('billing_subscriptions')
    .update({
      plan_id:
        planId,

      billing_cycle:
        'monthly',

      provider:
        'mercado_pago',

      provider_subscription_id:
        mercadoPago.id,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      'id',
      internalSubscription.id
    )
    .is(
      'provider_subscription_id',
      null
    )
    .select(
      [
        'id',
        'plan_id',
        'status',
        'billing_cycle',
        'trial_ends_at',
        'provider',
        'provider_subscription_id',
      ].join(',')
    )
    .maybeSingle();

  if (
    updateSubscriptionError ||
    !updatedSubscription
  ) {
    /*
     * Situação importante:
     * o Mercado Pago já criou a
     * assinatura, portanto NÃO devemos
     * tentar criar outra automaticamente.
     *
     * O ID fica registrado no log para
     * reconciliação administrativa.
     */
    console.error(
      'ASSINATURA_MP_CRIADA_MAS_NAO_VINCULADA:',
      {
        billingAccountId,
        orderId,
        providerSubscriptionId:
          mercadoPago.id,
        error:
          updateSubscriptionError,
      }
    );

    return json(
      {
        ok: false,

        error:
          'A assinatura foi criada no provedor, mas não pôde ser vinculada ao MirraCRM. Não tente novamente.',

        code:
          'PROVIDER_CREATED_LOCAL_LINK_FAILED',
      },
      500
    );
  }

  /*
   * 11. Registramos na ordem qual
   * assinatura externa foi criada.
   *
   * provider_checkout_id é o campo
   * disponível no schema para o
   * identificador externo relacionado
   * à criação desta ordem.
   */
  const {
    error: updateOrderError,
  } = await admin
    .from('billing_orders')
    .update({
      provider_checkout_id:
        mercadoPago.id,

      updated_at:
        new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateOrderError) {
    /*
     * Não desfazemos a assinatura:
     * o vínculo principal já está salvo
     * em billing_subscriptions.
     */
    console.error(
      'Assinatura vinculada, mas billing_order não foi atualizada:',
      {
        orderId,
        providerSubscriptionId:
          mercadoPago.id,
        error:
          updateOrderError,
      }
    );
  }

  return json(
    {
      ok: true,

      subscription: {
        id:
          updatedSubscription.id,

        planId:
          updatedSubscription.plan_id,

        billingCycle:
          updatedSubscription
            .billing_cycle,

        status:
          updatedSubscription.status,

        trialEndsAt:
          updatedSubscription
            .trial_ends_at,

        provider:
          updatedSubscription.provider,

        providerSubscriptionId:
          updatedSubscription
            .provider_subscription_id,
      },

      order: {
        id: orderId,
      },
    },
    201
  );
}
