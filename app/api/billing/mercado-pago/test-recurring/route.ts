import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

const noStore = {
  'Cache-Control': 'no-store',
};

type MercadoPagoErrorResponse = {
  message?: string;
  error?: string;
  status?: number;
  cause?: unknown;
};

type MercadoPagoSubscriptionResponse = {
  id?: string;
  status?: string;
  next_payment_date?: string;
  external_reference?: string;
};

export async function POST(
  request: NextRequest
) {
  /*
   * Rota temporária exclusiva
   * para ambiente Preview.
   *
   * Nunca funciona em produção.
   */
  if (
    process.env.VERCEL_ENV ===
    'production'
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Not found.',
      },
      {
        status: 404,
        headers: noStore,
      }
    );
  }

  const accessToken =
    process.env
      .MERCADO_PAGO_ACCESS_TOKEN
      ?.trim();

  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Mercado Pago não configurado.',
      },
      {
        status: 503,
        headers: noStore,
      }
    );
  }

  try {
    const body =
      (await request.json()) as {
        cardTokenId?: string;
        payerEmail?: string;
      };

    const cardTokenId =
      String(
        body?.cardTokenId || ''
      ).trim();

    const payerEmail =
      String(
        body?.payerEmail || ''
      )
        .trim()
        .toLowerCase();

    if (
      !cardTokenId ||
      !payerEmail
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Token do cartão ou e-mail ausente.',
        },
        {
          status: 400,
          headers: noStore,
        }
      );
    }

    /*
     * Assinatura descartável usada
     * somente para testar uma cobrança
     * recorrente real do Mercado Pago.
     *
     * - Sem free trial
     * - Sem plano Basic
     * - Sem plano Pro
     * - R$ 10,00
     * - Mensal
     */
    const now =
      Date.now();

    /*
     * Começa alguns minutos à frente.
     */
    const startDate =
      new Date(
        now +
          5 * 60 * 1000
      ).toISOString();

    /*
     * Vigência aproximada de um ano.
     */
    const endDate =
      new Date(
        now +
          365 *
            24 *
            60 *
            60 *
            1000
      ).toISOString();

    const externalReference =
      `MIRRACRM_RECURRING_TEST_${Date.now()}`;

    const idempotencyKey =
      crypto.randomUUID();

    const mercadoPagoResponse =
      await fetch(
        'https://api.mercadopago.com/preapproval',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Content-Type':
              'application/json',

            'X-Idempotency-Key':
              idempotencyKey,

            /*
             * Header utilizado pelo
             * Mercado Pago no exemplo
             * oficial do ambiente
             * de teste deste fluxo.
             */
            'X-scope':
              'stage',
          },

          cache: 'no-store',

          body: JSON.stringify({
            back_url:
              'https://develop-mirracrm.vercel.app/cadastro/pagamento/teste-recorrencia',

            reason:
              'MirraCRM - Teste tecnico recorrencia',

            external_reference:
              externalReference,

            auto_recurring: {
              frequency: 1,

              frequency_type:
                'months',

              start_date:
                startDate,

              end_date:
                endDate,

              transaction_amount:
                10,

              currency_id:
                'BRL',
            },

            payer_email:
              payerEmail,

            card_token_id:
              cardTokenId,

            status:
              'authorized',
          }),
        }
      );

    const responseText =
      await mercadoPagoResponse.text();

    let mercadoPagoResult:
      | MercadoPagoSubscriptionResponse
      | MercadoPagoErrorResponse
      | null = null;

    try {
      mercadoPagoResult =
        responseText
          ? JSON.parse(
              responseText
            )
          : null;
    } catch {
      mercadoPagoResult =
        null;
    }

    /*
     * Não registramos:
     * - Access Token
     * - Card Token
     * - Authorization
     *
     * Apenas a resposta devolvida
     * pelo Mercado Pago.
     */
    if (
      !mercadoPagoResponse.ok
    ) {
      console.error(
        'Mercado Pago recurring test:',
        mercadoPagoResponse.status,
        mercadoPagoResult
      );

      const providerError =
        mercadoPagoResult as
          | MercadoPagoErrorResponse
          | null;

      return NextResponse.json(
        {
          ok: false,

          error:
            'Mercado Pago recusou a criação da assinatura de teste.',

          providerStatus:
            mercadoPagoResponse.status,

          providerMessage:
            providerError?.message ??
            providerError?.error ??
            null,

          providerCause:
            providerError?.cause ??
            null,
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    const subscription =
      mercadoPagoResult as
        | MercadoPagoSubscriptionResponse
        | null;

    const subscriptionId =
      String(
        subscription?.id || ''
      ).trim();

    if (!subscriptionId) {
      console.error(
        'Mercado Pago recurring test: resposta sem subscription ID.',
        mercadoPagoResult
      );

      return NextResponse.json(
        {
          ok: false,

          error:
            'Mercado Pago respondeu sem ID da assinatura.',
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    /*
     * subscriptionId e
     * externalReference são
     * identificadores.
     *
     * Nenhuma credencial é
     * devolvida ao navegador.
     */
    return NextResponse.json(
      {
        ok: true,

        subscriptionId,

        status:
          subscription?.status ??
          null,

        nextPaymentDate:
          subscription
            ?.next_payment_date ??
          null,

        externalReference,

        test: {
          amount: 10,

          currency:
            'BRL',

          frequency:
            1,

          frequencyType:
            'months',

          startDate,

          endDate,

          freeTrial:
            false,

          scope:
            'stage',
        },
      },
      {
        status: 200,
        headers: noStore,
      }
    );
  } catch (error) {
    console.error(
      'Recurring test unexpected error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado.',
      },
      {
        status: 500,
        headers: noStore,
      }
    );
  }
}
