import type { BackupItem, DbHealthStats } from '@/data/repositories/backupRepo';
import { formatDhakaDateTime } from '@/lib/dates';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  Database,
  Download,
  HardDrive,
  Receipt,
  RefreshCw,
  RotateCcw,
  Scale,
  Trash2,
} from 'lucide-react';
import React from 'react';

interface BackupTabProps {
  dbHealth: DbHealthStats | null;
  backups: BackupItem[];
  loadingBackups: boolean;
  creatingBackup: boolean;
  backupLabel: string;
  onBackupLabelChange: (val: string) => void;
  onCreateBackup: () => void;
  onExportBackup: (filename: string) => void;
  onDeleteBackup: (filename: string) => void;
  onRefreshBackups: () => void;
  restoringBackup: boolean;
  restoreConfirmModal: BackupItem | null;
  onOpenRestoreModal: (item: BackupItem) => void;
  onCloseRestoreModal: () => void;
  onExecuteRestore: () => void;
}

export const BackupTab: React.FC<BackupTabProps> = ({
  dbHealth,
  backups,
  loadingBackups,
  creatingBackup,
  backupLabel,
  onBackupLabelChange,
  onCreateBackup,
  onExportBackup,
  onDeleteBackup,
  onRefreshBackups,
  restoringBackup,
  restoreConfirmModal,
  onOpenRestoreModal,
  onCloseRestoreModal,
  onExecuteRestore,
}) => {
  return (
    <div className="space-y-6">
      {/* Health Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider mb-1">
            <HardDrive className="w-3.5 h-3.5 text-brand-gold" />
            <span>DB File Size</span>
          </div>
          <div className="text-base font-bold text-neutral-900 dark:text-white font-mono">
            {dbHealth?.dbSizeFormatted || '...'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Integrity</span>
          </div>
          <div className="text-base font-bold text-emerald-400 uppercase">
            {dbHealth?.integrityStatus === 'ok' ? 'Verified OK' : dbHealth?.integrityStatus || 'Checking'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider mb-1">
            <Receipt className="w-3.5 h-3.5 text-brand-gold" />
            <span>Total Sales</span>
          </div>
          <div className="text-base font-bold text-neutral-900 dark:text-white font-mono">
            {dbHealth?.totalSalesCount ?? '0'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider mb-1">
            <Building className="w-3.5 h-3.5 text-brand-gold" />
            <span>Customers</span>
          </div>
          <div className="text-base font-bold text-neutral-900 dark:text-white font-mono">
            {dbHealth?.totalCustomersCount ?? '0'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider mb-1">
            <Scale className="w-3.5 h-3.5 text-brand-gold" />
            <span>Products</span>
          </div>
          <div className="text-base font-bold text-neutral-900 dark:text-white font-mono">
            {dbHealth?.totalProductsCount ?? '0'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider mb-1">
            <Clock className="w-3.5 h-3.5 text-brand-gold" />
            <span>Last Snapshot</span>
          </div>
          <div className="text-[11px] font-semibold text-neutral-300 truncate">
            {dbHealth?.lastBackupAt ? formatDhakaDateTime(dbHealth.lastBackupAt) : 'None yet'}
          </div>
        </div>
      </div>

      {/* Create Backup Action Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Create Instant Online Snapshot (VACUUM INTO)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Takes a safe, non-blocking defragmented snapshot of your active sales and catalog without locking transactions.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshBackups}
            disabled={loadingBackups}
            className="p-1.5 rounded-lg border border-brand-border hover:border-brand-gold/60 text-neutral-400 hover:text-white cursor-pointer"
            title="Refresh snapshots list"
          >
            <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
          <input
            type="text"
            placeholder="Optional snapshot label (e.g. Before stock count, Weekend close)"
            value={backupLabel}
            onChange={(e) => onBackupLabelChange(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          />
          <button
            type="button"
            onClick={onCreateBackup}
            disabled={creatingBackup}
            className="px-4 py-2 rounded-lg bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold-hover transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{creatingBackup ? 'Creating Snapshot…' : 'Take Snapshot Now'}</span>
          </button>
        </div>
      </div>

      {/* Snapshots List Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-200 dark:border-brand-border flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
              Available Database Snapshots ({backups.length})
            </h3>
            <p className="text-[11px] text-neutral-400">
              Stored safely in local app directory <code>data/backups/</code>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-brand-black/60 border-b border-neutral-200 dark:border-brand-border text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Snapshot Name</th>
                <th className="px-4 py-3">Classification</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-brand-border text-neutral-700 dark:text-neutral-200">
              {loadingBackups ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                    Loading snapshots…
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                    No database snapshots found yet. Click &ldquo;Take Snapshot Now&rdquo; above.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                    <td className="px-4 py-3 font-mono font-semibold text-neutral-900 dark:text-white">
                      {b.filename}
                    </td>
                    <td className="px-4 py-3">
                      {b.isSafetySnapshot ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          Pre-Restore Safety Copy
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                          Manual Snapshot
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                      {formatDhakaDateTime(b.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-neutral-300">
                      {b.sizeFormatted}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenRestoreModal(b)}
                          className="px-2.5 py-1 rounded bg-brand-surface border border-amber-500/40 hover:border-amber-400 text-amber-400 hover:text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Restore active database from this snapshot"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportBackup(b.filename)}
                          className="px-2.5 py-1 rounded bg-brand-surface border border-brand-border hover:border-brand-gold text-neutral-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Copy snapshot file to Downloads folder"
                        >
                          <Download className="w-3 h-3 text-brand-gold" />
                          <span>Save to Downloads</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBackup(b.filename)}
                          className="p-1 rounded hover:bg-red-500/15 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {restoreConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-brand-surface border border-amber-500/50 rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Confirm Database Restore</h3>
              <p className="text-xs text-neutral-300 mt-1">
                Are you sure you want to restore the system database to snapshot:
              </p>
              <div className="mt-2 p-2.5 bg-brand-black border border-brand-border rounded-lg font-mono text-xs text-brand-gold break-all">
                {restoreConfirmModal.filename}
              </div>
            </div>

            <div className="p-3 bg-brand-black/70 border border-brand-border rounded-xl text-left text-xs space-y-2 text-neutral-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Automatic Safety Net:</strong> A pre-restore safety copy of your current active database will be created first before applying this snapshot.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Any sales or inventory adjustments created after this snapshot&apos;s timestamp ({formatDhakaDateTime(restoreConfirmModal.createdAt)}) will be overwritten.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onCloseRestoreModal}
                disabled={restoringBackup}
                className="py-2.5 px-4 rounded-xl bg-brand-black border border-brand-border hover:border-neutral-500 text-neutral-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onExecuteRestore}
                disabled={restoringBackup}
                className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-brand-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${restoringBackup ? 'animate-spin' : ''}`} />
                <span>{restoringBackup ? 'Restoring…' : 'Yes, Restore Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
