'use client';

import { useEffect, useState } from 'react';
import { useCRMStore, restoreSession } from '../src/store/crmStore';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const currentUser = useCRMStore(s => s.currentUser);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      restoreSession();
    }
    setChecking(false);
  }, []);

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