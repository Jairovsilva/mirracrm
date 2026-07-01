'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Github, Compass, Lock, ArrowRight } from 'lucide-react';

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanEmail = email.trim().toLowerCase();
    const domain = cleanEmail.split('@')[1];
    const invalidDomains = ['gmail.com', 'gmail.com.br', 'hotmail.com', 'outlook.com', 'yahoo.com', 'outlook.com.br'];

    // 1. Validação de Domínio Corporativo
    if (!domain || invalidDomains.includes(domain)) {
      alert("⚠️ Erro: Apenas e-mails corporativos/profissionais são permitidos no CorçaCRM!");
      return;
    }

    if (!isLoginTab) {
      // ---- FLUXO DE CADASTRO ----
      // Salva as credenciais diretamente no LocalStorage do navegador (banco local persistente)
      localStorage.setItem(`user_${cleanEmail}`, password);
      
      // Define qual empresa o usuário pertence com base no e-mail
      localStorage.setItem(`user_company_${cleanEmail}`, domain.split('.')[0].toUpperCase());
      
      alert(`🎉 Cadastro realizado com sucesso!\nEmpresa: ${domain.split('.')[0].toUpperCase()}\n\nAgora você será direcionado para a aba 'Entrar' para testar suas credenciais.`);
      
      // Limpa a senha e joga o usuário para a aba de Login para testar o acesso
      setPassword('');
      setIsLoginTab(true);
    } else {
      // ---- FLUXO DE LOGIN ----
      // Busca a senha cadastrada para este e-mail no LocalStorage
      const savedPassword = localStorage.getItem(`user_${cleanEmail}`);

      if (!savedPassword || savedPassword !== password) {
        alert("❌ Erro: Usuário não encontrado ou senha incorreta!");
        return;
      }

      // Se a senha estiver correta, salva a sessão ativa e libera o acesso ao CRM real
      localStorage.setItem('crm_session_active', cleanEmail);
      router.push('/app');
    }
  };

  // Simulação de SSO Corporativo Integrado
  const handleSSOAuth = (providerName: string, sampleEmail: string) => {
    const userEmail = prompt(`[${providerName} Enterprise] Insira seu e-mail corporativo:`, sampleEmail);
    if (!userEmail) return;

    const cleanEmail = userEmail.trim().toLowerCase();
    const domain = cleanEmail.split('@')[1];
    if (!domain || ['gmail.com', 'hotmail.com', 'yahoo.com'].includes(domain)) {
      alert("Erro: O provedor exige um domínio corporativo válido.");
      return;
    }

    // Registra e autentica automaticamente via Token Simulado
    localStorage.setItem(`user_${cleanEmail}`, 'sso_verified_token_123');
    localStorage.setItem('crm_session_active', cleanEmail);
    router.push('/app');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 font-sans">
      <header className="flex justify-between items-center max-w-5xl w-full mx-auto">
        <div className="text-xl font-black text-indigo-500 tracking-wider flex items-center gap-2">
          <span>🐆 CORÇA.CRM</span>
        </div>
        <span className="text-xs text-slate-500 font-semibold tracking-wider">Inteligência Comercial B2B</span>
      </header>

      <main className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center my-auto">
        <div className="space-y-6">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            Padrão Enterprise — Sistema Homologado
          </span>
          <h2 className="text-5xl font-black mb-4 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Mova seus negócios sem trações desnecessárias.
          </h2>
          <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
            Sua conta corporativa agora é salva localmente. Cadastre seu e-mail da empresa e acesse o painel instantaneamente.
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

          <h3 className="text-xl font-bold mb-1">{isLoginTab ? 'Acesse sua conta' : 'Crie seu workspace'}</h3>
          <p className="text-xs text-slate-400 mb-6">{isLoginTab ? 'Insira seus dados salvos' : 'Registre-se usando e-mail profissional'}</p>

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
                  placeholder="Sua senha de acesso" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full p-3 pl-10 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 transition" 
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-700 transition flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/20">
              {isLoginTab ? 'Entrar no Sistema' : 'Concluir Cadastro'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-xs text-slate-600 my-4 uppercase tracking-wider font-semibold">ou conecte via</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button type="button" onClick={() => handleSSOAuth('Google', 'diretor@suaempresa.com.br')} className="p-2 border border-slate-800 rounded-xl bg-slate-950 flex justify-center items-center gap-1 hover:bg-slate-800 transition"><Mail className="w-3.5 h-3.5" /> Google</button>
            <button type="button" onClick={() => handleSSOAuth('GitHub', 'cto@empresa.org')} className="p-2 border border-slate-800 rounded-xl bg-slate-950 flex justify-center items-center gap-1 hover:bg-slate-800 transition"><Github className="w-3.5 h-3.5" /> GitHub</button>
            <button type="button" onClick={() => handleSSOAuth('Microsoft', 'vp@office.com')} className="p-2 border border-slate-800 rounded-xl bg-slate-950 flex justify-center items-center gap-1 hover:bg-slate-800 transition"><Compass className="w-3.5 h-3.5" /> Microsoft</button>
          </div>
        </div>
      </main>
      <footer className="text-center text-xs text-slate-600">© 2026 CorçaCRM Technologies Inc. — LGPD Enforced</footer>
    </div>
  );
}
