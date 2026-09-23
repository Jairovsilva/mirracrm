import 'server-only';

export type MercadoPagoPayment = {
  id: number;
  status: string;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
  date_approved: string | null;
  payment_method_id: string | null;
};

export async function getMercadoPagoPayment(
  paymentId: string
): Promise<MercadoPagoPayment> {
  if (!/^[0-9]+$/.test(paymentId)) {
    throw new Error('Identificador de pagamento inválido.');
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Integração Mercado Pago não configurada.');
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Falha na consulta ao Mercado Pago: HTTP ${response.status}`
    );
  }

  const data: unknown = await response.json();

  if (!data || typeof data !== 'object') {
    throw new Error('Resposta de pagamento inválida.');
  }

  const payment = data as Record<string, unknown>;

  if (
    typeof payment.id !== 'number' ||
    !Number.isSafeInteger(payment.id) ||
    String(payment.id) !== paymentId ||
    typeof payment.status !== 'string' ||
    typeof payment.transaction_amount !== 'number' ||
    !Number.isFinite(payment.transaction_amount) ||
    payment.transaction_amount <= 0 ||
    typeof payment.currency_id !== 'string' ||
    (payment.external_reference !== null &&
      payment.external_reference !== undefined &&
      typeof payment.external_reference !== 'string') ||
    (payment.date_approved !== null &&
      payment.date_approved !== undefined &&
      typeof payment.date_approved !== 'string') ||
    (payment.payment_method_id !== null &&
      payment.payment_method_id !== undefined &&
      typeof payment.payment_method_id !== 'string')
  ) {
    throw new Error('Dados de pagamento inválidos.');
  }

  return {
    id: payment.id,
    status: payment.status,
    transaction_amount: payment.transaction_amount,
    currency_id: payment.currency_id,
    external_reference:
      (payment.external_reference as string | null) ?? null,
    date_approved:
      (payment.date_approved as string | null) ?? null,
    payment_method_id:
      (payment.payment_method_id as string | null) ?? null,
  };
}
