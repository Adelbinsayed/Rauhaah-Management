import React from 'react';
import { Calendar, X } from 'lucide-react';

export type DatePresetKey = 'today' | 'yesterday' | '7days' | 'month' | 'all' | 'custom';

export interface DateRangeBarProps {
  preset: DatePresetKey;
  startDate: string;
  endDate: string;
  onPresetChange: (preset: DatePresetKey) => void;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onReset?: () => void;
  className?: string;
}

const PRESET_OPTIONS: { key: DatePresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7days', label: 'Last 7 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

export const DateRangeBar: React.FC<DateRangeBarProps> = ({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
  onReset,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-brand-border bg-neutral-50/50 dark:bg-brand-surface/40 ${className}`}>
      {/* Preset Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 text-neutral-400 text-xs font-semibold uppercase tracking-wider mr-1">
          <Calendar className="w-3.5 h-3.5 text-brand-gold" />
          <span>Period:</span>
        </div>
        {PRESET_OPTIONS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPresetChange(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              preset === p.key
                ? 'bg-brand-gold text-brand-black shadow-sm font-bold'
                : 'bg-white dark:bg-brand-black/60 border border-neutral-200 dark:border-brand-border text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:border-brand-gold/40'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date Pickers */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white dark:bg-brand-black/80 border border-neutral-200 dark:border-brand-border px-2.5 py-1 rounded-lg">
          <span className="text-[10px] text-neutral-400 uppercase font-semibold">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              onStartDateChange(e.target.value);
              onPresetChange('custom');
            }}
            className="bg-transparent text-neutral-900 dark:text-white font-mono text-xs focus:outline-none cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-brand-black/80 border border-neutral-200 dark:border-brand-border px-2.5 py-1 rounded-lg">
          <span className="text-[10px] text-neutral-400 uppercase font-semibold">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              onEndDateChange(e.target.value);
              onPresetChange('custom');
            }}
            className="bg-transparent text-neutral-900 dark:text-white font-mono text-xs focus:outline-none cursor-pointer"
          />
        </div>

        {(startDate || endDate) && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
            title="Reset Date Range"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
