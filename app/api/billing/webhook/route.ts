import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

import {
  validateMercadoPagoWebhookSignature,
} from '@/src/lib/mercadopago/webhook-signature';

import {
  getMercadoPagoPayment,
} from '@/src/lib/mercadopago/payment-client';

import {
  reconcileMercadoPagoPayment,
} from '@/src/lib/mercadopago/reconcile-payment';

import {
  getMercadoPagoAuthorizedPayment,
  mercadoPagoAmountToCents,
} from '@/src/lib/mercadopago/authorized-payment-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = {
  'Cache-Control': 'no-store',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAdminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      'Configuração do Supabase ausente.'
    );
  }

  return createClient(
    url,
    serviceRole,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function getPaymentId(
  payment: any
) {
  const value =
    String(
      payment?.id ?? ''
    ).trim();

  if (
    !value ||
    !/^\d+$/.test(value)
  ) {
    throw new Error(
      'Pagamento Mercado Pago sem ID válido.'
    );
  }

  return value;
}

function getPaymentAmountCents(
  payment: any
) {
  const amount =
    Number(
      payment?.transaction_amount
    );

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Pagamento Mercado Pago com valor inválido.'
    );
  }

  const cents =
    Math.round(
      amount * 100
    );

  if (
    !Number.isSafeInteger(cents) ||
    cents <= 0
  ) {
    throw new Error(
      'Pagamento Mercado Pago com valor inválido.'
    );
  }

  return cents;
}

function getPaidAt(
  payment: any
) {
  const value =
    payment?.date_approved;

  if (!value) {
    throw new Error(
      'Pagamento aprovado sem date_approved.'
    );
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      'date_approved inválido.'
    );
  }

  return date.toISOString();
}

function getPaymentMethod(
  payment: any
) {
  const value =
    String(
      payment?.payment_method_id ||
      payment?.payment_type_id ||
      'unknown'
    ).trim();

  return value || 'unknown';
}

async function finishWebhookEvent({
  admin,
  eventId,
  attemptToken,
  success,
  error,
}: {
  admin: ReturnType<
    typeof getAdminSupabase
  >;
  eventId: string;
  attemptToken: string;
  success: boolean;
  error: string | null;
}) {
  const {
    error: finishError,
  } = await admin.rpc(
    'finish_billing_webhook_event_v2',
    {
      p_event_id:
        eventId,

      p_attempt_token:
        attemptToken,

      p_success:
        success,

      p_error:
        error,
    }
  );

  if (finishError) {
    throw new Error(
      `Falha ao finalizar webhook: ${finishError.message}`
    );
  }
}

