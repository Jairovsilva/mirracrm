import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type PlanId = 'basic' | 'pro';

type MercadoPagoPaymentResponse = {
  id?: number;
  status?: string;
  status_detail?: string;
  external_reference?: string;
};

function errorResponse(
  message: string,
  status: number,
  code?: string
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(code ? { code } : {}),
    },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mercadoPagoAccessToken =
      process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

    /**
     * DIAGNÓSTICO TEMPORÁRIO DO MERCADO PAGO
     *
     * Não imprime o Access Token completo.
     * Remover depois de identificarmos a origem do erro 401.
     */
    console.log('MP credential diagnostic:', {
      configured: Boolean(mercadoPagoAccessToken),
      prefix: mercadoPagoAccessToken?.slice(0, 8),
      length: mercadoPagoAccessToken?.length,
      vercelEnv: process.env.VERCEL_ENV,
      vercelGitBranch: process.env.VERCEL_GIT_COMMIT_REF,
    });

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !mercadoPagoAccessToken
    ) {
      console.error('Configuração do pagamento anual incompleta.');
      return errorResponse('Configuração do servidor incompleta.', 500);
    }

    const authorization = request.headers.get('authorization');
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!accessToken) {
      return errorResponse('Sessão não encontrada.', 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !user) {
      return errorResponse('Sessão inválida. Faça login novamente.', 401);
    }

    if (!user.email) {
      return errorResponse('E-mail do usuário não encontrado.', 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return errorResponse('Perfil não encontrado.', 404);
    }

    if (profile.role !== 'owner') {
      return errorResponse(
        'Apenas o proprietário da conta pode contratar um plano.',
        403
      );
    }

    const { data: membership, error: membershipError } = await admin
      .from('billing_memberships')
      .select('billing_account_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return errorResponse('Conta de faturamento não encontrada.', 404);
    }

    const accountId = membership.billing_account_id;

    const { data: account, error: accountError } = await admin
      .from('billing_accounts')
      .select('id, is_legacy_free')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return errorResponse('Conta não encontrada.', 404);
    }

    if (account.is_legacy_free) {
      return errorResponse(
        'Esta conta possui acesso legado e não necessita contratar um plano.',
        403
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse('Dados do pagamento inválidos.', 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errorResponse('Dados do pagamento inválidos.', 400);
    }

    const input = body as Record<string, unknown>;

    const planId =
      typeof input.planId === 'string'
        ? input.planId.trim().toLowerCase()
        : '';

    if (planId !== 'basic' && planId !== 'pro') {
      return errorResponse('Plano inválido.', 400);
    }

    if (input.billingCycle !== 'annual') {
      return errorResponse('Periodicidade inválida.', 400);
    }

    const cardTokenId =
      typeof input.cardTokenId === 'string'
        ? input.cardTokenId.trim()
        : '';

    const paymentMethodId =
      typeof input.paymentMethodId === 'string'
        ? input.paymentMethodId.trim()
        : '';

    const issuerId =
      typeof input.issuerId === 'string'
        ? input.issuerId.trim()
        : '';

    const identificationType =
      typeof input.identificationType === 'string'
        ? input.identificationType.trim()
        : '';

    const identificationNumber =
      typeof input.identificationNumber === 'string'
        ? input.identificationNumber.trim()
        : '';

    /**
     * O frontend já envia payerEmail.
     *
     * Em Preview, usamos o e-mail informado no formulário para permitir
     * o Buyer Test User do Mercado Pago.
     *
     * Em Production, continuamos usando o e-mail autenticado no MirraCRM.
     */
    const payerEmail =
      typeof input.payerEmail === 'string'
        ? input.payerEmail.trim().toLowerCase()
        : '';

    const isPreview = process.env.VERCEL_ENV === 'preview';

    const mercadoPagoPayerEmail =
      isPreview && payerEmail
        ? payerEmail
        : user.email.trim().toLowerCase();

    const installments = Number(input.installments);

    if (!cardTokenId || !paymentMethodId) {
      return errorResponse('Dados do cartão incompletos.', 400);
    }

    if (!Number.isInteger(installments) || installments <= 0) {
      return errorResponse('Número de parcelas inválido.', 400);
    }

    if (!mercadoPagoPayerEmail) {
      return errorResponse('E-mail do pagador não encontrado.', 400);
    }

    const { data: plan, error: planError } = await admin
      .from('billing_plans')
      .select('id, name, annual_price_cents, is_active')
      .eq('id', planId as PlanId)
      .single();

    if (planError || !plan) {
      return errorResponse('Plano não encontrado.', 404);
    }

    if (!plan.is_active) {
      return errorResponse(
        'Este plano não está disponível para contratação.',
        400
      );
    }

    const amountCents = plan.annual_price_cents;

    if (
      amountCents == null ||
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      return errorResponse('Preço anual não configurado.', 500);
    }

    const { data: order, error: orderError } = await admin.rpc(
      'create_or_reuse_billing_order',
      {
        p_account_id: accountId,
        p_plan_id: planId,
        p_billing_cycle: 'annual',
      }
    );

    if (orderError || !order) {
      console.error('Erro ao preparar pedido anual:', orderError);

      const message = orderError?.message || '';

      if (
        message.includes('pagamento em processamento') ||
        message.includes('contratação iniciada')
      ) {
        return errorResponse(message, 409);
      }

      return errorResponse(
        'Não foi possível preparar a contratação anual.',
        500
      );
    }

    if (
      order.billing_cycle !== 'annual' ||
      order.plan_id !== planId ||
      order.amount_cents !== amountCents ||
      order.currency !== 'BRL'
    ) {
      console.error('Pedido anual inconsistente:', {
        orderId: order.id,
        orderPlan: order.plan_id,
        requestedPlan: planId,
        orderCycle: order.billing_cycle,
        orderAmount: order.amount_cents,
        expectedAmount: amountCents,
        currency: order.currency,
      });

      return errorResponse('Pedido anual inconsistente.', 500);
    }

    // A mesma tentativa (mesmo token descartável) gera a mesma chave.
    // Um novo token de cartão gera uma nova tentativa, sem reutilizar
    // a idempotência de uma tentativa anterior eventualmente recusada.
    const idempotencyKey = createHash('sha256')
      .update(`${order.id}:${cardTokenId}`)
      .digest('hex');

    const payer: Record<string, unknown> = {
      email: mercadoPagoPayerEmail,
    };

    if (identificationType && identificationNumber) {
      payer.identification = {
        type: identificationType,
        number: identificationNumber,
      };
    }

    /**
     * Diagnóstico seguro do payer.
     *
     * Não imprime CPF, token do cartão ou Access Token.
     */
    console.log('MP payer diagnostic:', {
      environment: process.env.VERCEL_ENV,
      usingFormEmail: isPreview && Boolean(payerEmail),
      payerEmailDomain:
        mercadoPagoPayerEmail.split('@')[1] || 'invalid',
      paymentMethodId,
      installments,
      hasIdentification:
        Boolean(identificationType) &&
        Boolean(identificationNumber),
    });

    const paymentBody: Record<string, unknown> = {
      transaction_amount: centsToAmount(amountCents),
      token: cardTokenId,
      description: `MirraCRM ${plan.name} - Anual`,
      installments,
      payment_method_id: paymentMethodId,
      external_reference: order.id,
      payer,
    };

    if (issuerId) {
      paymentBody.issuer_id = issuerId;
    }

    const mercadoPagoResponse = await fetch(
      'https://api.mercadopago.com/v1/payments',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mercadoPagoAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(paymentBody),
        cache: 'no-store',
      }
    );

    let mercadoPagoPayment: MercadoPagoPaymentResponse | null = null;

    try {
      mercadoPagoPayment =
        (await mercadoPagoResponse.json()) as MercadoPagoPaymentResponse;
    } catch {
      mercadoPagoPayment = null;
    }

    if (!mercadoPagoResponse.ok || !mercadoPagoPayment?.id) {
      console.error(
        'Mercado Pago recusou a criação do pagamento anual:',
        {
          httpStatus: mercadoPagoResponse.status,
          response: mercadoPagoPayment,
          orderId: order.id,
        }
      );

      return errorResponse(
        'O Mercado Pago não conseguiu processar o pagamento anual. Confira os dados e tente novamente.',
        502,
        'MERCADO_PAGO_PAYMENT_FAILED'
      );
    }

    const providerPaymentId = String(mercadoPagoPayment.id);

    // Vincula imediatamente o identificador retornado pelo provedor.
    // A confirmação financeira continua sendo feita pelo webhook/canonical GET.
    const { error: linkError } = await admin
      .from('billing_orders')
      .update({
        provider: 'mercado_pago',
        provider_payment_id: providerPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('billing_account_id', accountId);

    if (linkError) {
      console.error(
        'Pagamento anual criado, mas falhou o vínculo local:',
        {
          orderId: order.id,
          providerPaymentId,
          linkError,
        }
      );

      return errorResponse(
        'O pagamento foi recebido pelo Mercado Pago, mas ocorreu uma falha ao vinculá-lo ao MirraCRM. Não tente novamente. Entre em contato com o suporte.',
        500,
        'PROVIDER_CREATED_LOCAL_LINK_FAILED'
      );
    }

    return NextResponse.json(
      {
        ok: true,
        orderId: order.id,
        paymentId: providerPaymentId,
        paymentStatus: mercadoPagoPayment.status || null,
        paymentStatusDetail: mercadoPagoPayment.status_detail || null,
        financialApplicationEnabled:
          process.env.MERCADO_PAGO_APPLY_PAYMENTS === 'true',
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Erro inesperado no pagamento anual:', error);
    return errorResponse('Erro inesperado no servidor.', 500);
  }
}
