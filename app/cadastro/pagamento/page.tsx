'use client';

import Script from 'next/script';
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';

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

type CardFormData = {
  token?: string;
  paymentMethodId?: string;
  issuerId?: string;
  cardholderEmail?: string;
  amount?: string;
  installments?: string;
  identificationNumber?: string;
  identificationType?: string;
};

type CardFormInstance = {
  getCardFormData: () => CardFormData;
  unmount?: () => void;
};

type MercadoPagoInstance = {
  cardForm: (config: {
    amount: string;
    iframe: boolean;

    form: {
      id: string;

      cardNumber: {
        id: string;
        placeholder: string;
      };

      expirationDate: {
        id: string;
        placeholder: string;
      };

      securityCode: {
        id: string;
        placeholder: string;
      };

      cardholderName: {
        id: string;
        placeholder: string;
      };

      issuer: {
        id: string;
        placeholder: string;
      };

      installments: {
        id: string;
        placeholder: string;
      };

      identificationType: {
        id: string;
        placeholder: string;
      };

      identificationNumber: {
        id: string;
        placeholder: string;
      };

      cardholderEmail: {
        id: string;
        placeholder: string;
      };
    };

    callbacks: {
      onFormMounted?: (
        error?: unknown
      ) => void;

      onSubmit: (
        event: FormEvent<HTMLFormElement>
      ) => void | Promise<void>;

      onFetching?: (
        resource: string
      ) => void | (() => void);
    };
  }) => CardFormInstance;
};

type PlanId = 'basic' | 'pro';

type BillingCycle =
  | 'monthly'
  | 'annual';

type PlanDetails = {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  users: string;
};

const PLANS: Record<
  PlanId,
  PlanDetails
> = {
  basic: {
    name: 'Basic',
    monthlyPrice: 'R$ 499',
    annualPrice: 'R$ 5.389,20',
    users: 'Até 2 usuários',
  },

  pro: {
    name: 'Pro',
    monthlyPrice: 'R$ 1.497',
    annualPrice: 'R$ 16.167,60',
    users: 'Até 5 usuários',
  },
};

function getErrorMessage(
  error: unknown
) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    const message = (
      error as {
        message?: unknown;
      }
    ).message;

    if (
      typeof message === 'string'
    ) {
      return message;
    }
  }

  return 'Não foi possível concluir a operação.';
}

