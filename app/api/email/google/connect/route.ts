import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const googleClientId = process.env.GOOGLE_CLIENT_ID!;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI!;
const googleEmailScope =
  process.env.GOOGLE_EMAIL_SCOPE ||
  'https://www.googleapis.com/auth/gmail.send';

const STATE_COOKIE = 'mirracrm_google_oauth_state';

function createStateToken(payload: {
  userId: string;
  scopeKey: string;
  nonce: string;
  expiresAt: number;
}) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;

  if (!secret) {
    throw new Error('GOOGLE_CLIENT_SECRET não configurado.');
  }

  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    'utf8'
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Configuração do Supabase ausente no servidor.',
        },
        { status: 500 }
      );
    }

    if (!googleClientId || !googleRedirectUri) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Configuração OAuth do Google incompleta.',
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const accessToken = body?.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sessão ausente. Faça login novamente.',
        },
        { status: 400 }
      );
    }

    // Valida o usuário exatamente como o MirraCRM já faz em /api/invite.
    const requesterClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: userData, error: userError } =
      await requesterClient.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sessão inválida. Faça login novamente.',
        },
        { status: 401 }
      );
    }

    const { data: requesterProfile, error: profileError } =
      await requesterClient
        .from('profiles')
        .select('id, scope_key')
        .eq('id', userData.user.id)
        .single();

    if (profileError || !requesterProfile) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Perfil do usuário não encontrado.',
        },
        { status: 401 }
      );
    }

    const nonce = crypto.randomBytes(32).toString('hex');

    // O state é assinado no servidor.
    // Isso impede que alguém altere userId/scopeKey no callback OAuth.
    const state = createStateToken({
      userId: userData.user.id,
      scopeKey: requesterProfile.scope_key,
      nonce,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: googleRedirectUri,
      response_type: 'code',

      // gmail.send:
      // permite enviar mensagens, sem conceder leitura geral da caixa postal.
      scope: googleEmailScope,

      // Necessário para receber refresh_token e manter a conta conectada.
      access_type: 'offline',

      // No primeiro vínculo, força a tela de consentimento para aumentar
      // a previsibilidade da emissão do refresh_token.
      prompt: 'consent',

      include_granted_scopes: 'true',

      state,
    });

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const response = NextResponse.json({
      ok: true,
      authUrl,
    });

    // Além do state assinado, guardamos o mesmo valor em cookie HttpOnly.
    // O callback só será aceito se ambos coincidirem.
    response.cookies.set({
      name: STATE_COOKIE,
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/email/google',
      maxAge: 10 * 60,
    });

    return response;
  } catch (err: any) {
    console.error('Erro ao iniciar OAuth Google:', err);

    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Erro inesperado ao iniciar a conexão com o Google.',
      },
      { status: 500 }
    );
  }
}