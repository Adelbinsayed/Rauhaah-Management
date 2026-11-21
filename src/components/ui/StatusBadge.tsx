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
  completed: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  voided: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
  danger: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
  returned: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  warning: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  pending: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
  gold: 'bg-brand-gold/15 border-brand-gold/40 text-brand-gold',
  neutral: 'bg-neutral-500/15 border-neutral-500/30 text-neutral-400',
  sealed_product: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  loose_decant: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  empty_bottle: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  accessory: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style} ${className}`}
    >
      {displayLabel}
    </span>
  );
};
