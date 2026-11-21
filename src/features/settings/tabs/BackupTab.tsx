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
        <div className="p-3.5 rounded-xl border border-hairline bg-surface">
          <div className="flex items-center gap-1.5 text-ink-secondary text-[11px] font-medium mb-1">
            <HardDrive className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
            <span>DB File Size</span>
          </div>
          <div className="text-base font-bold text-ink font-mono tabular-nums">
            {dbHealth?.dbSizeFormatted || '...'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-hairline bg-surface">
          <div className="flex items-center gap-1.5 text-ink-secondary text-[11px] font-medium mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-positive" strokeWidth={1.5} />
            <span>Integrity</span>
          </div>
          <div className="text-base font-bold text-positive">
            {dbHealth?.integrityStatus === 'ok' ? 'Verified OK' : dbHealth?.integrityStatus || 'Checking'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-hairline bg-surface">
          <div className="flex items-center gap-1.5 text-ink-secondary text-[11px] font-medium mb-1">
            <Receipt className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
            <span>Total Sales</span>
          </div>
          <div className="text-base font-bold text-ink font-mono tabular-nums">
            {dbHealth?.totalSalesCount ?? '0'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-hairline bg-surface">
          <div className="flex items-center gap-1.5 text-ink-secondary text-[11px] font-medium mb-1">
            <Building className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
            <span>Customers</span>
          </div>
          <div className="text-base font-bold text-ink font-mono tabular-nums">
            {dbHealth?.totalCustomersCount ?? '0'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-hairline bg-surface">
          <div className="flex items-center gap-1.5 text-ink-secondary text-[11px] font-medium mb-1">
            <Scale className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
            <span>Products</span>
          </div>
          <div className="text-base font-bold text-ink font-mono tabular-nums">
            {dbHealth?.totalProductsCount ?? '0'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-hairline bg-surface">
          <div className="flex items-center gap-1.5 text-ink-secondary text-[11px] font-medium mb-1">
            <Clock className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
            <span>Last Snapshot</span>
          </div>
          <div className="text-[11px] font-medium text-ink-secondary truncate">
            {dbHealth?.lastBackupAt ? formatDhakaDateTime(dbHealth.lastBackupAt) : 'None yet'}
          </div>
        </div>
      </div>

      {/* Create Backup Action Bar */}
      <div className="p-4 rounded-xl border border-hairline bg-surface space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Create Instant Online Snapshot (VACUUM INTO)
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Takes a safe, non-blocking defragmented snapshot of your active sales and catalog without locking transactions.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshBackups}
            disabled={loadingBackups}
            className="p-1.5 rounded-lg border border-hairline hover:border-hairline-strong text-ink-muted hover:text-ink transition-colors cursor-pointer"
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
            className="flex-1 px-3.5 py-2 bg-canvas border border-hairline rounded-lg text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={onCreateBackup}
            disabled={creatingBackup}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{creatingBackup ? 'Creating Snapshot…' : 'Take Snapshot Now'}</span>
          </button>
        </div>
      </div>

      {/* Snapshots List Table */}
      <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-ink">
              Available Database Snapshots ({backups.length})
            </h3>
            <p className="text-[11px] text-ink-secondary">
              Stored safely in local app directory <code>data/backups/</code>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-subtle border-b border-hairline text-ink-secondary font-medium">
              <tr>
                <th className="px-4 py-3">Snapshot Name</th>
                <th className="px-4 py-3">Classification</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-secondary">
              {loadingBackups ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                    Loading snapshots…
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                    No database snapshots found yet. Click &ldquo;Take Snapshot Now&rdquo; above.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-subtle/60 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-ink">
                      {b.filename}
                    </td>
                    <td className="px-4 py-3">
                      {b.isSafetySnapshot ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/15 border border-warning/25 text-warning">
                          Pre-Restore Safety Copy
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-positive/15 border border-positive/25 text-positive">
                          Manual Snapshot
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-ink-muted whitespace-nowrap">
                      {formatDhakaDateTime(b.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-ink-secondary">
                      {b.sizeFormatted}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenRestoreModal(b)}
                          className="px-2.5 py-1 rounded-md bg-canvas border border-warning/35 hover:border-warning text-warning text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Restore active database from this snapshot"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportBackup(b.filename)}
                          className="px-2.5 py-1 rounded-md bg-canvas border border-hairline hover:border-hairline-strong text-ink-secondary hover:text-ink text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Copy snapshot file to Downloads folder"
                        >
                          <Download className="w-3 h-3 text-accent-ink" />
                          <span>Save to Downloads</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBackup(b.filename)}
                          className="p-1 rounded hover:bg-negative/15 text-ink-muted hover:text-negative transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface border border-warning/40 rounded-2xl shadow-lg p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-warning/15 border border-warning/30 flex items-center justify-center text-warning">
              <RotateCcw className="w-6 h-6" strokeWidth={1.5} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-ink">Confirm Database Restore</h3>
              <p className="text-xs text-ink-secondary mt-1">
                Are you sure you want to restore the system database to snapshot:
              </p>
              <div className="mt-2 p-2.5 bg-canvas border border-hairline rounded-lg font-mono text-xs text-accent-ink break-all">
                {restoreConfirmModal.filename}
              </div>
            </div>

            <div className="p-3 bg-canvas border border-hairline rounded-xl text-left text-xs space-y-2 text-ink-secondary">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-positive shrink-0 mt-0.5" />
                <span>
                  <strong className="text-ink">Automatic Safety Net:</strong> A pre-restore safety copy of your current active database will be created first before applying this snapshot.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
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
                className="py-2.5 px-4 rounded-lg bg-canvas border border-hairline hover:border-hairline-strong text-ink-secondary hover:text-ink font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onExecuteRestore}
                disabled={restoringBackup}
                className="py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
