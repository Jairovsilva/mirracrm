import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const googleClientId = process.env.GOOGLE_CLIENT_ID!;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET!;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI!;

const STATE_COOKIE = 'mirracrm_google_oauth_state';

type StatePayload = {
  userId: string;
  scopeKey: string;
  nonce: string;
  expiresAt: number;
};

function verifyStateToken(state: string): StatePayload | null {
  try {
    if (!googleClientSecret) {
      return null;
    }

    const parts = state.split('.');

    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, receivedSignature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', googleClientSecret)
      .update(encodedPayload)
      .digest('base64url');

    const receivedBuffer = Buffer.from(receivedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (receivedBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as StatePayload;

    if (
      !payload?.userId ||
      !payload?.scopeKey ||
      !payload?.nonce ||
      !payload?.expiresAt
    ) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function redirectToApp(
  req: NextRequest,
  params: Record<string, string>
) {
  const url = new URL('/app', req.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = NextResponse.redirect(url);

  response.cookies.set({
    name: STATE_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/email/google',
    maxAge: 0,
  });

  return response;
}

export async function GET(req: NextRequest) {
  try {
    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !googleClientId ||
      !googleClientSecret ||
      !googleRedirectUri
    ) {
      console.error('Configuração OAuth/Supabase incompleta.');

      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'server_config',
      });
    }

    const url = new URL(req.url);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const googleError = url.searchParams.get('error');

    if (googleError) {
      console.error('Google OAuth retornou erro:', googleError);

      return redirectToApp(req, {
        email_connection: 'error',
        reason:
          googleError === 'access_denied'
            ? 'access_denied'
            : 'google_oauth',
      });
    }

    if (!code || !state) {
      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'missing_code_or_state',
      });
    }

    const cookieState = req.cookies.get(STATE_COOKIE)?.value;

    if (!cookieState || cookieState !== state) {
      console.error('OAuth state não corresponde ao cookie.');

      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'invalid_state',
      });
    }

    const statePayload = verifyStateToken(state);

    if (!statePayload) {
      console.error('OAuth state inválido ou expirado.');

      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'invalid_state',
      });
    }

    // Troca o authorization code por tokens diretamente com o Google.
    const tokenResponse = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: googleRedirectUri,
          grant_type: 'authorization_code',
        }),
        cache: 'no-store',
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData?.access_token) {
      console.error('Falha ao obter tokens Google:', {
        status: tokenResponse.status,
        error: tokenData?.error,
        description: tokenData?.error_description,
      });

      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'token_exchange',
      });
    }

    const accessToken = String(tokenData.access_token);
    const refreshToken = tokenData.refresh_token
      ? String(tokenData.refresh_token)
      : null;

    /*
     * Com gmail.send não precisamos solicitar permissão para ler
     * mensagens. Para identificar a própria conta conectada,
     * usamos users.getProfile com userId=me.
     */
       // Identifica a Conta Google conectada sem solicitar
    // permissão para ler a caixa de entrada do Gmail.
    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      }
    );

    const googleProfile = await profileResponse.json();

    if (!profileResponse.ok || !googleProfile?.email) {
      console.error('Falha ao identificar Conta Google:', {
        status: profileResponse.status,
        error: googleProfile?.error,
      });

      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'google_profile',
      });
    }

    const emailAddress = String(googleProfile.email)
      .trim()
      .toLowerCase();

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    /*
     * Não confiamos apenas no userId contido no state.
     * Confirmamos que o perfil continua existindo e que o scope_key
     * continua sendo o mesmo que iniciou o OAuth.
     */
    const { data: userProfile, error: userProfileError } =
      await adminClient
        .from('profiles')
        .select('id, scope_key')
        .eq('id', statePayload.userId)
        .single();

    if (
      userProfileError ||
      !userProfile ||
      userProfile.scope_key !== statePayload.scopeKey
    ) {
      console.error(
        'Perfil do usuário não corresponde ao OAuth iniciado.',
        userProfileError
      );

      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'profile_mismatch',
      });
    }

    /*
     * Um usuário possui uma conexão Google ativa.
     * O unique(user_id, provider) criado no banco garante isso.
     */
    const { data: existingAccount } = await adminClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', statePayload.userId)
      .eq('provider', 'google')
      .maybeSingle();

    let emailAccountId: string;

    if (existingAccount?.id) {
      const { data: updatedAccount, error: updateAccountError } =
        await adminClient
          .from('email_accounts')
          .update({
            scope_key: statePayload.scopeKey,
            email_address: emailAddress,
            status: 'active',
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAccount.id)
          .select('id')
          .single();

      if (updateAccountError || !updatedAccount) {
        console.error(
          'Erro ao atualizar email_accounts:',
          updateAccountError
        );

        return redirectToApp(req, {
          email_connection: 'error',
          reason: 'account_save',
        });
      }

      emailAccountId = updatedAccount.id;
    } else {
      const { data: insertedAccount, error: insertAccountError } =
        await adminClient
          .from('email_accounts')
          .insert({
            user_id: statePayload.userId,
            scope_key: statePayload.scopeKey,
            provider: 'google',
            email_address: emailAddress,
            status: 'active',
          })
          .select('id')
          .single();

      if (insertAccountError || !insertedAccount) {
        console.error(
          'Erro ao criar email_accounts:',
          insertAccountError
        );

        return redirectToApp(req, {
          email_connection: 'error',
          reason: 'account_save',
        });
      }

      emailAccountId = insertedAccount.id;
    }

    /*
     * Se for uma reconexão, o Google pode não devolver um novo
     * refresh_token. Nesse caso preservamos o refresh_token já salvo.
     */
    const { data: existingCredentials } = await adminClient
      .from('email_oauth_credentials')
      .select('refresh_token')
      .eq('email_account_id', emailAccountId)
      .maybeSingle();

    const finalRefreshToken =
      refreshToken || existingCredentials?.refresh_token || null;

    if (!finalRefreshToken) {
      console.error(
        'Google não forneceu refresh_token e não existe token anterior.'
      );

      await adminClient
        .from('email_accounts')
        .update({
          status: 'error',
          last_error:
            'Não foi possível obter autorização offline do Google.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', emailAccountId);

      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'missing_refresh_token',
      });
    }

    const expiresIn = Number(tokenData.expires_in || 3600);

    const expiresAt = new Date(
      Date.now() + expiresIn * 1000
    ).toISOString();

    const { error: credentialError } = await adminClient
      .from('email_oauth_credentials')
      .upsert(
        {
          email_account_id: emailAccountId,
          access_token: accessToken,
          refresh_token: finalRefreshToken,
          token_type: tokenData.token_type
            ? String(tokenData.token_type)
            : 'Bearer',
          scope: tokenData.scope
            ? String(tokenData.scope)
            : process.env.GOOGLE_EMAIL_SCOPE ||
              'https://www.googleapis.com/auth/gmail.send',
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'email_account_id',
        }
      );

    if (credentialError) {
      console.error(
        'Erro ao salvar credenciais OAuth:',
        credentialError
      );

      await adminClient
        .from('email_accounts')
        .update({
          status: 'error',
          last_error:
            'Não foi possível armazenar as credenciais OAuth.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', emailAccountId);

      return redirectToApp(req, {
        email_connection: 'error',
        reason: 'credential_save',
      });
    }

    await adminClient
      .from('email_accounts')
      .update({
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailAccountId);

    return redirectToApp(req, {
      email_connection: 'success',
    });
  } catch (err: any) {
    console.error('Erro inesperado no callback Google OAuth:', err);

    return redirectToApp(req, {
      email_connection: 'error',
      reason: 'unexpected',
    });
  }
}