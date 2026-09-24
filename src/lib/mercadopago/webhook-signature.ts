import 'server-only';

import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

type WebhookSignatureInput = {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
};

type ParsedSignature = {
  timestamp: string;
  hash: string;
};

function parseSignature(
  header: string | null
): ParsedSignature | null {
  if (!header) {
    return null;
  }

  const parts = header.split(',');
  let timestamp: string | null = null;
  let hash: string | null = null;

  for (const part of parts) {
    const separator = part.indexOf('=');

    if (separator === -1) {
      return null;
    }

    const key = part
      .slice(0, separator)
      .trim();

    const value = part
      .slice(separator + 1)
      .trim();

    if (key === 'ts') {
      if (timestamp !== null) {
        return null;
      }

      timestamp = value;
    }

    if (key === 'v1') {
      if (hash !== null) {
        return null;
      }

      hash = value;
    }
  }

  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !hash ||
    !/^[a-fA-F0-9]{64}$/.test(hash)
  ) {
    return null;
  }

  return {
    timestamp,
    hash,
  };
}

/**
 * Valida a assinatura de uma notificação
 * Webhook do Mercado Pago.
 *
 * Esta função:
 * - valida a autenticidade da notificação;
 * - não aprova pagamentos;
 * - não consulta o Mercado Pago;
 * - não altera o banco de dados.
 */
export function validateMercadoPagoWebhookSignature({
  signatureHeader,
  requestId,
  dataId,
  secret,
}: WebhookSignatureInput): boolean {
  if (
    !secret ||
    !requestId ||
    !dataId
  ) {
    return false;
  }

  const signature = parseSignature(
    signatureHeader
  );

  if (!signature) {
    return false;
  }

  /**
   * O Mercado Pago exige que data.id seja
   * utilizado em minúsculas para a validação
   * quando houver caracteres alfabéticos.
   */
  const normalizedDataId =
    dataId.toLowerCase();

  /**
   * Manifest oficial do Mercado Pago:
   *
   * id:[data.id_url];
   * request-id:[x-request-id_header];
   * ts:[ts_header];
   */
  const manifest =
    `id:${normalizedDataId};` +
    `request-id:${requestId};` +
    `ts:${signature.timestamp};`;

  /**
   * Gera HMAC-SHA256 utilizando a
   * assinatura secreta configurada
   * para o Webhook.
   */
  const expected = createHmac(
    'sha256',
    secret
  )
    .update(manifest)
    .digest();

  /**
   * Converte o v1 hexadecimal recebido
   * para os mesmos bytes do HMAC esperado.
   */
  const received = Buffer.from(
    signature.hash,
    'hex'
  );

  if (
    received.length !==
    expected.length
  ) {
    return false;
  }

  /**
   * Comparação em tempo constante.
   */
  return timingSafeEqual(
    received,
    expected
  );
}