import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, FileSpreadsheet, FolderOpen, X } from 'lucide-react';
import { useAppStore } from '@/app/store';
import { isTauriRuntime } from '@/data/db';
import { invoke } from '@tauri-apps/api/core';

export const ExportSuccessModal: React.FC = () => {
  const { exportModal, closeExportModal } = useAppStore();
  const [openedFolder, setOpenedFolder] = useState(false);

  useEffect(() => {
    setOpenedFolder(false);
  }, [exportModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exportModal && (e.key === 'Escape' || e.key === 'Enter')) {
        closeExportModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exportModal, closeExportModal]);

  if (!exportModal) return null;

  const handleOpenFolder = async () => {
    if (isTauriRuntime() && exportModal.filePath) {
      try {
        setOpenedFolder(true);
        await invoke('reveal_in_explorer', { path: exportModal.filePath.trim() });
      } catch (err) {
        console.warn('Error invoking reveal_in_explorer:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-neutral-900 border border-brand-border rounded-2xl shadow-2xl p-6 space-y-5 text-white relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeExportModal}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Success Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            {exportModal.title || 'File Downloaded Successfully!'}
          </h3>
          <p className="text-xs text-neutral-400 max-w-sm">
            {exportModal.message || 'Your CSV report has been exported and saved to your computer.'}
          </p>
        </div>

        {/* File Information Card */}
        <div className="p-3.5 rounded-xl bg-neutral-800/80 border border-brand-border/80 space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white truncate font-mono">
                {exportModal.filename}
              </div>
              {exportModal.rowCount !== undefined && (
                <div className="text-[11px] text-neutral-400">
                  {exportModal.rowCount} record{exportModal.rowCount === 1 ? '' : 's'} exported
                </div>
              )}
            </div>
          </div>

          {exportModal.filePath && (
            <div className="pt-2 border-t border-brand-border/60 space-y-1">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Saved to Location:
              </span>
              <div className="text-[11px] text-brand-gold font-mono break-all bg-neutral-900/80 p-2 rounded-lg border border-brand-border/40 select-all">
                {exportModal.filePath}
              </div>
            </div>
          )}
        </div>

        {/* Excel Compatibility Note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>UTF-8 BOM format (Ready to open in Microsoft Excel)</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          {exportModal.filePath && (
            <button
              type="button"
              onClick={handleOpenFolder}
              className="flex-1 py-2.5 px-4 rounded-xl border border-brand-border bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {openedFolder ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Opened Folder</span>
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4 text-brand-gold" />
                  <span>Show in Folder</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={closeExportModal}
            autoFocus
            className="flex-1 py-2.5 px-4 rounded-xl bg-brand-gold hover:bg-brand-gold-light text-brand-black text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-brand-gold/20 cursor-pointer"
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
