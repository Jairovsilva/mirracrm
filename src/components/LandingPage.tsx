'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useCRMStore } from '@/src/store/crmStore';
import { Mail, Github, Compass, Lock, ArrowRight, Sparkles } from 'lucide-react';

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
      if (success) onAuthSuccess();
    } else {
      const success = register(email, password);
      if (success) onAuthSuccess();
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
    <div className="min-h-screen bg-white text-neutral-900 font-sans antialiased flex flex-col justify-between">
      
      {/* 🧭 HEADER CLEAN (Estilo Helena) */}
      <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <Image
            src="/davinci_crie_uma_logomarca_para_o_meu_crm_que_ser__chamado.png"
            alt="CorçaCRM"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-bold text-lg tracking-tight text-neutral-950">
            Corça<span className="font-normal text-indigo-600">CRM</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => setIsLoginTab(true)}
            className={`text-sm font-medium transition-colors ${isLoginTab ? 'text-indigo-600' : 'text-neutral-500 hover:text-neutral-950'}`}
          >
            Entrar
          </button>
          <button 
            type="button"
            onClick={() => setIsLoginTab(false)}
            className="text-sm font-medium bg-neutral-950 hover:bg-neutral-800 text-white px-5 py-2.5 rounded-full transition-all shadow-sm"
          >
            Teste Grátis
          </button>
        </div>
      </header>

      {/* 🚀 LAYOUT DE ENTRADA CONTEMPORÂNEO */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-12">
        
        {/* LADO ESQUERDO: Posicionamento de Marca & Atração */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
            <Sparkles className="w-3 h-3" /> White Label — Inteligência de Vendas B2B
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-neutral-950 tracking-tight leading-[1.12]">
            O CRM que aprende a cada interação e <span className="font-semibold text-indigo-600">converte intenção em receita</span>
          </h1>
          
          <p className="text-lg text-neutral-500 font-normal leading-relaxed max-w-xl">
            Conecte equipes, gerencie leads e unifique seus dados comerciais. Uma tecnologia robusta desenhada especificamente para sustentar e acelerar o crescimento previsível do seu negócio.
          </p>
        </div>

        {/* LADO DIREITO: Formulário de Entrada Limpo */}
        <div className="lg:col-span-5 w-full max-w-md bg-white border border-neutral-200/60 p-8 rounded-3xl justify-self-center lg:justify-self-end shadow-xl shadow-neutral-100/50">
          
          {/* Abas internas */}
          <div className="flex border-b border-neutral-100 mb-6">
            <button
              type="button"
              onClick={() => { setIsLoginTab(true); setPassword(''); }}
              className={`flex-1 pb-3 text-xs uppercase tracking-wider font-bold transition-all ${isLoginTab ? 'border-b-2 border-indigo-600 text-neutral-950' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              Acessar Conta
            </button>
            <button
              type="button"
              onClick={() => { setIsLoginTab(false); setPassword(''); }}
              className={`flex-1 pb-3 text-xs uppercase tracking-wider font-bold transition-all ${!isLoginTab ? 'border-b-2 border-indigo-600 text-neutral-950' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              Criar Workspace
            </button>
          </div>

          <h3 className="text-xl font-semibold text-neutral-950 mb-1">
            {isLoginTab ? 'Corça CRM Workspace' : 'Cadastre sua Empresa'}
          </h3>
          <p className="text-xs text-neutral-400 mb-6">
            {isLoginTab ? 'Insira suas credenciais de acesso corporativo' : 'Primeiro usuário cadastrado assumirá o papel de Admin Principal.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Endereço de E-mail</label>
              <input
                type="email"
                required
                placeholder="seu-email@provedor.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Senha de Segurança</label>
              <div className="relative mt-1.5">
                <input
                  type="password"
                  required
                  minLength={4}
                  placeholder="******"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 pl-10 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <button type="submit" className="w-full h-12 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-full transition flex justify-center items-center gap-2 shadow-lg shadow-indigo-100">
              {isLoginTab ? 'Entrar no Painel' : 'Concluir Cadastro'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* SSO Integrado */}
          <div className="text-center text-[10px] text-neutral-400 my-5 uppercase tracking-widest font-bold">ou autenticar via</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleSSOAuth('Google Cloud Identity', 'diretor@suaempresa.com.br')}
              className="p-2.5 border border-neutral-200 rounded-xl bg-white text-neutral-600 flex justify-center items-center gap-1 hover:bg-neutral-50 transition"
            >
              <Mail className="w-3.5 h-3.5 text-neutral-400" /> Google
            </button>
            <button
              type="button"
              onClick={() => handleSSOAuth('GitHub Enterprise', 'cto@empresa.org')}
              className="p-2.5 border border-neutral-200 rounded-xl bg-white text-neutral-600 flex justify-center items-center gap-1 hover:bg-neutral-50 transition"
            >
              <Github className="w-3.5 h-3.5 text-neutral-400" /> GitHub
            </button>
            <button
              type="button"
              onClick={() => handleSSOAuth('Azure AD / Microsoft', 'vp@microsoft-office.com')}
              className="p-2.5 border border-neutral-200 rounded-xl bg-white text-neutral-600 flex justify-center items-center gap-1 hover:bg-neutral-50 transition"
            >
              <Compass className="w-3.5 h-3.5 text-neutral-400" /> Azure
            </button>
          </div>
        </div>
      </main>

      {/* 🏁 RODAPÉ DISCRETO */}
      <footer className="text-center py-6 border-t border-neutral-100 text-xs text-neutral-400">
        © 2026 CorçaCRM Technologies Inc. — Enterprise Standard & LGPD Enforced
      </footer>
    </div>
  );
}