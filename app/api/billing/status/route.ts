import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

function remainingDays(
  timestamp: number | null,
  now: number
): number | null {
  if (timestamp === null) return null;

  return Math.max(0, Math.ceil((timestamp - now) / DAY_MS));
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Token não informado." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Variáveis de ambiente do Supabase ausentes.");

      return NextResponse.json(
        { error: "Configuração do servidor incompleta." },
        { status: 500 }
      );
    }

    // Valida a sessão do usuário.
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
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
        { error: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    // A chave privilegiada permanece exclusivamente no servidor.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: membership, error: membershipError } = await admin
      .from("billing_memberships")
      .select("billing_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!membership) {
      return NextResponse.json(
        { error: "Conta de faturamento não encontrada." },
        { status: 404 }
      );
    }

    const accountId = membership.billing_account_id;

    const [
      { data: account, error: accountError },
      { data: subscription, error: subscriptionError },
    ] = await Promise.all([
      admin
        .from("billing_accounts")
        .select("id, company_name, is_legacy_free")
        .eq("id", accountId)
        .single(),

      admin
        .from("billing_subscriptions")
        .select(
          "plan_id, status, billing_cycle, trial_starts_at, trial_ends_at, current_period_starts_at, current_period_ends_at"
        )
        .eq("billing_account_id", accountId)
        .single(),
    ]);

    if (accountError) throw accountError;
    if (subscriptionError) throw subscriptionError;

    if (!account || !subscription) {
      return NextResponse.json(
        { error: "Dados da assinatura não encontrados." },
        { status: 404 }
      );
    }

    let plan = null;

    if (subscription.plan_id) {
      const { data, error } = await admin
        .from("billing_plans")
        .select(
          "id, name, monthly_price_cents, annual_price_cents, max_users"
        )
        .eq("id", subscription.plan_id)
        .single();

      if (error) throw error;

      plan = data;
    }

    const now = Date.now();

    const trialEndsAt = parseTimestamp(
      subscription.trial_ends_at
    );

    const periodStartsAt = parseTimestamp(
      subscription.current_period_starts_at
    );

    const periodEndsAt = parseTimestamp(
      subscription.current_period_ends_at
    );

    const isLegacyFree =
      account.is_legacy_free === true &&
      subscription.status === "legacy_free";

    const trialValid =
      subscription.status === "trialing" &&
      trialEndsAt !== null &&
      trialEndsAt > now;

    const subscriptionValid =
      subscription.status === "active" &&
      periodEndsAt !== null &&
      periodEndsAt > now;

    const hasAccess =
      isLegacyFree || trialValid || subscriptionValid;

    /*
     * Cliente ainda está no teste gratuito e não contratou.
     */
    const isTrialing =
      subscription.status === "trialing" &&
      trialEndsAt !== null &&
      trialEndsAt > now;

    /*
     * Cliente já contratou, mas o período pago começará
     * somente após o término do teste gratuito.
     */
    const isPaidAwaitingStart =
      subscription.status === "active" &&
      subscription.plan_id !== null &&
      trialEndsAt !== null &&
      trialEndsAt > now &&
      periodStartsAt !== null &&
      periodStartsAt > now &&
      periodEndsAt !== null &&
      periodEndsAt > periodStartsAt;

    /*
     * Período pago efetivamente iniciado.
     */
    const isPaidPeriod =
      subscription.status === "active" &&
      periodStartsAt !== null &&
      periodStartsAt <= now &&
      periodEndsAt !== null &&
      periodEndsAt > now;

    /*
     * Mantém a contagem do teste também quando o cliente
     * já pagou antecipadamente.
     */
    const trialDaysRemaining =
      isTrialing || isPaidAwaitingStart
        ? remainingDays(trialEndsAt, now)
        : null;

    const paidPeriodDaysRemaining =
      isPaidPeriod
        ? remainingDays(periodEndsAt, now)
        : null;

    const effectiveStatus =
      subscription.status === "trialing" && !trialValid
        ? "expired"
        : subscription.status === "active" && !subscriptionValid
          ? "expired"
          : subscription.status;

    /*
     * Campo informativo para a interface.
     * Não substitui a validação de acesso no banco.
     */
    const billingPhase = isLegacyFree
      ? "legacy_free"
      : isPaidAwaitingStart
        ? "paid_awaiting_start"
        : isTrialing
          ? "trial"
          : isPaidPeriod
            ? "paid"
            : hasAccess
              ? "active"
              : "inactive";

    return NextResponse.json(
      {
        account: {
          id: account.id,
          companyName: account.company_name,
          isLegacyFree: account.is_legacy_free,
        },

        subscription: {
          status: subscription.status,
          effectiveStatus,
          billingCycle: subscription.billing_cycle,

          trialStartsAt: subscription.trial_starts_at,
          trialEndsAt: subscription.trial_ends_at,
          trialDaysRemaining,

          currentPeriodStartsAt:
            subscription.current_period_starts_at,

          currentPeriodEndsAt:
            subscription.current_period_ends_at,

          hasAccess,

          // Novos campos para a interface.
          billingPhase,
          isPaidAwaitingStart,
          paidPeriodDaysRemaining,
        },

        plan,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao consultar assinatura:", error);

    return NextResponse.json(
      { error: "Não foi possível consultar a assinatura." },
      { status: 500 }
    );
  }
}
