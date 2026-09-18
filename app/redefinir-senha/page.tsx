
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/src/lib/supabaseClient';

type RecoveryStatus =
  | 'checking'
  | 'ready'
  | 'invalid'
  | 'success';

export default function RedefinirSenhaPage() {
  const [status, setStatus] =
    useState<RecoveryStatus>('checking');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const query = new URLSearchParams(
      window.location.search
    );

    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    );

    const hasRecoveryMarker =
      query.get('recovery') === '1' ||
      hash.get('type') === 'recovery';

    const hasAuthError =
      query.has('error') ||
      query.has('error_code') ||
      hash.has('error') ||
      hash.has('error_code');

    if (hasAuthError || !hasRecoveryMarker) {
      setStatus('invalid');
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (
          event === 'PASSWORD_RECOVERY' &&
          session
        ) {
          setStatus('ready');
        }
      }
    );

    const checkRecoverySession = async () => {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (!active) return;

        if (sessionError || !data.session) {
          setStatus('invalid');
          return;
        }

        // A página só aceita sessões acompanhadas de um
        // redirecionamento identificado como recuperação.
        setStatus('ready');
      } catch {
        if (active) {
          setStatus('invalid');
        }
      }
    };

    void checkRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setError('');

    if (status !== 'ready') {
      setError(
        'O link de recuperação não está válido. Solicite um novo link.'
      );
      return;
    }

    if (password.length < 8) {
      setError(
        'A nova senha deve conter pelo menos 8 caracteres.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas informadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !data.session) {
        setStatus('invalid');
        setError(
          'Sua sessão de recuperação expirou. Solicite um novo link.'
        );
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        setError(
          'Não foi possível atualizar a senha. Verifique os requisitos e tente novamente.'
        );
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setStatus('success');

      // Após a troca, o usuário deverá entrar novamente
      // utilizando sua nova senha.
      await supabase.auth.signOut();
    } catch {
      setError(
        'Ocorreu um erro ao redefinir a senha. Tente novamente.'
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

        {status === 'checking' && (
          <div className="space-y-4">
            <ShieldCheck className="h-11 w-11 text-indigo-600" />

            <h1 className="text-2xl font-bold text-neutral-950">
              Validando seu link
            </h1>

            <p className="text-sm text-neutral-500">
              Aguarde enquanto verificamos sua solicitação
              de recuperação de senha.
            </p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-5">
            <ShieldCheck className="h-11 w-11 text-rose-500" />

            <h1 className="text-2xl font-bold text-neutral-950">
              Link inválido ou expirado
            </h1>

            <p className="text-sm leading-relaxed text-neutral-600">
              Não foi possível validar sua solicitação.
              O link pode ter expirado ou já ter sido utilizado.
              Solicite um novo e-mail de recuperação.
            </p>

            <Link
              href="/recuperar-senha"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Solicitar novo link
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-indigo-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />

            <h1 className="text-2xl font-bold text-neutral-950">
              Senha atualizada!
            </h1>

            <p className="text-sm leading-relaxed text-neutral-600">
              Sua nova senha foi cadastrada com sucesso.
              Agora você pode acessar o MirraCRM
              utilizando suas novas credenciais.
            </p>

            <Link
              href="/"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Ir para o login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <>
            <ShieldCheck className="mb-5 h-11 w-11 text-indigo-600" />

            <h1 className="text-2xl font-bold text-neutral-950">
              Criar nova senha
            </h1>

            <p className="mt-2 mb-7 text-sm leading-relaxed text-neutral-500">
              Defina uma nova senha para acessar sua conta
              no MirraCRM.
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
                  htmlFor="new-password"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-500"
                >
                  Nova senha
                </label>

                <div className="relative mt-2">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />

                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Mínimo de 8 caracteres"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-4 text-sm text-neutral-900 outline-none transition-colors focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-500"
                >
                  Confirmar nova senha
                </label>

                <div className="relative mt-2">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />

                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    placeholder="Repita sua nova senha"
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
                  ? 'Atualizando senha...'
                  : 'Salvar nova senha'}

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
