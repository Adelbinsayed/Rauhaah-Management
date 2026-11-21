import React from 'react';

interface SecurityTabProps {
  idleLockMinutes: number;
  onIdleLockMinutesChange: (val: number) => void;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({
  idleLockMinutes,
  onIdleLockMinutesChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
          Terminal Idle Lock Timeout
        </label>
        <select
          value={idleLockMinutes}
          onChange={(e) => onIdleLockMinutesChange(Number(e.target.value))}
          className="w-full max-w-xs px-3.5 py-2.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
        >
          <option value={1}>1 Minute</option>
          <option value={2}>2 Minutes</option>
          <option value={5}>5 Minutes (Default)</option>
          <option value={10}>10 Minutes</option>
          <option value={15}>15 Minutes</option>
          <option value={30}>30 Minutes</option>
          <option value={0}>Never Auto-Lock</option>
        </select>
        <p className="text-[11px] text-neutral-400 mt-1">
          When no mouse or keyboard activity occurs for this duration, the screen locks automatically to protect your POS terminal.
        </p>
      </div>
    </div>
  );
};
