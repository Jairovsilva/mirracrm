import {
  createClient,
  SupabaseClient,
} from '@supabase/supabase-js';

import { NextRequest } from 'next/server';

import crypto from 'crypto';

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const supabaseServiceRoleKey =
  process.env
    .SUPABASE_SERVICE_ROLE_KEY ||
  '';

export interface RequesterContext {
  userId: string;
  email: string;
  role:
    | 'owner'
    | 'admin'
    | 'vendedor';
  scopeKey: string;
  companyName: string;
  client: SupabaseClient;
}

export interface WhatsAppAccountRow {
  id: string;
  scope_key: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number:
    | string
    | null;
  verified_name:
    | string
    | null;
  status:
    | 'active'
    | 'inactive'
    | 'error';
  created_by_user_id: string;

  /**
   * Novo modelo:
   *
   * O access token real não fica
   * armazenado nesta tabela.
   *
   * Guardamos somente o UUID do
   * segredo existente no
   * Supabase Vault.
   */
  access_token_secret_id:
    | string
    | null;
}

function assertSupabaseServerEnv() {
  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL não configurada.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY não configurada.'
    );
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada.'
    );
  }
}

/**
 * Cliente administrativo.
 *
 * Deve ser utilizado somente no
 * servidor porque utiliza a
 * SUPABASE_SERVICE_ROLE_KEY.
 */
export function getAdminSupabase(): SupabaseClient {
  assertSupabaseServerEnv();

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Extrai o Bearer Token da
 * requisição feita pelo frontend.
 */
export function getBearerToken(
  request: NextRequest
): string | null {
  const authorization =
    request.headers.get(
      'authorization'
    );

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.split(' ');

  if (
    scheme?.toLowerCase() !==
      'bearer' ||
    !token
  ) {
    return null;
  }

  return token.trim();
}

/**
 * Autentica o usuário do MirraCRM
 * e carrega o profile respeitando
 * as regras atuais do projeto.
 */
export async function getRequesterContext(
  request: NextRequest
): Promise<RequesterContext | null> {
  assertSupabaseServerEnv();

  const token =
    getBearerToken(request);

  if (!token) {
    return null;
  }

  const requesterClient =
    createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        },

        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

  const {
    data: userData,
    error: userError,
  } =
    await requesterClient.auth.getUser();

  if (
    userError ||
    !userData?.user
  ) {
    return null;
  }

  const {
    data: profile,
    error: profileError,
  } = await requesterClient
    .from('profiles')
    .select(
      'id,email,role,scope_key,company_name'
    )
    .eq(
      'id',
      userData.user.id
    )
    .single();

  if (
    profileError ||
    !profile
  ) {
    return null;
  }

  return {
    userId: profile.id,
    email: profile.email,
    role: profile.role,
    scopeKey:
      profile.scope_key,
    companyName:
      profile.company_name,
    client: requesterClient,
  };
}

/**
 * Normaliza telefone para somente
 * números.
 *
 * Telefones brasileiros locais
 * recebem o código 55.
 */
export function normalizePhone(
  input:
    | string
    | null
    | undefined
): string {
  if (!input) {
    return '';
  }

  let digits =
    String(input).replace(
      /\D/g,
      ''
    );

  if (
    digits.length === 10 ||
    digits.length === 11
  ) {
    digits = `55${digits}`;
  }

  return digits;
}

/**
 * Retorna a versão da Graph API
 * usada pelo backend.
 *
 * Separar isso das credenciais
 * permite que as contas conectadas
 * via Embedded Signup usem tokens
 * individuais.
 */
export function getWhatsAppGraphVersion(): string {
  return (
    process.env
      .WHATSAPP_GRAPH_API_VERSION ||
    'v23.0'
  );
}

/**
 * Configuração LEGADA.
 *
 * Mantida temporariamente para não
 * quebrar rotas antigas e a conta
 * de teste já existente.
 *
 * Novas contas reais conectadas
 * pelo Embedded Signup NÃO devem
 * depender do accessToken,
 * phoneNumberId ou wabaId daqui.
 */
