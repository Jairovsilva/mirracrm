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
      
      {/* 🧭 HEADER CLEAN */}
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

      {/* 🚀 CONTEÚDO PRINCIPAL (Grid Simétrico & Espaçado) */}
      <main className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-auto py-12">
        
        {/* Lado Esquerdo: Frase de Impacto e Atração */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
            <Sparkles className="w-3 h-3" /> Padrão Enterprise — Salesforce & HubSpot Style
          </div>
          
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-light text-neutral-950 dark:text-white leading-[1.12] tracking-tight">
            Mova seus negócios sem <span className="font-semibold text-indigo-600 dark:text-indigo-400">trações desnecessárias.</span>
          </h2>
          
          {/* ✨ FRASE DE IMPACTO MOTIVACIONAL PARA ATRAÇÃO */}
          <p className="text-lg text-neutral-500 dark:text-neutral-400 font-normal leading-relaxed max-w-xl">
            Transforme dados frios em relações comerciais previsíveis. O ecossistema dinâmico projetado para dar clareza ao seu funil, maximizar a produtividade do seu time e acelerar suas conversões diárias.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-neutral-300 dark:text-neutral-800" /> Gestão de Leads por Dono
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-neutral-300 dark:text-neutral-800" /> Isolamento Completo de Workspace
            </div>
          </div>
        </div>

        {/* Lado Direito: Formulário Contemporâneo */}
        <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800/80 p-8 rounded-2xl w-full max-w-md justify-self-center lg:justify-self-end shadow-xl shadow-neutral-100/40 dark:shadow-none">
          
          {/* Seletor de Abas Minimalista */}
          <div className="flex border-b border-neutral-100 dark:border-neutral-800 mb-6">
            <button
              type="button"
              onClick={() => { setIsLoginTab(true); setPassword(''); }}
              className={`flex-1 pb-3 text-xs uppercase tracking-wider font-bold transition-all ${isLoginTab ? 'border-b-2 border-indigo-600 text-neutral-950 dark:text-white' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setIsLoginTab(false); setPassword(''); }}
              className={`flex-1 pb-3 text-xs uppercase tracking-wider font-bold transition-all ${!isLoginTab ? 'border-b-2 border-indigo-600 text-neutral-950 dark:text-white' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
            >
              Cadastrar
            </button>
          </div>

          <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-1">
            {isLoginTab ? 'Acesse sua conta' : 'Crie seu workspace'}
          </h3>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6">
            {isLoginTab ? 'Use suas credenciais corporativas' : 'Cadastre sua empresa usando e-mail profissional'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">E-mail Corporativo</label>
              <input
                type="email"
                required
                placeholder="nome@suaempresa.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-black transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Senha</label>
              <div className="relative mt-1.5">
                <input
                  type="password"
                  required
                  minLength={4}
                  placeholder={isLoginTab ? "Digite sua senha" : "Defina uma senha segura"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 pl-10 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-black transition"
                />
                <Lock className="w-4 h-4 text-neutral-400 dark:text-neutral-600 absolute left-3 top-3.5" />
              </div>
            </div>

            <button type="submit" className="w-full h-12 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs uppercase tracking-wider font-bold rounded-xl shadow-md shadow-indigo-100 dark:shadow-none transition flex justify-center items-center gap-2">
              {isLoginTab ? 'Entrar' : 'Concluir Cadastro'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Seção SSO */}
          <div className="text-center text-[10px] text-neutral-400 dark:text-neutral-600 my-5 uppercase tracking-widest font-bold">ou use Single Sign-On</div>
          <div className="grid grid-cols-3 gap-2 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => handleSSOAuth('Google Cloud Identity', 'diretor@suaempresa.com.br')}
              className="p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 flex justify-center items-center gap-1 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
            >
              <Mail className="w-3.5 h-3.5 text-neutral-400" /> Google
            </button>
            <button
              type="button"
              onClick={() => handleSSOAuth('GitHub Enterprise', 'cto@empresa.org')}
              className="p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 flex justify-center items-center gap-1 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
            >
              <Github className="w-3.5 h-3.5 text-neutral-400" /> GitHub
            </button>
            <button
              type="button"
              onClick={() => handleSSOAuth('Azure AD / Microsoft', 'vp@microsoft-office.com')}
              className="p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 flex justify-center items-center gap-1 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
            >
              <Compass className="w-3.5 h-3.5 text-neutral-400" /> Azure
            </button>
          </div>

          <p className="text-[10px] text-center text-neutral-400 dark:text-neutral-500 mt-5 leading-normal">
            * {isLoginTab ? 'O acesso concede visualização imediata ao seu pipeline único.' : 'O primeiro usuário registrado assume o papel de Administrador da Empresa.'}
          </p>
        </div>
      </main>

      {/* 🏁 RODAPÉ DISCRETO */}
      <footer className="text-center text-xs text-neutral-400 dark:text-neutral-600 border-t border-neutral-100 dark:border-neutral-900 pt-5">
        © 2026 CorçaCRM Technologies Inc. — LGPD Enforced
      </footer>
    </div>
  );
}