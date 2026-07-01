'use client';

import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Globe, Building2, Mail, Crown, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsView() {
  const { t } = useTranslation();
  const theme = useCRMStore((s) => s.theme);
  const toggleTheme = useCRMStore((s) => s.toggleTheme);
  const setLanguage = useCRMStore((s) => s.setLanguage);
  const currentLanguage = useCRMStore((s) => s.currentLanguage);
  const currentUser = useCRMStore((s) => s.currentUser);

  const handleLogout = () => {
    window.location.href = '/';
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t.nav.settings}</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas preferências</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
              {currentUser?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold">{currentUser?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                  <Crown className="w-3 h-3" />
                  {currentUser?.role.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">E-mail:</span>
              <span className="font-medium truncate">{currentUser?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Empresa:</span>
              <span className="font-medium">{currentUser?.empresa}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.common.theme}</CardTitle>
          <CardDescription>Escolha entre modo claro e escuro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
              )}
            >
              <Sun className="w-5 h-5 text-warning" />
              <span className="font-medium text-sm">{t.common.light}</span>
            </button>
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
              )}
            >
              <Moon className="w-5 h-5 text-primary" />
              <span className="font-medium text-sm">{t.common.dark}</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t.common.language}
          </CardTitle>
          <CardDescription>Selecione o idioma da interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {([
              { code: 'pt', flag: '🇧🇷', label: 'Português' },
              { code: 'en', flag: '🇺🇸', label: 'English' },
              { code: 'es', flag: '🇪🇸', label: 'Español' },
            ] as const).map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                  currentLanguage === lang.code ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                )}
              >
                <span className="text-2xl">{lang.flag}</span>
                <span className="text-sm font-medium">{lang.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleLogout}>
        <LogOut className="w-4 h-4 mr-2" />
        {t.common.logout}
      </Button>
    </div>
  );
}
