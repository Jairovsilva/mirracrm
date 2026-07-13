import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { email, name, password, accessToken } = await req.json();

    if (!email || !name || !password || !accessToken) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios ausentes.' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    // Cliente autenticado como o solicitante — usado só para validar quem ele é
    const requesterClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: userData, error: userError } = await requesterClient.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
    }

    const { data: requesterProfile, error: profileError } = await requesterClient
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !requesterProfile) {
      return NextResponse.json({ ok: false, error: 'Perfil do solicitante não encontrado.' }, { status: 401 });
    }

    if (requesterProfile.role !== 'owner' && requesterProfile.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Apenas administradores podem criar novos usuários.' },
        { status: 403 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const domain = cleanEmail.split('@')[1] ?? '';
    const requesterDomain = String(requesterProfile.scope_key).replace('PJ::', '');

    if (String(requesterProfile.scope_key).startsWith('PJ::') && domain !== requesterDomain) {
      return NextResponse.json(
        { ok: false, error: `O e-mail deve pertencer ao domínio ${requesterDomain}.` },
        { status: 400 }
      );
    }

    // Cliente com privilégios de administrador — só existe aqui, no servidor
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: String(password),
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      return NextResponse.json(
        { ok: false, error: createError?.message || 'Erro ao criar usuário.' },
        { status: 400 }
      );
    }

    // upsert: se o trigger do banco já criou o perfil automaticamente (com valores
    // padrão), sobrescreve com os dados corretos do convite, em vez de falhar
    // com "duplicate key" e apagar o usuário que acabou de ser criado.
    const { error: insertError } = await adminClient.from('profiles').upsert({
      id: newUser.user.id,
      email: cleanEmail,
      name: String(name).trim(),
      role: 'vendedor',
      account_type: requesterProfile.account_type,
      scope_key: requesterProfile.scope_key,
      company_name: requesterProfile.company_name,
    }, { onConflict: 'id' });

    if (insertError) {
      // Reverte a criação do usuário de autenticação se o perfil falhar
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erro inesperado no servidor.' }, { status: 500 });
  }
}