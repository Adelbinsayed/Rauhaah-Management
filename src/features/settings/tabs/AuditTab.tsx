import type { AuditLogEntry } from '@/domain/auth/types';
import { formatDhakaDateTime } from '@/lib/dates';
import React, { useState } from 'react';

interface AuditTabProps {
  auditLogs: AuditLogEntry[];
  loadingAudit: boolean;
  onRefresh: () => void;
}

function formatAuditDetails(details: string): string {
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

export const AuditTab: React.FC<AuditTabProps> = ({
  auditLogs,
  loadingAudit,
  onRefresh,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
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
              auditLogs.map((log) => {
                const isExpanded = expandedIds.has(log.id);
                return (
                <tr key={log.id} className="hover:bg-subtle/60 transition-colors">
                  <td className="px-4 py-2.5 text-ink-muted font-mono tabular-nums text-[11px] whitespace-nowrap align-top">
                    {formatDhakaDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink align-top">
                    {log.username ? `@${log.username}` : 'System'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-accent-ink text-[11px] align-top">
                    {log.action}
                  </td>
                  <td
                    title={log.details || ''}
                    className="px-4 py-2.5 text-ink-secondary text-[11px] max-w-md align-top"
                  >
                    {log.details ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(log.id)}
                        className="text-left w-full cursor-pointer hover:text-ink transition-colors"
                      >
                        {isExpanded ? (
                          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] bg-canvas p-2 rounded border border-hairline">
                            {formatAuditDetails(log.details)}
                          </pre>
                        ) : (
                          <div className="truncate max-w-xs">{log.details}</div>
                        )}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
