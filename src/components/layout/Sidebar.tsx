'use client';

import { useState } from 'react';
import { useCRMStore } from '@/src/store/crmStore';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import { FileDown, Users, TrendingUp, DollarSign } from 'lucide-react';

export function ClientesDashboardView() {
  const leads = useCRMStore((s) => s.leads);
  
  // Filtro de leads convertidos
  const clientesAtivos = leads.filter(l => l.propostaAceita);
  
  // Métricas em tempo real
  const totalLeads = leads.length;
  const totalClientes = clientesAtivos.length;
  const taxaConversao = totalLeads > 0 ? ((totalClientes / totalLeads) * 100).toFixed(1) : "0.0";
  const faturamentoTotal = clientesAtivos.reduce((acc, curr) => acc + Number(curr.valorProposta || 0), 0);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Cabeçalho institucional do PDF
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Cor verde-esmeralda
    doc.text("Relatório Executivo de Clientes - MirraCRM", 14, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Exportado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 29, 196, 29);

    // Seção de KPIs
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Desempenho Geral do Funil de Vendas", 14, 40);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`• Total de Oportunidades Triadas: ${totalLeads}`, 14, 48);
    doc.text(`• Total de Negócios Convertidos: ${totalClientes}`, 14, 55);
    doc.text(`• Taxa de Conversão Final: ${taxaConversao}%`, 14, 62);
    doc.text(`• Receita sob Contratos Ativos: R$ ${faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 69);

    // Tabela de Carteira Ativa
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Relação de Clientes Convertidos", 14, 85);

    let y = 95;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Empresa", 14, y);
    doc.text("Contato Principal", 75, y);
    doc.text("Valor Contrato", 140, y);
    doc.text("Status", 180, y);
    
    doc.setDrawColor(203, 213, 225);
    doc.line(14, y + 2, 196, y + 2);

    y += 8;
    doc.setFont("helvetica", "normal");
    clientesAtivos.forEach((cliente) => {
      if (y > 270) { 
        doc.addPage(); 
        y = 20; 
      }
      doc.text(cliente.nomeEmpresa.substring(0, 30), 14, y);
      doc.text(cliente.nome.substring(0, 30), 75, y);
      doc.text(`R$ ${Number(cliente.valorProposta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, y);
      doc.text("Ativo", 180, y);
      y += 8;
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Relatório de auditoria interna. Confidencial.", 14, 285);

    doc.save(`MirraCRM-Relatorio-Clientes.pdf`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Top Header com Ação de Download */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">💼 Carteira de Clientes</h1>
          <p className="text-sm text-muted-foreground">Monitore os negócios fechados e gere relatórios para a diretoria</p>
        </div>
        <Button
          onClick={handleExportPDF}
          className="bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100 h-10 px-4 rounded-xl flex items-center gap-2 font-semibold self-start"
        >
          <FileDown className="w-4 h-4" />
          Exportar Relatório PDF
        </Button>
      </div>

      {/* Grid de Cards de Indicadores Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Clientes Ativos</p>
            <h3 className="text-xl font-bold">{totalClientes}</h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Faturamento Contratado</p>
            <h3 className="text-xl font-bold">
              R$ {faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Taxa de Conversão</p>
            <h3 className="text-xl font-bold">{taxaConversao}%</h3>
          </div>
        </div>
      </div>

      {/* Tabela de Dados */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/40 text-muted-foreground text-xs font-semibold border-b border-border">
                <th className="p-4">Empresa</th>
                <th className="p-4">Contato Principal</th>
                <th className="p-4">Valor da Proposta</th>
                <th className="p-4">Documento / Proposta</th>
              </tr>
            </thead>
            <tbody>
              {clientesAtivos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                    Nenhum cliente fechado encontrado no funil até o momento.
                  </td>
                </tr>
              ) : (
                clientesAtivos.map((cliente) => (
                  <tr key={cliente.id} className="border-b border-border hover:bg-secondary/10 transition-colors text-sm">
                    <td className="p-4 font-semibold text-foreground">{cliente.nomeEmpresa}</td>
                    <td className="p-4 text-muted-foreground">{cliente.nome} ({cliente.cargo || 'Responsável'})</td>
                    <td className="p-4 text-emerald-600 dark:text-emerald-400 font-bold">
                      R$ {Number(cliente.valorProposta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      {cliente.arquivoPropostaUrl ? (
                        <a
                          href={cliente.arquivoPropostaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-600 font-semibold underline inline-flex items-center gap-1"
                        >
                          Ver Proposta Comercial 🔗
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sem documento anexo</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}