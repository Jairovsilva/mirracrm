'use client';

import { useTranslation } from '@/src/lib/useTranslation';
import type { Stage } from '@/src/store/crmStore';
import { cn } from '@/lib/utils';

const stageColors: Record<Stage, string> = {
  entrada: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  enriquecer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  reuniao: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  fim_cadencia: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400',
};

export function StageBadge({ stage, size = 'sm' }: { stage: Stage; size?: 'sm' | 'xs' }) {
  const { t } = useTranslation();
  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-[10px]',
      stageColors[stage]
    )}>
      {t.stages[stage]}
    </span>
  );
}
