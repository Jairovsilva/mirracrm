import { NextRequest, NextResponse } from 'next/server';

import {
  getAdminSupabase,
  getRequesterContext,
} from '@/src/lib/whatsapp/server';

export const runtime = 'nodejs';

interface CompleteEmbeddedSignupBody {
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
}

interface MetaError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface MetaTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: MetaError;
}

interface MetaPhoneNumber {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
}

interface MetaPhoneNumbersResponse {
  data?: MetaPhoneNumber[];
  paging?: {
    next?: string;
  };
  error?: MetaError;
}

interface MetaSubscribedAppsResponse {
  success?: boolean;
  error?: MetaError;
}

interface SavedWhatsAppAccount {
  id: string;
  scope_key: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  status: string;
}

function normalizeMetaId(value: unknown): string {
  return String(value || '').trim();
}

function getGraphVersion(): string {
  return process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';
}

/**
 * Troca o authorization code temporário retornado
 * pelo Embedded Signup por um access token.
 *
 * O App Secret permanece exclusivamente no servidor.
 * O access token nunca é devolvido ao navegador.
 */
async function exchangeCodeForToken(code: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appId) {
    throw new Error(
      'NEXT_PUBLIC_META_APP_ID não configurado no servidor.'
    );
  }

  if (!appSecret) {
    throw new Error(
      'WHATSAPP_APP_SECRET não configurado no servidor.'
    );
  }

  const graphVersion = getGraphVersion();

  const url = new URL(
    `https://graph.facebook.com/${graphVersion}/oauth/access_token`
  );

  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  const data = (await response.json()) as MetaTokenResponse;

  if (!response.ok || !data.access_token) {
    console.error('Falha ao trocar code do Embedded Signup:', {
      status: response.status,
      metaCode: data?.error?.code,
      metaSubcode: data?.error?.error_subcode,
      metaType: data?.error?.type,
      metaMessage: data?.error?.message,
      fbtraceId: data?.error?.fbtrace_id,
    });

    throw new Error(
      data?.error?.message ||
        'A Meta não permitiu concluir a autorização.'
    );
  }

  return data.access_token;
}

/**
 * Consulta os números pertencentes à WABA autorizada.
 *
 * Isso é feito no backend para não confiarmos
 * somente nos IDs recebidos do navegador.
 */
async function getAllWabaPhoneNumbers(
  accessToken: string,
  wabaId: string
): Promise<MetaPhoneNumber[]> {
  const graphVersion = getGraphVersion();

  let nextUrl: string | null =
    `https://graph.facebook.com/${graphVersion}/` +
    `${encodeURIComponent(wabaId)}/phone_numbers` +
    '?fields=id,display_phone_number,verified_name&limit=100';

  const result: MetaPhoneNumber[] = [];

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    const data = (await response.json()) as MetaPhoneNumbersResponse;

    if (!response.ok) {
      console.error('Falha ao consultar números da WABA:', {
        status: response.status,
        metaCode: data?.error?.code,
        metaSubcode: data?.error?.error_subcode,
        metaType: data?.error?.type,
        metaMessage: data?.error?.message,
        fbtraceId: data?.error?.fbtrace_id,
      });

      throw new Error(
        data?.error?.message ||
          'Não foi possível validar a conta do WhatsApp Business.'
      );
    }

    if (Array.isArray(data.data)) {
      result.push(...data.data);
    }

    nextUrl = data?.paging?.next || null;
  }

  return result;
}

/**
 * Assina o aplicativo na WABA autorizada para
 * permitir o recebimento dos webhooks.
 */
