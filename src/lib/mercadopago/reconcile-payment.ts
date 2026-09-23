import 'server-only';

import type { MercadoPagoPayment } from './payment-client';

export type BillingOrderForReconciliation = {
  id: string;
  amount_cents: number;
  currency: string;
  provider: string;
  status: string;
};

export type ReconciledPayment = {
  providerPaymentId: string;
  orderId: string;
  amountCents: number;
  currency: 'BRL';
  paymentMethod: string | null;
  paidAt: string;
};

function moneyToCents(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Valor do pagamento inválido.');
  }

  const cents = Math.round(value * 100);

  // Protege contra valores com precisão incompatível
  // com uma moeda de duas casas decimais.
  if (Math.abs(value * 100 - cents) > 0.000001) {
    throw new Error(
      'Pagamento possui precisão monetária inválida.'
    );
  }

  return cents;
}

export function reconcileMercadoPagoPayment(
  payment: MercadoPagoPayment,
  order: BillingOrderForReconciliation
): ReconciledPayment {
  if (order.provider !== 'mercado_pago') {
    throw new Error('Provedor do pedido inválido.');
  }

  if (
    order.status !== 'pending' &&
    order.status !== 'processing'
  ) {
    throw new Error(
      'Pedido não está disponível para pagamento.'
    );
  }

  if (payment.status !== 'approved') {
    throw new Error('Pagamento não está aprovado.');
  }

  if (payment.currency_id !== 'BRL') {
    throw new Error('Moeda do pagamento inválida.');
  }

  if (order.currency !== 'BRL') {
    throw new Error('Moeda do pedido inválida.');
  }

  if (payment.external_reference !== order.id) {
    throw new Error(
      'Pagamento não corresponde ao pedido.'
    );
  }

  const amountCents = moneyToCents(
    payment.transaction_amount
  );

  if (amountCents !== order.amount_cents) {
    throw new Error(
      'Valor do pagamento não corresponde ao pedido.'
    );
  }

  if (!payment.date_approved) {
    throw new Error(
      'Pagamento aprovado sem data de aprovação.'
    );
  }

  const paidAt = new Date(payment.date_approved);

  if (Number.isNaN(paidAt.getTime())) {
    throw new Error(
      'Data de aprovação do pagamento inválida.'
    );
  }

  return {
    providerPaymentId: String(payment.id),
    orderId: order.id,
    amountCents,
    currency: 'BRL',
    paymentMethod: payment.payment_method_id,
    paidAt: paidAt.toISOString(),
  };
}
