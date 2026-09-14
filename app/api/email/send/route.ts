import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const googleClientId = process.env.GOOGLE_CLIENT_ID!;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET!;

const ATTACHMENT_BUCKET = 'email-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB por arquivo
const MAX_ATTACHMENTS = 5;

type ProfileRow = {
  id: string;
  scope_key: string;
  role: 'owner' | 'admin' | 'vendedor';
};

type LeadRow = {
  id: string;
  scope_key: string;
  created_by_user_id: string;
  nome: string | null;
  email_corporativo: string | null;
};

type EmailAccountRow = {
  id: string;
  user_id: string;
  scope_key: string;
  provider: string;
  email_address: string;
  display_name: string | null;
  status: string;
};

type CredentialRow = {
  refresh_token_secret_id: string | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status }
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function sanitizeFilename(value: string): string {
  const cleaned = value
    .replace(/[^\p{L}\p{N}._() -]/gu, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || 'anexo';
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function toBase64Url(value: string | Buffer): string {
  const buffer = Buffer.isBuffer(value)
    ? value
    : Buffer.from(value, 'utf8');

  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? value;
}

function normalizeRecipients(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return [];

  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildMimeMessage(params: {
  fromEmail: string;
  displayName?: string | null;
  to: string;
  cc: string[];
  bcc: string[];
  subject: string;
  bodyText: string;
  attachments: Array<{
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }>;
}): string {
  const {
    fromEmail,
    displayName,
    to,
    cc,
    bcc,
    subject,
    bodyText,
    attachments,
  } = params;

  const safeDisplayName = displayName
    ? sanitizeHeader(displayName)
    : '';

  const fromHeader = safeDisplayName
    ? `${encodeHeader(safeDisplayName)} <${fromEmail}>`
    : fromEmail;

  const headers = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
  ];

  if (attachments.length === 0) {
    return [
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(Buffer.from(bodyText, 'utf8').toString('base64')),
    ].join('\r\n');
  }

  const boundary = `mirracrm_${crypto.randomUUID().replace(/-/g, '')}`;

  const parts: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(bodyText, 'utf8').toString('base64')),
  ];

  for (const attachment of attachments) {
    const encodedFilename = encodeHeader(attachment.fileName);

    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${encodedFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${encodedFilename}"`,
      '',
      wrapBase64(attachment.buffer.toString('base64'))
    );
  }

  parts.push(`--${boundary}--`, '');

  return parts.join('\r\n');
}

async function getGoogleAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    const errorCode =
      data?.error ||
      `GOOGLE_TOKEN_${response.status}`;

    const errorDescription =
      data?.error_description ||
      'Não foi possível renovar a autorização do Gmail.';

    throw new Error(`${errorCode}: ${errorDescription}`);
  }

  return data.access_token as string;
}