async function subscribeAppToWaba(
  accessToken: string,
  wabaId: string
): Promise<void> {
  const graphVersion = getGraphVersion();

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/` +
      `${encodeURIComponent(wabaId)}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    }
  );

  const data = (await response.json()) as MetaSubscribedAppsResponse;

  if (!response.ok || data?.success !== true) {
    console.error('Falha ao assinar WABA para webhooks:', {
      status: response.status,
      metaCode: data?.error?.code,
      metaSubcode: data?.error?.error_subcode,
      metaType: data?.error?.type,
      metaMessage: data?.error?.message,
      fbtraceId: data?.error?.fbtrace_id,
    });

    throw new Error(
      data?.error?.message ||
        'Não foi possível habilitar os webhooks da conta do WhatsApp.'
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    /**
     * 1. Autenticar o usuário do MirraCRM.
     */
    const requester = await getRequesterContext(request);

    if (!requester) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Usuário não autenticado.',
        },
        {
          status: 401,
        }
      );
    }

    /**
     * Somente owner/admin pode conectar
     * uma conta do WhatsApp.
     */
    if (
      requester.role !== 'owner' &&
      requester.role !== 'admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Somente owner ou admin pode conectar uma conta do WhatsApp.',
        },
        {
          status: 403,
        }
      );
    }

    /**
     * 2. Receber o resultado do Embedded Signup.
     */
    let body: CompleteEmbeddedSignupBody;

    try {
      body = (await request.json()) as CompleteEmbeddedSignupBody;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: 'Corpo da requisição inválido.',
        },
        {
          status: 400,
        }
      );
    }

    const code = String(body?.code || '').trim();
    const wabaId = normalizeMetaId(body?.wabaId);
    const phoneNumberId = normalizeMetaId(body?.phoneNumberId);

    if (!code || !wabaId || !phoneNumberId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'O Embedded Signup não retornou todas as informações necessárias.',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * 3. Trocar o authorization code temporário
     * por um access token no servidor.
     */
    const accessToken = await exchangeCodeForToken(code);

    /**
     * 4. Validar que o phone_number_id realmente
     * pertence à WABA autorizada.
     */
    const phoneNumbers = await getAllWabaPhoneNumbers(
      accessToken,
      wabaId
    );

    const selectedPhone = phoneNumbers.find(
      (phone) => String(phone?.id || '') === phoneNumberId
    );

    if (!selectedPhone) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'O número informado não pertence à conta do WhatsApp Business autorizada.',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * 5. Assinar o aplicativo na WABA.
     */
    await subscribeAppToWaba(accessToken, wabaId);

    const admin = getAdminSupabase();

    /**
     * 6. Verificar se o phone_number_id
     * já existe no MirraCRM.
     */
    const {
      data: existingAccount,
      error: existingAccountError,
    } = await admin
      .from('whatsapp_accounts')
      .select('id, scope_key, access_token_secret_id')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle();

    if (existingAccountError) {
      console.error(
        'Erro ao consultar whatsapp_accounts:',
        existingAccountError
      );

      throw new Error(
        'Não foi possível consultar a configuração atual do WhatsApp.'
      );
    }

    /**
     * Um phone_number_id já pertencente a outro
     * scope não pode ser apropriado pelo tenant atual.
     */
    if (
      existingAccount &&
      existingAccount.scope_key !== requester.scopeKey
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Este número já está associado a outra conta do MirraCRM.',
        },
        {
          status: 409,
        }
      );
    }

    /**
     * 7. Guardar o access token no Supabase Vault.
     *
     * whatsapp_accounts recebe somente o UUID
     * do segredo. O token não é armazenado em
     * texto puro na tabela.
     */
    let accessTokenSecretId: string | null =
      existingAccount?.access_token_secret_id || null;

    if (accessTokenSecretId) {
      const { error: updateSecretError } = await admin.rpc(
        'update_whatsapp_access_token',
        {
          p_secret_id: accessTokenSecretId,
          p_access_token: accessToken,
        }
      );

      if (updateSecretError) {
        console.error(
          'Erro ao atualizar token do WhatsApp no Vault:',
          updateSecretError
        );

        throw new Error(
          'Não foi possível atualizar com segurança a credencial do WhatsApp.'
        );
      }
    } else {
      const {
        data: createdSecretId,
        error: createSecretError,
      } = await admin.rpc('store_whatsapp_access_token', {
        p_access_token: accessToken,
      });

      if (createSecretError || !createdSecretId) {
        console.error(
          'Erro ao armazenar token do WhatsApp no Vault:',
          createSecretError
        );

        throw new Error(
          'Não foi possível armazenar com segurança a credencial do WhatsApp.'
        );
      }

      accessTokenSecretId = String(createdSecretId);
    }

    /**
     * 8. Criar ou atualizar a conta WhatsApp.
     */
    const accountPayload = {
      scope_key: requester.scopeKey,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number:
        selectedPhone.display_phone_number || null,
      verified_name: selectedPhone.verified_name || null,
      status: 'active',
      created_by_user_id: requester.userId,
      access_token_secret_id: accessTokenSecretId,
      updated_at: new Date().toISOString(),
    };

    const {
      data: savedAccountData,
      error: saveAccountError,
    } = await admin
      .from('whatsapp_accounts')
      .upsert(accountPayload, {
        onConflict: 'phone_number_id',
      })
      .select(
        'id, scope_key, waba_id, phone_number_id, display_phone_number, verified_name, status'
      )
      .single();

    if (saveAccountError || !savedAccountData) {
      console.error(
        'Erro ao salvar conta WhatsApp:',
        saveAccountError
      );

      throw new Error(
        'A autorização foi concluída, mas não foi possível salvar a conta no MirraCRM.'
      );
    }

    /**
     * O client Supabase utilizado pelo projeto não
     * possui tipos gerados específicos para esta
     * tabela. Portanto, fazemos aqui uma conversão
     * explícita para o formato que acabamos de
     * selecionar.
     */
    const savedAccount =
      savedAccountData as unknown as SavedWhatsAppAccount;

    /**
     * 9. Depois que a nova conta estiver salva,
     * desativar outras contas ativas do mesmo scope.
     *
     * Isso preserva o comportamento atual do
     * WhatsAppView, que espera uma conta ativa.
     */
    const { error: deactivateError } = await admin
      .from('whatsapp_accounts')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('scope_key', requester.scopeKey)
      .neq('id', savedAccount.id)
      .eq('status', 'active');

    if (deactivateError) {
      console.error(
        'Erro ao desativar contas WhatsApp anteriores:',
        deactivateError
      );

      throw new Error(
        'O novo número foi conectado, mas houve erro ao desativar a configuração anterior.'
      );
    }

    /**
     * 10. Retornar somente dados não sensíveis.
     *
     * Access token e UUID do segredo do Vault
     * nunca são enviados ao navegador.
     */
    return NextResponse.json({
      ok: true,
      account: {
        id: savedAccount.id,
        scope_key: savedAccount.scope_key,
        waba_id: savedAccount.waba_id,
        phone_number_id: savedAccount.phone_number_id,
        display_phone_number: savedAccount.display_phone_number,
        verified_name: savedAccount.verified_name,
        status: savedAccount.status,
      },
    });
  } catch (error: unknown) {
    console.error(
      'Erro ao concluir Embedded Signup:',
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível concluir a conexão do WhatsApp.';

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}