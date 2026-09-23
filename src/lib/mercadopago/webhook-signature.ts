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

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === 'ts') {
      if (timestamp !== null) return null;
      timestamp = value;
    }

    if (key === 'v1') {
      if (hash !== null) return null;
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
 * Valida a assinatura de uma notificação do Mercado Pago.
 *
 * Não aprova pagamentos.
 * Não consulta o provedor.
 * Não altera o banco.
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
    !dataId ||
    !/^[0-9]+$/.test(dataId)
  ) {
    return false;
  }

  const signature = parseSignature(signatureHeader);

  if (!signature) {
    return false;
  }

  // Evita aceitar timestamps impossíveis ou muito antigos.
  const timestampMs = Number(signature.timestamp) * 1000;

  if (!Number.isSafeInteger(timestampMs)) {
    return false;
  }

  const now = Date.now();
  const maxAgeMs = 5 * 60 * 1000;

  if (
    timestampMs > now + maxAgeMs ||
    timestampMs < now - maxAgeMs
  ) {
    return false;
  }

  const manifest =
    `id:${dataId.toLowerCase()};` +
    `request-id:${requestId};` +
    `ts:${signature.timestamp};`;

  const expected = createHmac('sha256', secret)
    .update(manifest)
    .digest();

  const received = Buffer.from(
    signature.hash,
    'hex'
  );

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}
