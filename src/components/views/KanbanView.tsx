'use client';
import React, { useRef, useState } from 'react';
import { useCRMStore, type Stage } from '@/src/store/crmStore';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function KanbanView() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { leads, addLead, theme } = useCRMStore();
  const [isProcessing, setIsProcessing] = useState(false);

  // Interpretador Inteligente para ler a planilha Excel
  const mapRowToLead = (row: any) => {
    const keys = Object.keys(row);
    
    const findValue = (possibleNames: string[]) => {
      const foundKey = keys.find(k => 
        possibleNames.some(name => k.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === name)
      );
      return foundKey ? String(row[foundKey]).trim() : '';
    };

    const name = findValue(['nome', 'contato', 'lead', 'clientename']);
    const company = findValue(['empresa', 'razaosocial', 'companhia', 'organization']);
    const email = findValue(['email', 'emailcorporativo', 'mail', 'correio']);
    const role = findValue(['cargo', 'funcao', 'posicao', 'role']);
    const linkedin = findValue(['linkedin', 'url', 'perfil']);
    const phone = findValue(['telefone', 'celular', 'fixo', 'whatsapp', 'phone', 'mobile']);
    const cnpj = findValue(['cnpj', 'cadastro', 'documento']).replace(/[^0-9]/g, '');

    const notes = [
      role ? `Cargo: ${role}` : '',
      linkedin ? `LinkedIn: ${linkedin}` : '',
      cnpj ? `CNPJ: ${cnpj}` : '',
      phone ? `Tel: ${phone}` : ''
    ].filter(Boolean).join(' | ');

    return {
      nome: name || 'Lead Sem Nome',
      cargo: role,
      emailCorporativo: email || '',
      linkedin: linkedin,
      telefoneCelular: phone || '',
      telefoneFixo: '',
      nomeEmpresa: company || 'Empresa Não Identificada',
      cnpj: cnpj,
      temperatura: 'frio' as const,
      stage: 'entrada' as const,
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) throw new Error('Falha no buffer do arquivo.');

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          alert('⚠️ A planilha selecionada está vazia.');
          setIsProcessing(false);
          return;
        }

        let importedCount = 0;

        jsonData.forEach((row: any) => {
          const formattedLead = mapRowToLead(row);
          if (formattedLead.nome !== 'Lead Sem Nome' || formattedLead.nomeEmpresa !== 'Empresa Não Identificada') {
            addLead(formattedLead);
            importedCount++;
          }
        });

        alert(`🎉 Sucesso! Foram importados ${importedCount} contatos diretamente para a etapa de Entrada do seu Funil.`);
      } catch (error) {
        console.error(error);
        alert('❌ Erro ao ler arquivo Excel. Verifique a formatação das colunas.');
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const columns: { title: string; id: Stage; color: string }[] = [
    { title: 'Entrada', id: 'entrada', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' },
    { title: 'Enriquecer', id: 'enriquecer', color: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
    { title: 'Reunião', id: 'reuniao', color: 'bg-sky-500/10 border-sky-500/30 text-sky-400' },
    { title: 'Fim de Cadência', id: 'fim_cadencia', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Pipeline de Vendas B2B</h1>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie seus leads comerciais em tempo real.</p>
        </div>

        <div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Mapeando Linhas...' : <> <FileSpreadsheet className="w-4 h-4" /> Importar Lista Excel </>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {columns.map(column => {
          const filteredLeads = leads.filter(l => l.stage === column.id);
          return (
            <div key={column.id} className={`p-4 rounded-2xl border min-h-[500px] flex flex-col ${
              theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className={`p-2.5 rounded-xl border text-xs font-black mb-4 uppercase tracking-wider flex justify-between items-center ${column.color}`}>
                <span>{column.title}</span>
                <span className="px-2 py-0.5 rounded-md bg-black/20 text-[10px]">{filteredLeads.length}</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {filteredLeads.map(lead => (
                  <div key={lead.id} className={`p-4 rounded-xl border transition-all ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
                  }`}>
                    <div className="font-bold text-sm truncate">{lead.nome}</div>
                    <div className="text-xs text-indigo-500 font-semibold mb-2 truncate">{lead.nomeEmpresa}</div>
                    {lead.emailCorporativo && <div className="text-[11px] text-slate-400 truncate mb-1">✉️ {lead.emailCorporativo}</div>}
                    {lead.cargo && (
                      <div className={`mt-2 pt-2 border-t text-[10px] line-clamp-2 leading-relaxed ${
                        theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-600'
                      }`}>
                        {lead.cargo}
                      </div>
                    )}
                  </div>
                ))}
                {filteredLeads.length === 0 && (
                  <div className="text-center text-xs text-slate-600 py-12 border-2 border-dashed border-slate-800/10 rounded-xl my-auto">
                    Nenhum lead nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
