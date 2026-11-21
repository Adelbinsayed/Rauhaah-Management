import React from 'react';
import { useAppStore } from '@/app/store';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, FolderOpen } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toast, hideToast } = useAppStore();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    error: <AlertCircle className="w-4 h-4 text-rose-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    info: <Info className="w-4 h-4 text-sky-400" />,
  };

  const borderStyles = {
    success: 'border-emerald-500/50',
    error: 'border-rose-500/50',
    warning: 'border-amber-500/50',
    info: 'border-sky-500/50',
  };

  const type = toast.type || (toast.filePath ? 'success' : 'info');

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-white dark:bg-brand-surface border ${borderStyles[type]} text-neutral-900 dark:text-white rounded-xl shadow-2xl animate-in slide-in-from-bottom duration-200 max-w-md select-none`}
    >
      <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-brand-black/60 flex items-center justify-center shrink-0">
        {icons[type]}
      </div>

      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="text-xs font-bold text-neutral-900 dark:text-white truncate">
            {toast.title}
          </div>
        )}
        <div className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-snug">
          {toast.message}
        </div>
      </div>

      {toast.filePath && (
        <button
          type="button"
          onClick={() => invoke('reveal_in_explorer', { path: toast.filePath })}
          className="px-2.5 py-1.5 rounded-lg bg-brand-gold text-brand-black text-[11px] font-bold hover:bg-brand-gold-hover transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Show in Folder</span>
        </button>
      )}

      <button
        type="button"
        onClick={hideToast}
        className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
