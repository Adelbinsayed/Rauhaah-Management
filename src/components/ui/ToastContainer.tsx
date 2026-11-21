import React from 'react';
import { useAppStore } from '@/app/store';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, FolderOpen } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toast, hideToast } = useAppStore();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-positive" strokeWidth={1.5} />,
    error: <AlertCircle className="w-4 h-4 text-negative" strokeWidth={1.5} />,
    warning: <AlertTriangle className="w-4 h-4 text-warning" strokeWidth={1.5} />,
    info: <Info className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />,
  };

  const borderStyles = {
    success: 'border-positive/40',
    error: 'border-negative/40',
    warning: 'border-warning/40',
    info: 'border-hairline-strong',
  };

  const type = toast.type || (toast.filePath ? 'success' : 'info');

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-surface border ${borderStyles[type]} text-ink rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)] max-w-md select-none`}
    >
      <div className="w-8 h-8 rounded-lg bg-raised border border-hairline flex items-center justify-center shrink-0">
        {icons[type]}
      </div>

      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="text-xs font-medium text-ink truncate">
            {toast.title}
          </div>
        )}
        <div className="text-xs text-ink-secondary leading-snug">
          {toast.message}
        </div>
      </div>

      {toast.filePath && (
        <button
          type="button"
          onClick={() => invoke('reveal_in_explorer', { path: toast.filePath })}
          className="px-2.5 py-1.5 rounded-lg bg-accent text-accent-fg text-xs font-medium hover:bg-accent-hover transition-colors duration-150 ease-unslop flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Show in Folder</span>
        </button>
      )}

      <button
        type="button"
        onClick={hideToast}
        className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-raised transition-colors duration-150 ease-unslop cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </div>
  );
};
