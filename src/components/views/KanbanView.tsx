'use client';

import { useState, useRef } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore, type Stage, type Lead } from '@/src/store/crmStore';
import { TemperatureBadge } from '@/src/components/leads/TemperatureBadge';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical, Building2, Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KanbanViewProps {
  onOpenLead: (id: string) => void;
  onAddLead: () => void;
  onEditLead: (id: string) => void;
}

const stageOrder: Stage[] = ['entrada', 'enriquecer', 'reuniao', 'fim_cadencia'];

const stageHeaderColors: Record<Stage, string> = {
  entrada: 'border-t-blue-500',
  enriquecer: 'border-t-emerald-500',
  reuniao: 'border-t-amber-500',
  fim_cadencia: 'border-t-slate-500',
};

export function KanbanView({ onOpenLead, onAddLead, onEditLead }: KanbanViewProps) {
  const { t } = useTranslation();
  const leads = useCRMStore((s) => s.leads);
  const updateLeadStage = useCRMStore((s) => s.updateLeadStage);
  const deleteLead = useCRMStore((s) => s.deleteLead);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stage: Stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };

  const handleDrop = (e: React.DragEvent, stage: Stage) => {
    e.preventDefault();
    if (draggedId) {
      updateLeadStage(draggedId, stage);
    }
    setDraggedId(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverStage(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold">{t.nav.kanban}</h1>
          <p className="text-sm text-muted-foreground">{leads.length} {t.nav.leads.toLowerCase()}</p>
        </div>
        <Button onClick={onAddLead} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          {t.lead.addLead}
        </Button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto kanban-scroll p-4 md:p-6">
        <div className="flex gap-4 min-w-max h-full">
          {stageOrder.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDrop={(e) => handleDrop(e, stage)}
                onDragLeave={() => setDragOverStage(null)}
                className={cn(
                  'w-72 md:w-80 shrink-0 flex flex-col rounded-xl bg-secondary/40 border border-border border-t-4 transition-colors',
                  stageHeaderColors[stage],
                  dragOverStage === stage && 'bg-primary/5 border-primary/30'
                )}
              >
                {/* Column header */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{t.stages[stage]}</h3>
                    <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 space-y-2.5 min-h-[100px]">
                  {stageLeads.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                      {t.lead.noLeads}
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <KanbanCard
                        key={lead.id}
                        lead={lead}
                        isDragging={draggedId === lead.id}
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onOpenLead(lead.id)}
                        menuOpen={menuOpenId === lead.id}
                        onMenuToggle={() => setMenuOpenId(menuOpenId === lead.id ? null : lead.id)}
                        onEdit={() => {
                          onEditLead(lead.id);
                          setMenuOpenId(null);
                        }}
                        onDelete={() => {
                          deleteLead(lead.id);
                          setMenuOpenId(null);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface KanbanCardProps {
  lead: Lead;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function KanbanCard({ lead, isDragging, onDragStart, onDragEnd, onClick, menuOpen, onMenuToggle, onEdit, onDelete }: KanbanCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'group relative bg-card rounded-lg border border-border p-3.5 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200',
        isDragging && 'opacity-40 rotate-2'
      )}
    >
      {/* Menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMenuToggle();
        }}
        className="absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); onMenuToggle(); }} />
          <div className="absolute top-8 right-2 z-20 w-36 rounded-lg border border-border bg-popover shadow-lg overflow-hidden animate-scale-in">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>
          </div>
        </>
      )}

      {/* Header */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
          {lead.nome[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm truncate pr-6">{lead.nome}</h4>
          <p className="text-xs text-muted-foreground truncate">{lead.cargo}</p>
        </div>
      </div>

      {/* Company */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5">
        <Building2 className="w-3 h-3 shrink-0" />
        <span className="truncate">{lead.nomeEmpresa}</span>
      </div>

      {/* Contact icons */}
      <div className="flex items-center gap-2 mb-3 text-muted-foreground">
        {lead.emailCorporativo && <Mail className="w-3.5 h-3.5" />}
        {lead.telefoneCelular && <Phone className="w-3.5 h-3.5" />}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border">
        <TemperatureBadge temperature={lead.temperatura} size="xs" />
        {lead.valorProposta ? (
          <span className="text-xs font-semibold text-foreground">
            R$ {lead.valorProposta.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
