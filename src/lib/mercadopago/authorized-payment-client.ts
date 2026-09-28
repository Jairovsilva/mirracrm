export type MercadoPagoAuthorizedPayment = {
  id: number;
  type?: string | null;
  date_created?: string | null;
  last_modified?: string | null;

  preapproval_id: string;

  external_reference?: string | number | null;

  currency_id: string;

  transaction_amount:
    | number
    | string;

  debit_date?: string | null;

  retry_attempt?: number | null;

  status?: string | null;

  summarized?: string | null;

  payment?: {
    id?: number | string | null;
    status?: string | null;
    status_detail?: string | null;
  } | null;
};

function getAccessToken() {
  const token =
    process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

  if (!token) {
    throw new Error(
      'MERCADO_PAGO_ACCESS_TOKEN não configurado.'
    );
  }

  return token;
}

function normalizeInvoiceId(
  value: string
) {
  const normalized =
    String(value || '').trim();

  /*
   * A documentação do Mercado Pago define
   * authorized_payment.id como numérico.
   *
   * Não aceitamos qualquer valor arbitrário
   * para montar a URL.
   */
  if (
    !normalized ||
    !/^\d+$/.test(normalized)
  ) {
    throw new Error(
      'Identificador da fatura Mercado Pago inválido.'
    );
  }

  return normalized;
}

export async function getMercadoPagoAuthorizedPayment(
  invoiceId: string
): Promise<MercadoPagoAuthorizedPayment> {
  const normalizedInvoiceId =
    normalizeInvoiceId(invoiceId);

  const accessToken =
    getAccessToken();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      10000
    );

  try {
    const response =
      await fetch(
        `https://api.mercadopago.com/authorized_payments/${encodeURIComponent(
          normalizedInvoiceId
        )}`,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            Accept:
              'application/json',
          },

          cache: 'no-store',

          signal:
            controller.signal,
        }
      );

    const rawText =
      await response.text();

    let payload: unknown = null;

    if (rawText) {
      try {
        payload =
          JSON.parse(rawText);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      throw new Error(
        `Mercado Pago authorized payment GET falhou (${response.status}).`
      );
    }

    if (
      !payload ||
      typeof payload !== 'object'
    ) {
      throw new Error(
        'Mercado Pago retornou uma fatura inválida.'
      );
    }

    const invoice =
      payload as MercadoPagoAuthorizedPayment;

    /*
     * Defesa contra resposta inesperada:
     * o ID retornado precisa ser exatamente
     * o ID que consultamos.
     */
    if (
      String(invoice.id) !==
      normalizedInvoiceId
    ) {
      throw new Error(
        'ID da fatura retornada pelo Mercado Pago diverge da consulta.'
      );
    }

    if (
      !invoice.preapproval_id ||
      typeof invoice.preapproval_id !==
        'string'
    ) {
      throw new Error(
        'Fatura Mercado Pago sem preapproval_id.'
      );
    }

    if (
      !invoice.currency_id ||
      typeof invoice.currency_id !==
        'string'
    ) {
      throw new Error(
        'Fatura Mercado Pago sem moeda.'
      );
    }

    const amount =
      Number(
        invoice.transaction_amount
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        'Fatura Mercado Pago com valor inválido.'
      );
    }

    /*
     * Não aplicamos uma cobrança sem
     * pagamento associado.
     *
     * Uma fatura pode existir ainda como
     * scheduled/pending, portanto isso
     * NÃO significa erro financeiro do
     * cliente; apenas significa que ela
     * ainda não pode ser aplicada.
     */
    const paymentId =
      invoice.payment?.id;

    if (
      paymentId === null ||
      paymentId === undefined ||
      String(paymentId).trim() === ''
    ) {
      throw new Error(
        'Fatura Mercado Pago ainda não possui pagamento associado.'
      );
    }

    if (
      !/^\d+$/.test(
        String(paymentId)
      )
    ) {
      throw new Error(
        'Identificador do pagamento da fatura é inválido.'
      );
    }

    return invoice;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'AbortError'
    ) {
      throw new Error(
        'Timeout ao consultar fatura no Mercado Pago.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function mercadoPagoAmountToCents(
  amount: number | string
) {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(numeric) ||
    numeric <= 0
  ) {
    throw new Error(
      'Valor Mercado Pago inválido.'
    );
  }

  /*
   * BRL possui duas casas decimais.
   *
   * Exemplo:
   * 499.00 -> 49900
   */
  const cents =
    Math.round(
      numeric * 100
    );

  if (
    !Number.isSafeInteger(cents) ||
    cents <= 0
  ) {
    throw new Error(
      'Valor em centavos inválido.'
    );
  }

  return cents;
}
