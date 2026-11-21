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
    <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-hairline bg-surface ${className}`}>
      {/* Preset Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 text-ink-muted text-xs font-medium mr-1">
          <Calendar className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
          <span>Period</span>
        </div>
        {PRESET_OPTIONS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPresetChange(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ease-unslop cursor-pointer ${
              preset === p.key
                ? 'bg-accent text-accent-fg font-semibold'
                : 'bg-raised border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-strong'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date Pickers */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-raised border border-hairline px-2.5 py-1.5 rounded-lg">
          <span className="text-xs text-ink-muted">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              onStartDateChange(e.target.value);
              onPresetChange('custom');
            }}
            className="bg-transparent text-ink font-mono text-xs tabular-nums focus:outline-none cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-raised border border-hairline px-2.5 py-1.5 rounded-lg">
          <span className="text-xs text-ink-muted">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              onEndDateChange(e.target.value);
              onPresetChange('custom');
            }}
            className="bg-transparent text-ink font-mono text-xs tabular-nums focus:outline-none cursor-pointer"
          />
        </div>

        {(startDate || endDate) && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised transition-colors duration-150 ease-unslop cursor-pointer"
            title="Reset Date Range"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
};
