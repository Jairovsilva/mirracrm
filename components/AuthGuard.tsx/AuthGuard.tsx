'use client';

import { useEffect, useState } from 'react';
import { useCRMStore, restoreSession } from '@/store/useCRMStore';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const currentUser = useCRMStore(s => s.currentUser);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Only restore session if not already logged in
    if (currentUser) {
      setChecking(false);
      return;
    }

    restoreSession().finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return fallback ?? null;
  }

  return <>{children}</>;
}

📁 Arquivo: components/DailyAutomation.tsx

Componente novo — executa as automações diárias. Cole em components/DailyAutomation.tsx.

typescript'use client';

import { useEffect } from 'react';
import { useCRMStore, runDailyAlertAutomation } from '@/store/useCRMStore';

export function DailyAutomation() {
  const currentUser = useCRMStore(s => s.currentUser);

  useEffect(() => {
    if (!currentUser) return;
    // Run after a short delay to not block render
    const timer = setTimeout(() => {
      runDailyAlertAutomation();
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // invisible component
}