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
   * Mesmo que as credenciais sejam
   * configuradas acidentalmente,
   * o processamento financeiro somente
   * poderá iniciar quando esta variável
   * for explicitamente habilitada.
   */
  if (
    process.env
      .MERCADO_PAGO_WEBHOOK_ENABLED !==
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
    process.env
      .MERCADO_PAGO_WEBHOOK_SECRET || '';

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
     * 1. DADOS DA NOTIFICAÇÃO
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
     * 2. AUTENTICIDADE
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
     * 3. LER O BODY APÓS VALIDAR
     *    A ORIGEM.
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
     * Aceitamos neste pipeline apenas
     * notificações referentes a payment.
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
     * 4. O ID DA NOTIFICAÇÃO SERÁ NOSSA
     *    CHAVE DE IDEMPOTÊNCIA DO WEBHOOK.
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
     * 5. RESERVAR O EVENTO.
     *
     * A função SQL que já criamos impede
     * dois workers de processarem o mesmo
     * evento simultaneamente.
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

    const claim = Array.isArray(claimRows)
      ? claimRows[0]
      : claimRows;

    if (!claim) {
      throw new Error(
        'Reserva do webhook não retornou resultado.'
      );
    }

    /*
     * Evento já conhecido.
     *
     * Respondemos 200 para o provedor não
     * insistir desnecessariamente na mesma
     * notificação.
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
      String(claim.attempt_token || '');

    if (!eventId || !attemptToken) {
      throw new Error(
        'Reserva sem token de processamento.'
      );
    }

    try {
      /*
       * 6. CONSULTA CANÔNICA.
       *
       * Não confiamos no status enviado
       * pelo webhook.
       */
      const payment =
        await getMercadoPagoPayment(
          dataId
        );

      /*
       * 7. external_reference DEVE SER
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
       * 8. CARREGAR O PEDIDO REAL.
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
       * 9. CONCILIAÇÃO.
       *
       * Aqui são conferidos:
       * - pagamento aprovado
       * - BRL
       * - external_reference
       * - valor exato
       * - pedido pendente/processing
       */
      const reconciled =
        reconcileMercadoPagoPayment(
          payment,
          order
        );

      /*
       * =================================================
       * TRAVA FINANCEIRA TEMPORÁRIA
       * =================================================
       *
       * Chegamos até a confirmação segura do pagamento,
       * mas AINDA NÃO gravamos billing_payments,
       * NÃO marcamos billing_orders como paid e
       * NÃO ativamos billing_subscriptions.
       *
       * Essa trava será removida somente depois dos
       * testes com credenciais oficiais do Mercado Pago.
       */
      if (
        process.env
          .MERCADO_PAGO_APPLY_PAYMENTS !==
        'true'
      ) {
        await admin.rpc(
          'finish_billing_webhook_event_v2',
          {
            p_event_id: eventId,
            p_attempt_token:
              attemptToken,
            p_success: false,
            p_error:
              'Pagamento validado, mas aplicação financeira permanece desabilitada.',
          }
        );

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
       * NÃO IMPLEMENTAR APLICAÇÃO AQUI AINDA.
       *
       * Esta exceção é proposital.
       *
       * Mesmo que alguém habilite por engano
       * MERCADO_PAGO_APPLY_PAYMENTS=true,
       * não haverá ativação financeira até
       * instalarmos a próxima etapa.
       */
      void reconciled;

      throw new Error(
        'Aplicação financeira ainda não implementada.'
      );
    } catch (processingError) {
      const message =
        processingError instanceof Error
          ? processingError.message
          : 'Erro desconhecido no processamento.';

      /*
       * A tentativa somente pode ser encerrada
       * utilizando o token que a reservou.
       */
      const {
        error: finishError,
      } = await admin.rpc(
        'finish_billing_webhook_event_v2',
        {
          p_event_id: eventId,
          p_attempt_token:
            attemptToken,
          p_success: false,
          p_error: message,
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
    process.env
      .MERCADO_PAGO_WEBHOOK_ENABLED ===
    'true';

  const applyPayments =
    process.env
      .MERCADO_PAGO_APPLY_PAYMENTS ===
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
