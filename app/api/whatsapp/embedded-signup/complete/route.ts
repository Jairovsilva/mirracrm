import {
  NextRequest,
  NextResponse,
} from 'next/server';

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

interface MetaTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
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
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

function normalizeMetaId(
  value: unknown
): string {
  return String(value || '').trim();
}

function getGraphVersion(): string {
  return (
    process.env
      .WHATSAPP_GRAPH_API_VERSION ||
    'v23.0'
  );
}

async function exchangeCodeForToken(
  code: string
): Promise<string> {
  const appId =
    process.env
      .NEXT_PUBLIC_META_APP_ID;

  const appSecret =
    process.env
      .WHATSAPP_APP_SECRET;

  if (!appId) {
    throw new Error(
      'NEXT_PUBLIC_META_APP_ID não configurado.'
    );
  }

  if (!appSecret) {
    throw new Error(
      'WHATSAPP_APP_SECRET não configurado.'
    );
  }

  const graphVersion =
    getGraphVersion();

  const url =
    new URL(
      `https://graph.facebook.com/${graphVersion}/oauth/access_token`
    );

  url.searchParams.set(
    'client_id',
    appId
  );

  url.searchParams.set(
    'client_secret',
    appSecret
  );

  url.searchParams.set(
    'code',
    code
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: 'GET',
        cache: 'no-store',
      }
    );

  const data =
    (await response.json()) as
      MetaTokenResponse;

  if (
    !response.ok ||
    !data.access_token
  ) {
    console.error(
      'Falha ao trocar code do Embedded Signup:',
      {
        status:
          response.status,

        metaCode:
          data?.error?.code,

        metaSubcode:
          data?.error
            ?.error_subcode,

        metaType:
          data?.error?.type,

        metaMessage:
          data?.error?.message,

        fbtraceId:
          data?.error
            ?.fbtrace_id,
      }
    );

    throw new Error(
      data?.error?.message ||
        'A Meta não permitiu concluir a autorização.'
    );
  }

  return data.access_token;
}

