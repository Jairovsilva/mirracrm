import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook do Mercado Pago.
 *
 * ESTADO ATUAL: INATIVO.
 *
 * Esta rota não processa pagamentos enquanto a integração
 * segura com o Mercado Pago não estiver implementada.
 *
 * Não remover esta proteção antes de adicionar:
 * 1. Validação da assinatura da notificação.
 * 2. Consulta autenticada ao Mercado Pago.
 * 3. Conferência do pedido, valor, moeda e pagamento.
 * 4. Processamento transacional e idempotente.
 */

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "Integração de pagamentos ainda não habilitada.",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      service: "mirracrm-billing-webhook",
      status: "not_configured",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
