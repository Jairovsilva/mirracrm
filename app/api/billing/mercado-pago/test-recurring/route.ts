import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = {
  'Cache-Control': 'no-store',
};

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json(
      { ok: false, error: 'Not found.' },
      { status: 404, headers: noStore }
    );
  }

  const accessToken =
    process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: 'Mercado Pago não configurado.' },
      { status: 503, headers: noStore }
    );
  }

  try {
    const body = await request.json();

    const cardTokenId =
      String(body?.cardTokenId || '').trim();

    const payerEmail =
      String(body?.payerEmail || '').trim();

    if (!cardTokenId || !payerEmail) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Token do cartão ou e-mail ausente.',
        },
        { status: 400, headers: noStore }
      );
    }

    /*
     * Assinatura DESCARTÁVEL, exclusivamente para
     * validar o ciclo real de cobrança recorrente.
     *
     * Não possui free_trial.
     */
    const externalReference =
      `MIRRACRM_RECURRING_TEST_${Date.now()}`;

    const response = await fetch(
      'https://api.mercadopago.com/preapproval',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': crypto.randomUUID(),
        },

        cache: 'no-store',

        body: JSON.stringify({
          reason:
            'MirraCRM - Teste técnico recorrência',

          external_reference:
            externalReference,

          payer_email:
            payerEmail,

          card_token_id:
            cardTokenId,

          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',

            /*
             * Valor pequeno porque esta assinatura
             * existe apenas no ambiente Test User.
             */
            transaction_amount: 10,
            currency_id: 'BRL',
          },

          back_url:
            'https://develop-mirracrm.vercel.app/cadastro/pagamento/teste-recorrencia',

          status: 'authorized',
        }),
      }
    );

    const text =
      await response.text();

    let result: any = null;

    try {
      result = text
        ? JSON.parse(text)
        : null;
    } catch {
      result = null;
    }

    if (!response.ok) {
      console.error(
        'Mercado Pago recurring test:',
        response.status,
        result
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            'Mercado Pago recusou a criação da assinatura de teste.',
          status: response.status,
          provider:
            result ?? null,
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    const subscriptionId =
      String(result?.id || '').trim();

    if (!subscriptionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Mercado Pago criou resposta sem ID de assinatura.',
        },
        {
          status: 502,
          headers: noStore,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        subscriptionId,
        status:
          result?.status ?? null,
        nextPaymentDate:
          result?.next_payment_date ?? null,
        externalReference,
      },
      {
        status: 200,
        headers: noStore,
      }
    );
  } catch (error) {
    console.error(
      'Recurring test error:',
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
