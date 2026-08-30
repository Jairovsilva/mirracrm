import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface RequesterContext {
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'vendedor';
  scopeKey: string;
  companyName: string;
  client: SupabaseClient;
}

export interface WhatsAppAccountRow {
  id: string;
  scope_key: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  status: 'active' | 'inactive' | 'error';
  created_by_user_id: string;
}

function assertSupabaseServerEnv() {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada.');
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY não configurada.');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  }
}

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

export function getBearerToken(
  request: NextRequest
): string | null {
  const authorization =
    request.headers.get('authorization');

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.split(' ');

  if (
    scheme?.toLowerCase() !== 'bearer' ||
    !token
  ) {
    return null;
  }

  return token.trim();
}

export async function getRequesterContext(
  request: NextRequest
): Promise<RequesterContext | null> {
  assertSupabaseServerEnv();

  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const requesterClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
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
  } = await requesterClient.auth.getUser();

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
    .eq('id', userData.user.id)
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
    scopeKey: profile.scope_key,
    companyName: profile.company_name,
    client: requesterClient,
  };
}

export function normalizePhone(
  input: string | null | undefined
): string {
  if (!input) {
    return '';
  }

  let digits =
    String(input).replace(/\D/g, '');

  if (
    digits.length === 10 ||
    digits.length === 11
  ) {
    digits = `55${digits}`;
  }

  return digits;
}

export function getWhatsAppEnvironment() {
  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || '';

  const accessToken =
    process.env.WHATSAPP_ACCESS_TOKEN || '';

  const appSecret =
    process.env.WHATSAPP_APP_SECRET || '';

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID || '';

  const wabaId =
    process.env.WHATSAPP_WABA_ID || '';

  const graphVersion =
    process.env.WHATSAPP_GRAPH_API_VERSION || '';

  return {
    verifyToken,
    accessToken,
    appSecret,
    phoneNumberId,
    wabaId,
    graphVersion,
  };
}

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

export function validateMetaSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret =
    process.env.WHATSAPP_APP_SECRET || '';

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
    Buffer.from(signatureHeader);

  const expectedBuffer =
    Buffer.from(expectedSignature);

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

export async function getWhatsAppAccountByPhoneNumberId(
  phoneNumberId: string
): Promise<WhatsAppAccountRow | null> {
  const admin =
    getAdminSupabase();

  const {
    data,
    error,
  } = await admin
    .from('whatsapp_accounts')
    .select('*')
    .eq(
      'phone_number_id',
      phoneNumberId
    )
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error(
      'Erro ao localizar conta WhatsApp:',
      error
    );

    return null;
  }

  return data as
    | WhatsAppAccountRow
    | null;
}

export function extractWhatsAppMessageText(
  message: any
): string {
  if (!message) {
    return '';
  }

  switch (message.type) {
    case 'text':
      return (
        message.text?.body || ''
      );

    case 'button':
      return (
        message.button?.text ||
        '[Botão]'
      );

    case 'interactive':
      return (
        message.interactive
          ?.button_reply?.title ||
        message.interactive
          ?.list_reply?.title ||
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
    typeof media === 'object' &&
    media.id
  ) {
    return media.id;
  }

  return null;
}

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
    new Date(lastInboundAt).getTime();

  if (
    Number.isNaN(inboundTime)
  ) {
    return false;
  }

  const now = Date.now();

  const twentyFourHours =
    24 * 60 * 60 * 1000;

  return (
    now - inboundTime <=
    twentyFourHours
  );
}