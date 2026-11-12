import { CheckCircle2, Database, FolderOpen, Moon, Package, RefreshCw, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { DbInfo } from '@/data/db';
import { type BranchRow, systemRepo } from '@/data/repositories/systemRepo';
import { formatDhakaDateTime } from '@/lib/dates';
import { en } from '@/lib/i18n/en';
import { Sidebar } from './Sidebar';
import { useAppStore } from './store';

export function App() {
  const { activeRoute, theme, toggleTheme } = useAppStore();
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSystemState = useCallback(async () => {
    const info = await systemRepo.getDbInfo();
    setDbInfo(info);
    if (info) {
      const [branchRows, note] = await Promise.all([
        systemRepo.getBranches(),
        systemRepo.getSetting('phase0_check'),
      ]);
      setBranches(branchRows);
      setTestNote(note);
    }
  }, []);

  useEffect(() => {
    loadSystemState();
  }, [loadSystemState]);

  const handleWriteTest = async () => {
    if (!dbInfo) return;
    setSaving(true);
    try {
      const stamp = new Date().toISOString();
      await systemRepo.setSetting('phase0_check', `Verified at ${stamp}`, dbInfo.deviceId);
      await loadSystemState();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-white text-neutral-900 dark:bg-brand-black dark:text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 shrink-0 border-b border-neutral-200 dark:border-brand-border px-6 flex items-center justify-between bg-white dark:bg-brand-black">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold capitalize tracking-tight">
              {activeRoute.replace('-', ' ')}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface">
              <span
                className={
                  dbInfo
                    ? 'w-2 h-2 rounded-full bg-emerald-500'
                    : 'w-2 h-2 rounded-full bg-amber-500'
                }
              />
              <span className="text-neutral-600 dark:text-neutral-300">
                {dbInfo ? en.common.connected : en.common.disconnected}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? en.common.lightMode : en.common.darkMode}
              className="p-2 rounded-md border border-neutral-200 dark:border-brand-border hover:bg-neutral-100 dark:hover:bg-brand-surface transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-brand-gold" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-700" />
              )}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeRoute === 'dashboard' ? (
            <div className="max-w-4xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                  Phase 0: Foundation Ready
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Portable SQLite (WAL mode), atomic Rust batch transactions, and sync-ready schema.
                </p>
              </div>

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-brand-gold">
                    <Database className="w-4 h-4" />
                    <span>{en.common.dbStatus}</span>
                  </div>
                  {dbInfo ? (
                    <dl className="text-xs space-y-1.5 text-neutral-600 dark:text-neutral-300 font-mono">
                      <div>
                        <dt className="text-neutral-400">Journal Mode</dt>
                        <dd className="uppercase font-semibold text-emerald-500">
                          {dbInfo.journalMode}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">Migrations Applied</dt>
                        <dd>{dbInfo.appliedMigrations.join(', ') || 'None'}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">Device ID</dt>
                        <dd className="truncate">{dbInfo.deviceId}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-xs text-neutral-500">
                      Running in browser preview. Launch via Tauri desktop app to connect to SQLite.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-brand-gold">
                    <FolderOpen className="w-4 h-4" />
                    <span>{en.common.portablePath}</span>
                  </div>
                  {dbInfo ? (
                    <dl className="text-xs space-y-1.5 text-neutral-600 dark:text-neutral-300 font-mono">
                      <div>
                        <dt className="text-neutral-400">Database</dt>
                        <dd className="break-all">{dbInfo.dbPath}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">Backups</dt>
                        <dd className="break-all">{dbInfo.backupsDir}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">CSV Import</dt>
                        <dd className="break-all">{dbInfo.importDir}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-xs text-neutral-500">
                      Portable folders are resolved relative to Rauhaah.exe at runtime.
                    </p>
                  )}
                </div>
              </div>

              {/* Branches + Write Test */}
              <div className="rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">SQLite Persistence Check</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Writes a setting row + change_log entry in a single atomic Rust transaction.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!dbInfo || saving}
                    onClick={handleWriteTest}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold bg-brand-gold text-brand-black hover:bg-brand-gold-hover disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className={saving ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
                    Test SQLite Write
                  </button>
                </div>

                {testNote && (
                  <div className="flex items-center gap-2 text-xs text-emerald-500 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{testNote}</span>
                  </div>
                )}

                {branches.length > 0 && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    Default Branch:{' '}
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {branches[0].name} ({branches[0].code})
                    </span>{' '}
                    · Created {formatDhakaDateTime(branches[0].created_at)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold mb-4">
                <Package className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold capitalize">{activeRoute.replace('-', ' ')}</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {en.common.comingSoon}. This screen is scaffolded in the Phase 0 shell and will be
                implemented in its scheduled phase.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