export default function PaymentPage() {
  const router = useRouter();

  const searchParams =
    useSearchParams();

  const cardFormRef =
    useRef<CardFormInstance | null>(
      null
    );

  const initializedRef =
    useRef(false);

  const [sdkReady, setSdkReady] =
    useState(false);

  const [formReady, setFormReady] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const rawPlan =
    searchParams.get('plan');

  const rawCycle =
    searchParams.get('cycle');

  const planId: PlanId =
    rawPlan === 'pro'
      ? 'pro'
      : 'basic';

  const billingCycle: BillingCycle =
    rawCycle === 'annual'
      ? 'annual'
      : 'monthly';

  const plan =
    PLANS[planId];

  const isAnnual =
    billingCycle === 'annual';

  const amount =
    planId === 'basic'
      ? '499'
      : '1497';

  /*
   * A Public Key é incorporada ao
   * frontend pelo Next.js.
   *
   * trim() remove somente espaços,
   * tabs ou quebras de linha existentes
   * no início/final do valor.
   */
  const publicKey =
    process.env
      .NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
      ?.trim();

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /*
   * DIAGNÓSTICO TEMPORÁRIO.
   *
   * Não imprime a Public Key.
   *
   * Apenas informa:
   * - se existe;
   * - comprimento;
   * - se ainda contém whitespace;
   * - se começa com TEST-.
   */
  useEffect(() => {
    console.log(
      'MP Public Key diagnostics',
      {
        configured:
          Boolean(publicKey),

        length:
          publicKey?.length ?? 0,

        containsWhitespace:
          publicKey
            ? /\s/.test(publicKey)
            : null,

        startsWithTEST:
          publicKey?.startsWith(
            'TEST-'
          ) ?? false,
      }
    );
  }, [publicKey]);

  /*
   * Inicialização do CardForm.
   */
  useEffect(() => {
    if (
      !sdkReady ||
      isAnnual ||
      initializedRef.current
    ) {
      return;
    }

    if (
      !publicKey ||
      !window.MercadoPago
    ) {
      setError(
        'A configuração de pagamento não está disponível.'
      );

      return;
    }

    initializedRef.current =
      true;

    try {
      const mp =
        new window.MercadoPago(
          publicKey,
          {
            locale: 'pt-BR',
          }
        );

      cardFormRef.current =
        mp.cardForm({
          amount,
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
                'Nome impresso no cartão',
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
                'Tipo de documento',
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
                'E-mail',
            },
          },

          callbacks: {
            onFormMounted: (
              mountError
            ) => {
              if (mountError) {
                console.error(
                  'Erro ao carregar CardForm:',
                  mountError
                );

                setError(
                  'Não foi possível carregar o formulário de pagamento.'
                );

                return;
              }

              console.log(
                'Mercado Pago CardForm carregado com sucesso.'
              );

              setFormReady(true);
            },

            onFetching: () => {
              return () => {};
            },

            onSubmit: async (
              event
            ) => {
              event.preventDefault();

              if (submitting) {
                return;
              }

              setError('');
              setSubmitting(true);

              try {
                const cardData =
                  cardFormRef.current
                    ?.getCardFormData();

                const cardTokenId =
                  cardData?.token;

                if (!cardTokenId) {
                  throw new Error(
                    'Não foi possível validar os dados do cartão. Confira os campos e tente novamente.'
                  );
                }

                if (
                  !supabaseUrl ||
                  !supabaseAnonKey
                ) {
                  throw new Error(
                    'Configuração de autenticação indisponível.'
                  );
                }

                const supabase =
                  createClient(
                    supabaseUrl,
                    supabaseAnonKey,
                    {
                      auth: {
                        persistSession:
                          true,

                        autoRefreshToken:
                          true,
                      },
                    }
                  );

                const {
                  data: sessionData,
                  error:
                    sessionError,
                } =
                  await supabase
                    .auth
                    .getSession();

                const accessToken =
                  sessionData
                    .session
                    ?.access_token;

                if (
                  sessionError ||
                  !accessToken
                ) {
                  throw new Error(
                    'Sua sessão expirou. Entre novamente para continuar.'
                  );
                }

                const response =
                  await fetch(
                    '/api/billing/mercado-pago/subscriptions',
                    {
                      method: 'POST',

                      headers: {
                        'Content-Type':
                          'application/json',

                        Authorization:
                          `Bearer ${accessToken}`,
                      },

                      body:
                        JSON.stringify({
                          planId,

                          billingCycle:
                            'monthly',

                          cardTokenId,
                        }),
                    }
                  );

                let result:
                  | {
                      ok?: boolean;
                      error?: string;
                      code?: string;
                    }
                  | null = null;

                try {
                  result =
                    (await response.json()) as {
                      ok?: boolean;
                      error?: string;
                      code?: string;
                    };
                } catch {
                  result = null;
                }

                if (
                  !response.ok ||
                  !result?.ok
                ) {
                  if (
                    result?.code ===
                    'PROVIDER_CREATED_LOCAL_LINK_FAILED'
                  ) {
                    throw new Error(
                      'Sua assinatura foi recebida pelo Mercado Pago, mas ocorreu uma falha ao vinculá-la ao MirraCRM. Não tente novamente. Entre em contato com o suporte.'
                    );
                  }

                  if (
                    result?.code ===
                    'SUBSCRIPTION_ALREADY_LINKED'
                  ) {
                    router.replace(
                      '/app'
                    );

                    return;
                  }

                  throw new Error(
                    result?.error ||
                      'Não foi possível configurar sua assinatura.'
                  );
                }

                router.replace(
                  '/app'
                );
              } catch (
                submitError
              ) {
                console.error(
                  'Erro ao configurar assinatura:',
                  submitError
                );

                setError(
                  getErrorMessage(
                    submitError
                  )
                );
              } finally {
                setSubmitting(false);
              }
            },
          },
        });
    } catch (
      initializationError
    ) {
      console.error(
        'Erro ao inicializar Mercado Pago:',
        initializationError
      );

      initializedRef.current =
        false;

      setError(
        'Não foi possível inicializar o pagamento.'
      );
    }

    return () => {
      try {
        cardFormRef.current
          ?.unmount?.();
      } catch {
        // Nada a fazer.
      }

      cardFormRef.current =
        null;

      initializedRef.current =
        false;
    };
  }, [
    amount,
    isAnnual,
    publicKey,
    router,
    sdkReady,
    submitting,
    supabaseAnonKey,
    supabaseUrl,
    planId,
  ]);

  return (
    <>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => {
          console.log(
            'MercadoPago.js carregado.'
          );

          setSdkReady(true);
        }}
        onError={() => {
          console.error(
            'Falha ao carregar MercadoPago.js.'
          );

          setError(
            'Não foi possível carregar a conexão segura com o Mercado Pago.'
          );
        }}
      />

      <main className="min-h-screen bg-[#07111f] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-8 lg:px-8">
          <header className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/cadastro?plan=${planId}&cycle=${billingCycle}`
                )
              }
              className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <ArrowLeft
                size={18}
              />

              Voltar
            </button>

            <div className="text-xl font-semibold tracking-tight">
              Mirra

              <span className="text-cyan-400">
                CRM
              </span>
            </div>
          </header>

          <div className="flex flex-1 items-center py-10">
            <div className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
              <section className="flex flex-col justify-center">
                <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-300">
                  <ShieldCheck
                    size={16}
                  />

                  Checkout seguro
                </div>

                <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Configure sua assinatura
                  do MirraCRM
                </h1>

                <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">
                  Você terá 13 dias para
                  usar o MirraCRM antes do
                  início da cobrança
                  recorrente.
                </p>

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-sm text-slate-400">
                        Plano selecionado
                      </p>

                      <h2 className="mt-1 text-2xl font-semibold">
                        MirraCRM{' '}
                        {plan.name}
                      </h2>

                      <p className="mt-2 text-sm text-slate-400">
                        {plan.users}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-semibold">
                        {isAnnual
                          ? plan.annualPrice
                          : plan.monthlyPrice}
                      </div>

                      <div className="mt-1 text-sm text-slate-400">
                        {isAnnual
                          ? 'por ano'
                          : 'por mês'}
                      </div>
                    </div>
                  </div>

                  <div className="my-6 h-px bg-white/10" />

                  <div className="space-y-3 text-sm text-slate-300">
                    <div className="flex items-center gap-3">
                      <Check
                        size={17}
                        className="text-cyan-400"
                      />

                      13 dias de teste
                      grátis
                    </div>

                    {!isAnnual && (
                      <div className="flex items-center gap-3">
                        <Check
                          size={17}
                          className="text-cyan-400"
                        />

                        Cobrança mensal
                        automática após o
                        período de teste
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Check
                        size={17}
                        className="text-cyan-400"
                      />

                      Cancele quando
                      precisar
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-slate-500">
                  <Lock
                    size={17}
                    className="mt-1 shrink-0"
                  />

                  <p>
                    Os dados sensíveis do
                    cartão são processados
                    pela infraestrutura
                    segura do Mercado Pago.
                  </p>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/20 sm:p-8">
                {isAnnual ? (
                  <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                      <CreditCard
                        size={26}
                      />
                    </div>

                    <h2 className="mt-5 text-xl font-semibold">
                      Pagamento anual
                    </h2>

                    <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                      O pagamento anual
                      será disponibilizado
                      em um fluxo separado.
                      Nenhuma cobrança será
                      realizada nesta tela.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/cadastro/pagamento?plan=${planId}&cycle=monthly`
                        )
                      }
                      className="mt-7 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-[#07111f] transition hover:bg-cyan-300"
                    >
                      Escolher mensal
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-7">
                      <p className="text-sm font-medium text-cyan-300">
                        Cartão de crédito
                      </p>

                      <h2 className="mt-1 text-2xl font-semibold">
                        Dados de pagamento
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Nenhuma cobrança
                        será feita hoje. A
                        primeira cobrança
                        ocorrerá após o
                        período de teste.
                      </p>
                    </div>

                    {error && (
                      <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200">
                        {error}
                      </div>
                    )}

                    {!formReady &&
                      !error && (
                        <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                          <Loader2
                            size={17}
                            className="animate-spin"
                          />

                          Carregando ambiente
                          seguro de
                          pagamento...
                        </div>
                      )}

                    <form
                      id="form-checkout"
                      className="space-y-5"
                    >
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                          Número do cartão
                        </label>

                        <div
                          id="form-checkout__cardNumber"
                          className="h-12 rounded-xl border border-white/10 bg-[#0b1727] px-3 py-3"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-300">
                            Validade
                          </label>

                          <div
                            id="form-checkout__expirationDate"
                            className="h-12 rounded-xl border border-white/10 bg-[#0b1727] px-3 py-3"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-300">
                            CVV
                          </label>

                          <div
                            id="form-checkout__securityCode"
                            className="h-12 rounded-xl border border-white/10 bg-[#0b1727] px-3 py-3"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="form-checkout__cardholderName"
                          className="mb-2 block text-sm font-medium text-slate-300"
                        >
                          Nome no cartão
                        </label>

                        <input
                          id="form-checkout__cardholderName"
                          type="text"
                          autoComplete="cc-name"
                          className="h-12 w-full rounded-xl border border-white/10 bg-[#0b1727] px-4 text-sm text-white outline-none transition focus:border-cyan-400/60"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
                        <div>
                          <label
                            htmlFor="form-checkout__identificationType"
                            className="mb-2 block text-sm font-medium text-slate-300"
                          >
                            Documento
                          </label>

                          <select
                            id="form-checkout__identificationType"
                            className="h-12 w-full rounded-xl border border-white/10 bg-[#0b1727] px-3 text-sm text-white outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="form-checkout__identificationNumber"
                            className="mb-2 block text-sm font-medium text-slate-300"
                          >
                            CPF
                          </label>

                          <input
                            id="form-checkout__identificationNumber"
                            type="text"
                            inputMode="numeric"
                            className="h-12 w-full rounded-xl border border-white/10 bg-[#0b1727] px-4 text-sm text-white outline-none transition focus:border-cyan-400/60"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="form-checkout__cardholderEmail"
                          className="mb-2 block text-sm font-medium text-slate-300"
                        >
                          E-mail
                        </label>

                        <input
                          id="form-checkout__cardholderEmail"
                          type="email"
                          autoComplete="email"
                          className="h-12 w-full rounded-xl border border-white/10 bg-[#0b1727] px-4 text-sm text-white outline-none transition focus:border-cyan-400/60"
                        />
                      </div>

                      <div className="hidden">
                        <select
                          id="form-checkout__issuer"
                          aria-label="Emissor"
                        />

                        <select
                          id="form-checkout__installments"
                          aria-label="Parcelas"
                        />
                      </div>

                      <button
                        id="form-checkout__submit"
                        type="submit"
                        disabled={
                          submitting ||
                          !formReady
                        }
                        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-[#07111f] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <Loader2
                              size={18}
                              className="animate-spin"
                            />

                            Configurando
                            assinatura...
                          </>
                        ) : (
                          <>
                            <Lock
                              size={17}
                            />

                            Iniciar 13 dias
                            grátis
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                      <ShieldCheck
                        size={15}
                      />

                      Pagamento processado
                      com segurança pelo
                      Mercado Pago
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
