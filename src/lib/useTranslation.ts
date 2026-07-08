'use client';

import { useCRMStore } from '@/src/store/crmStore';
import { translations, type Language } from '@/src/lib/i18n';

export function useTranslation() {
  const currentLanguage = useCRMStore((s) => s.language);
  const t = translations[currentLanguage as Language];
  return { t, lang: currentLanguage };
}
