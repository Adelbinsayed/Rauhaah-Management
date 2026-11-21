import type { DbInfo } from '@/data/db';
import { authRepo } from '@/data/repositories/authRepo';
import { settingsRepo } from '@/data/repositories/settingsRepo';
import { systemRepo } from '@/data/repositories/systemRepo';
import { LockScreen } from '@/features/auth/LockScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { SetupScreen } from '@/features/auth/SetupScreen';
import { ExportSuccessModal } from '@/components/ExportSuccessModal';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { en } from '@/lib/i18n/en';
import {
  Lock,
  Moon,
  Package,
  Shield,
  Sun,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAppStore } from './store';

// Lazy-loaded routes for minimal initial bundle and fast cold-start
const DashboardScreen = lazy(() =>
  import('@/features/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen }))
);
const PriceCheckerScreen = lazy(() =>
  import('@/features/priceChecker/PriceCheckerScreen').then((m) => ({ default: m.PriceCheckerScreen }))
);
const UsersScreen = lazy(() =>
  import('@/features/users/UsersScreen').then((m) => ({ default: m.UsersScreen }))
);
const SettingsScreen = lazy(() =>
  import('@/features/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
);
const CatalogScreen = lazy(() =>
  import('@/features/catalog/CatalogScreen').then((m) => ({ default: m.CatalogScreen }))
);
const PosScreen = lazy(() =>
  import('@/features/pos/PosScreen').then((m) => ({ default: m.PosScreen }))
);
const SalesListScreen = lazy(() =>
  import('@/features/sales/SalesListScreen').then((m) => ({ default: m.SalesListScreen }))
);
const PurchasesScreen = lazy(() =>
  import('@/features/purchases/PurchasesScreen').then((m) => ({ default: m.PurchasesScreen }))
);
const SuppliersScreen = lazy(() =>
  import('@/features/purchases/SuppliersScreen').then((m) => ({ default: m.SuppliersScreen }))
);
const CustomersScreen = lazy(() =>
  import('@/features/customers/CustomersScreen').then((m) => ({ default: m.CustomersScreen }))
);
const ExpensesScreen = lazy(() =>
  import('@/features/expenses/ExpensesScreen').then((m) => ({ default: m.ExpensesScreen }))
);
const ReportsScreen = lazy(() =>
  import('@/features/reports/ReportsScreen').then((m) => ({ default: m.ReportsScreen }))
);
const ImportScreen = lazy(() =>
  import('@/features/import/ImportScreen').then((m) => ({ default: m.ImportScreen }))
);

function ScreenFallback() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 space-y-3 animate-in fade-in duration-150 select-none">
      <div className="w-7 h-7 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
      <span className="text-xs text-neutral-400 font-mono tracking-wider">Loading module…</span>
    </div>
  );
}

export function App() {
  const {
    activeRoute,
    theme,
    toggleTheme,
    currentUser,
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
      <div className="h-screen w-screen bg-[#202020] text-white flex flex-col items-center justify-center p-6 space-y-4">
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

      {/* Global CSV Export Success Popup Modal */}
      <ExportSuccessModal />

      {/* Global Floating Toast Notifications Container */}
      <ToastContainer />

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
              className="p-2 rounded-md border border-neutral-200 dark:border-brand-border hover:bg-neutral-100 dark:hover:bg-brand-surface text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? en.common.lightMode : en.common.darkMode}
              className="p-2 rounded-md border border-neutral-200 dark:border-brand-border hover:bg-neutral-100 dark:hover:bg-brand-surface transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-brand-gold" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-700" />
              )}
            </button>
          </div>
        </header>

        {/* Main Content Area with Route Suspense */}
        <main className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<ScreenFallback />}>
            {activeRoute === 'dashboard' && <DashboardScreen deviceId={deviceId} />}

            {activeRoute === 'price-checker' && <PriceCheckerScreen deviceId={deviceId} />}

            {activeRoute === 'users' && <UsersScreen deviceId={deviceId} />}

            {activeRoute === 'settings' && <SettingsScreen deviceId={deviceId} />}

            {(activeRoute === 'products' || activeRoute === 'price-list' || activeRoute === 'stock') && (
              <CatalogScreen deviceId={deviceId} />
            )}

            {activeRoute === 'pos' && <PosScreen deviceId={deviceId} />}

            {activeRoute === 'sales' && <SalesListScreen deviceId={deviceId} />}

            {activeRoute === 'purchases' && <PurchasesScreen deviceId={deviceId} />}

            {activeRoute === 'suppliers' && <SuppliersScreen deviceId={deviceId} />}

            {activeRoute === 'customers' && <CustomersScreen deviceId={deviceId} />}

            {activeRoute === 'expenses' && <ExpensesScreen deviceId={deviceId} />}

            {activeRoute === 'reports' && <ReportsScreen deviceId={deviceId} />}

            {activeRoute === 'import' && <ImportScreen deviceId={deviceId} />}

            {/* Placeholder for future phases */}
            {activeRoute !== 'dashboard' &&
              activeRoute !== 'price-checker' &&
              activeRoute !== 'users' &&
              activeRoute !== 'settings' &&
              activeRoute !== 'products' &&
              activeRoute !== 'price-list' &&
              activeRoute !== 'stock' &&
              activeRoute !== 'import' &&
              activeRoute !== 'pos' &&
              activeRoute !== 'sales' &&
              activeRoute !== 'purchases' &&
              activeRoute !== 'suppliers' &&
              activeRoute !== 'customers' &&
              activeRoute !== 'expenses' &&
              activeRoute !== 'reports' && (
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
          </Suspense>
        </main>
      </div>
    </div>
  );
}
