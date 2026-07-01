'use client';

import { useTranslation } from '@/src/lib/useTranslation';
import type { Temperature } from '@/src/store/crmStore';
import { Snowflake, ThermometerSun, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TemperatureBadge({ temperature, size = 'sm' }: { temperature: Temperature; size?: 'sm' | 'xs' }) {
  const { t } = useTranslation();
  const config = {
    frio: { label: t.temperature.frio, icon: Snowflake, classes: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
    morno: { label: t.temperature.morno, icon: ThermometerSun, classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
    quente: { label: t.temperature.quente, icon: Flame, classes: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  };
  const { label, icon: Icon, classes } = config[temperature];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-[10px]',
      classes
    )}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
      {label}
    </span>
  );
}
