import React from 'react';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  highlight?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  trend,
  highlight = false,
  className = '',
}) => {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        highlight
          ? 'bg-brand-gold/10 border-brand-gold/50 text-white shadow-sm'
          : 'bg-white dark:bg-brand-surface border-neutral-200 dark:border-brand-border text-neutral-900 dark:text-white shadow-sm hover:border-neutral-300 dark:hover:border-brand-gold/30'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        {icon && (
          <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-brand-black/60 flex items-center justify-center text-brand-gold shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="text-xl font-bold font-mono tracking-tight text-neutral-900 dark:text-white">
        {value}
      </div>

      {(subtitle || trend) && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`font-semibold text-[11px] px-1.5 py-0.2 rounded ${
                trend.isPositive
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
