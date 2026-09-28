'use client';

import Script from 'next/script';
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

type TestCardFormData = {
  token?: string;
  cardholderEmail?: string;
};

type TestCardFormInstance = {
  getCardFormData: () => TestCardFormData;
  unmount?: () => void;
};

export default function RecurringTestPage() {
  const cardFormRef =
    useRef<TestCardFormInstance | null>(
      null
    );

  const initializedRef =
    useRef(false);

  const submittingRef =
    useRef(false);

  const [sdkReady, setSdkReady] =
    useState(false);

  const [ready, setReady] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [result, setResult] =
    useState<Record<
      string,
      unknown
    > | null>(null);

  const publicKey =
    process.env
      .NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
      ?.trim();

  useEffect(() => {
    if (
      !sdkReady ||
      initializedRef.current
    ) {
      return;
    }

    if (!publicKey) {
      setError(
        'Mercado Pago não configurado.'
      );
      return;
    }

    /*
     * A página oficial do MirraCRM já declara
     * window.MercadoPago globalmente.
     *
     * Aqui evitamos uma segunda declaração
     * global para não gerar conflito no
     * TypeScript durante o build.
     */
    const MercadoPagoConstructor =
      window.MercadoPago;

    if (!MercadoPagoConstructor) {
      setError(
        'SDK do Mercado Pago não foi carregado.'
      );
      return;
    }

    initializedRef.current = true;

    try {
      const mp =
        new MercadoPagoConstructor(
          publicKey,
          {
            locale: 'pt-BR',
          }
        );

      cardFormRef.current =
        mp.cardForm({
          amount: '10',

          iframe: true,

          form: {
            id: 'form-checkout',

            cardNumber: {
              id:
                'form-checkout__cardNumber',

              placeholder:
                'Número do cartão',
            },

            expirationDate: {
              id:
                'form-checkout__expirationDate',

              placeholder:
                'MM/AA',
            },

            securityCode: {
              id:
                'form-checkout__securityCode',

              placeholder:
                'CVV',
            },

            cardholderName: {
              id:
                'form-checkout__cardholderName',

              placeholder:
                'Nome do titular',
            },

            issuer: {
              id:
                'form-checkout__issuer',

              placeholder:
                'Banco emissor',
            },

            installments: {
              id:
                'form-checkout__installments',

              placeholder:
                'Parcelas',
            },

            identificationType: {
              id:
                'form-checkout__identificationType',

              placeholder:
                'Documento',
            },

            identificationNumber: {
              id:
                'form-checkout__identificationNumber',

              placeholder:
                'CPF',
            },

            cardholderEmail: {
              id:
                'form-checkout__cardholderEmail',

              placeholder:
                'E-mail Buyer Test User',
            },
          },

          callbacks: {
            onFormMounted: (
              mountError?: unknown
            ) => {
              if (mountError) {
                console.error(
                  'Erro ao carregar CardForm:',
                  mountError
                );

                setError(
                  'Erro ao carregar formulário.'
                );

                return;
              }

              setReady(true);
            },

            onFetching: () => {
              return () => {};
            },

            onSubmit: async (
              event: FormEvent<HTMLFormElement>
            ) => {
              event.preventDefault();

              if (
                submittingRef.current
              ) {
                return;
              }

              submittingRef.current =
                true;

              setSubmitting(true);
              setError('');
              setResult(null);

              try {
                const data =
                  cardFormRef.current
                    ?.getCardFormData();

                const cardTokenId =
                  data?.token;

                const payerEmail =
                  data?.cardholderEmail;

                if (
                  !cardTokenId ||
                  !payerEmail
                ) {
                  throw new Error(
                    'Token ou e-mail não foi gerado. Confira os campos.'
                  );
                }

                const response =
                  await fetch(
                    '/api/billing/mercado-pago/test-recurring',
                    {
                      method: 'POST',

                      headers: {
                        'Content-Type':
                          'application/json',
                      },

                      body:
                        JSON.stringify({
                          cardTokenId,
                          payerEmail,
                        }),
                    }
                  );

                let responseData:
                  | Record<
                      string,
                      unknown
                    >
                  | null = null;

                try {
                  responseData =
                    (await response.json()) as Record<
                      string,
                      unknown
                    >;
                } catch {
                  responseData =
                    null;
                }

                if (
                  !response.ok ||
                  responseData?.ok !==
                    true
                ) {
                  const message =
                    typeof responseData?.error ===
                    'string'
                      ? responseData.error
                      : 'Falha ao criar assinatura de teste.';

                  throw new Error(
                    message
                  );
                }

                setResult(
                  responseData
                );
              } catch (err) {
                console.error(
                  'Teste recorrência:',
                  err
                );

                setError(
                  err instanceof Error
                    ? err.message
                    : 'Erro inesperado.'
                );
              } finally {
                submittingRef.current =
                  false;

                setSubmitting(false);
              }
            },
          },
        }) as TestCardFormInstance;
    } catch (initializationError) {
      console.error(
        'Erro ao inicializar Mercado Pago:',
        initializationError
      );

      initializedRef.current =
        false;

      setError(
        'Não foi possível inicializar o Mercado Pago.'
      );
    }

    return () => {
      try {
        cardFormRef.current
          ?.unmount?.();
      } catch {
        // Página temporária de teste.
      }

      cardFormRef.current =
        null;
    };
  }, [
    sdkReady,
    publicKey,
  ]);

  return (
    <>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() =>
          setSdkReady(true)
        }
      />

      <main
        style={{
          maxWidth: 620,
          margin: '40px auto',
          padding: 24,
          fontFamily:
            'Arial, sans-serif',
        }}
      >
        <h1>
          MirraCRM — Teste de recorrência
        </h1>

        <p>
          Ambiente temporário de teste.
          Valor: R$ 10,00/mês. Sem
          período grátis.
        </p>

        <p>
          Use somente Buyer Test User e
          cartão sandbox.
        </p>

        <form id="form-checkout">
          <div
            id="form-checkout__cardNumber"
            style={{
              height: 48,
              marginBottom: 12,
            }}
          />

          <div
            id="form-checkout__expirationDate"
            style={{
              height: 48,
              marginBottom: 12,
            }}
          />

          <div
            id="form-checkout__securityCode"
            style={{
              height: 48,
              marginBottom: 12,
            }}
          />

          <input
            id="form-checkout__cardholderName"
            placeholder="Nome do titular"
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 12,
            }}
          />

          <select
            id="form-checkout__issuer"
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 12,
            }}
          />

          <select
            id="form-checkout__installments"
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 12,
            }}
          />

          <select
            id="form-checkout__identificationType"
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 12,
            }}
          />

          <input
            id="form-checkout__identificationNumber"
            placeholder="CPF"
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 12,
            }}
          />

          <input
            id="form-checkout__cardholderEmail"
            type="email"
            placeholder="E-mail Buyer Test User"
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 20,
            }}
          />

          <button
            type="submit"
            disabled={
              !ready ||
              submitting
            }
            style={{
              width: '100%',
              padding: 14,

              cursor:
                submitting
                  ? 'wait'
                  : 'pointer',
            }}
          >
            {submitting
              ? 'Criando teste...'
              : ready
                ? 'Criar assinatura de teste'
                : 'Carregando Mercado Pago...'}
          </button>
        </form>

        {error && (
          <pre
            style={{
              marginTop: 20,
              whiteSpace:
                'pre-wrap',
            }}
          >
            ERRO: {error}
          </pre>
        )}

        {result && (
          <>
            <h2
              style={{
                marginTop: 24,
              }}
            >
              Assinatura criada
            </h2>

            <pre
              style={{
                whiteSpace:
                  'pre-wrap',

                overflowWrap:
                  'anywhere',
              }}
            >
              {JSON.stringify(
                result,
                null,
                2
              )}
            </pre>
          </>
        )}
      </main>
    </>
  );
}
