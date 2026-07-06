'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { LayoutDashboard, KanbanSquare, Users, BarChart3, UserCog, Settings, LogOut } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { ViewType } from '@/app/app/page';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { t } = useTranslation();
  const storeCurrentUser = useCRMStore((s) => s.currentUser);
  
  // Estado local para garantir sincronismo em tempo real com o localStorage
  const [displayUser, setDisplayUser] = useState({
    email: storeCurrentUser?.email || 'jairo@ainglobal.com.br',
    empresa: storeCurrentUser?.empresa || 'AINGLOBAL',
    role: storeCurrentUser?.role || 'admin_principal'
  });

  // 🔄 Efeito cirúrgico para capturar o usuário real logado no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeUserEmail = localStorage.getItem('crm_current_user');
      if (activeUserEmail) {
        setDisplayUser({
          email: activeUserEmail,
          empresa: activeUserEmail.includes('ainglob') ? 'AINGLOBAL' : 'Workspace Pessoal',
          role: activeUserEmail.includes('ainglob') ? 'admin_principal' : 'usuário'
        });
      }
    }
  }, [storeCurrentUser]);

  const navItems = [
    { id: 'dashboard' as ViewType, label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'kanban' as ViewType, label: t.nav.kanban, icon: KanbanSquare },
    { id: 'leads' as ViewType, label: t.nav.leads, icon: Users },
    { id: 'analytics' as ViewType, label: t.nav.analytics, icon: BarChart3 },
    { id: 'team' as ViewType, label: t.nav.team, icon: UserCog },
    { id: 'settings' as ViewType, label: t.nav.settings, icon: Settings },
  ];

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('crm_session_active');
      localStorage.removeItem('crm_current_user');
      localStorage.removeItem('user_email');
      localStorage.removeItem('email');
      window.location.href = '/';
    }
  };

  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-sidebar-border">
        <Image
          src="/davinci_crie_uma_logomarca_para_o_meu_crm_que_ser__chamado.png"
          alt="CorçaCRM"
          width={36}
          height={36}
          className="rounded-lg"
        />
        <div>
          <h1 className="font-bold text-sm text-sidebar-foreground">{t.appName}</h1>
          <p className="text-xs text-muted-foreground">{displayUser.empresa}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4 transition-transform group-hover:scale-110', isActive && 'scale-110')} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm">
            {displayUser.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayUser.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{displayUser.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title={t.common.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}