async function getAllWabaPhoneNumbers(
  accessToken: string,
  wabaId: string
): Promise<MetaPhoneNumber[]> {
  const graphVersion =
    getGraphVersion();

  let nextUrl:
    | string
    | null =
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
      wabaId
    )}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`;

  const result:
    MetaPhoneNumber[] = [];

  while (nextUrl) {
    const response =
      await fetch(
        nextUrl,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: 'no-store',
        }
      );

    const data =
      (await response.json()) as
        MetaPhoneNumbersResponse;

    if (!response.ok) {
      console.error(
        'Falha ao consultar números da WABA:',
        {
          status:
            response.status,

          metaCode:
            data?.error?.code,

          metaSubcode:
            data?.error
              ?.error_subcode,

          metaType:
            data?.error?.type,

          metaMessage:
            data?.error
              ?.message,

          fbtraceId:
            data?.error
              ?.fbtrace_id,
        }
      );

      throw new Error(
        data?.error?.message ||
          'Não foi possível validar a conta do WhatsApp Business.'
      );
    }

    if (
      Array.isArray(data.data)
    ) {
      result.push(
        ...data.data
      );
    }

    nextUrl =
      data?.paging?.next ||
      null;
  }

  return result;
}

async function subscribeAppToWaba(
  accessToken: string,
  wabaId: string
): Promise<void> {
  const graphVersion =
    getGraphVersion();

  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
        wabaId
      )}/subscribed_apps`,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache: 'no-store',
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    data?.success !== true
  ) {
    console.error(
      'Falha ao assinar WABA para webhooks:',
      {
        status:
          response.status,

        metaCode:
          data?.error?.code,

        metaSubcode:
          data?.error
            ?.error_subcode,

        metaType:
          data?.error?.type,

        metaMessage:
          data?.error?.message,

        fbtraceId:
          data?.error
            ?.fbtrace_id,
      }
    );

    throw new Error(
      data?.error?.message ||
        'Não foi possível habilitar os webhooks da conta do WhatsApp.'
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * 1. Autenticar usuário do MirraCRM.
     */
    const requester =
  await getRequesterContext(
    request
  );

if (!requester) {
  return NextResponse.json(
    {
      ok: false,
      error:
        'Usuário não autenticado.',
    },
    {
      status: 401,
    }
  );
}

if (
  requester.role !==
    'owner' &&
  requester.role !==
    'admin'
) {
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

    /*
     * 2. Receber resultado do
     * Embedded Signup.
     */
    const body =
      (await request.json()) as
        CompleteEmbeddedSignupBody;

    const code =
      String(
        body?.code || ''
      ).trim();

    const wabaId =
      normalizeMetaId(
        body?.wabaId
      );

    const phoneNumberId =
      normalizeMetaId(
        body?.phoneNumberId
      );

    if (
      !code ||
      !wabaId ||
      !phoneNumberId
    ) {
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

    /*
     * 3. Trocar o code temporário
     * pelo access token.
     *
     * O token nunca retorna ao
     * navegador.
     */
    const accessToken =
      await exchangeCodeForToken(
        code
      );

    /*
     * 4. Validar que o número
     * realmente pertence à WABA
     * autorizada.
     *
     * Não confiamos apenas nos IDs
     * enviados pelo frontend.
     */
    const phoneNumbers =
      await getAllWabaPhoneNumbers(
        accessToken,
        wabaId
      );

    const selectedPhone =
      phoneNumbers.find(
        (phone) =>
          String(phone?.id) ===
          phoneNumberId
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

    /*
     * 5. Assinar o aplicativo
     * nesta WABA para permitir
     * recebimento dos webhooks.
     */
    await subscribeAppToWaba(
      accessToken,
      wabaId
    );

    const admin =
      getAdminSupabase();

    /*
     * 6. Verificar se este número
     * já existe no MirraCRM.
     */
    const {
      data:
        existingAccount,
      error:
        existingAccountError,
    } = await admin
      .from(
        'whatsapp_accounts'
      )
      .select(
        'id, scope_key, access_token_secret_id'
      )
      .eq(
        'phone_number_id',
        phoneNumberId
      )
      .maybeSingle();

    if (
      existingAccountError
    ) {
      console.error(
        'Erro ao consultar whatsapp_accounts:',
        existingAccountError
      );

      throw new Error(
        'Não foi possível consultar a configuração atual do WhatsApp.'
      );
    }

    /*
     * Um mesmo phone_number_id não
     * pode ser apropriado por outro
     * tenant/scope.
     */
    if (
      existingAccount &&
      existingAccount.scope_key !==
        requester.scopeKey
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

    /*
     * 7. Guardar token no Vault.
     *
     * Se já houver segredo para este
     * número, atualizamos o segredo.
     * Caso contrário, criamos um novo.
     */
    let accessTokenSecretId:
      | string
      | null =
      existingAccount
        ?.access_token_secret_id ||
      null;

    if (
      accessTokenSecretId
    ) {
      const {
        error:
          updateSecretError,
      } = await admin.rpc(
        'update_whatsapp_access_token',
        {
          p_secret_id:
            accessTokenSecretId,

          p_access_token:
            accessToken,
        }
      );

      if (
        updateSecretError
      ) {
        console.error(
          'Erro ao atualizar token no Vault:',
          updateSecretError
        );

        throw new Error(
          'Não foi possível atualizar com segurança a credencial do WhatsApp.'
        );
      }
    } else {
      const {
        data:
          createdSecretId,
        error:
          createSecretError,
      } = await admin.rpc(
        'store_whatsapp_access_token',
        {
          p_access_token:
            accessToken,
        }
      );

      if (
        createSecretError ||
        !createdSecretId
      ) {
        console.error(
          'Erro ao armazenar token no Vault:',
          createSecretError
        );

        throw new Error(
          'Não foi possível armazenar com segurança a credencial do WhatsApp.'
        );
      }

      accessTokenSecretId =
        String(
          createdSecretId
        );
    }

    /*
     * 8. Criar/atualizar a conta.
     */
    const accountPayload = {
      scope_key:
        requester.scopeKey,

      waba_id:
        wabaId,

      phone_number_id:
        phoneNumberId,

      display_phone_number:
        selectedPhone
          .display_phone_number ||
        null,

      verified_name:
        selectedPhone
          .verified_name ||
        null,

      status:
        'active',

      created_by_user_id:
        requester.userId,

      access_token_secret_id:
        accessTokenSecretId,

      updated_at:
        new Date().toISOString(),
    };

    const {
      data:
        savedAccount,
      error:
        saveAccountError,
    } = await admin
      .from(
        'whatsapp_accounts'
      )
      .upsert(
        accountPayload,
        {
          onConflict:
            'phone_number_id',
        }
      )
      .select(
        'id, scope_key, waba_id, phone_number_id, display_phone_number, verified_name, status'
      )
      .single();

    if (
      saveAccountError ||
      !savedAccount
    ) {
      console.error(
        'Erro ao salvar conta WhatsApp:',
        saveAccountError
      );

      throw new Error(
        'A autorização foi concluída, mas não foi possível salvar a conta no MirraCRM.'
      );
    }

    /*
     * 9. Somente após salvar a nova
     * conta com sucesso, desativamos
     * outras contas WhatsApp que
     * estavam ativas neste scope.
     *
     * Isso evita o .maybeSingle()
     * do frontend encontrar duas
     * contas ativas.
     */
    const {
      error:
        deactivateError,
    } = await admin
      .from(
        'whatsapp_accounts'
      )
      .update({
        status:
          'inactive',

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'scope_key',
        requester.scopeKey
      )
      .neq(
        'id',
        savedAccount.id
      )
      .eq(
        'status',
        'active'
      );

    if (
      deactivateError
    ) {
      console.error(
        'Erro ao desativar contas WhatsApp anteriores:',
        deactivateError
      );

      /*
       * Não desfazemos uma autorização
       * Meta válida por causa disso.
       * Porém retornamos erro para que
       * não escondamos inconsistência.
       */
      throw new Error(
        'O novo número foi conectado, mas houve erro ao desativar a configuração anterior.'
      );
    }

    return NextResponse.json({
      ok: true,

      account:
        savedAccount,
    });
  } catch (error: any) {
    console.error(
      'Erro ao concluir Embedded Signup:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message ||
          'Não foi possível concluir a conexão do WhatsApp.',
      },
      {
        status: 500,
      }
    );
  }
}