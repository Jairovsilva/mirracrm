'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Mail, Crown, User, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';

export function TeamView() {
  const { t } = useTranslation();
  const registeredUsers = useCRMStore((s) => s.registeredUsers);
  const currentUser = useCRMStore((s) => s.currentUser);
  const registerVendedor = useCRMStore((s) => s.registerVendedor);
  const getCompanyLeads = useCRMStore((s) => s.getCompanyLeads);

  // Estados locais para o formulário de cadastro
  const [nomeVendedor, setNomeVendedor] = useState('');
  const [emailVendedor, setEmailVendedor] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtra dinamicamente os usuários da mesma empresa
  const companyUsers = registeredUsers.filter(
    (u) => u.empresa === currentUser?.empresa
  );

  const isAdmin = currentUser?.role === 'admin_principal';

  const handleCreateVendedor = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!nomeVendedor || !emailVendedor) {
      setStatusMsg({ type: 'error', text: 'Preencha todos os campos obrigatórios.' });
      return;
    }

    const result = registerVendedor(emailVendedor.trim().toLowerCase(), nomeVendedor);

    if (result.success) {
      setStatusMsg({ type: 'success', text: result.message });
      setNomeVendedor('');
      setEmailVendedor('');
    } else {
      setStatusMsg({ type: 'error', text: result.message });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto animate-fade-in text-foreground">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border pb-4 gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t.nav.team}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companyUsers.length} {companyUsers.length === 1 ? 'membro' : 'membros'} no workspace <span className="font-semibold text-primary uppercase">{currentUser?.empresa}</span>
          </p>
        </div>
        <div className="px-3 py-1 bg-secondary text-muted-foreground rounded-full text-xs font-medium">
          Sua função: <span className="font-bold text-primary capitalize">{currentUser?.role.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulário Lateral de Cadastro */}
        <div className="space-y-4">
          <Card className="border border-border/80">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm">Convidar Vendedor</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Crie acessos exclusivos para que outros vendedores da sua equipe gerenciem leads e batam metas.
              </p>

              {!isAdmin ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Acesso restrito. Apenas administradores podem vincular novas contas à equipe.</span>
                </div>
              ) : (
                <form onSubmit={handleCreateVendedor} className="space-y-3 pt-1">
                  {statusMsg && (
                    <div className={`p-2.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 justify-center ${
                      statusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-destructive/10 border-destructive/20 text-destructive'
                    }`}>
                      {statusMsg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      <span>{statusMsg.text}</span>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome Comercial</label>
                    <input
                      type="text"
                      required
                      value={nomeVendedor}
                      onChange={(e) => setNomeVendedor(e.target.value)}
                      placeholder="Ex: Roberto Vendas"
                      className="w-full mt-1 p-2 rounded-lg bg-secondary/50 border border-border text-xs focus:outline-none focus:border-primary transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">E-mail de Acesso</label>
                    <input
                      type="email"
                      required
                      value={emailVendedor}
                      onChange={(e) => setEmailVendedor(e.target.value)}
                      placeholder="vendedor@suaempresa.com"
                      className="w-full mt-1 p-2 rounded-lg bg-secondary/50 border border-border text-xs focus:outline-none focus:border-primary transition"
                    />
                  </div>

                  <div className="text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded-lg border border-border/40">
                    🔑 A senha inicial padrão gerada para o primeiro login será: <code className="font-mono bg-secondary px-1 py-0.5 rounded text-primary font-bold">123456</code>
                  </div>

                  <button type="submit" className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-lg transition shadow-sm">
                    Adicionar à Empresa
                  </button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Listagem de Usuários Organizados e Isolados */}
        <div className="lg:col-span-2">
          {companyUsers.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t.common.noData}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {companyUsers.map((user) => {
                const isUserAdmin = user.role === 'admin_principal';
                
                // 🔒 CORREÇÃO DA VISÃO DO ADMIN: Puxa o escopo isolado real da empresa em vez de ler o array bruto global
                const companyLeads = getCompanyLeads();
                const userLeads = isUserAdmin 
                  ? companyLeads 
                  : companyLeads.filter((l) => l.userId === user.id);

                const storedName = typeof window !== 'undefined' ? localStorage.getItem(`crm_name_${user.email}`) : null;
                const displayName = storedName || user.email.split('@')[0];

                return (
                  <Card key={user.id} className="hover:shadow-md transition-shadow bg-card border-border/80 relative">
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${
                          isUserAdmin ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'
                        }`}>
                          {displayName[0]?.toUpperCase()}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-sm truncate capitalize">
                              {displayName}
                              {user.id === currentUser?.id && <span className="text-[11px] text-muted-foreground font-normal lowercase"> (você)</span>}
                            </h3>
                            {isUserAdmin ? (
                              <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-muted-foreground/60" />
                            {user.email}
                          </p>
                          
                          <span className={`inline-block mt-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isUserAdmin ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-secondary text-muted-foreground'
                          }`}>
                            {user.role.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Escopo de Leads</p>
                          <p className="font-bold text-sm text-foreground mt-0.5">
                            {isUserAdmin ? `${userLeads.length} (Empresa)` : userLeads.length}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Empresa Vinculada</p>
                          <p className="font-bold text-xs text-foreground uppercase mt-0.5">{user.empresa}</p>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}