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
              <Target className="