import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: 'Configuração do servidor incompleta.' },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let createdUserId: string | null = null;

  try {
    const body = await req.json();

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    const password =
      typeof body.password === 'string' ? body.password : '';

    const name =
      typeof body.name === 'string' ? body.name.trim() : '';

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return NextResponse.json(
        { ok: false, error: 'E-mail inválido.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A senha deve ter pelo menos 8 caracteres.',
        },
        { status: 400 }
      );
    }

    if (!name || name.length > 120) {
      return NextResponse.json(
        { ok: false, error: 'Informe um nome válido.' },
        { status: 400 }
      );
    }

    // O servidor cria o usuário. O navegador não escolhe
    // role, scope_key, empresa ou período de teste.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (createError || !created.user) {
      console.error('Falha ao criar usuário:', createError?.message);

      return NextResponse.json(
        {
          ok: false,
          error: 'Não foi possível concluir o cadastro. Verifique se o e-mail já está cadastrado.',
        },
        { status: 400 }
      );
    }

    createdUserId = created.user.id;

    // O gatilho handle_new_user cria o perfil isolado.
    // Atualizamos somente o nome, usando service_role.
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        name,
        company_name: `Conta de ${name}`,
      })
      .eq('id', createdUserId);

    if (profileError) {
      throw new Error(
        `Falha ao preparar perfil: ${profileError.message}`
      );
    }

    // Função SQL já instalada no Supabase.
    // Ela cria a conta, o vínculo e os 13 dias de teste.
    const { data: billingAccountId, error: billingError } =
      await admin.rpc('create_trial_billing_account', {
        p_user_id: createdUserId,
      });

    if (billingError || !billingAccountId) {
      throw new Error(
        `Falha ao criar assinatura: ${
          billingError?.message ?? 'Conta não retornada'
        }`
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Cadastro realizado. Seu teste de 13 dias começou.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro no cadastro:', error);

    // Evita deixar uma conta parcialmente criada.
    // A exclusão pode falhar se já houver vínculos;
    // nesse caso, o erro será registrado para correção.
    if (createdUserId) {
      const { error: cleanupError } =
        await admin.auth.admin.deleteUser(createdUserId);

      if (cleanupError) {
        console.error(
          'ATENÇÃO: falha ao reverter cadastro:',
          createdUserId,
          cleanupError.message
        );
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível concluir o cadastro. Tente novamente.',
      },
      { status: 500 }
    );
  }
}
