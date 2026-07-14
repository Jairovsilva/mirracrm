'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Mail, Lock, User, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useCRMStore } from '@/src/store/crmStore';
import { supabase } from '@/src/lib/supabaseClient';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const register = useCRMStore((s) => s.register);
  const login = useCRMStore((s) => s.login);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = '/app';
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || (!isLogin && !name)) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um endereço de e-mail válido.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const result = await login(email, password);
        if (result.ok) {
          window.location.href = '/app';
        } else {
          setError(result.error || 'Credenciais incorretas.');
        }
      } else {
        const result = await register(email, password, name);
        if (result.ok) {
          window.location.href = '/app';
        } else {
          setError(result.error || 'Erro ao cadastrar.');
        }
      }
    } catch {
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans antialiased flex flex-col justify-between">

      {/* HEADER */}
      <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <Image
            src="/mirra-logo.png"
            alt="MirraCRM"
            width={32}
            height={32}
            className="rounded-lg shadow-sm"
          />
          <span className="font-bold text-lg tracking-tight text-neutral-950">
            Mirra<span className="font-normal text-indigo-600">CRM</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`text-sm font-medium transition-colors ${isLogin ? 'text-indigo-600' : 'text-neutral-500 hover:text-neutral-950'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className="text-sm font-medium bg-neutral-950 hover:bg-neutral-800 text-white px-5 py-2.5 rounded-full transition-all shadow-sm"
          >
            Teste Grátis
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-12">

        {/* LEFT */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
            <Sparkles className="w-3 h-3" /> White Label — Inteligência de Vendas B2B
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-neutral-950 tracking-tight leading-[1.15]">
            A Inteligência Artificial faz a análise. <br />
            <span className="font-semibold text-indigo-600">Sua equipe toma as melhores decisões.</span> <br />
            O resultado aparece no faturamento.
          </h1>

          <p className="text-lg text-neutral-500 font-normal leading-relaxed max-w-xl">
            Conecte equipes com clientes e leads. Combine inteligência, atendimento humano e um CRM que organiza seu fluxo comercial. Uma tecnologia robusta desenhada para sustentar o crescimento do seu negócio.
          </p>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-5 w-full max-w-md bg-white border border-neutral-200/70 p-8 rounded-3xl justify-self-center lg:justify-self-end shadow-xl shadow-neutral-100/60">

          <div className="text-left space-y-2 mb-6">
            <h3 className="text-xl font-bold text-neutral-950 tracking-tight">
              {isLogin ? 'Mirra CRM Workspace' : 'Cadastre sua Empresa'}
            </h3>
            <p className="text-xs text-neutral-400">
              {isLogin ? 'Insira suas credenciais de acesso' : 'Crie sua conta e comece agora mesmo'}
            </p>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Nome Completo</label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Endereço de E-mail</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu-email@provedor.com"
                  className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Senha de Segurança</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******"
                  className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm py-3.5 px-4 rounded-full shadow-lg shadow-indigo-100 transition-all mt-6"
            >
              {loading ? 'Aguarde...' : (isLogin ? 'Entrar no Painel' : 'Finalizar Cadastro')}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="text-center pt-5 border-t border-neutral-100 mt-5">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-xs text-neutral-500 hover:text-indigo-600 transition-colors"
            >
              {isLogin ? 'Não possui uma conta? Cadastre-se' : 'Já possui uma conta? Faça o Login'}
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="text-center py-6 border-t border-neutral-100 text-xs text-neutral-400">
        © 2026 MirraCRM Technologies Inc. — Enterprise Standard & LGPD Enforced
      </footer>
    </div>
  );
}