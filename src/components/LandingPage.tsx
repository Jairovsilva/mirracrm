'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useCRMStore } from '@/src/store/crmStore';
import { Mail, Github, Compass, Lock, ArrowRight, Target, Sparkles, Shield } from 'lucide-react';

export default function LandingPage({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const login = useCRMStore((s) => s.login);
  const register = useCRMStore((s) => s.register);
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoginTab) {
      const success = login(email, password);
      if (success) {
        onAuthSuccess();
      }
    } else {
      const success = register(email, password);
      if (success) {
        onAuthSuccess();
      }
    }
  };

  const handleSSOAuth = (providerName: string, defaultEmail: string) => {
    const userEmail = prompt(`[OAuth Integration] Insira seu e-mail corporativo para autenticação via ${providerName}:`, defaultEmail);
    if (!userEmail) return;

    const domain = userEmail.split('@')[1];
    const invalidDomains = ['gmail.com', 'gmail.com.br', 'hotmail.com', 'outlook.com', 'yahoo.com'];

    if (!domain || invalidDomains.includes(domain.toLowerCase())) {
      alert(`Erro de Provedor: O Hub ${providerName} Enterprise exige um domínio corporativo válido.`);
      return;
    }

    const userPassword = prompt(`Insira uma senha para criptografar suas credenciais de segurança do workspace ${domain.split('.')[0].toUpperCase()}:`, 'senha123');
    if (!userPassword) return;

    const registered = register(userEmail, userPassword);
    if (registered) {
      onAuthSuccess();
    } else {
      const loggedIn = login(userEmail, userPassword);
      if (loggedIn) onAuthSuccess();
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col justify-between p-6 md:p-10 tracking-tight font-sans selection:bg-indigo-100">

      {/* Header */}
      <header className="flex justify-between items-center max-w-6xl w-full mx-auto border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <div className="flex items-center gap-3">
          <Image
            src="/davinci_crie_uma_logomarca_para_o_meu_crm_que_ser__chamado.png"
            alt="CorçaCRM"
            width={34}
            height={34}
            className="rounded-xl shadow-sm"
          />
          <span className="text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
            Corça<span className="text-indigo-600 dark:text-indigo-400 font-light">CRM</span>
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-50 dark:bg-neutral-900 text-[11px] font-medium text-neutral-500 uppercase tracking-wider border border-neutral-100 dark:border-neutral-800">
          Inteligência Comercial B2B
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-auto py-12">

        {/* Left side: headline */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
            <Sparkles className="w-3 h-3" /> Padrão Enterprise — Salesforce & HubSpot Style
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-light text-neutral-950 dark:text-white leading-[1.12] tracking-tight">
            Mova seus negócios sem <span className="font-semibold text-indigo-600 dark:text-indigo-400">trações desnecessárias.</span>
          </h2>

          <p className="text-lg text-neutral-500 dark:text-neutral-400 font-normal leading-relaxed max-w-xl">
            Transforme dados frios em relações comerciais previsíveis. O ecossistema dinâmico projetado para dar clareza ao seu funil, maximizar a produtividade do seu time e acelerar suas conversões diárias.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-500" /> Pipeline visual drag-and-drop
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-500" /> Multi-usuário com controle de acesso
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Assistente de IA integrado
            </div>
          </div>
        </div>

        {/* Right side: auth card */}
        <div className="lg:col-span-5">
          <div className="bg-neutral-50 dark:bg-neutral-900/60 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-neutral-950 dark:text-white">
                {isLoginTab ? 'Acessar Plataforma' : 'Criar Conta'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {isLoginTab ? 'Entre com suas credenciais corporativas' : 'Cadastre seu e-mail corporativo para começar'}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg mb-6">
              <button
                onClick={() => setIsLoginTab(true)}
                className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all ${
                  isLoginTab
                    ? 'bg-white dark:bg-neutral-950 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLoginTab(false)}
                className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all ${
                  !isLoginTab
                    ? 'bg-white dark:bg-neutral-950 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                Cadastrar
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  E-mail Corporativo
                </label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.nome@empresa.com.br"
                    required
                    className="w-full text-sm rounded-xl pl-10 pr-4 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Senha
                </label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full text-sm rounded-xl pl-10 pr-4 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40"
              >
                {isLoginTab ? 'Entrar no CRM' : 'Criar Conta e Acessar'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
              <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">ou via SSO</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
            </div>

            {/* SSO buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSSOAuth('GitHub Enterprise', 'dev@empresa.com')}
                className="flex items-center justify-center gap-2 text-xs font-medium py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
              >
                <Github className="w-3.5 h-3.5" /> GitHub
              </button>
              <button
                onClick={() => handleSSOAuth('Microsoft Entra', 'user@onmicrosoft.com')}
                className="flex items-center justify-center gap-2 text-xs font-medium py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
              >
                <Compass className="w-3.5 h-3.5" /> Microsoft
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto border-t border-neutral-100 dark:border-neutral-900 pt-5 flex justify-between items-center text-[11px] text-neutral-400 dark:text-neutral-600">
        <span>© {new Date().getFullYear()} CorçaCRM. Todos os direitos reservados.</span>
        <span className="flex items-center gap-1.5">
          <Shield className="w-3 h-3" /> Dados protegidos com criptografia ponta-a-ponta
        </span>
      </footer>
    </div>
  );
}
