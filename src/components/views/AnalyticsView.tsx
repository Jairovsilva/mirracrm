'use client';

import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, RadialBarChart, RadialBar,
} from 'recharts';
import { TrendingUp, Users, Target, DollarSign, Activity as ActivityIcon } from 'lucide-react';

export function AnalyticsView() {
  const { t } = useTranslation();
  const getCompanyLeads = useCRMStore((s) => s.getCompanyLeads);

  // 🎯 FILTRO DE SEGURANÇA CORRIGIDO: Alinha os dados do Analytics rigorosamente com a empresa/usuário atual
  const leads = getCompanyLeads();

  const stageData = [
    { name: t.stages.entrada, value: leads.filter((l) => l.stage === 'entrada').length, color: 'hsl(var(--chart-1))' },
    { name: t.stages.enriquecer, value: leads.filter((l) => l.stage === 'enriquecer').length, color: 'hsl(var(--chart-2))' },
    { name: t.stages.reuniao, value: leads.filter((l) => l.stage === 'reuniao').length, color: 'hsl(var(--chart-3))' },
    { name: t.stages.fim_cadencia, value: leads.filter((l) => l.stage === 'fim_cadencia').length, color: 'hsl(var(--chart-4))' },
  ];

  const tempData = [
    { name: t.temperature.frio, value: leads.filter((l) => l.temperatura === 'frio').length, fill: '#3b82f6' },
    { name: t.temperature.morno, value: leads.filter((l) => l.temperatura === 'morno').length, fill: '#f59e0b' },
    { name: t.temperature.quente, value: leads.filter((l) => l.temperatura === 'quente').length, fill: '#ef4444' },
  ];

  const pipelineByStage = stageData.map((s) => ({
    name: s.name,
    valor: leads
      .filter((l) => t.stages[l.stage] === s.name)
      .reduce((sum, l) => sum + (l.valorProposta || 0), 0),
  }));

  const trendData = [
    { month: 'Jan', leads: leads.length > 0 ? 12 : 0, reunioes: leads.length > 0 ? 4 : 0 },
    { month: 'Fev', leads: leads.length > 0 ? 18 : 0, reunioes: leads.length > 0 ? 7 : 0 },
    { month: 'Mar', leads: leads.length > 0 ? 25 : 0, reunioes: leads.length > 0 ? 10 : 0 },
    { month: 'Abr', leads: leads.length > 0 ? 22 : 0, reunioes: leads.length > 0 ? 8 : 0 },
    { month: 'Mai', leads: leads.length > 0 ? 30 : 0, reunioes: leads.length > 0 ? 12 : 0 },
    { month: 'Jun', leads: leads.length, reunioes: leads.filter((l) => l.stage === 'reuniao').length },
  ];

  const totalValue = leads.reduce((sum, l) => sum + (l.valorProposta || 0), 0);
  const conversionRate = leads.length > 0 ? ((leads.filter((l) => l.stage === 'fim_cadencia').length / leads.length) * 100).toFixed(1) : '0';

  const kpis = [
    { label: t.dashboard.totalLeads, value: leads.length, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: t.dashboard.pipelineValue, value: `R$ ${(totalValue / 1000).toFixed(0)}k`, icon: DollarSign, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Taxa de Conversão', value: `${conversionRate}%`, icon: Target, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Atividades', value: leads.reduce((sum, l) => sum + (l.activities?.length || 0), 0), icon: ActivityIcon, color: 'text-chart-4', bg: 'bg-chart-4/10' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t.nav.analytics}</h1>
        <p className="text-sm text-muted-foreground mt-1">Análise de performance comercial</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i}>
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{kpi.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Tendência de Leads e Reuniões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReunioes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area type="monotone" dataKey="leads" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#colorLeads)" />
              <Area type="monotone" dataKey="reunioes" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#colorReunioes)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.pipelineByStage}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pipelineByStage} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Valor']}
                />
                <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.temperatureDistribution}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadialBarChart innerRadius="30%" outerRadius="100%" data={tempData} startAngle={90} endAngle={-270}>
                <RadialBar background dataKey="value" cornerRadius={8} />
                <Legend
                  iconType="circle"
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}