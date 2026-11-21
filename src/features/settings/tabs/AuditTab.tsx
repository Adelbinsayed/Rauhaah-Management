import type { AuditLogEntry } from '@/domain/auth/types';
import { formatDhakaDateTime } from '@/lib/dates';
import React from 'react';

interface AuditTabProps {
  auditLogs: AuditLogEntry[];
  loadingAudit: boolean;
  onRefresh: () => void;
}

export const AuditTab: React.FC<AuditTabProps> = ({
  auditLogs,
  loadingAudit,
  onRefresh,
}) => {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface overflow-hidden shadow-sm">
      <div className="p-4 border-b border-neutral-200 dark:border-brand-border flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
            Recent Security &amp; Audit Events
          </h3>
          <p className="text-[11px] text-neutral-400">
            Logins, credential updates, user creations, and setting modifications
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-brand-gold hover:underline cursor-pointer"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 dark:bg-brand-black/60 border-b border-neutral-200 dark:border-brand-border text-neutral-500 uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-brand-border text-neutral-700 dark:text-neutral-200">
            {loadingAudit ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  Loading audit logs…
                </td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                  <td className="px-4 py-2.5 text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                    {formatDhakaDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-neutral-900 dark:text-white">
                    {log.username ? `@${log.username}` : 'System'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-brand-gold text-[11px]">
                    {log.action}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400 text-[11px] max-w-xs truncate">
                    {log.details || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
