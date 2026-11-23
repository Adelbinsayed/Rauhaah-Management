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

  useEffect(() => {
    if (!exportModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExportModal();
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] p-6 space-y-5 text-ink relative">
        {/* Close Button */}
        <button
          type="button"
          aria-label="Close modal"
          onClick={closeExportModal}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised transition-colors duration-150 ease-unslop cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>

        {/* Hero Success Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2">
          <div className="w-12 h-12 rounded-xl bg-positive/10 border border-positive/25 flex items-center justify-center text-positive mb-1">
            <CheckCircle2 className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-medium text-ink">
            {(exportModal.title || 'File downloaded successfully').replace(/!+$/, '')}
          </h3>
          <p className="text-xs text-ink-muted max-w-sm">
            {exportModal.message || 'Your CSV report has been exported and saved to your computer.'}
          </p>
        </div>

        {/* File Information Card */}
        <div className="p-3.5 rounded-xl bg-raised border border-hairline space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink truncate font-mono">
                {exportModal.filename}
              </div>
              {exportModal.rowCount !== undefined && (
                <div className="text-xs text-ink-muted tabular-nums">
                  {exportModal.rowCount} record{exportModal.rowCount === 1 ? '' : 's'} exported
                </div>
              )}
            </div>
          </div>

          {exportModal.filePath && (
            <div className="pt-2 border-t border-hairline space-y-1">
              <span className="text-xs font-medium text-ink-muted">
                Saved location
              </span>
              <div className="text-xs text-accent-ink font-mono break-all bg-canvas p-2 rounded-lg border border-hairline select-all">
                {exportModal.filePath}
              </div>
            </div>
          )}
        </div>

        {/* Excel Compatibility Note */}
        <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-positive" />
          <span>UTF-8 BOM format (ready for Microsoft Excel)</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          {exportModal.filePath && (
            <button
              type="button"
              onClick={handleOpenFolder}
              className="flex-1 py-2.5 px-4 rounded-lg border border-hairline bg-raised hover:border-hairline-strong text-ink text-xs font-medium flex items-center justify-center gap-2 transition-colors duration-150 ease-unslop cursor-pointer"
            >
              {openedFolder ? (
                <>
                  <Check className="w-4 h-4 text-positive" strokeWidth={1.5} />
                  <span className="text-positive">Opened Folder</span>
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                  <span>Show in Folder</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={closeExportModal}
            autoFocus
            className="flex-1 py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 ease-unslop cursor-pointer"
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
