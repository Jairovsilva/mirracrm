import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type BillingCycle = 'monthly' | 'annual';

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('Configuração do Supabase incompleta.');
      return errorResponse('Configuração do servidor incompleta.', 500);
    }

    // 1. Autenticar o usuário.
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

    // A chave administrativa permanece exclusivamente no servidor.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 2. Somente o proprietário pode contratar.
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

    // 3. Identificar a conta pelo usuário autenticado.
    // Nunca aceitar billing_account_id enviado pelo navegador.
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

    // 4. Validar a seleção.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse('Dados da contratação inválidos.', 400);
    }

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return errorResponse('Dados da contratação inválidos.', 400);
    }

    const input = body as Record<string, unknown>;

    if (
      typeof input.planId !== 'string' ||
      typeof input.billingCycle !== 'string'
    ) {
      return errorResponse('Plano ou periodicidade inválidos.', 400);
    }

    const planId = input.planId.trim().toLowerCase();

    const billingCycle = input.billingCycle.trim() as BillingCycle;

    if (planId === 'enterprise') {
      return errorResponse(
        'O plano Enterprise possui contratação personalizada.',
        400
      );
    }

    if (planId !== 'basic' && planId !== 'pro') {
      return errorResponse('Plano inválido.', 400);
    }

    if (
      billingCycle !== 'monthly' &&
      billingCycle !== 'annual'
    ) {
      return errorResponse('Periodicidade inválida.', 400);
    }

    // 5. Consultar o plano e o preço exclusivamente no banco.
    const { data: plan, error: planError } = await admin
      .from('billing_plans')
      .select(
        'id, name, monthly_price_cents, annual_price_cents, max_users, is_active'
      )
      .eq('id', planId)
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

    const amountCents =
      billingCycle === 'monthly'
        ? plan.monthly_price_cents
        : plan.annual_price_cents;

    if (
      amountCents == null ||
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      return errorResponse('Preço do plano não configurado.', 500);
    }

    // 6. Criar ou reutilizar o pedido dentro de uma transação SQL.
    // A função bloqueia a conta e impede criação concorrente.
    const { data: order, error: orderError } = await admin.rpc(
      'create_or_reuse_billing_order',
      {
        p_account_id: accountId,
        p_plan_id: planId,
        p_billing_cycle: billingCycle,
      }
    );

    if (orderError || !order) {
      console.error('Erro ao criar ou reutilizar pedido:', orderError);

      const message = orderError?.message || '';

      if (
        message.includes('pagamento em processamento') ||
        message.includes('contratação iniciada')
      ) {
        return errorResponse(message, 409);
      }

      if (
        message.includes('Plano indisponível') ||
        message.includes('Plano ou periodicidade inválidos')
      ) {
        return errorResponse(message, 400);
      }

      return errorResponse(
        'Não foi possível preparar a contratação.',
        500
      );
    }

    // 7. Responder com os dados efetivamente gravados no banco.
    // A função pode ter reutilizado um pedido anterior.
    const reused =
      new Date(order.created_at).getTime() <
      Date.now() - 5000;

    return NextResponse.json(
      {
        ok: true,

        reused,

        order: {
          id: order.id,

          plan: {
            id: plan.id,
            name: plan.name,
            maxUsers: plan.max_users,
          },

          billingCycle: order.billing_cycle,
          amountCents: order.amount_cents,
          currency: order.currency,
          status: order.status,
          expiresAt: order.expires_at,
          createdAt: order.created_at,
        },

        payment: {
          configured: false,
          provider: 'mercado_pago',
        },
      },
      {
        status: reused ? 200 : 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Erro inesperado na API de pedidos:', error);

    return errorResponse('Erro inesperado no servidor.', 500);
  }
}
