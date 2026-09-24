'use client';

import React, {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from 'react';

import Image from 'next/image';
import Link from 'next/link';
import {
  useRouter,
  useSearchParams,
} from 'next/navigation';

import { createClient } from '@supabase/supabase-js';

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';

type PlanId = 'basic' | 'pro';

type BillingCycle =
  | 'monthly'
  | 'annual';

type PlanConfig = {
  id: PlanId;
  name: string;
  users: number;
  monthlyPrice: string;
  annualPrice: string;
};

const PLANS: Record<
  PlanId,
  PlanConfig
> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    users: 2,
    monthlyPrice: 'R$ 499',
    annualPrice: 'R$ 5.389,20',
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    users: 5,
    monthlyPrice: 'R$ 1.497',
    annualPrice: 'R$ 16.167,60',
  },
};

function CadastroContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const requestedPlan =
    searchParams.get('plan');

  const requestedCycle =
    searchParams.get('cycle');

  const plan: PlanId =
    requestedPlan === 'pro'
      ? 'pro'
      : 'basic';

  const cycle: BillingCycle =
    requestedCycle === 'annual'
      ? 'annual'
      : 'monthly';

  const selectedPlan =
    PLANS[plan];

  const [name, setName] =
    useState('');

  const [
    companyName,
    setCompanyName,
  ] = useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  useEffect(() => {
    /*
     * Normaliza URLs digitadas
     * manualmente com plano inválido.
     */
    if (
      requestedPlan !== 'basic' &&
      requestedPlan !== 'pro'
    ) {
      router.replace(
        `/cadastro?plan=basic&cycle=${cycle}`
      );
    }
  }, [
    requestedPlan,
    cycle,
    router,
  ]);

  const price =
    cycle === 'annual'
      ? selectedPlan.annualPrice
      : selectedPlan.monthlyPrice;

  const cycleLabel =
    cycle === 'annual'
      ? 'por ano'
      : 'por mês';

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError('');

    const normalizedName =
      name.trim();

    const normalizedCompany =
      companyName.trim();

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !normalizedName ||
      !normalizedCompany ||
      !normalizedEmail ||
      !password ||
      !confirmPassword
    ) {
      setError(
        'Preencha todos os campos para continuar.'
      );

      return;
    }

    if (
      normalizedName.length > 120
    ) {
      setError(
        'Informe um nome válido.'
      );

      return;
    }

    if (
      normalizedCompany.length >
      160
    ) {
      setError(
        'Informe um nome de empresa válido.'
      );

      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailRegex.test(
        normalizedEmail
      ) ||
      normalizedEmail.length > 254
    ) {
      setError(
        'Informe um endereço de e-mail válido.'
      );

      return;
    }

    if (password.length < 8) {
      setError(
        'A senha deve ter pelo menos 8 caracteres.'
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        'As senhas informadas não são iguais.'
      );

      return;
    }

    setSubmitting(true);

    try {
      /*
       * 1. Criar a identidade e
       * estrutura de billing pelo
       * nosso servidor.
       *
       * A service_role nunca chega
       * ao navegador.
       */
      const registerResponse =
        await fetch(
          '/api/register',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              name:
                normalizedName,

              companyName:
                normalizedCompany,

              email:
                normalizedEmail,

              password,
            }),
          }
        );

      let registerResult: {
        ok?: boolean;
        error?: string;
      } = {};

      try {
        registerResult =
          await registerResponse.json();
      } catch {
        throw new Error(
          'O servidor retornou uma resposta inválida.'
        );
      }

      if (
        !registerResponse.ok ||
        !registerResult.ok
      ) {
        throw new Error(
          registerResult.error ||
            'Não foi possível concluir o cadastro.'
        );
      }

      /*
       * 2. O cadastro administrativo
       * não cria uma sessão no browser.
       *
       * Fazemos o login normal do
       * usuário recém-criado.
       */
      const supabaseUrl =
        process.env
          .NEXT_PUBLIC_SUPABASE_URL;

      const supabaseAnonKey =
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl:
                true,
            },
          }
        );

      const {
        data: loginData,
        error: loginError,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              normalizedEmail,

            password,
          });

      if (
        loginError ||
        !loginData.session
      ) {
        throw new Error(
          'Sua conta foi criada, mas não foi possível iniciar a sessão. Faça login para continuar.'
        );
      }

      /*
       * 3. Guardamos somente dados
       * NÃO sensíveis para apresentar
       * o resumo na próxima página.
       *
       * Nunca armazenamos a senha.
       */
      const signupDraft = {
        name:
          normalizedName,

        companyName:
          normalizedCompany,

        email:
          normalizedEmail,

        plan,

        cycle,

        createdAt:
          new Date().toISOString(),
      };

      sessionStorage.setItem(
        'mirra_signup_draft',
        JSON.stringify(
          signupDraft
        )
      );

      /*
       * 4. Usuário já está
       * autenticado.
       *
       * A próxima página poderá
       * chamar /api/billing/orders
       * usando o access_token da
       * sessão.
       */
      router.push(
        `/cadastro/pagamento?plan=${plan}&cycle=${cycle}`
      );
    } catch (
      caughtError
    ) {
      console.error(
        'Erro ao concluir cadastro:',
        caughtError
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível continuar. Tente novamente.'
      );

      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050d1a] text-white">
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <Image
              src="/mirra-logo.png"
              alt="MirraCRM"
              width={38}
              height={38}
              className="rounded-xl"
              priority
            />

            <span className="text-xl font-bold tracking-[-0.03em]">
              Mirra
              <span className="text-sky-400">
                CRM
              </span>
            </span>
          </Link>

          <Link
            href="/#planos"
            className="flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos planos
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl gap-14 px-6 py-12 lg:grid-cols-[1fr_420px] lg:px-8 lg:py-16">
        {/* FORMULÁRIO */}
        <section className="mx-auto w-full max-w-2xl">
          <div className="mb-10">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400 text-sm font-bold text-[#04101d]">
                1
              </div>

              <div className="h-px w-12 bg-sky-400/40" />

              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-slate-500">
                2
              </div>

              <span className="text-xs font-medium text-slate-500">
                Pagamento
              </span>
            </div>

            <p className="text-sm font-semibold text-sky-400">
              Crie seu acesso
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Vamos preparar seu
              MirraCRM.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
              Informe seus dados e
              os dados da empresa.
              Na próxima etapa você
              concluirá a contratação.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-6"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-slate-300"
                >
                  Seu nome
                </label>

                <div className="relative mt-2">
                  <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(
                      event
                    ) =>
                      setName(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="João Silva"
                    required
                    maxLength={
                      120
                    }
                    disabled={
                      submitting
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#091425] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="company"
                  className="text-sm font-medium text-slate-300"
                >
                  Empresa
                </label>

                <div className="relative mt-2">
                  <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    id="company"
                    type="text"
                    autoComplete="organization"
                    value={
                      companyName
                    }
                    onChange={(
                      event
                    ) =>
                      setCompanyName(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Nome da empresa"
                    required
                    maxLength={
                      160
                    }
                    disabled={
                      submitting
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#091425] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-300"
              >
                E-mail profissional
              </label>

              <div className="relative mt-2">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="voce@empresa.com"
                  required
                  maxLength={
                    254
                  }
                  disabled={
                    submitting
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#091425] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-300"
                >
                  Crie uma senha
                </label>

                <div className="relative mt-2">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    autoComplete="new-password"
                    value={
                      password
                    }
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                    disabled={
                      submitting
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#091425] py-3.5 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    disabled={
                      submitting
                    }
                    aria-label={
                      showPassword
                        ? 'Ocultar senha'
                        : 'Mostrar senha'
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white disabled:cursor-not-allowed"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="text-sm font-medium text-slate-300"
                >
                  Confirme a senha
                </label>

                <div className="relative mt-2">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    id="confirm-password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    autoComplete="new-password"
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event
                    ) =>
                      setConfirmPassword(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Repita sua senha"
                    required
                    minLength={8}
                    disabled={
                      submitting
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#091425] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />

                <p className="text-xs leading-6 text-slate-400">
                  Nenhuma cobrança é
                  realizada nesta
                  etapa. Seus dados
                  de pagamento serão
                  tratados com
                  segurança na
                  próxima etapa da
                  contratação.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                submitting
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-6 py-4 text-sm font-bold text-[#04101d] transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting
                ? 'Criando seu acesso...'
                : 'Continuar para pagamento'}

              {!submitting && (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>

            <p className="text-xs leading-5 text-slate-600">
              Já possui uma
              conta?{' '}
              <Link
                href="/login"
                className="font-semibold text-sky-400 hover:text-sky-300"
              >
                Entrar no
                MirraCRM
              </Link>
            </p>
          </form>
        </section>

        {/* RESUMO */}
        <aside className="lg:pt-10">
          <div className="sticky top-8 overflow-hidden rounded-[28px] border border-white/10 bg-[#091425]">
            <div className="border-b border-white/[0.07] p-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-400">
                Plano escolhido
              </p>

              <div className="mt-4 flex items-start justify-between gap-5">
                <div>
                  <h2 className="text-2xl font-semibold">
                    MirraCRM{' '}
                    {
                      selectedPlan.name
                    }
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Até{' '}
                    {
                      selectedPlan.users
                    }{' '}
                    {selectedPlan.users ===
                    1
                      ? 'usuário'
                      : 'usuários'}
                  </p>
                </div>

                <Link
                  href="/#planos"
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                >
                  Alterar
                </Link>
              </div>
            </div>

            <div className="p-7">
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm text-slate-400">
                  {cycle ===
                  'annual'
                    ? 'Plano anual'
                    : 'Plano mensal'}
                </span>

                <div className="text-right">
                  <p className="text-2xl font-semibold">
                    {price}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {
                      cycleLabel
                    }
                  </p>
                </div>
              </div>

              {cycle ===
                'annual' && (
                <div className="mt-4 rounded-xl bg-emerald-400/[0.08] px-4 py-3 text-xs font-medium text-emerald-300">
                  10% de desconto
                  no plano anual
                </div>
              )}

              <div className="my-6 h-px bg-white/[0.07]" />

              <div className="space-y-4">
                {[
                  '13 dias para experimentar',
                  `Até ${selectedPlan.users} usuários`,
                  'Funil de vendas',
                  'Gestão de leads',
                  'Dashboard comercial',
                ].map(
                  (item) => (
                    <div
                      key={
                        item
                      }
                      className="flex items-center gap-3 text-sm text-slate-300"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/10">
                        <Check className="h-3 w-3 text-emerald-400" />
                      </span>

                      {item}
                    </div>
                  )
                )}
              </div>

              <div className="mt-7 rounded-xl border border-sky-400/10 bg-sky-400/[0.05] p-4">
                <p className="text-sm font-semibold text-white">
                  Hoje: R$ 0
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Seu período de
                  teste é de 13
                  dias. A
                  contratação será
                  configurada na
                  próxima etapa.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#050d1a] text-sm text-slate-400">
          Carregando
          contratação...
        </main>
      }
    >
      <CadastroContent />
    </Suspense>
  );
}