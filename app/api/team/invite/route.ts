import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let createdUserId: string | null = null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Variáveis do Supabase ausentes na rota de convites.');
    return NextResponse.json(
      { ok: false, error: 'Configuração do servidor incompleta.' },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const body = await req.json();

    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');

    const authorization = req.headers.get('authorization');
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!email || !name || !password || !accessToken) {
      return NextResponse.json(
        { ok: false, error: 'Preencha todos os campos obrigatórios.' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'E-mail inválido.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'A senha deve ter pelo menos 8 caracteres.' },
        { status: 400 }
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
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Sessão inválida. Faça login novamente.' },
        { status: 401 }
      );
    }

    const { data: requesterProfile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, account_type, scope_key, company_name')
      .eq('id', user.id)
      .single();

    if (profileError || !requesterProfile) {
      return NextResponse.json(
        { ok: false, error: 'Perfil do solicitante não encontrado.' },
        { status: 401 }
      );
    }

    if (
      requesterProfile.role !== 'owner' &&
      requesterProfile.role !== 'admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Apenas proprietários e administradores podem convidar usuários.',
        },
        { status: 403 }
      );
    }

    // Preserva a restrição de domínio das contas antigas que usam PJ::.
    const scopeKey = String(requesterProfile.scope_key);

    if (scopeKey.startsWith('PJ::')) {
      const requiredDomain = scopeKey.slice(4).toLowerCase();
      const invitedDomain = email.split('@')[1];

      if (invitedDomain !== requiredDomain) {
        return NextResponse.json(
          {
            ok: false,
            error: `O e-mail deve pertencer ao domínio ${requiredDomain}.`,
          },
          { status: 400 }
        );
      }
    }

    const { data: membership, error: membershipError } = await admin
      .from('billing_memberships')
      .select('billing_account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { ok: false, error: 'Conta de faturamento não encontrada.' },
        { status: 403 }
      );
    }

    const { data: account, error: accountError } = await admin
      .from('billing_accounts')
      .select('is_legacy_free')
      .eq('id', membership.billing_account_id)
      .single();

    const { data: subscription, error: subscriptionError } = await admin
      .from('billing_subscriptions')
      .select('status, plan_id, trial_ends_at, current_period_ends_at')
      .eq('billing_account_id', membership.billing_account_id)
      .single();

    if (
      accountError ||
      subscriptionError ||
      !account ||
      !subscription
    ) {
      return NextResponse.json(
        { ok: false, error: 'Não foi possível validar a assinatura.' },
        { status: 500 }
      );
    }

    const now = Date.now();

    const legacyValid =
      account.is_legacy_free === true &&
      subscription.status === 'legacy_free';

    const trialValid =
      account.is_legacy_free === false &&
      subscription.status === 'trialing' &&
      !!subscription.trial_ends_at &&
      new Date(subscription.trial_ends_at).getTime() > now;

    const activeValid =
      account.is_legacy_free === false &&
      subscription.status === 'active' &&
      !!subscription.current_period_ends_at &&
      new Date(subscription.current_period_ends_at).getTime() > now;

    if (!legacyValid && !trialValid && !activeValid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Assinatura inativa ou período de teste encerrado.',
        },
        { status: 403 }
      );
    }

    // Verificação antecipada para evitar criar usuários desnecessariamente.
    // A função SQL fará a verificação definitiva com bloqueio de concorrência.
    if (!legacyValid) {
      let maxUsers = 2;

      if (subscription.plan_id) {
        const { data: plan, error: planError } = await admin
          .from('billing_plans')
          .select('max_users, is_active')
          .eq('id', subscription.plan_id)
          .single();

        if (planError || !plan || !plan.is_active || plan.max_users == null) {
          return NextResponse.json(
            { ok: false, error: 'Limite de usuários do plano não configurado.' },
            { status: 403 }
          );
        }

        maxUsers = plan.max_users;
      } else if (subscription.status !== 'trialing') {
        return NextResponse.json(
          { ok: false, error: 'Plano não configurado.' },
          { status: 403 }
        );
      }

      const { count, error: countError } = await admin
        .from('billing_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('billing_account_id', membership.billing_account_id);

      if (countError) {
        throw countError;
      }

      if ((count ?? 0) >= maxUsers) {
        return NextResponse.json(
          {
            ok: false,
            error: `Limite de usuários do plano atingido (${maxUsers} vagas).`,
          },
          { status: 403 }
        );
      }
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        {
          ok: false,
          error: createError?.message || 'Não foi possível criar o usuário.',
        },
        { status: 400 }
      );
    }

    createdUserId = created.user.id;

    // O trigger cria um perfil isolado. O servidor o vincula à empresa correta.
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        name,
        role: 'vendedor',
        account_type: requesterProfile.account_type,
        scope_key: requesterProfile.scope_key,
        company_name: requesterProfile.company_name,
      })
      .eq('id', createdUserId);

    if (updateError) {
      throw updateError;
    }

    // Verificação definitiva de assinatura, empresa e vagas dentro do banco.
    const { error: linkError } = await admin.rpc(
      'add_billing_team_member',
      {
        p_requester_id: user.id,
        p_new_user_id: createdUserId,
      }
    );

    if (linkError) {
      throw linkError;
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Usuário criado e vinculado à equipe com sucesso.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Erro ao convidar usuário:', error);

    if (createdUserId) {
      const { error: cleanupError } =
        await admin.auth.admin.deleteUser(createdUserId);

      if (cleanupError) {
        console.error(
          'ATENÇÃO: falha ao desfazer criação do usuário:',
          createdUserId,
          cleanupError
        );
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível criar o usuário.';

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
