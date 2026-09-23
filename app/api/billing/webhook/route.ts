import { NextRequest, NextResponse } from 'next/server';

import { validateMercadoPagoWebhookSignature } from '@/src/lib/mercadopago/webhook-signature';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = {
  'Cache-Control': 'no-store',
};

export async function POST(request: NextRequest) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || '';

  // Sem credencial configurada, nenhuma notificação é aceita.
  if (!secret) {
    return NextResponse.json(
      { error: 'Integração de pagamentos ainda não habilitada.' },
      { status: 503, headers: noStore }
    );
  }

  const signatureHeader = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');

  // O identificador deve vir da URL da notificação.
  const dataId = request.nextUrl.searchParams.get('data.id');

  const validSignature = validateMercadoPagoWebhookSignature({
    signatureHeader,
    requestId,
    dataId,
    secret,
  });

  if (!validSignature) {
    return NextResponse.json(
      { error: 'Assinatura inválida.' },
      { status: 401, headers: noStore }
    );
  }

  // Assinatura válida NÃO significa pagamento aprovado.
  // A consulta ao Mercado Pago e a conciliação financeira
  // serão implementadas antes de habilitar esta rota.
  return NextResponse.json(
    { error: 'Processamento financeiro ainda não habilitado.' },
    { status: 503, headers: noStore }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      service: 'mirracrm-billing-webhook',
      status: 'not_configured',
    },
    { status: 200, headers: noStore }
  );
}