export async function POST(req: NextRequest) {
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

  let emailMessageId: string | null = null;
  let emailAccountId: string | null = null;
  let authenticatedUserId: string | null = null;

  try {
    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !googleClientId ||
      !googleClientSecret
    ) {
      console.error(
        'Configuração incompleta no servidor para envio de e-mail.'
      );

      return jsonError(
        'Integração de e-mail não configurada corretamente no servidor.',
        500
      );
    }

    const formData = await req.formData();

    const accessTokenEntry = formData.get('accessToken');
    const leadIdEntry = formData.get('leadId');
    const toEntry = formData.get('to');
    const subjectEntry = formData.get('subject');
    const bodyEntry = formData.get('body');

    const accessToken =
      typeof accessTokenEntry === 'string'
        ? accessTokenEntry.trim()
        : '';

    const leadId =
      typeof leadIdEntry === 'string'
        ? leadIdEntry.trim()
        : '';

    const to =
      typeof toEntry === 'string'
        ? toEntry.trim().toLowerCase()
        : '';

    const subject =
      typeof subjectEntry === 'string'
        ? sanitizeHeader(subjectEntry)
        : '';

    const body =
      typeof bodyEntry === 'string'
        ? bodyEntry.trim()
        : '';

    const cc = normalizeRecipients(formData.get('cc'))
      .map((email) => email.toLowerCase());

    const bcc = normalizeRecipients(formData.get('bcc'))
      .map((email) => email.toLowerCase());

    if (!accessToken) {
      return jsonError(
        'Sessão ausente. Faça login novamente.',
        401
      );
    }

    if (!leadId) {
      return jsonError('Lead não informado.');
    }

    if (!to || !isValidEmail(to)) {
      return jsonError(
        'Informe um e-mail de destinatário válido.'
      );
    }

    if (cc.some((email) => !isValidEmail(email))) {
      return jsonError(
        'Existe um endereço inválido no campo CC.'
      );
    }

    if (bcc.some((email) => !isValidEmail(email))) {
      return jsonError(
        'Existe um endereço inválido no campo CCO.'
      );
    }

    if (!subject) {
      return jsonError('Informe o assunto do e-mail.');
    }

    if (subject.length > 500) {
      return jsonError(
        'O assunto do e-mail é muito longo.'
      );
    }

    if (!body) {
      return jsonError('Escreva a mensagem do e-mail.');
    }

    /*
     * Cliente autenticado com o JWT do usuário.
     * A consulta do lead abaixo passa pelo RLS existente do MirraCRM.
     *
     * Isso preserva exatamente:
     * owner/admin -> leads do mesmo scope
     * vendedor   -> leads do mesmo scope criados pelo próprio vendedor
     */
    const requesterClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
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

    if (userError || !userData?.user) {
      return jsonError(
        'Sessão inválida. Faça login novamente.',
        401
      );
    }

    authenticatedUserId = userData.user.id;

    const {
      data: profileData,
      error: profileError,
    } = await requesterClient
      .from('profiles')
      .select('id, scope_key, role')
      .eq('id', authenticatedUserId)
      .single();

    if (profileError || !profileData) {
      console.error(
        'Perfil não encontrado no envio de e-mail:',
        profileError
      );

      return jsonError(
        'Perfil do usuário não encontrado.',
        403
      );
    }

    const profile = profileData as ProfileRow;

    /*
     * IMPORTANTE:
     * usamos requesterClient propositalmente para que o RLS de leads
     * seja a autoridade final da permissão.
     */
    const {
      data: leadData,
      error: leadError,
    } = await requesterClient
      .from('leads')
      .select(
        'id, scope_key, created_by_user_id, nome, email_corporativo'
      )
      .eq('id', leadId)
      .maybeSingle();

    if (leadError) {
      console.error(
        'Erro ao validar lead para envio:',
        leadError
      );

      return jsonError(
        'Não foi possível validar o lead.',
        500
      );
    }

    if (!leadData) {
      return jsonError(
        'Lead não encontrado ou você não possui permissão para acessá-lo.',
        403
      );
    }

    const lead = leadData as LeadRow;

    /*
     * Defesa adicional.
     * Mesmo que uma policy seja alterada acidentalmente no futuro,
     * o endpoint não atravessa scopes.
     */
    if (lead.scope_key !== profile.scope_key) {
      return jsonError(
        'Você não possui permissão para enviar e-mail para este lead.',
        403
      );
    }

    if (
      profile.role === 'vendedor' &&
      lead.created_by_user_id !== profile.id
    ) {
      return jsonError(
        'Você não possui permissão para enviar e-mail para este lead.',
        403
      );
    }

    const {
      data: emailAccountData,
      error: emailAccountError,
    } = await adminClient
      .from('email_accounts')
      .select(
        'id, user_id, scope_key, provider, email_address, display_name, status'
      )
      .eq('user_id', authenticatedUserId)
      .eq('provider', 'google')
      .maybeSingle();

    if (emailAccountError) {
      console.error(
        'Erro ao localizar Gmail conectado:',
        emailAccountError
      );

      return jsonError(
        'Não foi possível consultar a conta Gmail.',
        500
      );
    }

    if (!emailAccountData) {
      return jsonError(
        'Nenhuma conta Gmail está conectada. Conecte seu Gmail em Configurações.',
        409
      );
    }

    const emailAccount =
      emailAccountData as EmailAccountRow;

    emailAccountId = emailAccount.id;

    if (
      emailAccount.user_id !== authenticatedUserId ||
      emailAccount.scope_key !== profile.scope_key
    ) {
      console.error(
        'Conta de e-mail incompatível com usuário/scope.'
      );

      return jsonError(
        'A conta Gmail conectada não pertence a este usuário.',
        403
      );
    }

    if (emailAccount.status !== 'active') {
      return jsonError(
        'Sua conta Gmail precisa ser reconectada em Configurações.',
        409
      );
    }

    const {
      data: credentialData,
      error: credentialError,
    } = await adminClient
      .from('email_oauth_credentials')
      .select('refresh_token_secret_id')
      .eq('email_account_id', emailAccount.id)
      .maybeSingle();

    if (credentialError) {
      console.error(
        'Erro ao consultar credencial OAuth:',
        credentialError
      );

      return jsonError(
        'Não foi possível consultar a autorização do Gmail.',
        500
      );
    }

    const credential =
      credentialData as CredentialRow | null;

    if (!credential?.refresh_token_secret_id) {
      return jsonError(
        'A autorização do Gmail está incompleta. Reconecte sua conta em Configurações.',
        409
      );
    }

    /*
     * Lê o refresh token somente no backend via RPC autorizada
     * exclusivamente ao service_role.
     */
    const {
      data: refreshTokenData,
      error: refreshTokenError,
    } = await adminClient.rpc(
      'get_email_refresh_token',
      {
        p_secret_id:
          credential.refresh_token_secret_id,
      }
    );

    if (
      refreshTokenError ||
      typeof refreshTokenData !== 'string' ||
      !refreshTokenData
    ) {
      console.error(
        'Falha ao recuperar refresh token do Vault:',
        refreshTokenError
      );

      await adminClient
        .from('email_accounts')
        .update({
          status: 'error',
          last_error:
            'Não foi possível acessar a autorização protegida do Gmail.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', emailAccount.id);

      return jsonError(
        'Não foi possível acessar a autorização do Gmail. Reconecte sua conta.',
        409
      );
    }

    /*
     * Anexos
     */
    const fileEntries = formData
      .getAll('attachments')
      .filter(
        (entry): entry is File =>
          typeof File !== 'undefined' &&
          entry instanceof File &&
          entry.size > 0
      );

    if (fileEntries.length > MAX_ATTACHMENTS) {
      return jsonError(
        `Você pode anexar no máximo ${MAX_ATTACHMENTS} arquivos por e-mail.`
      );
    }

    for (const file of fileEntries) {
      if (file.size > MAX_FILE_SIZE) {
        return jsonError(
          `O arquivo "${file.name}" ultrapassa o limite de 10 MB.`
        );
      }
    }

    const preparedAttachments: Array<{
      fileName: string;
      mimeType: string;
      buffer: Buffer;
      fileSize: number;
    }> = [];

    for (const file of fileEntries) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      preparedAttachments.push({
        fileName: sanitizeFilename(file.name),
        mimeType:
          file.type || 'application/octet-stream',
        buffer,
        fileSize: file.size,
      });
    }

    /*
     * Criamos o registro antes do envio.
     * queued significa: solicitação validada e pronta para ser enviada.
     */
    const {
      data: messageData,
      error: messageInsertError,
    } = await adminClient
      .from('email_messages')
      .insert({
        scope_key: profile.scope_key,
        lead_id: lead.id,
        email_account_id: emailAccount.id,
        sent_by_user_id: authenticatedUserId,
        provider: 'google',
        from_email: emailAccount.email_address,
        to_email: to,
        cc,
        bcc,
        subject,
        body_text: body,
        body_html: null,
        status: 'queued',
      })
      .select('id')
      .single();

    if (messageInsertError || !messageData) {
      console.error(
        'Erro ao criar registro de email_messages:',
        messageInsertError
      );

      return jsonError(
        'Não foi possível preparar o registro do e-mail.',
        500
      );
    }

    emailMessageId = messageData.id;

    /*
     * Primeiro armazenamos os anexos no bucket privado.
     * Nenhum URL público é criado.
     */
    const storedAttachments: Array<{
      fileName: string;
      mimeType: string;
      fileSize: number;
      storagePath: string;
    }> = [];

    for (const attachment of preparedAttachments) {
      const uniquePart = crypto.randomUUID();

      const storagePath = [
        profile.scope_key,
        lead.id,
        emailMessageId,
        `${uniquePart}-${attachment.fileName}`,
      ].join('/');

      const {
        error: uploadError,
      } = await adminClient.storage
        .from(ATTACHMENT_BUCKET)
        .upload(
          storagePath,
          attachment.buffer,
          {
            contentType: attachment.mimeType,
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          'Erro ao armazenar anexo privado:',
          uploadError
        );

        throw new Error(
          `STORAGE_UPLOAD: Não foi possível armazenar o anexo "${attachment.fileName}".`
        );
      }

      storedAttachments.push({
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        storagePath,
      });
    }

    if (storedAttachments.length > 0) {
      const attachmentRows =
        storedAttachments.map((attachment) => ({
          email_message_id: emailMessageId,
          file_name: attachment.fileName,
          mime_type: attachment.mimeType,
          file_size: attachment.fileSize,
          storage_path: attachment.storagePath,
        }));

      const {
        error: attachmentInsertError,
      } = await adminClient
        .from('email_attachments')
        .insert(attachmentRows);

      if (attachmentInsertError) {
        console.error(
          'Erro ao registrar email_attachments:',
          attachmentInsertError
        );

        throw new Error(
          'ATTACHMENT_DB: Não foi possível registrar os anexos do e-mail.'
        );
      }
    }

    /*
     * O access token Google nasce aqui e fica apenas em memória.
     * Não salvamos esse token no Supabase.
     */
    const googleAccessToken =
      await getGoogleAccessToken(refreshTokenData);

    const mimeMessage = buildMimeMessage({
      fromEmail: emailAccount.email_address,
      displayName: emailAccount.display_name,
      to,
      cc,
      bcc,
      subject,
      bodyText: body,
      attachments: preparedAttachments,
    });

    const raw = toBase64Url(mimeMessage);

    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
        cache: 'no-store',
      }
    );

    const gmailData =
      await gmailResponse.json().catch(() => null);

    if (
      !gmailResponse.ok ||
      !gmailData?.id
    ) {
      const googleError =
        gmailData?.error?.message ||
        `Gmail API respondeu HTTP ${gmailResponse.status}.`;

      throw new Error(
        `GMAIL_SEND: ${googleError}`
      );
    }

    const sentAt = new Date().toISOString();

    const {
      error: messageUpdateError,
    } = await adminClient
      .from('email_messages')
      .update({
        status: 'sent',
        provider_message_id: gmailData.id,
        provider_thread_id:
          gmailData.threadId ?? null,
        sent_at: sentAt,
        error_code: null,
        error_message: null,
      })
      .eq('id', emailMessageId);

    if (messageUpdateError) {
      console.error(
        'Gmail aceitou a mensagem, mas falhou atualização de email_messages:',
        messageUpdateError
      );
    }

    /*
     * Histórico do lead.
     * Não registramos corpo completo nem conteúdo do anexo aqui;
     * email_messages/email_attachments são a fonte detalhada.
     */
    const activityContent =
      `E-mail enviado para ${to} — Assunto: ${subject}` +
      (
        preparedAttachments.length > 0
          ? ` — ${preparedAttachments.length} anexo(s)`
          : ''
      );

    const {
      error: activityError,
    } = await adminClient
      .from('activities')
      .insert({
        lead_id: lead.id,
        type: 'email',
        content: activityContent,
        user_id: authenticatedUserId,
        date: sentAt,
      });

    if (activityError) {
      console.error(
        'E-mail enviado, mas falhou registro em activities:',
        activityError
      );
    }

    await adminClient
      .from('leads')
      .update({
        updated_at: sentAt,
      })
      .eq('id', lead.id);

    await adminClient
      .from('email_accounts')
      .update({
        status: 'active',
        last_error: null,
        updated_at: sentAt,
      })
      .eq('id', emailAccount.id);

    /*
     * "sent" aqui significa que a Gmail API aceitou o envio.
     * Não representa confirmação de entrega na caixa do destinatário.
     */
    return NextResponse.json({
      ok: true,
      status: 'sent',
      messageId: emailMessageId,
      providerMessageId: gmailData.id,
      providerThreadId:
        gmailData.threadId ?? null,
      acceptedByProvider: true,
      message:
        'E-mail enviado ao Gmail com sucesso.',
    });
  } catch (err: any) {
    const rawMessage =
      err?.message ||
      'Erro inesperado durante o envio do e-mail.';

    /*
     * Não devolvemos refresh token, access token ou secrets.
     */
    const safeMessage = rawMessage
      .replace(
        /ya29\.[A-Za-z0-9._-]+/g,
        '[TOKEN_REMOVIDO]'
      )
      .slice(0, 1000);

    console.error(
      'Erro no envio de e-mail:',
      safeMessage
    );

    if (emailMessageId) {
      const errorCode =
        safeMessage.includes(':')
          ? safeMessage.split(':')[0].slice(0, 100)
          : 'EMAIL_SEND_ERROR';

      await adminClient
        .from('email_messages')
        .update({
          status: 'failed',
          error_code: errorCode,
          error_message: safeMessage,
        })
        .eq('id', emailMessageId);
    }

    /*
     * Se a autorização Google foi revogada/expirou,
     * sinalizamos a conta para reconexão.
     */
    if (
      emailAccountId &&
      (
        safeMessage.includes('invalid_grant') ||
        safeMessage.includes('invalid_client')
      )
    ) {
      await adminClient
        .from('email_accounts')
        .update({
          status: 'error',
          last_error:
            'A autorização do Gmail precisa ser renovada.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', emailAccountId);
    }

    if (!authenticatedUserId) {
      return jsonError(
        'Não foi possível autenticar a solicitação.',
        401
      );
    }

    return jsonError(
      safeMessage.startsWith('STORAGE_UPLOAD:')
        ? safeMessage.replace(
            'STORAGE_UPLOAD:',
            ''
          ).trim()
        : safeMessage.startsWith('ATTACHMENT_DB:')
        ? safeMessage.replace(
            'ATTACHMENT_DB:',
            ''
          ).trim()
        : safeMessage.startsWith('GMAIL_SEND:')
        ? safeMessage.replace(
            'GMAIL_SEND:',
            ''
          ).trim()
        : safeMessage.includes('invalid_grant')
        ? 'A autorização do Gmail expirou ou foi revogada. Reconecte a conta em Configurações.'
        : 'Não foi possível enviar o e-mail. Consulte o status da integração e tente novamente.',
      500
    );
  }
}