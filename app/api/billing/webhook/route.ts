import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { createClient } from '@supabase/supabase-js';

import {
  validateMercadoPagoWebhookSignature,
} from '@/src/lib/mercadopago/webhook-signature';

import {
  getMercadoPagoPayment,
} from '@/src/lib/mercadopago/payment-client';

import {
  reconcileMercadoPagoPayment,
} from '@/src/lib/mercadopago/reconcile-payment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = {
  'Cache-Control': 'no-store',
};

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

export async function POST(
  request: NextRequest
) {
  /*
   * TRAVA PRINCIPAL.
   *
   * Mesmo que as credenciais do Mercado Pago
   * sejam configuradas, o webhook financeiro
   * só funciona quando esta variável estiver
   * explicitamente definida como "true".
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
     * 1. DADOS UTILIZADOS NA VALIDAÇÃO
     *    DA ASSINATURA DO MERCADO PAGO.
     */
    const signatureHeader =
      request.headers.get('x-signature');

    const requestId =
      request.headers.get('x-request-id');

    const dataId =
      request.nextUrl.searchParams.get(
        'data.id'
      );

    /*
     * 2. VALIDAR A AUTENTICIDADE
     *    DA NOTIFICAÇÃO.
     */
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
          error: 'Assinatura inválida.',
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
            'Pagamento não identificado.',
        },
        {
          status: 400,
          headers: noStore,
        }
      );
    }

    /*
     * 3. LER O PAYLOAD.
     */
    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Payload inválido.',
        },
        {
          status: 400,
          headers: noStore,
        }
      );
    }

    /*
     * 4. ESTE PIPELINE PROCESSA
     *    SOMENTE EVENTOS DE PAYMENT.
     */
    if (
      body?.type !== 'payment' ||
      String(body?.data?.id || '') !==
        dataId
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

    /*
     * 5. IDENTIFICADOR ÚNICO
     *    DA NOTIFICAÇÃO.
     */
    const providerEventId =
      String(body?.id || '').trim();

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

    const admin = getAdminSupabase();

    /*
     * 6. RESERVAR O EVENTO.
     *
     * A função SQL controla duplicidade,
     * concorrência e cria um token exclusivo
     * para esta tentativa.
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
          String(body.type),

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
      Array.isArray(claimRows)
        ? claimRows[0]
        : claimRows;

    if (!claim) {
      throw new Error(
        'Reserva do webhook não retornou resultado.'
      );
    }

    /*
     * Evento já registrado anteriormente.
     *
     * Não repetimos o processamento.
     */
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
      String(claim.event_id);

    const attemptToken =
      String(
        claim.attempt_token || ''
      );

    if (!eventId || !attemptToken) {
      throw new Error(
        'Reserva sem token de processamento.'
      );
    }

    try {
      /*
       * 7. CONSULTA CANÔNICA DO PAGAMENTO.
       *
       * Não confiamos no status informado
       * diretamente pelo webhook.
       */
      const payment =
        await getMercadoPagoPayment(
          dataId
        );

      /*
       * 8. O external_reference DO
       *    MERCADO PAGO DEVE CONTER
       *    billing_orders.id.
       */
      const orderId =
        payment.external_reference;

      if (
        !orderId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          orderId
        )
      ) {
        throw new Error(
          'Pagamento sem referência válida ao pedido.'
        );
      }

      /*
       * 9. CARREGAR O PEDIDO REAL
       *    DO MIRRACRM.
       */
      const {
        data: order,
        error: orderError,
      } = await admin
        .from('billing_orders')
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
        .eq('id', orderId)
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

      /*
       * 10. CONCILIAR PAGAMENTO X PEDIDO.
       *
       * A função confere:
       *
       * - status approved;
       * - moeda BRL;
       * - external_reference;
       * - valor exato;
       * - pedido pending/processing;
       * - provedor Mercado Pago.
       */
      const reconciled =
        reconcileMercadoPagoPayment(
          payment,
          order
        );

      /*
       * =================================================
       * SEGUNDA TRAVA DE SEGURANÇA
       * =================================================
       *
       * Mesmo com o webhook habilitado,
       * nenhuma assinatura será ativada enquanto
       * MERCADO_PAGO_APPLY_PAYMENTS não for "true".
       */
      if (
        process.env.MERCADO_PAGO_APPLY_PAYMENTS !==
        'true'
      ) {
        const {
          error: disabledFinishError,
        } = await admin.rpc(
          'finish_billing_webhook_event_v2',
          {
            p_event_id:
              eventId,

            p_attempt_token:
              attemptToken,

            p_success:
              false,

            p_error:
              'Pagamento validado, mas aplicação financeira permanece desabilitada.',
          }
        );

        if (disabledFinishError) {
          console.error(
            'Falha ao registrar webhook desabilitado:',
            disabledFinishError
          );
        }

        return NextResponse.json(
          {
            received: true,
            verified: true,
            applied: false,
          },
          {
            status: 503,
            headers: noStore,
          }
        );
      }

      /*
       * 11. APLICAÇÃO FINANCEIRA ATÔMICA.
       *
       * Chegamos aqui somente depois de:
       *
       * - assinatura válida;
       * - consulta direta ao Mercado Pago;
       * - pagamento approved;
       * - pedido encontrado;
       * - external_reference correspondente;
       * - valor correspondente;
       * - moeda BRL;
       * - trava financeira habilitada.
       *
       * O RPC registra o pagamento e aplica
       * primeira contratação OU renovação
       * dentro da transação PostgreSQL.
       */
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

      /*
       * 12. PAGAMENTO JÁ FOI APLICADO.
       *
       * Agora podemos marcar esta tentativa
       * do webhook como concluída.
       */
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
            true,

          p_error:
            null,
        }
      );

      if (finishError) {
        /*
         * O pagamento NÃO deve ser revertido aqui.
         *
         * O RPC financeiro é idempotente.
         * Portanto uma reconciliação posterior
         * poderá recuperar este cenário sem
         * duplicar o pagamento.
         */
        throw new Error(
          `Pagamento aplicado, mas webhook não pôde ser finalizado: ${finishError.message}`
        );
      }

      /*
       * 13. PROCESSAMENTO CONCLUÍDO.
       */
      return NextResponse.json(
        {
          received: true,
          verified: true,
          applied: true,
        },
        {
          status: 200,
          headers: noStore,
        }
      );
    } catch (processingError) {
      const message =
        processingError instanceof Error
          ? processingError.message
          : 'Erro desconhecido no processamento.';

      /*
       * Marca a tentativa como falha.
       *
       * O token impede uma tentativa antiga
       * de finalizar uma tentativa mais nova.
       */
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
            false,

          p_error:
            message,
        }
      );

      if (finishError) {
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
    },
    {
      status: 200,
      headers: noStore,
    }
  );
}
