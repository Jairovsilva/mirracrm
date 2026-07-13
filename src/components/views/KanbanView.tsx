'use client';
import React, { useRef, useState } from 'react';
import { useCRMStore, type Stage } from '@/src/store/crmStore';
import { FileSpreadsheet, Trash2, GripVertical, Search, X, CheckSquare, Square, ListChecks } from 'lucide-react';
import * as XLSX from 'xlsx';

interface KanbanViewProps {
  onOpenLead: (id: string) => void;
  onAddLead: () => void;
  onEditLead: (id: string) => void;
}

export default function KanbanView({ onOpenLead, onAddLead, onEditLead }: KanbanViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLead, moveLead, deleteLead, deleteLeads, theme, leads } = useCRMStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Stage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 🆕 Modo de seleção múltipla para exclusão em massa
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const myLeads = leads;

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleLeadSelected = (leadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmMsg = `Excluir ${selectedIds.size} lead(s) selecionado(s)? Essa ação não pode ser desfeita.`;
    if (!confirm(confirmMsg)) return;

    setIsDeleting(true);
    await deleteLeads(Array.from(selectedIds));
    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const mapRowToLead = (row: any) => {
    const keys = Object.keys(row);

    const normalize = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');

    const findValue = (possibleNames: string[]) => {
      const normalizedNames = possibleNames.map(normalize);

      let foundKey = keys.find((k) => normalizedNames.includes(normalize(k)));

      if (!foundKey) {
        foundKey = keys.find((k) => {
          const nk = normalize(k);
          return normalizedNames.some((name) => nk.includes(name) || name.includes(nk));
        });
      }

      if (!foundKey) return '';
      const raw = row[foundKey];
      return raw === undefined || raw === null ? '' : String(raw).trim();
    };

    const name = findValue(['nome', 'contato', 'lead', 'clientename', 'nomecompleto', 'nomedocontato']);
    const company = findValue(['empresa', 'razaosocial', 'companhia', 'organization', 'nomeempresa', 'razaosocialempresa']);
    const email = findValue(['email', 'emailcorporativo', 'mail', 'correio', 'ecorporativo']);
    const role = findValue(['cargo', 'funcao', 'posicao', 'role', 'cargofuncao', 'jobtitle', 'title']);
    const linkedin = findValue(['linkedin', 'url', 'perfil']);
    const phoneCel = findValue(['telefonecelular', 'celular', 'whatsapp', 'mobile', 'cel']);
    const phoneFixo = findValue(['telefonefixo', 'fixo', 'telefone', 'phone', 'tel']);
    const cnpj = findValue(['cnpj', 'cadastro', 'documento', 'cnpjdaempresa']).replace(/[^0-9]/g, '');
    const valorRaw = findValue(['valor', 'valorproposta', 'proposta', 'valordeal', 'dealvalue', 'value']);
    const valorProposta = valorRaw
      ? Number(valorRaw.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0
      : 0;

    return {
      nome: name || 'Lead Sem Nome',
      cargo: role,
      emailCorporativo: email || '',
      linkedin: linkedin,
      telefoneCelular: phoneCel || phoneFixo || '',
      telefoneFixo: phoneFixo || '',
      nomeEmpresa: company || 'Empresa Não Identificada',
      cnpj: cnpj,
      temperatura: 'frio' as const,
      stage: 'entrada' as const,
      valorProposta: valorProposta,
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
    if (selectionMode) return;
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
      moveLead(leadId, columnId);
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
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectionMode
                ? 'Clique nos cards para selecionar os leads que deseja excluir.'
                : 'Arraste os cards entre as etapas ou clique para abrir o detalhe do lead.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!selectionMode ? (
              <>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                <button
                  type="button"
                  onClick={toggleSelectionMode}
                  className={`flex items-center gap-2 font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all whitespace-nowrap border ${
                    theme === 'dark'
                      ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ListChecks className="w-4 h-4" /> Selecionar
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {isProcessing ? 'Mapeando...' : <> <FileSpreadsheet className="w-4 h-4" /> Importar Lista de Contatos </>}
                </button>
              </>
            ) : (
              <>
                <span className={`text-xs font-bold px-3 py-2 rounded-xl ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {selectedIds.size} selecionado(s)
                </span>
                <button
                  type="button"
                  onClick={toggleSelectionMode}
                  className={`font-bold text-xs py-2.5 px-4 rounded-xl transition-all border ${
                    theme === 'dark'
                      ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedIds.size === 0 || isDeleting}
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition-all whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Excluindo...' : `Excluir selecionados (${selectedIds.size})`}
                </button>
              </>
            )}
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
        {columns.map(column => {
          const filteredLeads = myLeads.filter(l => {
            if (l.stage !== column.id) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            return (
              l.nome.toLowerCase().includes(q) ||
              l.nomeEmpresa.toLowerCase().includes(q) ||
              l.emailCorporativo.toLowerCase().includes(q) ||
              l.cargo.toLowerCase().includes(q)
            );
          });
          const isDragOver = dragOverColumn === column.id;
          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
              className={`p-4 rounded-2xl border min-h-[500px] flex flex-col transition-colors ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-500/5'
                  : theme === 'dark'
                    ? 'bg-slate-900/40 border-slate-800'
                    : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className={`p-2.5 rounded-xl border text-xs font-black mb-4 uppercase tracking-wider flex justify-between items-center ${column.color}`}>
                <span>{column.title}</span>
                <span className="px-2 py-0.5 rounded-md bg-black/20 text-[10px]">{filteredLeads.length}</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {filteredLeads.map(lead => {
                  const isSelected = selectedIds.has(lead.id);
                  return (
                    <div
                      key={lead.id}
                      draggable={!selectionMode}
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => (selectionMode ? toggleLeadSelected(lead.id) : onOpenLead(lead.id))}
                      className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40'
                          : draggedLeadId === lead.id
                            ? 'opacity-40 border-dashed border-indigo-500'
                            : theme === 'dark'
                              ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10'
                              : 'bg-slate-50 border-slate-200 shadow-sm hover:border-indigo-500/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {selectionMode ? (
                            isSelected ? (
                              <CheckSquare className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                            ) : (
                              <Square className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                            )
                          ) : (
                            <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                            }`} />
                          )}
                          <div className="font-bold text-sm truncate">{lead.nome}</div>
                        </div>
                        {!selectionMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Excluir o lead "${lead.nome}"?`)) {
                                deleteLead(lead.id);
                              }
                            }}
                            className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ${
                              theme === 'dark'
                                ? 'text-slate-600 hover:text-rose-400 hover:bg-rose-500/10'
                                : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'
                            }`}
                            title="Excluir lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-indigo-500 font-semibold mb-2 truncate pl-5">{lead.nomeEmpresa}</div>
                      {lead.emailCorporativo && (
                        <div className="text-[11px] text-slate-400 truncate mb-1 pl-5">✉️ {lead.emailCorporativo}</div>
                      )}
                      {lead.cargo && (
                        <div className={`mt-2 pt-2 border-t text-[10px] line-clamp-2 leading-relaxed pl-5 ${
                          theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-600'
                        }`}>
                          {lead.cargo}
                        </div>
                      )}
                    </div>
                  );
                })}
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