export function getWhatsAppEnvironment() {
  const verifyToken =
    process.env
      .WHATSAPP_VERIFY_TOKEN ||
    '';

  const accessToken =
    process.env
      .WHATSAPP_ACCESS_TOKEN ||
    '';

  const appSecret =
    process.env
      .WHATSAPP_APP_SECRET ||
    '';

  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID ||
    '';

  const wabaId =
    process.env
      .WHATSAPP_WABA_ID ||
    '';

  const graphVersion =
    process.env
      .WHATSAPP_GRAPH_API_VERSION ||
    '';

  return {
    verifyToken,
    accessToken,
    appSecret,
    phoneNumberId,
    wabaId,
    graphVersion,
  };
}

/**
 * Validação LEGADA.
 *
 * Mantida por compatibilidade com
 * rotas antigas, principalmente o
 * setup da conta de teste.
 *
 * Não deve ser usada para decidir
 * qual token uma conta real utiliza.
 */
export function assertWhatsAppEnvironment() {
  const env =
    getWhatsAppEnvironment();

  const missing: string[] = [];

  if (!env.verifyToken) {
    missing.push(
      'WHATSAPP_VERIFY_TOKEN'
    );
  }

  if (!env.accessToken) {
    missing.push(
      'WHATSAPP_ACCESS_TOKEN'
    );
  }

  if (!env.appSecret) {
    missing.push(
      'WHATSAPP_APP_SECRET'
    );
  }

  if (!env.phoneNumberId) {
    missing.push(
      'WHATSAPP_PHONE_NUMBER_ID'
    );
  }

  if (!env.wabaId) {
    missing.push(
      'WHATSAPP_WABA_ID'
    );
  }

  if (!env.graphVersion) {
    missing.push(
      'WHATSAPP_GRAPH_API_VERSION'
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Variáveis WhatsApp ausentes: ${missing.join(
        ', '
      )}`
    );
  }

  return env;
}

/**
 * Recupera o access token
 * individual de uma conta
 * WhatsApp a partir do Vault.
 *
 * IMPORTANTE:
 *
 * Esta função utiliza o cliente
 * service_role e deve permanecer
 * exclusivamente no backend.
 */
export async function getWhatsAppAccessTokenFromVault(
  secretId: string
): Promise<string> {
  const normalizedSecretId =
    String(secretId || '').trim();

  if (!normalizedSecretId) {
    throw new Error(
      'Identificador da credencial do WhatsApp ausente.'
    );
  }

  const admin =
    getAdminSupabase();

  const {
    data,
    error,
  } = await admin.rpc(
    'get_whatsapp_access_token',
    {
      p_secret_id:
        normalizedSecretId,
    }
  );

  if (error) {
    console.error(
      'Erro ao recuperar access token do WhatsApp no Vault:',
      error
    );

    throw new Error(
      'Não foi possível acessar a credencial do WhatsApp.'
    );
  }

  const accessToken =
    String(data || '').trim();

  if (!accessToken) {
    throw new Error(
      'Credencial do WhatsApp não encontrada no Vault.'
    );
  }

  return accessToken;
}

/**
 * Valida a assinatura enviada pela
 * Meta nos webhooks.
 *
 * Continua usando WHATSAPP_APP_SECRET
 * porque esse segredo pertence ao
 * aplicativo Meta, e não a uma conta
 * WhatsApp específica.
 */
export function validateMetaSignature(
  rawBody: string,
  signatureHeader:
    | string
    | null
): boolean {
  const appSecret =
    process.env
      .WHATSAPP_APP_SECRET ||
    '';

  if (
    !appSecret ||
    !signatureHeader
  ) {
    return false;
  }

  if (
    !signatureHeader.startsWith(
      'sha256='
    )
  ) {
    return false;
  }

  const expectedSignature =
    `sha256=${crypto
      .createHmac(
        'sha256',
        appSecret
      )
      .update(rawBody)
      .digest('hex')}`;

  const receivedBuffer =
    Buffer.from(
      signatureHeader
    );

  const expectedBuffer =
    Buffer.from(
      expectedSignature
    );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

/**
 * Localiza a conta WhatsApp ativa
 * correspondente ao
 * phone_number_id recebido da Meta.
 *
 * O webhook usa esta função para
 * descobrir a qual scope do
 * MirraCRM o evento pertence.
 */
export async function getWhatsAppAccountByPhoneNumberId(
  phoneNumberId: string
): Promise<WhatsAppAccountRow | null> {
  const normalizedPhoneNumberId =
    String(
      phoneNumberId || ''
    ).trim();

  if (!normalizedPhoneNumberId) {
    return null;
  }

  const admin =
    getAdminSupabase();

  const {
    data,
    error,
  } = await admin
    .from(
      'whatsapp_accounts'
    )
    .select(
      `
        id,
        scope_key,
        waba_id,
        phone_number_id,
        display_phone_number,
        verified_name,
        status,
        created_by_user_id,
        access_token_secret_id
      `
    )
    .eq(
      'phone_number_id',
      normalizedPhoneNumberId
    )
    .eq(
      'status',
      'active'
    )
    .maybeSingle();

  if (error) {
    console.error(
      'Erro ao localizar conta WhatsApp:',
      error
    );

    return null;
  }

  if (!data) {
    return null;
  }

  return data as unknown as WhatsAppAccountRow;
}

/**
 * Extrai uma representação textual
 * das mensagens recebidas.
 */
export function extractWhatsAppMessageText(
  message: any
): string {
  if (!message) {
    return '';
  }

  switch (message.type) {
    case 'text':
      return (
        message.text?.body ||
        ''
      );

    case 'button':
      return (
        message.button?.text ||
        '[Botão]'
      );

    case 'interactive':
      return (
        message.interactive
          ?.button_reply
          ?.title ||
        message.interactive
          ?.list_reply
          ?.title ||
        '[Mensagem interativa]'
      );

    case 'image':
      return (
        message.image?.caption ||
        '[Imagem]'
      );

    case 'document':
      return (
        message.document
          ?.filename ||
        message.document
          ?.caption ||
        '[Documento]'
      );

    case 'audio':
      return '[Áudio]';

    case 'video':
      return (
        message.video?.caption ||
        '[Vídeo]'
      );

    case 'sticker':
      return '[Figurinha]';

    case 'location':
      return '[Localização]';

    case 'contacts':
      return '[Contato]';

    case 'reaction':
      return (
        message.reaction?.emoji ||
        '[Reação]'
      );

    default:
      return `[${message.type || 'Mensagem'}]`;
  }
}

/**
 * Extrai media_id quando a
 * mensagem contém mídia.
 */
export function getWhatsAppMediaId(
  message: any
): string | null {
  if (!message?.type) {
    return null;
  }

  const media =
    message[message.type];

  if (
    media &&
    typeof media ===
      'object' &&
    media.id
  ) {
    return media.id;
  }

  return null;
}

/**
 * Verifica a janela de atendimento
 * de 24 horas.
 *
 * Utilizada para impedir envio de
 * texto livre quando não existe
 * uma conversa iniciada pelo
 * cliente dentro da janela.
 */
export function isWithin24HourWindow(
  lastInboundAt:
    | string
    | null
    | undefined
): boolean {
  if (!lastInboundAt) {
    return false;
  }

  const inboundTime =
    new Date(
      lastInboundAt
    ).getTime();

  if (
    Number.isNaN(
      inboundTime
    )
  ) {
    return false;
  }

  const now =
    Date.now();

  const twentyFourHours =
    24 * 60 * 60 * 1000;

  /**
   * Evita considerar uma data
   * futura inválida como estando
   * dentro da janela.
   */
  if (inboundTime > now) {
    return false;
  }

  return (
    now - inboundTime <=
    twentyFourHours
  );
}