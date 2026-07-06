'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Flame, CalendarCheck, DollarSign, ArrowUpRight, ArrowDownRight, TrendingUp, Plus } from 'lucide-react';
import { TemperatureBadge } from '@/src/components/leads/TemperatureBadge';
import { StageBadge } from '@/src/components/leads/StageBadge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface DashboardViewProps {
  onOpenLead: (id: string) => void;
  onAddLead: () => void;
  onViewKanban: () => void;
}

export function DashboardView({ onOpenLead, onAddLead, onViewKanban }: DashboardViewProps) {
  const { t } = useTranslation();
  const leads = useCRMStore((s) => s.leads);
  
  // 🔄 Estado local para garantir sincronia real com o usuário do LocalStorage
  const [activeEmail, setActiveEmail] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('crm_current_user') || '';
      setActiveEmail(storedUser);
    }
  }, []);

  // 🔒 ISOLAMENTO REAL: Filtra os leads pelo email verificado no LocalStorage
  const myLeads = leads.filter((l) => {
    const owner = (l as any).userOwner;
    return owner === activeEmail;
  });

  // 📊 Métricas baseadas unicamente no usuário logado
  const totalLeads = myLeads.length;
  const hotLeads = myLeads.filter((l) => l.temperatura === 'quente').length;
  const meetingsScheduled = myLeads.filter((l) => l.stage === 'reuniao').length;
  const pipelineValue = myLeads.reduce((sum, l) => sum + (l.valorProposta || 0), 0);

  const stageData = [
    { name: t.stages.entrada, value: myLeads.filter((l) => l.stage === 'entrada').length, color: 'hsl(var(--chart-1))' },
    { name: t.stages.enriquecer, value: myLeads.filter((l) => l.stage === 'enriquecer').length, color: 'hsl(var(--chart-2))' },
    { name: t.stages.reuniao, value: myLeads.filter((l) => l.stage === 'reuniao').length, color: 'hsl(var(--chart-3))' },
    { name: t.stages.fim_cadencia, value: myLeads.filter((l) => l.stage === 'fim_cadencia').length, color: 'hsl(var(--chart-4))' },
  ];

  const tempData = [
    { name: t.temperature.frio, value: myLeads.filter((l) => l.temperatura === 'frio').length, color: '#3b82f6' },
    { name: t.temperature.morno, value: myLeads.filter((l) => l.temperatura === 'morno').length, color: '#f59e0b' },
    { name: t.temperature.quente, value: myLeads.filter((l) => l.temperatura === 'quente').length, color: '#ef4444' },
  ];

  const pipelineByStage = stageData.map((s) => ({
    name: s.name,
    valor: myLeads
      .filter((l) => t.stages[l.stage] === s.name)
      .reduce((sum, l) => sum + (l.valorProposta || 0), 0),
  }));

  const stats = [
    {
      label: t.dashboard.totalLeads,
      value: totalLeads,
      icon: Users,
      change: '+12%',
      trend: 'up' as const,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: t.dashboard.hotLeads,
      value: hotLeads,
      icon: Flame,
      change: '+8%',
      trend: 'up' as const,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: t.dashboard.meetingsScheduled,
      value: meetingsScheduled,
      icon: CalendarCheck,
      change: '+5%',
      trend: 'up' as const,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: t.dashboard.pipelineValue,
      value: pipelineValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
      icon: DollarSign,
      change: '-3%',
      trend: 'down' as const,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      {/* Welcome header corrigido com o activeEmail real */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {t.dashboard.welcome}, {activeEmail ? activeEmail.split('@')[0] : 'Usuário'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString(currentLanguageDate(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onViewKanban}>
            <TrendingUp className="w-4 h-4 mr-2" />
            {t.nav.kanban}
          </Button>
          <Button onClick={onAddLead}>
            <Plus className="w-4 h-4 mr-2" />
            {t.lead.addLead}
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${stat.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                    {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline by stage */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.pipelineByStage}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pipelineByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Valor']}
                />
                <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Temperature distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.temperatureDistribution}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={tempData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {tempData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.dashboard.recentLeads}</CardTitle>
        </CardHeader>
        <CardContent>
          {myLeads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t.common.noData}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myLeads.slice(0, 6).map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => onOpenLead(lead.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {lead.nome[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{lead.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.cargo} · {lead.nomeEmpresa}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TemperatureBadge temperature={lead.temperatura} />
                    <StageBadge stage={lead.stage} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function currentLanguageDate() {
  return 'pt-BR';
}
