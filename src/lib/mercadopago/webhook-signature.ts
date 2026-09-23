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
 * Valida a assinatura de uma notificação do Mercado Pago.
 *
 * IMPORTANTE:
 * - Não aprova pagamentos.
 * - Não consulta o Mercado Pago.
 * - Não altera o banco de dados.
 * - Não deve ser usado sozinho para confirmar pagamento.
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

  const signature = parseSignature(
    signatureHeader
  );

  if (!signature) {
    return false;
  }

  /**
   * O "ts" informado pelo Mercado Pago
   * na assinatura é tratado em milissegundos.
   */
  const timestampMs = Number(
    signature.timestamp
  );

  if (
    !Number.isSafeInteger(timestampMs)
  ) {
    return false;
  }

  /**
   * Proteção adicional contra replay.
   *
   * Aceitamos uma diferença máxima de
   * 5 minutos entre a assinatura e o servidor.
   *
   * Essa janela poderá ser ajustada depois
   * dos testes reais do webhook.
   */
  const now = Date.now();
  const maxAgeMs = 5 * 60 * 1000;

  if (
    timestampMs > now + maxAgeMs ||
    timestampMs < now - maxAgeMs
  ) {
    return false;
  }

  /**
   * Manifest utilizado na validação
   * da assinatura.
   */
  const manifest =
    `id:${dataId.toLowerCase()};` +
    `request-id:${requestId};` +
    `ts:${signature.timestamp};`;

  /**
   * Calcula o HMAC esperado utilizando
   * exclusivamente o segredo do webhook.
   */
  const expected = createHmac(
    'sha256',
    secret
  )
    .update(manifest)
    .digest();

  /**
   * A assinatura v1 recebida deve ser
   * hexadecimal SHA-256 (32 bytes).
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
   * Comparação resistente a timing attacks.
   */
  return timingSafeEqual(
    received,
    expected
  );
}
