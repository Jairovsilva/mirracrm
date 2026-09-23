'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';

const benefits = [
  '13 dias para experimentar',
  'Implantação simples',
  'Gestão comercial centralizada',
];

const features = [
  {
    icon: Target,
    title: 'Funil de vendas',
    description:
      'Acompanhe cada oportunidade, organize suas etapas comerciais e saiba exatamente onde cada negociação está.',
  },
  {
    icon: Users,
    title: 'Leads centralizados',
    description:
      'Mantenha seus contatos e oportunidades organizados em um único ambiente para sua equipe comercial.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp integrado',
    description:
      'Conecte conversas à operação comercial e distribua atendimentos sem separar comunicação e CRM.',
  },
  {
    icon: BarChart3,
    title: 'Visão de resultados',
    description:
      'Acompanhe pipeline, reuniões, leads e indicadores para entender o que está acontecendo na operação.',
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [annual, setAnnual] = useState(false);

  const basicPrice = annual
    ? 'R$ 5.389,20'
    : 'R$ 499';

  const proPrice = annual
    ? 'R$ 16.167,60'
    : 'R$ 1.497';

  /*
   * Esta informação viaja para /cadastro.
   *
   * Exemplos:
   *
   * /cadastro?plan=basic&cycle=monthly
   * /cadastro?plan=basic&cycle=annual
   * /cadastro?plan=pro&cycle=monthly
   * /cadastro?plan=pro&cycle=annual
   */
  const billingCycle = annual
    ? 'annual'
    : 'monthly';

  return (
    <main className="min-h-screen overflow-hidden bg-[#050d1a] text-white selection:bg-sky-400 selection:text-[#04101d]">
      {/* ==================================================
          HEADER
      ================================================== */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#050d1a]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <Image
              src="/mirra-logo.png"
              alt="MirraCRM"
              width={38}
              height={38}
              className="rounded-xl"
              priority
            />

            <span className="text-xl font-bold tracking-[-0.03em]">
              Mirra
              <span className="text-sky-400">
                CRM
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            <a
              href="#produto"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Produto
            </a>

            <a
              href="#recursos"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Recursos
            </a>

            <a
              href="#whatsapp"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              WhatsApp
            </a>

            <a
              href="#planos"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Preços
            </a>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/login"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
            >
              Entrar
            </Link>

            <a
              href="#planos"
              className="flex items-center gap-2 rounded-xl bg-sky-400 px-5 py-2.5 text-sm font-bold text-[#04101d] transition hover:bg-sky-300"
            >
              Começar grátis
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <button
            type="button"
            aria-label={
              menuOpen
                ? 'Fechar menu'
                : 'Abrir menu'
            }
            aria-expanded={menuOpen}
            onClick={() =>
              setMenuOpen(!menuOpen)
            }
            className="rounded-lg border border-white/10 p-2 text-white lg:hidden"
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* MENU MOBILE */}
        {menuOpen && (
          <div className="border-t border-white/10 bg-[#07101f] px-6 py-6 lg:hidden">
            <div className="flex flex-col gap-5">
              <a
                href="#produto"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                Produto
              </a>

              <a
                href="#recursos"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                Recursos
              </a>

              <a
                href="#whatsapp"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                WhatsApp
              </a>

              <a
                href="#planos"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                Preços
              </a>

              <div className="h-px bg-white/10" />

              <Link
                href="/login"
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                Entrar
              </Link>

              <a
                href="#planos"
                onClick={() =>
                  setMenuOpen(false)
                }
                className="rounded-xl bg-sky-400 px-5 py-3 text-center font-bold text-[#04101d]"
              >
                Começar 13 dias grátis
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ==================================================
          HERO
      ================================================== */}
      <section className="relative pt-[150px]">
        <div className="pointer-events-none absolute left-1/2 top-[-250px] h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-sky-500/[0.10] blur-[130px]" />

        <div className="relative mx-auto max-w-7xl px-6 text-center lg:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/[0.08] px-4 py-2 text-xs font-semibold text-sky-300">
            <Sparkles className="h-3.5 w-3.5" />
            Sua operação comercial em um só lugar
          </div>

          <h1 className="mx-auto mt-7 max-w-5xl text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-[76px]">
            Transforme oportunidades
            <br className="hidden sm:block" /> em{' '}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              vendas.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Leads, funil, equipe, indicadores e
            conversas conectados em um CRM criado
            para dar clareza à sua operação
            comercial.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#planos"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-7 py-4 text-sm font-bold text-[#04101d] shadow-[0_0_40px_rgba(56,189,248,0.16)] transition hover:bg-sky-300 sm:w-auto"
            >
              Começar 13 dias grátis
              <ArrowRight className="h-4 w-4" />
            </a>

            <a
              href="#produto"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/[0.08] sm:w-auto"
            >
              Conhecer o MirraCRM
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="flex items-center gap-2 text-xs text-slate-400"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                {benefit}
              </div>
            ))}
          </div>

          {/* DASHBOARD REAL */}
          <div className="relative mx-auto mt-16 max-w-6xl">
            <div className="absolute -inset-8 rounded-[50px] bg-sky-500/[0.08] blur-3xl" />

            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#0a1425] p-1.5 shadow-[0_35px_100px_rgba(0,0,0,0.55)]">
              <div className="flex h-9 items-center gap-1.5 border-b border-white/[0.06] px-4">
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />

                <span className="ml-3 text-[10px] text-slate-600">
                  MirraCRM
                </span>
              </div>

              <Image
                src="/mirra-dashboard.png"
                alt="Dashboard comercial do MirraCRM"
                width={1900}
                height={810}
                priority
                className="h-auto w-full rounded-b-[20px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          PRODUTO
      ================================================== */}
      <section
        id="produto"
        className="scroll-mt-24 py-28 sm:py-36"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-400">
                Clareza comercial
              </p>

              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                Uma visão clara de tudo que move suas
                vendas.
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-slate-400">
                Entenda o tamanho do seu pipeline,
                acompanhe leads, reuniões e etapas do
                processo comercial sem depender de
                informações espalhadas.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  'Visão do pipeline comercial',
                  'Acompanhamento de leads',
                  'Indicadores de reuniões',
                  'Distribuição por temperatura',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm text-slate-300"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/10">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </span>

                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-10 bg-blue-500/10 blur-[80px]" />

              <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#0b1628] p-2 shadow-2xl">
                <Image
                  src="/mirra-dashboard.png"
                  alt="Indicadores comerciais do MirraCRM"
                  width={1900}
                  height={810}
                  className="h-auto w-full rounded-[20px]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          RECURSOS
      ================================================== */}
      <section
        id="recursos"
        className="scroll-mt-24 border-y border-white/[0.06] bg-white/[0.018] py-28"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-400">
              Um CRM para vender
            </p>

            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Do primeiro contato ao fechamento.
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-400">
              Centralize as partes essenciais da
              operação para que sua equipe enxergue
              oportunidades e avance negociações com
              mais organização.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group rounded-[24px] border border-white/[0.08] bg-[#091425] p-7 transition duration-300 hover:-translate-y-1 hover:border-sky-400/20"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10 text-sky-400">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-6 text-lg font-semibold">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================================================
          WHATSAPP
      ================================================== */}
      <section
        id="whatsapp"
        className="scroll-mt-24 py-28 sm:py-36"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-[1.25fr_0.75fr] lg:px-8">
          <div className="relative order-2 lg:order-1">
            <div className="absolute inset-10 bg-cyan-400/[0.08] blur-[90px]" />

            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#0b1628] p-2 shadow-2xl">
              <Image
                src="/mirra-whatsapp.png"
                alt="Central de WhatsApp integrada ao MirraCRM"
                width={1900}
                height={810}
                className="h-auto w-full rounded-[20px]"
              />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400">
              <MessageCircle className="h-6 w-6" />
            </div>

            <p className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-emerald-400">
              Conversas conectadas
            </p>

            <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              WhatsApp e CRM trabalhando juntos.
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-400">
              Acompanhe conversas comerciais no mesmo
              ambiente dos seus leads e distribua o
              atendimento entre responsáveis.
            </p>

            <div className="mt-8 space-y-4">
              {[
                'Conversas comerciais centralizadas',
                'Distribuição de atendimento',
                'Contato conectado ao CRM',
                'Visão de conversas não lidas',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <Check className="h-4 w-4 text-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          DIFERENCIAIS
      ================================================== */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="overflow-hidden rounded-[32px] border border-sky-400/10 bg-gradient-to-br from-[#0b1c31] to-[#07101f] p-8 sm:p-12 lg:p-16">
            <div className="grid gap-12 lg:grid-cols-3">
              <div>
                <Zap className="h-6 w-6 text-sky-400" />

                <h3 className="mt-5 text-xl font-semibold">
                  Operação mais organizada
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Leads, oportunidades e atividades
                  comerciais em um ambiente comum.
                </p>
              </div>

              <div>
                <BarChart3 className="h-6 w-6 text-sky-400" />

                <h3 className="mt-5 text-xl font-semibold">
                  Informação para decidir
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Visualize indicadores do processo
                  comercial e acompanhe o pipeline.
                </p>
              </div>

              <div>
                <ShieldCheck className="h-6 w-6 text-sky-400" />

                <h3 className="mt-5 text-xl font-semibold">
                  Controle da equipe
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Organize responsáveis e mantenha
                  maior visibilidade sobre a operação.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          PLANOS
      ================================================== */}
      <section
        id="planos"
        className="scroll-mt-24 py-28 sm:py-36"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-400">
              Planos
            </p>

            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Comece com 13 dias para experimentar.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-400">
              Escolha o plano adequado ao tamanho da
              sua operação comercial.
            </p>

            {/* SELETOR MENSAL / ANUAL */}
            <div className="mx-auto mt-9 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() =>
                  setAnnual(false)
                }
                aria-pressed={!annual}
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                  !annual
                    ? 'bg-white text-[#07101f]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensal
              </button>

              <button
                type="button"
                onClick={() =>
                  setAnnual(true)
                }
                aria-pressed={annual}
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                  annual
                    ? 'bg-white text-[#07101f]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Anual

                <span className="ml-2 text-xs text-emerald-500">
                  -10%
                </span>
              </button>
            </div>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {/* ============================================
                BASIC
            ============================================ */}
            <article className="flex flex-col rounded-[28px] border border-white/10 bg-[#091425] p-8">
              <p className="text-sm font-semibold text-slate-400">
                BASIC
              </p>

              <h3 className="mt-3 text-2xl font-semibold">
                Para operações enxutas
              </h3>

              <div className="mt-8">
                <span className="text-4xl font-semibold tracking-tight">
                  {basicPrice}
                </span>

                <span className="ml-2 text-sm text-slate-500">
                  {annual
                    ? '/ano'
                    : '/mês'}
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-400">
                Até 2 usuários
              </p>

              <div className="my-8 h-px bg-white/10" />

              <div className="flex-1 space-y-4">
                {[
                  'Funil de vendas',
                  'Gestão de leads',
                  'Dashboard comercial',
                  'Gestão de equipe',
                  '13 dias para experimentar',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 text-sm text-slate-300"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />

                    {item}
                  </div>
                ))}
              </div>

              {/* ALTERADO:
                  agora transporta plano + ciclo */}
              <Link
                href={`/cadastro?plan=basic&cycle=${billingCycle}`}
                className="mt-9 flex items-center justify-center rounded-xl border border-white/15 px-5 py-3.5 text-sm font-bold transition hover:bg-white hover:text-[#07101f]"
              >
                Começar 13 dias grátis
              </Link>
            </article>

            {/* ============================================
                PRO
            ============================================ */}
            <article className="relative flex flex-col rounded-[28px] border border-sky-400/40 bg-gradient-to-b from-sky-400/[0.12] to-[#091425] p-8 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
              <div className="absolute right-6 top-6 rounded-full bg-sky-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#04101d]">
                Equipes em crescimento
              </div>

              <p className="text-sm font-semibold text-sky-400">
                PRO
              </p>

              <h3 className="mt-3 max-w-[230px] text-2xl font-semibold">
                Mais espaço para sua equipe
              </h3>

              <div className="mt-8">
                <span className="text-4xl font-semibold tracking-tight">
                  {proPrice}
                </span>

                <span className="ml-2 text-sm text-slate-500">
                  {annual
                    ? '/ano'
                    : '/mês'}
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-400">
                Até 5 usuários
              </p>

              <div className="my-8 h-px bg-white/10" />

              <div className="flex-1 space-y-4">
                {[
                  'Tudo do Basic',
                  'Até 5 usuários',
                  'Operação comercial ampliada',
                  'Gestão de equipe',
                  '13 dias para experimentar',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 text-sm text-slate-300"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />

                    {item}
                  </div>
                ))}
              </div>

              {/* ALTERADO:
                  agora transporta plano + ciclo */}
              <Link
                href={`/cadastro?plan=pro&cycle=${billingCycle}`}
                className="mt-9 flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-5 py-3.5 text-sm font-bold text-[#04101d] transition hover:bg-sky-300"
              >
                Começar 13 dias grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>

            {/* ============================================
                ENTERPRISE
            ============================================ */}
            <article className="flex flex-col rounded-[28px] border border-white/10 bg-[#091425] p-8">
              <p className="text-sm font-semibold text-slate-400">
                ENTERPRISE
              </p>

              <h3 className="mt-3 text-2xl font-semibold">
                Para necessidades específicas
              </h3>

              <div className="mt-8">
                <span className="text-4xl font-semibold tracking-tight">
                  Sob medida
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-400">
                Configuração personalizada
              </p>

              <div className="my-8 h-px bg-white/10" />

              <div className="flex-1 space-y-4">
                {[
                  'Estrutura personalizada',
                  'Quantidade de usuários sob medida',
                  'Necessidades comerciais específicas',
                  'Atendimento comercial',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 text-sm text-slate-300"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />

                    {item}
                  </div>
                ))}
              </div>

              <a
                href="mailto:comercial@mirracrm.com.br"
                className="mt-9 flex items-center justify-center rounded-xl border border-white/15 px-5 py-3.5 text-sm font-bold transition hover:bg-white hover:text-[#07101f]"
              >
                Falar com vendas
              </a>
            </article>
          </div>

          {annual && (
            <p className="mt-7 text-center text-sm text-slate-500">
              Valores anuais já consideram 10% de
              desconto em relação a 12 mensalidades.
            </p>
          )}
        </div>
      </section>

      {/* ==================================================
          CTA FINAL
      ================================================== */}
      <section className="px-6 pb-28 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[36px] border border-sky-400/20 bg-[#0b1d33] px-6 py-20 text-center sm:px-12">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/10 blur-[100px]" />

          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Seu processo comercial merece mais
              clareza.
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-400">
              Conheça o MirraCRM e centralize sua
              operação comercial em um único ambiente.
            </p>

            <a
              href="#planos"
              className="mt-9 inline-flex items-center gap-2 rounded-xl bg-sky-400 px-7 py-4 text-sm font-bold text-[#04101d] transition hover:bg-sky-300"
            >
              Começar meus 13 dias grátis
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ==================================================
          FOOTER
      ================================================== */}
      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/mirra-logo.png"
              alt="MirraCRM"
              width={32}
              height={32}
              className="rounded-lg"
            />

            <span className="font-bold">
              Mirra
              <span className="text-sky-400">
                CRM
              </span>
            </span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
            <a
              href="#produto"
              className="hover:text-white"
            >
              Produto
            </a>

            <a
              href="#recursos"
              className="hover:text-white"
            >
              Recursos
            </a>

            <a
              href="#planos"
              className="hover:text-white"
            >
              Preços
            </a>

            <Link
              href="/login"
              className="hover:text-white"
            >
              Entrar
            </Link>
          </div>

          <p className="text-xs text-slate-600">
            © 2026 MirraCRM.
          </p>
        </div>
      </footer>
    </main>
  );
}
