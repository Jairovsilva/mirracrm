'use client';

import { useState, useRef, useEffect } from 'react';
import { useCRMStore } from '@/src/store/crmStore';
import { MessageCircle, X, Send, Bot, ChevronDown } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_CONTEXT = `Você é o assistente de IA do CRM B2B. Ajude o usuário com dúvidas sobre gestão de leads, pipeline de vendas, estratégias de prospecção, qualificação de leads, follow-up, negociações B2B e uso do CRM. Responda sempre em português, de forma concisa e prática. Não invente dados do CRM do usuário — apenas oriente com boas práticas.`;

function getLocalResponse(message: string, leads: { length: number }): string {
  const m = message.toLowerCase();

  if (m.includes('quantos lead') || m.includes('total de lead')) {
    return `Você tem atualmente **${leads.length} leads** no seu pipeline. Quer dicas de como avançá-los para as próximas etapas?`;
  }
  if (m.includes('follow') || m.includes('acompanhamento') || m.includes('follow-up')) {
    return `**Boas práticas de follow-up B2B:**\n\n• Contate dentro de 24h após o primeiro interesse\n• Use cadências de 5-7 tentativas antes de desqualificar\n• Varie o canal: e-mail → LinkedIn → telefone\n• Personalize cada mensagem com contexto do lead\n• Registre sempre a atividade no CRM para não perder histórico`;
  }
  if (m.includes('qualific') || m.includes('bant') || m.includes('temperatura')) {
    return `**Qualificação BANT para B2B:**\n\n• **Budget** — O lead tem orçamento aprovado?\n• **Authority** — Você fala com o decisor?\n• **Need** — Existe dor real e urgência?\n• **Timeline** — Qual o prazo de decisão?\n\nNo seu CRM use **Quente** para leads BANT completo, **Morno** para parcial e **Frio** para leads que ainda precisam de nurturing.`;
  }
  if (m.includes('proposta') || m.includes('valor') || m.includes('precificação')) {
    return `**Dicas para propostas B2B eficazes:**\n\n• Envie a proposta em até 24h após a reunião, quando a dor ainda está fresca\n• Personalize com os dados exatos do cliente (use o campo CNPJ/Empresa do CRM)\n• Apresente 3 opções de preço (âncora alta, ideal, mínimo)\n• Defina prazo de validade para criar urgência\n• Faça follow-up 48h após o envio`;
  }
  if (m.includes('kanban') || m.includes('pipeline') || m.includes('funil') || m.includes('etapa')) {
    return `**Etapas do seu pipeline:**\n\n• **Entrada** — Leads novos para validar\n• **Enriquecer** — Coletar mais dados e qualificar\n• **Reunião** — Agendado ou em negociação\n• **Fim de Cadência** — Convertidos ou descartados\n\nArraste os cards entre as colunas para mover leads. Clique em qualquer card para ver o histórico completo.`;
  }
  if (m.includes('importar') || m.includes('excel') || m.includes('planilha')) {
    return `**Importação de leads via Excel:**\n\nNo Funil de Vendas, clique em **Importar Lista Excel**. A planilha deve ter colunas como:\n• \`nome\` ou \`contato\`\n• \`empresa\` ou \`razao_social\`\n• \`email\`\n• \`cargo\`\n• \`telefone\`\n• \`linkedin\`\n• \`cnpj\`\n\nOs leads entram automaticamente na etapa **Entrada**.`;
  }
  if (m.includes('olá') || m.includes('oi') || m.includes('bom dia') || m.includes('boa tarde') || m.includes('boa noite') || m.includes('ola')) {
    return `Olá! Sou o assistente de IA do seu CRM B2B. Posso ajudar com:\n\n• Estratégias de prospecção e qualificação\n• Dicas de follow-up e cadência\n• Como usar as funcionalidades do CRM\n• Análise do seu pipeline\n• Melhores práticas de vendas B2B\n\nO que você precisa?`;
  }
  if (m.includes('obrigad') || m.includes('valeu') || m.includes('thanks')) {
    return `Disponha! Se precisar de mais orientações sobre seu pipeline ou estratégias de vendas, é só perguntar.`;
  }

  return `Entendi sua pergunta sobre **"${message}"**. Posso ajudar com estratégias de vendas B2B, qualificação de leads, uso do CRM e follow-up. Poderia reformular com mais detalhes para eu te dar uma resposta mais precisa?`;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou seu assistente de IA. Pergunte sobre estratégias de vendas, qualificação de leads ou como usar o CRM.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = useCRMStore((s) => s.theme);
  const leads = useCRMStore((s) => s.getCompanyLeads());

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));

    const reply = getLocalResponse(text, leads);
    setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    setIsTyping(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: bold }} />
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  const isDark = theme === 'dark';

  return (
    <>
      {/* Chat window */}
      {isOpen && (
        <div
          className={`fixed bottom-24 right-5 z-50 flex flex-col rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 ${
            isDark
              ? 'bg-slate-900 border-slate-700'
              : 'bg-white border-slate-200'
          }`}
          style={{ width: 360, height: 500 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Assistente IA</p>
                <p className="text-[10px] text-indigo-200">CRM B2B — sempre disponível</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : isDark
                        ? 'bg-slate-800 text-slate-200 rounded-tl-sm'
                        : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}
                >
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`flex items-center gap-2 px-3 py-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte sobre vendas B2B..."
              className={`flex-1 text-xs rounded-xl px-3 py-2.5 outline-none border transition-colors ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500'
                  : 'bg-slate-100 border-transparent text-slate-900 placeholder-slate-400 focus:border-indigo-400'
              }`}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isTyping}
              className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-500/40 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        title="Assistente IA"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
        )}
      </button>
    </>
  );
}
