'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
} from 'lucide-react';

import { useCRMStore } from '@/src/store/crmStore';
import { supabase } from '@/src/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useCRMStore((state) => state.login);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        window.location.href = '/app';
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    setError('');

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError(
        'Preencha seu e-mail e sua senha.'
      );
      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      setError(
        'Insira um endereço de e-mail válido.'
      );
      return;
    }

    if (password.length < 6) {
      setError(
        'A senha deve conter no mínimo 6 caracteres.'
      );
      return;
    }

    setLoading(true);

    try {
      const result = await login(
        normalizedEmail,
        password
      );

      if (result.ok) {
        window.location.href = '/app';
        return;
      }

      setError(
        result.error || 'Credenciais incorretas.'
      );
    } catch {
      setError(
        'Ocorreu um erro. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07101f] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 lg:px-8">
        <header className="flex h-24 items-center justify-between">
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

            <span className="text-xl font-bold tracking-tight">
              Mirra
              <span className="text-sky-400">
                CRM
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-14 py-12 lg:grid-cols-2">
          <div className="hidden lg:block">
            <div className="mb-5 inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              MirraCRM
            </div>

            <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-[-0.04em]">
              Sua operação comercial continua
              daqui.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
              Entre no seu workspace para acompanhar
              leads, oportunidades, equipe, conversas
              e resultados comerciais.
            </p>

            <div className="relative mt-10 overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1628] p-2 shadow-2xl shadow-sky-950/30">
              <Image
                src="/mirra-dashboard.png"
                alt="Dashboard do MirraCRM"
                width={1200}
                height={700}
                className="h-auto w-full rounded-[22px]"
              />
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.055] p-7 shadow-2xl backdrop-blur-xl sm:p-9">
              <div className="mb-8">
                <p className="mb-2 text-sm font-semibold text-sky-400">
                  Bem-vindo de volta
                </p>

                <h2 className="text-3xl font-semibold tracking-tight">
                  Entrar no MirraCRM
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Use suas credenciais para acessar
                  seu ambiente comercial.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-300"
                  >
                    E-mail
                  </label>

                  <div className="relative mt-2">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="seu-email@empresa.com"
                      required
                      className="w-full rounded-xl border border-white/10 bg-[#07101f]/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-slate-300"
                    >
                      Senha
                    </label>

                    <Link
                      href="/recuperar-senha"
                      className="text-xs font-semibold text-sky-400 transition hover:text-sky-300"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>

                  <div className="relative mt-2">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full rounded-xl border border-white/10 bg-[#07101f]/70 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-5 py-3.5 text-sm font-bold text-[#04101d] transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? 'Entrando...'
                    : 'Entrar no MirraCRM'}

                  {!loading && (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </button>
              </form>

              <div className="mt-7 border-t border-white/10 pt-6 text-center">
                <p className="text-sm text-slate-400">
                  Ainda não utiliza o MirraCRM?{' '}
                  <Link
                    href="/#planos"
                    className="font-semibold text-sky-400 hover:text-sky-300"
                  >
                    Comece grátis
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