export async function POST(
  request: NextRequest
) {
  /*
   * =====================================================
   * TRAVA 1
   * =====================================================
   */

  if (
    process.env.MERCADO_PAGO_WEBHOOK_ENABLED !==
    'true'
  ) {
    return NextResponse.json(
      {
        error:
          'Processamento financeiro ainda não habilitado.',
      },
      {
        status: 503,
        headers: noStore,
      }
    );
  }

  const secret =
    process.env.MERCADO_PAGO_WEBHOOK_SECRET || '';

  if (!secret) {
    return NextResponse.json(
      {
        error:
          'Webhook Mercado Pago não configurado.',
      },
      {
        status: 503,
        headers: noStore,
      }
    );
  }

  try {
    /*
     * ===================================================
     * 1. VALIDAR ASSINATURA DO WEBHOOK
     * ===================================================
     */

    const signatureHeader =
      request.headers.get(
        'x-signature'
      );

    const requestId =
      request.headers.get(
        'x-request-id'
      );

    const dataId =
      request.nextUrl.searchParams.get(
        'data.id'
      );

    const validSignature =
      validateMercadoPagoWebhookSignature({
        signatureHeader,
        requestId,
        dataId,
        secret,
      });

    if (!validSignature) {
      return NextResponse.json(
        {
          error:
            'Assinatura inválida.',
        },
        {
          status: 401,
          headers: noStore,
        }
      );
    }

    if (!dataId) {
      return NextResponse.json(
        {
          error:
            'Recurso não identificado.',
        },
        {
          status: 400,
          headers: noStore,
        }
      );
    }

    /*
     * ===================================================
     * 2. LER PAYLOAD
     * ===================================================
     */

    let body: any;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            'Payload inválido.',
        },
        {
          status: 400,
          headers: noStore,
        }
      );
    }

    const eventType =
      String(
        body?.type || ''
      ).trim();

    /*
     * Processamos apenas:
     *
     * payment
     *
     * e
     *
     * subscription_authorized_payment
     */

    if (
      eventType !== 'payment' &&
      eventType !==
        'subscription_authorized_payment'
    ) {
      return NextResponse.json(
        {
          received: true,
          processed: false,
          reason:
            'Evento não aplicável.',
        },
        {
          status: 200,
          headers: noStore,
        }
      );
    }

    if (
      String(
        body?.data?.id || ''
      ) !== dataId
    ) {
      return NextResponse.json(
        {
          error:
            'Identificador do payload diverge da URL.',
        },
        {
          status: 400,
          headers: noStore,
        }
      );
    }

    /*
     * ===================================================
     * 3. IDENTIFICAR EVENTO
     * ===================================================
     */

    const providerEventId =
      String(
        body?.id || ''
      ).trim();

    if (!providerEventId) {
      return NextResponse.json(
        {
          error:
            'Identificador do evento ausente.',
        },
        {
          status: 400,
          headers: noStore,
        }
      );
    }

    const admin =
      getAdminSupabase();

    /*
     * ===================================================
     * 4. CLAIM / IDEMPOTÊNCIA DO WEBHOOK
     * ===================================================
     */

    const {
      data: claimRows,
      error: claimError,
    } = await admin.rpc(
      'claim_billing_webhook_event_v2',
      {
        p_provider_event_id:
          providerEventId,

        p_event_type:
          eventType,

        p_resource_id:
          dataId,
      }
    );

    if (claimError) {
      throw new Error(
        `Falha ao reservar webhook: ${claimError.message}`
      );
    }

    const claim =
      Array.isArray(
        claimRows
      )
        ? claimRows[0]
        : claimRows;

    if (!claim) {
      throw new Error(
        'Reserva do webhook não retornou resultado.'
      );
    }

    if (!claim.should_process) {
      return NextResponse.json(
        {
          received: true,
          duplicate: true,
        },
        {
          status: 200,
          headers: noStore,
        }
      );
    }

    const eventId =
      String(
        claim.event_id || ''
      );

    const attemptToken =
      String(
        claim.attempt_token || ''
      );

    if (
      !eventId ||
      !attemptToken
    ) {
      throw new Error(
        'Reserva sem token de processamento.'
      );
    }

    try {
      /*
       * =================================================
       * FLUXO A
       *
       * PAYMENT TRADICIONAL
       * =================================================
       */

      if (
        eventType === 'payment'
      ) {
        const payment =
          await getMercadoPagoPayment(
            dataId
          );

        const orderId =
          payment.external_reference;

        /*
         * IMPORTANTE:
         *
         * Este fluxo continua sendo o fluxo
         * tradicional baseado em billing_order.
         *
         * As faturas de assinatura recorrente
         * são processadas pelo FLUXO B abaixo.
         */

        if (
          !orderId ||
          !UUID_REGEX.test(
            orderId
          )
        ) {
          throw new Error(
            'Pagamento sem referência válida ao pedido.'
          );
        }

        const {
          data: order,
          error: orderError,
        } = await admin
          .from(
            'billing_orders'
          )
          .select(
            `
              id,
              billing_account_id,
              plan_id,
              billing_cycle,
              amount_cents,
              currency,
              status,
              provider,
              order_type
            `
          )
          .eq(
            'id',
            orderId
          )
          .maybeSingle();

        if (orderError) {
          throw new Error(
            `Falha ao consultar pedido: ${orderError.message}`
          );
        }

        if (!order) {
          throw new Error(
            'Pedido correspondente não encontrado.'
          );
        }

        const reconciled =
          reconcileMercadoPagoPayment(
            payment,
            order
          );

        /*
         * TRAVA 2
         */

        if (
          process.env
            .MERCADO_PAGO_APPLY_PAYMENTS !==
          'true'
        ) {
          await finishWebhookEvent({
            admin,
            eventId,
            attemptToken,
            success: false,
            error:
              'Pagamento validado, mas aplicação financeira permanece desabilitada.',
          });

          return NextResponse.json(
            {
              received: true,
              verified: true,
              eventType:
                'payment',
              applied: false,
            },
            {
              status: 503,
              headers: noStore,
            }
          );
        }

        const {
          error: applyError,
        } = await admin.rpc(
          'apply_verified_mercado_pago_payment',
          {
            p_order_id:
              reconciled.orderId,

            p_provider_payment_id:
              reconciled.providerPaymentId,

            p_amount_cents:
              reconciled.amountCents,

            p_currency:
              reconciled.currency,

            p_payment_method:
              reconciled.paymentMethod,

            p_paid_at:
              reconciled.paidAt,
          }
        );

        if (applyError) {
          throw new Error(
            `Falha na aplicação financeira: ${applyError.message}`
          );
        }

        await finishWebhookEvent({
          admin,
          eventId,
          attemptToken,
          success: true,
          error: null,
        });

        return NextResponse.json(
          {
            received: true,
            verified: true,
            eventType:
              'payment',
            applied: true,
          },
          {
            status: 200,
            headers: noStore,
          }
        );
      }

      /*
       * =================================================
       * FLUXO B
       *
       * SUBSCRIPTION_AUTHORIZED_PAYMENT
       * =================================================
       *
       * Aqui data.id NÃO é payment.id.
       *
       * É o ID da fatura/authorized payment.
       */

      const invoice =
        await getMercadoPagoAuthorizedPayment(
          dataId
        );

      const providerInvoiceId =
        String(
          invoice.id
        );

      const providerSubscriptionId =
        String(
          invoice.preapproval_id ||
          ''
        ).trim();

      if (
        !providerSubscriptionId
      ) {
        throw new Error(
          'Fatura sem preapproval_id.'
        );
      }

      /*
       * A fatura informa qual payment.id
       * foi gerado.
       *
       * Mesmo assim NÃO confiamos nos dados
       * financeiros embutidos nela.
       *
       * Consultamos /v1/payments/{id}.
       */

      const providerPaymentId =
        String(
          invoice.payment?.id ??
          ''
        ).trim();

      if (
        !providerPaymentId ||
        !/^\d+$/.test(
          providerPaymentId
        )
      ) {
        throw new Error(
          'Fatura sem payment.id válido.'
        );
      }

      const payment =
        await getMercadoPagoPayment(
          providerPaymentId
        );

      /*
       * =================================================
       * VALIDAR PAGAMENTO CANÔNICO
       * =================================================
       */

      const canonicalPaymentId =
        getPaymentId(
          payment
        );

      if (
        canonicalPaymentId !==
        providerPaymentId
      ) {
        throw new Error(
          'Pagamento canônico diverge da fatura.'
        );
      }

      if (
        payment.status !==
        'approved'
      ) {
        /*
         * Ainda NÃO transformamos rejeição em
         * past_due aqui.
         *
         * Isso será tratado em fluxo separado,
         * evitando bloquear cliente por uma
         * notificação intermediária.
         */

        await finishWebhookEvent({
          admin,
          eventId,
          attemptToken,
          success: true,
          error: null,
        });

        return NextResponse.json(
          {
            received: true,
            verified: true,
            eventType:
              'subscription_authorized_payment',
            paymentStatus:
              payment.status ||
              'unknown',
            applied: false,
          },
          {
            status: 200,
            headers: noStore,
          }
        );
      }

      const currency =
        String(
          payment.currency_id ||
          ''
        ).trim();

      if (
        currency !== 'BRL'
      ) {
        throw new Error(
          'Pagamento recorrente com moeda inválida.'
        );
      }

      /*
       * Comparação independente:
       *
       * authorized_payment.transaction_amount
       *
       * versus
       *
       * payment.transaction_amount
       */

      const invoiceAmountCents =
        mercadoPagoAmountToCents(
          invoice.transaction_amount
        );

      const paymentAmountCents =
        getPaymentAmountCents(
          payment
        );

      if (
        invoiceAmountCents !==
        paymentAmountCents
      ) {
        throw new Error(
          'Valor da fatura diverge do pagamento canônico.'
        );
      }

      if (
        String(
          invoice.currency_id
        ).trim() !==
        currency
      ) {
        throw new Error(
          'Moeda da fatura diverge do pagamento canônico.'
        );
      }

      /*
       * Confirma que o preapproval realmente
       * pertence a uma assinatura MirraCRM.
       *
       * Não dependemos de external_reference.
       */

      const {
        data: subscription,
        error: subscriptionError,
      } = await admin
        .from(
          'billing_subscriptions'
        )
        .select(
          `
            id,
            billing_account_id,
            plan_id,
            billing_cycle,
            status,
            provider,
            provider_subscription_id
          `
        )
        .eq(
          'provider',
          'mercado_pago'
        )
        .eq(
          'provider_subscription_id',
          providerSubscriptionId
        )
        .maybeSingle();

      if (
        subscriptionError
      ) {
        throw new Error(
          `Falha ao localizar assinatura: ${subscriptionError.message}`
        );
      }

      if (!subscription) {
        throw new Error(
          'Assinatura Mercado Pago não pertence ao MirraCRM.'
        );
      }

      /*
       * =================================================
       * TRAVA 2
       * =================================================
       *
       * Neste momento já sabemos:
       *
       * - webhook autêntico;
       * - invoice consultada no MP;
       * - preapproval conhecido;
       * - payment consultado no MP;
       * - payment approved;
       * - BRL;
       * - invoice/payment com mesmo valor;
       * - invoice/payment com mesma moeda.
       *
       * Mas ainda NÃO aplicamos dinheiro
       * enquanto o gate estiver false.
       */

      if (
        process.env
          .MERCADO_PAGO_APPLY_PAYMENTS !==
        'true'
      ) {
        await finishWebhookEvent({
          admin,
          eventId,
          attemptToken,
          success: false,
          error:
            'Fatura recorrente validada, mas aplicação financeira permanece desabilitada.',
        });

        return NextResponse.json(
          {
            received: true,
            verified: true,
            eventType:
              'subscription_authorized_payment',
            subscriptionMatched:
              true,
            paymentApproved:
              true,
            applied: false,
          },
          {
            status: 503,
            headers: noStore,
          }
        );
      }

      /*
       * =================================================
       * APLICAÇÃO ATÔMICA
       * =================================================
       *
       * Este é o RPC que acabamos de testar:
       *
       * - identifica primeira cobrança;
       * - ou cria renewal order;
       * - aplica payment;
       * - vincula authorized_payment.id;
       * - protege por payment.id;
       * - protege por invoice.id.
       */

      const {
        error: recurringApplyError,
      } = await admin.rpc(
        'apply_verified_mercado_pago_subscription_invoice',
        {
          p_provider_subscription_id:
            providerSubscriptionId,

          p_provider_invoice_id:
            providerInvoiceId,

          p_provider_payment_id:
            canonicalPaymentId,

          p_amount_cents:
            paymentAmountCents,

          p_currency:
            currency,

          p_payment_method:
            getPaymentMethod(
              payment
            ),

          p_paid_at:
            getPaidAt(
              payment
            ),
        }
      );

      if (
        recurringApplyError
      ) {
        throw new Error(
          `Falha ao aplicar fatura recorrente: ${recurringApplyError.message}`
        );
      }

      await finishWebhookEvent({
        admin,
        eventId,
        attemptToken,
        success: true,
        error: null,
      });

      return NextResponse.json(
        {
          received: true,
          verified: true,
          eventType:
            'subscription_authorized_payment',
          subscriptionMatched:
            true,
          paymentApproved:
            true,
          applied: true,
        },
        {
          status: 200,
          headers: noStore,
        }
      );
    } catch (
      processingError
    ) {
      const message =
        processingError instanceof Error
          ? processingError.message
          : 'Erro desconhecido no processamento.';

      /*
       * Tentamos registrar a falha.
       *
       * Se isso falhar, apenas registramos no
       * log porque o erro original continua
       * sendo a informação mais importante.
       */

      try {
        await finishWebhookEvent({
          admin,
          eventId,
          attemptToken,
          success: false,
          error:
            message,
        });
      } catch (
        finishError
      ) {
        console.error(
          'Falha ao registrar erro do webhook:',
          finishError
        );
      }

      console.error(
        'Falha no webhook Mercado Pago:',
        message
      );

      return NextResponse.json(
        {
          received: true,
          processed: false,
        },
        {
          status: 500,
          headers: noStore,
        }
      );
    }
  } catch (error) {
    console.error(
      'Erro no webhook Mercado Pago:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Falha ao processar notificação.',
      },
      {
        status: 500,
        headers: noStore,
      }
    );
  }
}

export async function GET() {
  const webhookEnabled =
    process.env.MERCADO_PAGO_WEBHOOK_ENABLED ===
    'true';

  const applyPayments =
    process.env.MERCADO_PAGO_APPLY_PAYMENTS ===
    'true';

  return NextResponse.json(
    {
      service:
        'mirracrm-billing-webhook',

      webhook:
        webhookEnabled
          ? 'enabled'
          : 'disabled',

      financialApplication:
        applyPayments
          ? 'enabled'
          : 'disabled',

      supportedEvents: [
        'payment',
        'subscription_authorized_payment',
      ],

      recurringInvoices:
        'supported',
    },
    {
      status: 200,
      headers: noStore,
    }
  );
}
