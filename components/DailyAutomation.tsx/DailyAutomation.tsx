'use client';

import { useEffect } from 'react';
import { useCRMStore, runDailyAlertAutomation } from '@/src/store/crmStore';

export function DailyAutomation() {
  const currentUser = useCRMStore(s => s.currentUser);

  useEffect(() => {
    if (!currentUser) return;
    runDailyAlertAutomation();
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
