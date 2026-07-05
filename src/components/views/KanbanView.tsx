'use client';
import React, { useRef, useState, useEffect } from 'react';
import { useCRMStore, type Stage } from '@/src/store/crmStore';
import { FileSpreadsheet, Trash2, GripVertical, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface KanbanViewProps {
  onOpenLead: (id: string) => void;
  onAddLead: () => void;
  onEditLead: (id: string) => void;
}

export default function KanbanView({ onOpenLead, onAddLead, onEditLead }: KanbanViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { leads, addLead, updateLeadStage, deleteLead, theme } = useCRMStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Stage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 🔐 ENGENHARIA SÊNIOR: Estado para armazenar o usuário logado com segurança no Client-side
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Captura o e-mail da pessoa que acabou de logar
      setCurrentUserEmail(localStorage.getItem('crm_current_user') || '');
    }
  }, []);

  // 🛡️ ISOLAMENTO DE DADOS: Filtra os leads globais para exibir APENAS os deste usuário ou exemplos do sistema
  const myLeads = leads.filter(l => {
    // Se o seu store usa 'userOwner', filtramos por ele. Caso contrário, se o objeto não tiver dono ainda,
    // garantimos compatibilidade retroativa para que você não perca os leads que já criou antes da trava.
    return !l.userOwner || l.userOwner === currentUserEmail || l.userOwner === 'system';
  });

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
      userOwner: currentUserEmail // Grava a propriedade do dono ao importar via Excel
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

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: Stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, columnId: Stage) => {
    e.preventDefault();
    if (dragOverColumn === columnId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, columnId: Stage) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (leadId) {
      updateLeadStage(leadId, columnId);
    }
    setDraggedLeadId(null);
    setDragOverColumn(null);
  };

  const columns: { title: string; id: Stage; color: string }[] = [
    { title: 'Entrada', id: 'entrada', color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' },
    { title: 'Enriquecer', id: 'enriquecer', color: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
    { title: 'Reunião', id: 'reuniao', color: 'bg-sky-500/10 border-sky-500/30 text-sky-400' },
    { title: 'Fim de Cadência', id: 'fim_cadencia', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Pipeline de Vendas B2B</h1>
            {currentUserEmail && (
              <p className="text-xs text-indigo-400 font-medium mb-1">
                Logado como: <span className="font-bold underline">{currentUserEmail}</span>
              </p>
            )}
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Arraste os cards entre as etapas ou clique para abrir o detalhe do lead.</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {isProcessing ? 'Mapeando...' : <> <FileSpreadsheet className="w-4 h-4" /> Importar Excel </>}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar lead por nome, empresa, email ou cargo..."
            className={`w-full text-sm rounded-xl pl-10 pr-10 py-2.5 outline-none border transition-colors ${
              theme === 'dark'
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-400'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-colors ${
                theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {