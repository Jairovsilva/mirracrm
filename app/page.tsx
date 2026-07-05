'use client';
import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('crm_session_active');
      if (session) {
        window.location.href = '/app';
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
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

    const cleanEmail = email.toLowerCase().trim();

    if (!isLogin) {
      // 🔐 CADASTRO ISOLADO: Salva as credenciais usando o email na chave para não sobrescrever outros usuários
      localStorage.setItem(`crm_pwd_${cleanEmail}`, password);
      localStorage.setItem(`crm_name_${cleanEmail}`, name);
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsLogin(true);
      }, 1500);
    } else {
      // 🔑 LOGIC DE LOGIN MULTI-USUÁRIO
      const savedPassword = localStorage.getItem(`crm_pwd_${cleanEmail}`);
      const savedName = localStorage.getItem(`crm_name_${cleanEmail}`) || cleanEmail.split('@')[0];

      // Caso o usuário já exista no localStorage ou seja um acesso administrativo/direto aceito
      if (savedPassword === password || cleanEmail.includes('ainglob') || cleanEmail === 'lucasdinho@gmail.com') {
        
        if (typeof window !== 'undefined') {
          // 🚨 LIMPEZA ABSOLUTA DE SESSÕES ANTERIORES (Evita o perfil ghost do Jairo)
          localStorage.removeItem('crm_session_active');
          localStorage.removeItem('crm_current_user');
          localStorage.removeItem('user_email');
          localStorage.removeItem('email');
          localStorage.removeItem('user');

          // 🏁 SINCRONIZAÇÃO DE CHAVES: Garante que tanto o Kanban quanto a Sidebar leiam o mesmo e-mail
          localStorage.setItem('crm_session_active', 'true');
          localStorage.setItem('crm_current_user', cleanEmail);
          localStorage.setItem('user_email', cleanEmail);
          localStorage.setItem('email', cleanEmail);
          localStorage.setItem('user', JSON.stringify({ email: cleanEmail, name: savedName }));
        }
        
        window.location.href = '/app';
      } else {
        setError('Credenciais incorretas. Verifique seu e-mail e senha.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-600/10 rounded-2xl text-indigo-400 border border-indigo-500/20 mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Corça CRM Workspace</h1>
          <p className="text-xs text-slate-400">
            {isLogin ? 'Insira suas credenciais de acesso' : 'Crie sua conta e comece agora mesmo'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Conta criada com sucesso! Redirecionando...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Endereço de E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@provedor.com"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Senha de Segurança</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/10 transition-all mt-6"
          >
            {isLogin ? 'Entrar no Painel' : 'Finalizar Cadastro'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
          >
            {isLogin ? 'Não possui uma conta? Cadastre-se' : 'Já possui uma conta? Faça o Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
