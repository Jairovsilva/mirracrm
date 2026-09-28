'use client';

import Script from 'next/script';
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

type CardFormData = {
  token?: string;
  cardholderEmail?: string;
};

type CardFormInstance = {
  getCardFormData: () => CardFormData;
  unmount?: () => void;
};

type MercadoPagoInstance = {
  cardForm: (config: any) => CardFormInstance;
};

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: {
        locale?: string;
      }
    ) => MercadoPagoInstance;
  }
}

export default function RecurringTestPage() {
  const cardFormRef =
    useRef<CardFormInstance | null>(null);

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
    useState<any>(null);

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

    if (
      !publicKey ||
      !window.MercadoPago
    ) {
      setError(
        'Mercado Pago não configurado.'
      );
      return;
    }

    initializedRef.current = true;

    const mp =
      new window.MercadoPago(
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

            submittingRef.current = true;
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
                  'Token ou e-mail não foi gerado.'
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

              const responseData =
                await response.json();

              if (
                !response.ok ||
                !responseData?.ok
              ) {
                throw new Error(
                  responseData?.error ||
                    'Falha ao criar assinatura.'
                );
              }

              setResult(
                responseData
              );
            } catch (err) {
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
      });

    return () => {
      try {
        cardFormRef.current
          ?.unmount?.();
      } catch {}

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
          Valor: R$ 10,00/mês.
          Sem período grátis.
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
              : 'Criar assinatura de teste'}
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
          <pre
            style={{
              marginTop: 20,
              whiteSpace:
                'pre-wrap',
            }}
          >
            {JSON.stringify(
              result,
              null,
              2
            )}
          </pre>
        )}
      </main>
    </>
  );
}
