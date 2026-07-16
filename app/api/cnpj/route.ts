import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cnpjRaw = searchParams.get('cnpj') ?? '';
  const cnpj = cnpjRaw.replace(/[^0-9]/g, '');

  if (cnpj.length !== 14) {
    return NextResponse.json(
      { ok: false, error: 'CNPJ inválido. Deve conter 14 dígitos.' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: 'CNPJ não encontrado na base pública da Receita Federal.' },
        { status: 404 }
      );
    }

    const data = await res.json();

    const ddd = data.ddd_telefone_1 ? String(data.ddd_telefone_1).slice(0, 2) : '';
    const numero = data.ddd_telefone_1 ? String(data.ddd_telefone_1).slice(2) : '';
    const telefone = ddd && numero ? `(${ddd}) ${numero}` : '';

    const socios = Array.isArray(data.qsa)
      ? data.qsa.map((s: any) => ({
          nome: s.nome_socio ?? '',
          cargo: s.qualificacao_socio ?? '',
        }))
      : [];

    return NextResponse.json({
      ok: true,
      data: {
        razaoSocial: data.razao_social ?? '',
        nomeFantasia: data.nome_fantasia ?? '',
        telefone,
        email: data.email ?? '',
        situacao: data.descricao_situacao_cadastral ?? '',
        socios,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'Erro ao consultar a base pública de CNPJ. Tente novamente.' },
      { status: 500 }
    );
  }
}