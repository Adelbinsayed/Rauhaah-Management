import React from 'react';

export type StatusVariant =
  | 'completed'
  | 'voided'
  | 'returned'
  | 'pending'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'gold'
  | 'sealed_product'
  | 'loose_decant'
  | 'empty_bottle'
  | 'accessory';

interface StatusBadgeProps {
  status?: string;
  variant?: StatusVariant;
  label?: string;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  completed: 'bg-emerald-600/10 border-emerald-600/25 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
  success: 'bg-emerald-600/10 border-emerald-600/25 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
  voided: 'bg-rose-600/10 border-rose-600/25 text-rose-700 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400',
  danger: 'bg-rose-600/10 border-rose-600/25 text-rose-700 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400',
  returned: 'bg-amber-600/10 border-amber-600/25 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
  warning: 'bg-amber-600/10 border-amber-600/25 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
  pending: 'bg-sky-600/10 border-sky-600/25 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-400',
  gold: 'bg-accent/15 border-accent/35 text-accent-ink',
  neutral: 'bg-raised border-hairline text-ink-secondary',
  sealed_product: 'bg-sky-600/10 border-sky-600/25 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-400',
  loose_decant: 'bg-accent/15 border-accent/35 text-accent-ink',
  empty_bottle: 'bg-raised border-hairline-strong text-ink-secondary',
  accessory: 'bg-emerald-600/10 border-emerald-600/25 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  label,
  className = '',
}) => {
  const normalizedKey = (variant || status?.toLowerCase() || 'neutral') as StatusVariant;
  const style = variantStyles[normalizedKey] || variantStyles.neutral;
  const displayLabel = label || status?.replace(/_/g, ' ') || 'Unknown';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium capitalize border ${style} ${className}`}
    >
      {displayLabel}
    </span>
  );
};
