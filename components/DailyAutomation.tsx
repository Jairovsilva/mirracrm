'use client';

import { useEffect } from 'react';
import { useCRMStore, runDailyAlertAutomation } from '../src/store/crmStore';

export function DailyAutomation() {
  const currentUser = useCRMStore(s => s.currentUser);

  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      runDailyAlertAutomation();
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);

  return null;
}