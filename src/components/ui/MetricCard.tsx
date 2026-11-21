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
      className={`p-5 rounded-xl border transition-colors duration-150 ease-unslop ${
        highlight
          ? 'bg-accent/10 border-accent/35 text-ink'
          : 'bg-surface border-hairline text-ink hover:border-hairline-strong shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-ink-muted">
          {label}
        </span>
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-raised border border-hairline flex items-center justify-center text-ink-muted shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="text-2xl font-medium font-mono tabular-nums text-ink">
        {value}
      </div>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`font-medium text-xs px-1.5 py-0.5 rounded tabular-nums ${
                trend.isPositive
                  ? 'bg-positive/10 text-positive'
                  : 'bg-negative/10 text-negative'
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-ink-muted truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
