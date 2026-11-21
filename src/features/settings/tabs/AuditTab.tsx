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
    <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
      <div className="p-4 border-b border-hairline flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-ink">
            Recent Security &amp; Audit Events
          </h3>
          <p className="text-[11px] text-ink-secondary">
            Logins, credential updates, user creations, and setting modifications
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-accent-ink hover:underline cursor-pointer font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-subtle border-b border-hairline text-ink-secondary font-medium">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-ink-secondary">
            {loadingAudit ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  Loading audit logs…
                </td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-subtle/60 transition-colors">
                  <td className="px-4 py-2.5 text-ink-muted font-mono tabular-nums text-[11px] whitespace-nowrap">
                    {formatDhakaDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {log.username ? `@${log.username}` : 'System'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-accent-ink text-[11px]">
                    {log.action}
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary text-[11px] max-w-xs truncate">
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
