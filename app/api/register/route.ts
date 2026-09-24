import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function response(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return response(
      {
        ok: false,
        error: 'Configuração do servidor incompleta.',
      },
      500
    );
  }

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  let createdUserId: string | null = null;

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return response(
        {
          ok: false,
          error: 'Dados de cadastro inválidos.',
        },
        400
      );
    }

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return response(
        {
          ok: false,
          error: 'Dados de cadastro inválidos.',
        },
        400
      );
    }

    const input =
      body as Record<string, unknown>;

    const email =
      typeof input.email === 'string'
        ? input.email.trim().toLowerCase()
        : '';

    const password =
      typeof input.password === 'string'
        ? input.password
        : '';

    const name =
      typeof input.name === 'string'
        ? input.name.trim()
        : '';

    const companyName =
      typeof input.companyName === 'string'
        ? input.companyName.trim()
        : '';

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      ) ||
      email.length > 254
    ) {
      return response(
        {
          ok: false,
          error: 'E-mail inválido.',
        },
        400
      );
    }

    if (password.length < 8) {
      return response(
        {
          ok: false,
          error:
            'A senha deve ter pelo menos 8 caracteres.',
        },
        400
      );
    }

    if (!name || name.length > 120) {
      return response(
        {
          ok: false,
          error: 'Informe um nome válido.',
        },
        400
      );
    }

    if (
      !companyName ||
      companyName.length > 160
    ) {
      return response(
        {
          ok: false,
          error:
            'Informe um nome de empresa válido.',
        },
        400
      );
    }

    /*
     * Cria a identidade do usuário.
     *
     * role, billing account e período de teste
     * continuam controlados exclusivamente
     * pelo servidor/banco.
     */
    const {
      data: created,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,

      user_metadata: {
        name,
        company_name: companyName,
      },
    });

    if (createError || !created.user) {
      console.error(
        'Falha ao criar usuário:',
        createError?.message
      );

      return response(
        {
          ok: false,
          error:
            'Não foi possível concluir o cadastro. Verifique se o e-mail já está cadastrado.',
        },
        400
      );
    }

    createdUserId = created.user.id;

    /*
     * O trigger handle_new_user já cria
     * o perfil. Aqui atualizamos somente
     * os campos permitidos.
     */
    const { error: profileError } =
      await admin
        .from('profiles')
        .update({
          name,
          company_name: companyName,
        })
        .eq('id', createdUserId);

    if (profileError) {
      throw new Error(
        `Falha ao preparar perfil: ${profileError.message}`
      );
    }

    /*
     * Cria:
     * - billing_account
     * - billing_membership
     * - billing_subscription
     * - trial de 13 dias
     *
     * A função SQL continua sendo a fonte
     * de verdade para o período de teste.
     */
    const {
      data: billingAccountId,
      error: billingError,
    } = await admin.rpc(
      'create_trial_billing_account',
      {
        p_user_id: createdUserId,
      }
    );

    if (
      billingError ||
      !billingAccountId
    ) {
      throw new Error(
        `Falha ao criar assinatura: ${
          billingError?.message ??
          'Conta não retornada'
        }`
      );
    }

    /*
     * Mantém o nome real da empresa também
     * na conta de faturamento.
     */
    const { error: accountError } =
      await admin
        .from('billing_accounts')
        .update({
          company_name: companyName,
        })
        .eq('id', billingAccountId);

    if (accountError) {
      throw new Error(
        `Falha ao atualizar empresa: ${accountError.message}`
      );
    }

    return response(
      {
        ok: true,

        user: {
          id: createdUserId,
          email,
        },

        billingAccountId,

        message:
          'Cadastro realizado com sucesso.',
      },
      201
    );
  } catch (error) {
    console.error(
      'Erro no cadastro:',
      error
    );

    /*
     * Evita deixar uma identidade parcial.
     *
     * A exclusão do usuário deve acionar
     * as relações/cascatas configuradas
     * no banco. Caso isso falhe, registramos
     * para investigação.
     */
    if (createdUserId) {
      const { error: cleanupError } =
        await admin.auth.admin.deleteUser(
          createdUserId
        );

      if (cleanupError) {
        console.error(
          'ATENÇÃO: falha ao reverter cadastro:',
          createdUserId,
          cleanupError.message
        );
      }
    }

    return response(
      {
        ok: false,
        error:
          'Não foi possível concluir o cadastro. Tente novamente.',
      },
      500
    );
  }
}