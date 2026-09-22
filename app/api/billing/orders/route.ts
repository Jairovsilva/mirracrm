import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type BillingCycle = 'monthly' | 'annual';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('Variáveis do Supabase ausentes na API de pedidos.');

      return NextResponse.json(
        {
          ok: false,
          error: 'Configuração do servidor incompleta.',
        },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 1. AUTENTICAÇÃO
    // ─────────────────────────────────────────────────────────────

    const authorization = request.headers.get('authorization');

    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sessão não encontrada.',
        },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          ok: false,
          error: 'Sessão inválida. Faça login novamente.',
        },
        { status: 401 }
      );
    }

    // Cliente administrativo somente no servidor.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // 2. VALIDAR SOLICITANTE
    // ─────────────────────────────────────────────────────────────

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Perfil não encontrado.',
        },
        { status: 404 }
      );
    }

    // Somente o proprietário contrata/altera o plano.
    if (profile.role !== 'owner') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Apenas o proprietário da conta pode contratar um plano.',
        },
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 3. IDENTIFICAR CONTA DE FATURAMENTO
    // ─────────────────────────────────────────────────────────────

    const { data: membership, error: membershipError } = await admin
      .from('billing_memberships')
      .select('billing_account_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Conta de faturamento não encontrada.',
        },
        { status: 404 }
      );
    }

    const accountId = membership.billing_account_id;

    const { data: account, error: accountError } = await admin
      .from('billing_accounts')
      .select('id, is_legacy_free')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Conta não encontrada.',
        },
        { status: 404 }
      );
    }

    // Clientes históricos permanecem no modelo gratuito.
    if (account.is_legacy_free === true) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Esta conta possui acesso legado e não necessita contratar um plano.',
        },
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 4. VALIDAR PLANO ESCOLHIDO
    // ─────────────────────────────────────────────────────────────

    let body: {
      planId?: string;
      billingCycle?: BillingCycle;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: 'Dados da contratação inválidos.',
        },
        { status: 400 }
      );
    }

    const planId = String(body.planId ?? '')
      .trim()
      .toLowerCase();

    const billingCycle = String(
      body.billingCycle ?? ''
    ).trim() as BillingCycle;

    if (!planId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Selecione um plano.',
        },
        { status: 400 }
      );
    }

    if (
      billingCycle !== 'monthly' &&
      billingCycle !== 'annual'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Periodicidade inválida.',
        },
        { status: 400 }
      );
    }

    // Enterprise não possui checkout automático.
    if (planId === 'enterprise') {
      return NextResponse.json(
        {
          ok: false,
          error:
            'O plano Enterprise possui contratação personalizada.',
        },
        { status: 400 }
      );
    }

    // Whitelist dos planos vendidos automaticamente.
    if (planId !== 'basic' && planId !== 'pro') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Plano inválido.',
        },
        { status: 400 }
      );
    }

    const { data: plan, error: planError } = await admin
      .from('billing_plans')
      .select(
        'id, name, monthly_price_cents, annual_price_cents, max_users, is_active'
      )
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Plano não encontrado.',
        },
        { status: 404 }
      );
    }

    if (!plan.is_active) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Este plano não está disponível para contratação.',
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 5. DETERMINAR PREÇO NO SERVIDOR
    // ─────────────────────────────────────────────────────────────

    const amountCents =
      billingCycle === 'monthly'
        ? plan.monthly_price_cents
        : plan.annual_price_cents;

    if (
      amountCents == null ||
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Preço do plano não configurado.',
        },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 6. CANCELAR PEDIDOS PENDENTES ANTIGOS DA MESMA CONTA
    // ─────────────────────────────────────────────────────────────

    const { error: cancelError } = await admin
      .from('billing_orders')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('billing_account_id', accountId)
      .eq('status', 'pending');

    if (cancelError) {
      console.error(
        'Erro ao cancelar pedidos pendentes anteriores:',
        cancelError
      );

      return NextResponse.json(
        {
          ok: false,
          error: 'Não foi possível preparar a nova contratação.',
        },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 7. CRIAR NOVO PEDIDO
    // ─────────────────────────────────────────────────────────────

    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    const { data: order, error: orderError } = await admin
      .from('billing_orders')
      .insert({
        billing_account_id: accountId,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        amount_cents: amountCents,
        currency: 'BRL',
        status: 'pending',
        provider: 'mercado_pago',
        expires_at: expiresAt,
      })
      .select(
        `
          id,
          plan_id,
          billing_cycle,
          amount_cents,
          currency,
          status,
          expires_at,
          created_at
        `
      )
      .single();

    if (orderError || !order) {
      console.error(
        'Erro ao criar pedido de contratação:',
        orderError
      );

      return NextResponse.json(
        {
          ok: false,
          error: 'Não foi possível criar o pedido.',
        },
        { status: 500 }
      );
    }

    // IMPORTANTE:
    // Criar um pedido NÃO ativa a assinatura.
    // A ativação ocorrerá posteriormente após confirmação
    // válida do pagamento pelo provedor.

    return NextResponse.json(
      {
        ok: true,

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
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'Erro inesperado na criação do pedido:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: 'Erro inesperado no servidor.',
      },
      { status: 500 }
    );
  }
}
