'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useCRMStore } from '@/src/store/crmStore';
import { Mail, Github, Compass, Lock, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6">
      <header className="flex justify-between items-center max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <Image
            src="/davinci_crie_uma_logomarca_para_o_meu_crm_que_ser__chamado.png"
            alt="CorçaCRM"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="text-xl font-black text-slate-100 tracking-tight">
            Corça<span className="text-indigo-400">CRM</span>
          </span>
        </div>
        <span className="text-xs text-slate-500">Inteligência Comercial B2B</span>
      </header>

      <main className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center my-auto">
        <div className="space-y-6">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            Padrão Enterprise — Salesforce & HubSpot Style
          </span>
          <h2 className="text-5xl font-black mb-4 leading-tight">Mova seus negócios sem trações desnecessárias.</h2>
          <p className="text-sm text-slate-400 max-w-sm">
            Primeiro usuário registrado assume o papel de Administrador da Empresa, herdando permissões para auditar dashboards da equipe de vendas.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-sm w-full justify-self-center md:justify-self-end shadow-2xl">
          <div className="flex border-b border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => { setIsLoginTab(true); setPassword(''); }}
              className={`flex-1 pb-3 text-sm font-bold transition-all ${isLoginTab ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-500 hover:text-slate-400'}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setIsLoginTab(false); setPassword(''); }}
              className={`flex-1 pb-3 text-sm font-bold transition-all ${!isLoginTab ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-500 hover:text-slate-400'}`}
            >
              Cadastrar
            </button>
          </div>

          <h3 className="text-xl font-bold mb-2">
            {isLoginTab ? 'Acesse sua conta' : 'Crie seu workspace'}
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            {isLoginTab ? 'Use suas credenciais corporativas' : 'Cadastre sua empresa usando e-mail profissional'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400">E-mail Corporativo</label>
              <input
                type="email"
                required
                placeholder="nome@suaempresa.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400">Senha</label>
              <div className="relative mt-1">
                <input
                  type="password"
                  required
                  minLength={4}
                  placeholder={isLoginTab ? "Digite sua senha" : "Defina uma senha segura"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 pl-10 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-700 transition flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/20">
              {isLoginTab ? 'Entrar' : 'Concluir Cadastro'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-xs text-slate-600 my-4 uppercase tracking-wider font-semibold">ou use Single Sign-On</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleSSOAuth('Google Cloud Identity', 'diretor@suaempresa.com.br')}
              className="p-2 border border-slate-800 rounded-xl bg-slate-950 flex justify-center items-center gap-1 hover:bg-slate-800 transition"
            >
              <Mail className="w-3.5 h-3.5" /> Google
            </button>
            <button
              type="button"
              onClick={() => handleSSOAuth('GitHub Enterprise', 'cto@empresa.org')}
              className="p-2 border border-slate-800 rounded-xl bg-slate-950 flex justify-center items-center gap-1 hover:bg-slate-800 transition"
            >
              <Github className="w-3.5 h-3.5" /> GitHub
            </button>
            <button
              type="button"
              onClick={() => handleSSOAuth('Azure AD / Microsoft', 'vp@microsoft-office.com')}
              className="p-2 border border-slate-800 rounded-xl bg-slate-950 flex justify-center items-center gap-1 hover:bg-slate-800 transition"
            >
              <Compass className="w-3.5 h-3.5" /> Microsoft
            </button>
          </div>
        </div>
      </main>
      <footer className="text-center text-xs text-slate-600">© 2026 CorçaCRM Technologies Inc. — LGPD Enforced</footer>
    </div>
  );
}
