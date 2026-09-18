
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabaseClient';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }

    setLoading(true);

    try {
      const redirectTo =
        `${window.location.origin}/redefinir-senha?recovery=1`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          { redirectTo }
        );

      if (resetError) {
        if (
          resetError.status === 429 ||
          /rate limit/i.test(resetError.message)
        ) {
          setError(
            'Muitas solicitações foram realizadas. Aguarde alguns minutos e tente novamente.'
          );
        } else {
          setError(
            'Não foi possível enviar o link agora. Tente novamente mais tarde.'
          );
        }

        return;
      }

      setSent(true);
    } catch {
      setError(
        'Não foi possível enviar o link agora. Tente novamente mais tarde.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl shadow-neutral-200/50">

        {/* LOGO */}
        <div className="flex items-center gap-3 mb-9">
          <Image
            src="/mirra-logo.png"
            alt="MirraCRM"
            width={36}
            height={36}
            className="rounded-lg"
          />

          <span className="font-bold text-lg text-neutral-950">
            Mirra
            <span className="font-normal text-indigo-600">
              CRM
            </span>
          </span>
        </div>

        {sent ? (
          <div className="space-y-5">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />

            <h1 className="text-2xl font-bold text-neutral-950">
              Verifique seu e-mail
            </h1>

            <p className="text-sm leading-relaxed text-neutral-600">
              Se existir uma conta associada ao endereço informado,
              você receberá um link para redefinir sua senha.
              Verifique também a pasta de spam.
            </p>

            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-neutral-950">
              Recuperar senha
            </h1>

            <p className="mt-2 mb-7 text-sm leading-relaxed text-neutral-500">
              Informe o e-mail utilizado no MirraCRM para receber
              um link de recuperação.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
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
                  htmlFor="recovery-email"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-500"
                >
                  Endereço de e-mail
                </label>

                <div className="relative mt-2">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />

                  <input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu-email@provedor.com"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-4 text-sm text-neutral-900 outline-none transition-colors focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? 'Enviando...'
                  : 'Enviar link de recuperação'}

                {!loading && (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </form>

            <Link
              href="/"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-indigo-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
