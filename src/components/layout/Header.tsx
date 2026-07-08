'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { Button } from '@/components/ui/button';
import { Bell, Moon, Sun, Plus, Search } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onAddLead: () => void;
  onToggleAlerts: () => void;
  showAlerts: boolean;
}

export function Header({ onAddLead, onToggleAlerts, showAlerts }: HeaderProps) {
  const { t } = useTranslation();
  const theme = useCRMStore((s) => s.theme);
  const toggleTheme = useCRMStore((s) => s.toggleTheme);
  const setLanguage = useCRMStore((s) => s.setLanguage);
  const currentLanguage = useCRMStore((s) => s.language);
  const alerts = useCRMStore((s) => s.alerts);
  const currentUser = useCRMStore((s) => s.currentUser);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Mobile logo */}
      <div className="md:hidden flex items-center gap-2">
        <Image
          src="/davinci_crie_uma_logomarca_para_o_meu_crm_que_ser__chamado.png"
          alt="CorçaCRM"
          width={28}
          height={28}
          className="rounded-md"
        />
        <span className="font-bold text-sm">{t.appName}</span>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t.lead.searchPlaceholder}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={onAddLead} size="sm" className="hidden sm:flex">
          <Plus className="w-4 h-4 mr-1.5" />
          {t.lead.addLead}
        </Button>
        <Button onClick={onAddLead} size="icon" variant="default" className="sm:hidden">
          <Plus className="w-4 h-4" />
        </Button>

        {/* Language selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="h-9 px-3 rounded-lg border border-border bg-card flex items-center gap-1.5 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <span className="text-base leading-none">{currentLanguage === 'pt' ? '🇧🇷' : currentLanguage === 'en' ? '🇺🇸' : '🇪🇸'}</span>
            <span className="uppercase">{currentLanguage}</span>
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-border bg-popover shadow-lg z-50 animate-scale-in overflow-hidden">
              {(['pt', 'en', 'es'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang);
                    setLangOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors',
                    currentLanguage === lang && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <span className="text-base">{lang === 'pt' ? '🇧🇷' : lang === 'en' ? '🇺🇸' : '🇪🇸'}</span>
                  <span className="uppercase">{lang}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <Button variant="outline" size="icon" onClick={toggleTheme} className="h-9 w-9">
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        {/* Alerts */}
        <button
          onClick={onToggleAlerts}
          className="relative h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <div className="hidden sm:flex w-9 h-9 rounded-full bg-primary/15 items-center justify-center text-primary font-semibold text-sm">
          {currentUser?.email?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}
