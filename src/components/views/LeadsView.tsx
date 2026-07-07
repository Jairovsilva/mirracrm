'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore, type Stage, type Temperature } from '@/src/store/crmStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TemperatureBadge } from '@/src/components/leads/TemperatureBadge';
import { StageBadge } from '@/src/components/leads/StageBadge';
import { Plus, Search, Pencil, Trash2, Building2, Mail, Phone, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadsViewProps {
  onOpenLead: (id: string) => void;
  onAddLead: () => void;
  onEditLead: (id: string) => void;
}

export function LeadsView({ onOpenLead, onAddLead, onEditLead }: LeadsViewProps) {
  const { t } = useTranslation();
  const getCompanyLeads = useCRMStore((s) => s.getCompanyLeads);
  const deleteLead = useCRMStore((s) => s.deleteLead);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<Stage | 'all'>('all');
  const [filterTemp, setFilterTemp] = useState<Temperature | 'all'>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const leads = getCompanyLeads();

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchesSearch =
        !search ||
        l.nome.toLowerCase().includes(search.toLowerCase()) ||
        l.nomeEmpresa.toLowerCase().includes(search.toLowerCase()) ||
        l.emailCorporativo.toLowerCase().includes(search.toLowerCase());
      const matchesStage = filterStage === 'all' || l.stage === filterStage;
      const matchesTemp = filterTemp === 'all' || l.temperatura === filterTemp;
      return matchesSearch && matchesStage && matchesTemp;
    });
  }, [leads, search, filterStage, filterTemp]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.nav.leads}</h1>
          <p className="text-sm text-muted-foreground">{filteredLeads.length} {t.nav.leads.toLowerCase()}</p>
        </div>
        <Button onClick={onAddLead}>
          <Plus className="w-4 h-4 mr-2" />
          {t.lead.addLead}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t.lead.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value as Stage | 'all')}
            className="h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">{t.common.all} — {t.lead.stage}</option>
            <option value="entrada">{t.stages.entrada}</option>
            <option value="enriquecer">{t.stages.enriquecer}</option>
            <option value="reuniao">{t.stages.reuniao}</option>
            <option value="fim_cadencia">{t.stages.fim_cadencia}</option>
          </select>
          <select
            value={filterTemp}
            onChange={(e) => setFilterTemp(e.target.value as Temperature | 'all')}
            className="h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">{t.common.all} — {t.lead.temperature}</option>
            <option value="frio">{t.temperature.frio}</option>
            <option value="morno">{t.temperature.morno}</option>
            <option value="quente">{t.temperature.quente}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">{t.common.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">{t.lead.name}</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">{t.lead.company}</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">{t.lead.email}</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">{t.lead.temperature}</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">{t.lead.stage}</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">{t.lead.proposalValue}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => onOpenLead(lead.id)}
                      className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                            {lead.nome[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{lead.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">{lead.cargo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{lead.nomeEmpresa}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{lead.emailCorporativo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TemperatureBadge temperature={lead.temperatura} size="xs" />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StageBadge stage={lead.stage} size="xs" />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold hidden md:table-cell">
                        {lead.valorProposta ? `R$ ${lead.valorProposta.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === lead.id ? null : lead.id);
                            }}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuOpenId === lead.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }} />
                              <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-border bg-popover shadow-lg overflow-hidden animate-scale-in">
                                <button
                                  onClick={(e) => { e.stopPropagation(); onEditLead(lead.id); setMenuOpenId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  {t.common.edit}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteLead(lead.id); setMenuOpenId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {t.common.delete}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
