import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnnualPlan =
  | 'basic'
  | 'pro';

type MercadoPagoSubscriptionResponse = {
  id?: string;
  status?: string;
  external_reference?: string;
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
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
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
      .slice(
        'Bearer '.length
      )
      .trim();

  return token || null;
}

function isAnnualPlan(
  value: string
): value is AnnualPlan {
  return (
    value === 'basic' ||
    value === 'pro'
  );
}

function centsToAmount(
  cents: number
) {
  return Number(
    (cents / 100).toFixed(2)
  );
}

export async function POST(
  request: NextRequest
) {
  /*
   * 1. Configuração obrigatória.
   */
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabaseServiceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  const mercadoPagoAccessToken =
    process.env
      .MERCADO_PAGO_ACCESS_TOKEN
      ?.trim();

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceRoleKey
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
    !mercadoPagoAccessToken
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
   * Diagnóstico seguro.
   *
   * Não imprime o Access Token.
   */
  console.log(
    'MP annual subscription credential diagnostic:',
    {
      configured:
        Boolean(
          mercadoPagoAccessToken
        ),

      prefix:
        mercadoPagoAccessToken
          .slice(0, 8),

      length:
        mercadoPagoAccessToken
          .length,

      vercelEnv:
        process.env
          .VERCEL_ENV,

      vercelGitBranch:
        process.env
          .VERCEL_GIT_COMMIT_REF,
    }
  );

  /*
   * 2. Autenticação do usuário
   * do MirraCRM.
   */
  const accessToken =
    getBearerToken(
      request
    );

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
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      }
    );

  const {
    data: userData,
    error: userError,
  } =
    await supabaseAuth
      .auth
      .getUser(
        accessToken
      );

  const user =
    userData.user;

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
   * 3. Owner obrigatório.
   */
  const admin =
    createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      }
    );

  const {
    data: profile,
    error: profileError,
  } =
    await admin
      .from('profiles')
      .select(
        'id, role'
      )
      .eq(
        'id',
        user.id
      )
      .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    return json(
      {
        ok: false,

        error:
          'Perfil não encontrado.',
      },
      404
    );
  }

  if (
    profile.role !==
    'owner'
  ) {
    return json(
      {
        ok: false,

        error:
          'Apenas o proprietário da conta pode contratar um plano.',
      },
      403
    );
  }

  /*
   * 4. Corpo da requisição.
   *
   * Para /preapproval precisamos
   * do token do cartão e do e-mail
   * do pagador.
   *
   * paymentMethodId, issuerId,
   * installments e CPF não são
   * necessários nesta chamada.
   */
  let body:
    Record<
      string,
      unknown
    >;

  try {
    body =
      (await request.json()) as
        Record<
          string,
          unknown
        >;
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
    typeof body.planId ===
    'string'
      ? body.planId
          .trim()
          .toLowerCase()
      : '';

  const billingCycle =
    typeof body.billingCycle ===
    'string'
      ? body.billingCycle
          .trim()
          .toLowerCase()
      : '';

  const cardTokenId =
    typeof body.cardTokenId ===
    'string'
      ? body.cardTokenId
          .trim()
      : '';

  const payerEmail =
    typeof body.payerEmail ===
    'string'
      ? body.payerEmail
          .trim()
          .toLowerCase()
      : '';

  if (
    !isAnnualPlan(
      planId
    )
  ) {
    return json(
      {
        ok: false,

        error:
          'Plano inválido.',
      },
      400
    );
  }

  if (
    billingCycle !==
    'annual'
  ) {
    return json(
      {
        ok: false,

        error:
          'Esta rota aceita somente cobrança anual.',
      },
      400
    );
  }

  if (
    !cardTokenId
  ) {
    return json(
      {
        ok: false,

        error:
          'Token do cartão não informado.',
      },
      400
    );
  }

  if (
    cardTokenId.length >
    500
  ) {
    return json(
      {
        ok: false,

        error:
          'Token do cartão inválido.',
      },
      400
    );
  }

  /*
   * Em Preview utilizamos
   * o Buyer Test User
   * informado no formulário.
   *
   * Em Production utilizamos
   * o e-mail real da conta
   * MirraCRM.
   */
  const isPreview =
    process.env
      .VERCEL_ENV ===
    'preview';

  const mercadoPagoPayerEmail =
    isPreview &&
    payerEmail
      ? payerEmail
      : user.email
          .trim()
          .toLowerCase();

  console.log(
    'MP annual payer diagnostic:',
    {
      environment:
        process.env
          .VERCEL_ENV,

      usingFormEmail:
        isPreview &&
        Boolean(
          payerEmail
        ),

      payerEmailDomain:
        mercadoPagoPayerEmail
          .split('@')[1] ||
        'invalid',
    }
  );

  /*
   * 5. Localizamos a conta
   * de billing.
   */
  const {
    data: membership,
    error:
      membershipError,
  } =
    await admin
      .from(
        'billing_memberships'
      )
      .select(
        'billing_account_id'
      )
      .eq(
        'user_id',
        user.id
      )
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
    membership
      .billing_account_id;

  /*
   * 6. Verificamos a conta.
   */
  const {
    data: account,
    error:
      accountError,
  } =
    await admin
      .from(
        'billing_accounts'
      )
      .select(
        'id, is_legacy_free'
      )
      .eq(
        'id',
        billingAccountId
      )
      .maybeSingle();

  if (
    accountError ||
    !account
  ) {
    return json(
      {
        ok: false,

        error:
          'Conta não encontrada.',
      },
      404
    );
  }

  if (
    account
      .is_legacy_free
  ) {
    return json(
      {
        ok: false,

        error:
          'Esta conta possui acesso legado e não necessita contratar um plano.',
      },
      403
    );
  }

  /*
   * 7. Carregamos a assinatura
   * interna.
   */
  const {
    data:
      internalSubscription,
    error:
      subscriptionError,
  } =
    await admin
      .from(
        'billing_subscriptions'
      )
      .select(
        'id, billing_account_id, plan_id, status, billing_cycle, trial_starts_at, trial_ends_at, provider, provider_subscription_id'
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
   * Impede criação duplicada
   * de assinatura externa.
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
   * 8. Validamos o plano
   * e o preço anual
   * diretamente no banco.
   */
  const {
    data: billingPlan,
    error: planError,
  } =
    await admin
      .from(
        'billing_plans'
      )
      .select(
        'id, name, annual_price_cents, is_active'
      )
      .eq(
        'id',
        planId
      )
      .eq(
        'is_active',
        true
      )
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

  const annualAmountCents =
    billingPlan
      .annual_price_cents;

  if (
    annualAmountCents ==
      null ||
    !Number.isInteger(
      annualAmountCents
    ) ||
    annualAmountCents <=
      0
  ) {
    return json(
      {
        ok: false,

        error:
          'Preço anual não configurado.',
      },
      500
    );
  }

  const annualAmount =
    centsToAmount(
      annualAmountCents
    );

  /*
   * 9. Criamos/reutilizamos
   * a billing_order interna.
   */
  const {
    data: orderResult,
    error: orderError,
  } =
    await admin.rpc(
      'create_or_reuse_billing_order',
      {
        p_account_id:
          billingAccountId,

        p_plan_id:
          planId,

        p_billing_cycle:
          'annual',
      }
    );

  if (orderError) {
    console.error(
      'Falha ao criar/reutilizar billing order anual:',
      orderError
    );

    const message =
      orderError.message ||
      '';

    if (
      message.includes(
        'pagamento em processamento'
      ) ||
      message.includes(
        'contratação iniciada'
      )
    ) {
      return json(
        {
          ok: false,
          error:
            message,
        },
        409
      );
    }

    return json(
      {
        ok: false,

        error:
          'Não foi possível preparar a assinatura anual.',
      },
      500
    );
  }

  /*
   * Compatibilidade caso a RPC
   * retorne linha ou array.
   */
  const order =
    Array.isArray(
      orderResult
    )
      ? orderResult[0]
      : orderResult;

  if (
    !order ||
    typeof order !==
      'object' ||
    !('id' in order) ||
    typeof order.id !==
      'string'
  ) {
    console.error(
      'RPC não retornou billing order anual válida:',
      orderResult
    );

    return json(
      {
        ok: false,

        error:
          'A ordem de cobrança anual não foi criada corretamente.',
      },
      500
    );
  }

  const orderId =
    order.id;

  /*
   * 10. Validação defensiva
   * da ordem.
   */
  if (
    'billing_cycle' in
      order &&
    order.billing_cycle !==
      'annual'
  ) {
    return json(
      {
        ok: false,

        error:
          'Periodicidade da ordem inconsistente.',
      },
      500
    );
  }

  if (
    'plan_id' in order &&
    order.plan_id !==
      planId
  ) {
    return json(
      {
        ok: false,

        error:
          'Plano da ordem inconsistente.',
      },
      500
    );
  }

  if (
    'amount_cents' in
      order &&
    order.amount_cents !==
      annualAmountCents
  ) {
    console.error(
      'Valor da ordem anual inconsistente:',
      {
        orderId,

        orderAmount:
          order.amount_cents,

        expectedAmount:
          annualAmountCents,
      }
    );

    return json(
      {
        ok: false,

        error:
          'Valor da ordem anual inconsistente.',
      },
      500
    );
  }

  /*
   * 11. Criamos a assinatura anual
   * diretamente em /preapproval.
   *
   * Não há preapproval_plan_id:
   * esta é uma assinatura sem
   * plano associado.
   *
   * Cobrança:
   * uma vez a cada 12 meses.
   */
  const mercadoPagoBody = {
    reason:
      `MirraCRM ${billingPlan.name} - Anual`,

    external_reference:
      orderId,

    payer_email:
      mercadoPagoPayerEmail,

    card_token_id:
      cardTokenId,

    auto_recurring: {
      frequency:
        12,

      frequency_type:
        'months',

      transaction_amount:
        annualAmount,

      currency_id:
        'BRL',
    },

    back_url:
      `${request.nextUrl.origin}/cadastro/pagamento?plan=${planId}&cycle=annual`,

    status:
      'authorized',
  };

  console.log(
    'MP annual preapproval request diagnostic:',
    {
      orderId,

      planId,

      billingCycle:
        'annual',

      transactionAmount:
        annualAmount,

      currency:
        'BRL',

      frequency:
        12,

      frequencyType:
        'months',

      payerEmailDomain:
        mercadoPagoPayerEmail
          .split('@')[1] ||
        'invalid',

      hasCardToken:
        Boolean(
          cardTokenId
        ),
    }
  );

  const mercadoPagoResponse =
    await fetch(
      'https://api.mercadopago.com/preapproval',
      {
        method:
          'POST',

        headers: {
          Authorization:
            `Bearer ${mercadoPagoAccessToken}`,

          'Content-Type':
            'application/json',

          /*
           * Mantemos o mesmo padrão
           * já utilizado pela rota
           * mensal do MirraCRM.
           */
          'X-Idempotency-Key':
            orderId,
        },

        body:
          JSON.stringify(
            mercadoPagoBody
          ),

        cache:
          'no-store',
      }
    );

  let mercadoPago:
    | MercadoPagoSubscriptionResponse
    | null =
      null;

  try {
    mercadoPago =
      (await mercadoPagoResponse.json()) as
        MercadoPagoSubscriptionResponse;
  } catch {
    mercadoPago =
      null;
  }

  /*
   * 12. Falha do Mercado Pago.
   */
  if (
    !mercadoPagoResponse.ok ||
    !mercadoPago?.id
  ) {
    console.error(
      'MP ANNUAL PREAPPROVAL FULL ERROR:',
      JSON.stringify(
        mercadoPago,
        null,
        2
      )
    );

    console.error(
      'Mercado Pago recusou a criação da assinatura anual:',
      {
        httpStatus:
          mercadoPagoResponse
            .status,

        orderId,

        response:
          mercadoPago,
      }
    );

    return json(
      {
        ok: false,

        error:
          'O Mercado Pago não conseguiu criar a assinatura anual.',

        code:
          'MERCADO_PAGO_PREAPPROVAL_FAILED',

        providerStatus:
          mercadoPagoResponse
            .status,
      },
      502
    );
  }

  const providerSubscriptionId =
    mercadoPago.id;

  /*
   * 13. Validações defensivas
   * da assinatura retornada.
   */
  if (
    mercadoPago
      .external_reference &&
    mercadoPago
      .external_reference !==
      orderId
  ) {
    console.error(
      'Mercado Pago retornou external_reference inesperado:',
      {
        expected:
          orderId,

        received:
          mercadoPago
            .external_reference,

        providerSubscriptionId,
      }
    );

    return json(
      {
        ok: false,

        error:
          'O provedor retornou uma assinatura anual inconsistente.',

        code:
          'PROVIDER_CREATED_LOCAL_LINK_FAILED',
      },
      500
    );
  }

  /*
   * 14. Vinculamos a assinatura
   * externa à billing_subscription.
   *
   * IMPORTANTE:
   *
   * Não ativamos a assinatura aqui.
   * A confirmação financeira deve
   * continuar dependendo do webhook
   * / consulta canônica do Mercado Pago.
   */
  const {
    data:
      updatedSubscription,
    error:
      updateSubscriptionError,
  } =
    await admin
      .from(
        'billing_subscriptions'
      )
      .update({
        plan_id:
          planId,

        billing_cycle:
          'annual',

        provider:
          'mercado_pago',

        provider_subscription_id:
          providerSubscriptionId,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        internalSubscription
          .id
      )
      .is(
        'provider_subscription_id',
        null
      )
      .select(
        'id, plan_id, status, billing_cycle, trial_ends_at, provider, provider_subscription_id'
      )
      .maybeSingle();

  if (
    updateSubscriptionError ||
    !updatedSubscription
  ) {
    /*
     * A assinatura externa JÁ existe.
     *
     * NÃO criar outra automaticamente.
     */
    console.error(
      'ASSINATURA_ANUAL_MP_CRIADA_MAS_NAO_VINCULADA:',
      {
        billingAccountId,

        orderId,

        providerSubscriptionId,

        error:
          updateSubscriptionError,
      }
    );

    return json(
      {
        ok: false,

        error:
          'A assinatura anual foi criada no Mercado Pago, mas não pôde ser vinculada ao MirraCRM. Não tente novamente.',

        code:
          'PROVIDER_CREATED_LOCAL_LINK_FAILED',
      },
      500
    );
  }

  /*
   * 15. Relacionamos também
   * billing_order à assinatura
   * externa.
   *
   * Para preapproval usamos
   * provider_checkout_id,
   * exatamente como a rota
   * mensal já faz.
   */
  const {
    error:
      updateOrderError,
  } =
    await admin
      .from(
        'billing_orders'
      )
      .update({
        provider:
          'mercado_pago',

        provider_checkout_id:
          providerSubscriptionId,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        orderId
      )
      .eq(
        'billing_account_id',
        billingAccountId
      );

  if (
    updateOrderError
  ) {
    /*
     * Não desfazemos a assinatura:
     * o vínculo principal já está
     * salvo em billing_subscriptions.
     */
    console.error(
      'Assinatura anual vinculada, mas billing_order não foi atualizada:',
      {
        orderId,

        providerSubscriptionId,

        error:
          updateOrderError,
      }
    );
  }

  /*
   * 16. Sucesso na criação
   * da assinatura.
   *
   * Isso NÃO significa ainda
   * pagamento confirmado.
   */
  return json(
    {
      ok: true,

      subscription: {
        id:
          updatedSubscription
            .id,

        planId:
          updatedSubscription
            .plan_id,

        billingCycle:
          updatedSubscription
            .billing_cycle,

        status:
          updatedSubscription
            .status,

        trialEndsAt:
          updatedSubscription
            .trial_ends_at,

        provider:
          updatedSubscription
            .provider,

        providerSubscriptionId:
          updatedSubscription
            .provider_subscription_id,

        mercadoPagoStatus:
          mercadoPago.status ||
          null,
      },

      order: {
        id:
          orderId,
      },
    },
    201
  );
}
