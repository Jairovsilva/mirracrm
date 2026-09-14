'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/src/lib/useTranslation';
import { useCRMStore } from '@/src/store/crmStore';
import { supabase } from '@/src/lib/supabaseClient';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Moon,
  Sun,
  Globe,
  Building2,
  Mail,
  Crown,
  LogOut,
  KeyRound,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type EmailAccount = {
  id: string;
  provider: string;
  email_address: string;
  display_name?: string | null;
  status: string;
  connected_at?: string | null;
  updated_at?: string | null;
  last_error?: string | null;
};

export function SettingsView() {
  const { t } = useTranslation();

  const theme = useCRMStore((s) => s.theme);
  const toggleTheme = useCRMStore((s) => s.toggleTheme);
  const setLanguage = useCRMStore((s) => s.setLanguage);
  const currentLanguage = useCRMStore((s) => s.language);
  const currentUser = useCRMStore((s) => s.currentUser);
  const logout = useCRMStore((s) => s.logout);
  const changePassword = useCRMStore((s) => s.changePassword);

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [passwordMsg, setPasswordMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // ─────────────────────────────────────────────
  // INTEGRAÇÃO DE E-MAIL
  // ─────────────────────────────────────────────

  const [emailAccount, setEmailAccount] =
    useState<EmailAccount | null>(null);

  const [loadingEmailAccount, setLoadingEmailAccount] =
    useState(true);

  const [connectingGoogle, setConnectingGoogle] =
    useState(false);

  const [emailIntegrationMsg, setEmailIntegrationMsg] =
    useState<{
      type: 'success' | 'error';
      text: string;
    } | null>(null);

  const loadEmailAccount = async () => {
    setLoadingEmailAccount(true);
    setEmailIntegrationMsg(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setEmailAccount(null);
        setEmailIntegrationMsg({
          type: 'error',
          text: 'Sua sessão não está disponível. Faça login novamente.',
        });
        return;
      }

      const response = await fetch('/api/email/account', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Não foi possível consultar a integração de e-mail.'
        );
      }

      const account =
        data?.account ??
        data?.emailAccount ??
        data?.data ??
        null;

      setEmailAccount(account);

      const params = new URLSearchParams(window.location.search);
      const emailStatus = params.get('email');

      if (emailStatus === 'connected') {
        setEmailIntegrationMsg({
          type: 'success',
          text: 'Conta Gmail conectada com sucesso.',
        });
      } else if (emailStatus === 'error') {
        setEmailIntegrationMsg({
          type: 'error',
          text: 'Não foi possível concluir a conexão com o Gmail.',
        });
      }
    } catch (error: any) {
      console.error('Erro ao consultar conta de e-mail:', error);

      setEmailAccount(null);
      setEmailIntegrationMsg({
        type: 'error',
        text:
          error?.message ||
          'Erro ao consultar a integração de e-mail.',
      });
    } finally {
      setLoadingEmailAccount(false);
    }
  };

  useEffect(() => {
    loadEmailAccount();
  }, []);

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    setEmailIntegrationMsg(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          'Sua sessão expirou. Faça login novamente.'
        );
      }

      const response = await fetch(
        '/api/email/google/connect',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: session.access_token,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Não foi possível iniciar a conexão com o Google.'
        );
      }

      if (!data?.authUrl) {
        throw new Error(
          'O servidor não retornou a URL de autorização do Google.'
        );
      }

      window.location.assign(data.authUrl);
    } catch (error: any) {
      console.error('Erro ao conectar Gmail:', error);

      setEmailIntegrationMsg({
        type: 'error',
        text:
          error?.message ||
          'Erro inesperado ao iniciar a conexão com o Gmail.',
      });

      setConnectingGoogle(false);
    }
  };

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────

  const handleLogout = async () => {
    await logout();
    window.location.replace('/');
  };

  // ─────────────────────────────────────────────
  // ALTERAÇÃO DE SENHA
  // ─────────────────────────────────────────────

  const handleChangePassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!novaSenha || !confirmarSenha) {
      setPasswordMsg({
        type: 'error',
        text: 'Preencha os dois campos.',
      });
      return;
    }

    if (novaSenha.length < 6) {
      setPasswordMsg({
        type: 'error',
        text: 'A nova senha deve ter pelo menos 6 caracteres.',
      });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setPasswordMsg({
        type: 'error',
        text: 'As senhas não coincidem.',
      });
      return;
    }

    setChangingPassword(true);

    const result = await changePassword(novaSenha);

    setChangingPassword(false);

    if (result.ok) {
      setPasswordMsg({
        type: 'success',
        text: 'Senha alterada com sucesso!',
      });

      setNovaSenha('');
      setConfirmarSenha('');
    } else {
      setPasswordMsg({
        type: 'error',
        text:
          result.error ||
          'Erro ao alterar a senha.',
      });
    }
  };

  const gmailConnected =
    emailAccount?.provider === 'google' &&
    emailAccount?.status === 'active';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">
          {t.nav.settings}
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas preferências
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Perfil
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
              {currentUser?.email?.[0]?.toUpperCase() || 'U'}
            </div>

            <div>
              <p className="font-semibold">
                {currentUser?.email}
              </p>

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

              <span className="text-muted-foreground">
                E-mail:
              </span>

              <span className="font-medium truncate">
                {currentUser?.email}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />

              <span className="text-muted-foreground">
                Empresa:
              </span>

              <span className="font-medium">
                {currentUser?.companyName}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integração de e-mail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Integração de E-mail
          </CardTitle>

          <CardDescription>
            Conecte sua conta Gmail para enviar e-mails e
            propostas comerciais diretamente pelo MirraCRM.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {emailIntegrationMsg && (
            <div
              className={`p-3 text-sm font-medium rounded-lg border flex items-start gap-2 ${
                emailIntegrationMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
            >
              {emailIntegrationMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}

              <span>
                {emailIntegrationMsg.text}
              </span>
            </div>
          )}

          {loadingEmailAccount ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Verificando integração...
            </div>
          ) : gmailConnected ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      Gmail conectado
                    </p>

                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {emailAccount?.email_address}
                    </p>

                    {emailAccount?.display_name && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {emailAccount.display_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadEmailAccount}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar status
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Link2 className="w-5 h-5 text-primary" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Gmail não conectado
                    </p>

                    <p className="text-sm text-muted-foreground mt-1">
                      A conexão será feita com autorização
                      segura do Google. O MirraCRM solicitará
                      permissão para enviar e-mails pela conta
                      conectada.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleConnectGoogle}
                disabled={connectingGoogle}
              >
                {connectingGoogle ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Conectar Gmail
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Alterar Senha
          </CardTitle>

          <CardDescription>
            Defina uma nova senha pessoal para sua conta
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleChangePassword}
            className="space-y-3 max-w-sm"
          >
            {passwordMsg && (
              <div
                className={`p-2.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}
              >
                {passwordMsg.type === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}

                <span>{passwordMsg.text}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Nova senha
              </label>

              <input
                type="password"
                required
                minLength={6}
                value={novaSenha}
                onChange={(e) =>
                  setNovaSenha(e.target.value)
                }
                placeholder="Mínimo 6 caracteres"
                className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Confirmar nova senha
              </label>

              <input
                type="password"
                required
                minLength={6}
                value={confirmarSenha}
                onChange={(e) =>
                  setConfirmarSenha(e.target.value)
                }
                placeholder="Repita a nova senha"
                className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button
              type="submit"
              disabled={changingPassword}
              className="w-full sm:w-auto"
            >
              {changingPassword
                ? 'Salvando...'
                : 'Salvar nova senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.common.theme}
          </CardTitle>

          <CardDescription>
            Escolha entre modo claro e escuro
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                theme !== 'light' && toggleTheme()
              }
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                theme === 'light'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-secondary'
              )}
            >
              <Sun className="w-5 h-5 text-warning" />

              <span className="font-medium text-sm">
                {t.common.light}
              </span>
            </button>

            <button
              onClick={() =>
                theme !== 'dark' && toggleTheme()
              }
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                theme === 'dark'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-secondary'
              )}
            >
              <Moon className="w-5 h-5 text-primary" />

              <span className="font-medium text-sm">
                {t.common.dark}
              </span>
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

          <CardDescription>
            Selecione o idioma da interface
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  code: 'pt',
                  flag: '🇧🇷',
                  label: 'Português',
                },
                {
                  code: 'en',
                  flag: '🇺🇸',
                  label: 'English',
                },
                {
                  code: 'es',
                  flag: '🇪🇸',
                  label: 'Español',
                },
              ] as const
            ).map((lang) => (
              <button
                key={lang.code}
                onClick={() =>
                  setLanguage(lang.code)
                }
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                  currentLanguage === lang.code
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-secondary'
                )}
              >
                <span className="text-2xl">
                  {lang.flag}
                </span>

                <span className="text-sm font-medium">
                  {lang.label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        {t.common.logout}
      </Button>
    </div>
  );
}