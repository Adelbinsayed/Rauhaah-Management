import type { DbInfo } from '@/data/db';
import { authRepo } from '@/data/repositories/authRepo';
import { settingsRepo } from '@/data/repositories/settingsRepo';
import { systemRepo } from '@/data/repositories/systemRepo';
import { canViewCost } from '@/domain/auth/permissions';
import { LockScreen } from '@/features/auth/LockScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { SetupScreen } from '@/features/auth/SetupScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { UsersScreen } from '@/features/users/UsersScreen';
import { CatalogScreen } from '@/features/catalog/CatalogScreen';
import { ImportScreen } from '@/features/import/ImportScreen';
import { en } from '@/lib/i18n/en';
import {
  CheckCircle2,
  Database,
  Lock,
  Moon,
  Package,
  Shield,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAppStore } from './store';

export function App() {
  const {
    activeRoute,
    theme,
    toggleTheme,
    currentUser,
    permissions,
    isLocked,
    shopSettings,
    setSession,
    lockSession,
    setShopSettings,
  } = useAppStore();

  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [initLoading, setInitLoading] = useState(true);

  const initSystem = useCallback(async () => {
    setInitLoading(true);
    try {
      const info = await systemRepo.getDbInfo();
      setDbInfo(info);

      const usersExist = await authRepo.hasUsers();
      setHasUsers(usersExist);

      if (usersExist) {
        const settings = await settingsRepo.getSettings();
        setShopSettings(settings);
      }
    } catch (err) {
      console.error('System initialization error:', err);
    } finally {
      setInitLoading(false);
    }
  }, [setShopSettings]);

  useEffect(() => {
    initSystem();
  }, [initSystem]);

  // Terminal Idle Lock Timer
  useEffect(() => {
    if (!currentUser || isLocked) return;
    const timeoutMinutes = shopSettings?.idleLockMinutes ?? 5;
    if (timeoutMinutes <= 0) return; // 0 = Never lock

    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lockSession();
      }, timeoutMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [currentUser, isLocked, shopSettings?.idleLockMinutes, lockSession]);

  const deviceId = dbInfo?.deviceId || 'DEV-FALLBACK';

  if (initLoading) {
    return (
      <div className="h-screen w-screen bg-brand-black text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
        <p className="text-xs text-neutral-400 font-mono tracking-wider">Connecting database…</p>
      </div>
    );
  }

  // 1. First-Run Setup Screen
  if (hasUsers === false) {
    return (
      <SetupScreen
        deviceId={deviceId}
        onSetupComplete={(session) => {
          setSession(session);
          setHasUsers(true);
          settingsRepo.getSettings().then(setShopSettings).catch(console.error);
        }}
      />
    );
  }

  // 2. Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        deviceId={deviceId}
        onLoginSuccess={(session) => {
          setSession(session);
          settingsRepo.getSettings().then(setShopSettings).catch(console.error);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-white text-neutral-900 dark:bg-brand-black dark:text-white overflow-hidden">
      {/* Auto-Lock Screen Overlay */}
      {isLocked && <LockScreen deviceId={deviceId} />}

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 shrink-0 border-b border-neutral-200 dark:border-brand-border px-6 flex items-center justify-between bg-white dark:bg-brand-black select-none">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold capitalize tracking-tight">
              {activeRoute.replace('-', ' ')}
            </h1>
            {shopSettings?.shopName && (
              <span className="text-xs text-neutral-400 hidden sm:inline">
                · {shopSettings.shopName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Role indicator pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-gold/15 border border-brand-gold/40 text-brand-gold">
              <Shield className="w-3.5 h-3.5" />
              <span>{currentUser.roleDisplayName}</span>
            </div>

            {/* Quick lock button */}
            <button
              type="button"
              onClick={lockSession}
              title="Lock Terminal"
              className="p-2 rounded-md border border-neutral-200 dark:border-brand-border hover:bg-neutral-100 dark:hover:bg-brand-surface text-neutral-600 dark:text-neutral-300 transition-colors"
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Theme toggle */}
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

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeRoute === 'dashboard' && (
            <div className="max-w-4xl space-y-6">
              {/* Welcome banner */}
              <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface p-5 space-y-2">
                <div className="flex items-center gap-2 text-brand-gold font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Phase 1 Completed: Users, Roles, and Settings</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Welcome, {currentUser.displayName}!
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Logged in as <strong className="text-brand-gold">{currentUser.roleDisplayName}</strong> (@{currentUser.username}).
                  {currentUser.roleName === 'staff' ? (
                    <span className="text-amber-500 font-semibold ml-1">
                      (Staff Mode: Cost prices, wholesale margins, and admin menus are strictly hidden from your session).
                    </span>
                  ) : (
                    <span> Full administrative and financial privileges active.</span>
                  )}
                </p>
              </div>

              {/* Status & Security Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-brand-gold" />
                    <span>Role Permissions</span>
                  </div>
                  <div className="text-sm font-bold text-neutral-900 dark:text-white">
                    {permissions.length} Active Capabilities
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Cost Viewing: {canViewCost(permissions) ? '✅ Allowed' : '🔒 Hidden'}
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-brand-gold" />
                    <span>Database Status</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-500">
                    WAL Mode Active
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    Device: {deviceId.slice(0, 18)}…
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-neutral-50 dark:bg-brand-surface p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-brand-gold" />
                    <span>Auto-Lock Security</span>
                  </div>
                  <div className="text-sm font-bold text-neutral-900 dark:text-white">
                    {shopSettings?.idleLockMinutes
                      ? `${shopSettings.idleLockMinutes} Minutes Idle`
                      : 'Never'}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Quick PIN Unlock enabled
                  </div>
                </div>
              </div>

              {/* Phase 1 Verification Checklist */}
              <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-5 space-y-3">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Phase 1 Features Ready for Testing
                </h3>
                <ul className="text-xs space-y-2 text-neutral-600 dark:text-neutral-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>First-Run Setup & Recovery:</strong> Owner account created with Argon2 hashing and emergency recovery code.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>Role Isolation:</strong> Staff accounts can never view cost columns, wholesale profit, or administrative settings.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>User Management:</strong> Add cashiers and managers, toggle active status, and reset passwords/PINs.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>Shop Configuration & Audit Log:</strong> Custom invoice prefix, negative stock warnings, tola conventions, and security audit log.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeRoute === 'users' && <UsersScreen deviceId={deviceId} />}

          {activeRoute === 'settings' && <SettingsScreen deviceId={deviceId} />}

          {(activeRoute === 'products' || activeRoute === 'price-list' || activeRoute === 'stock') && (
            <CatalogScreen deviceId={deviceId} />
          )}

          {activeRoute === 'import' && <ImportScreen deviceId={deviceId} />}

          {/* Placeholder for future phases */}
          {activeRoute !== 'dashboard' &&
            activeRoute !== 'users' &&
            activeRoute !== 'settings' &&
            activeRoute !== 'products' &&
            activeRoute !== 'price-list' &&
            activeRoute !== 'stock' &&
            activeRoute !== 'import' && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold mb-4">
                <Package className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold capitalize">{activeRoute.replace('-', ' ')}</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {en.common.comingSoon}. This module is scheduled for development in its upcoming phase.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
