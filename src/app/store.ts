import type { AuthSession, PermissionKey, ShopSettings, User } from '@/domain/auth/types';
import { create } from 'zustand';

export type NavRoute =
  | 'dashboard'
  | 'price-checker'
  | 'pos'
  | 'sales'
  | 'products'
  | 'price-list'
  | 'stock'
  | 'purchases'
  | 'suppliers'
  | 'customers'
  | 'blends'
  | 'expenses'
  | 'reports'
  | 'import'
  | 'users'
  | 'settings';

export interface ExportSuccessInfo {
  filename: string;
  filePath?: string;
  title?: string;
  message?: string;
  rowCount?: number;
}

export interface ToastNotification {
  id: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  title?: string;
  message: string;
  filePath?: string;
  durationMs?: number;
}

interface AppState {
  activeRoute: NavRoute;
  theme: 'dark' | 'light';
  currentUser: User | null;
  permissions: PermissionKey[];
  isLocked: boolean;
  shopSettings: ShopSettings | null;
  exportModal: ExportSuccessInfo | null;
  toast: ToastNotification | null;

  setActiveRoute: (route: NavRoute) => void;
  toggleTheme: () => void;
  setSession: (session: AuthSession | null) => void;
  lockSession: () => void;
  unlockSession: () => void;
  logout: () => void;
  setShopSettings: (settings: ShopSettings) => void;
  showExportSuccess: (info: ExportSuccessInfo) => void;
  closeExportModal: () => void;
  showToast: (toast: Omit<ToastNotification, 'id'>) => void;
  hideToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set) => ({
  activeRoute: 'dashboard',
  theme: 'dark',
  currentUser: null,
  permissions: [],
  isLocked: false,
  shopSettings: null,
  exportModal: null,
  toast: null,

  setActiveRoute: (route) => set({ activeRoute: route }),
  showExportSuccess: (info) => set({ exportModal: info }),
  closeExportModal: () => set({ exportModal: null }),
  showToast: (toastData) => {
    if (toastTimer) clearTimeout(toastTimer);
    const id = `toast-${Date.now()}`;
    set({ toast: { ...toastData, id } });
    const duration = toastData.durationMs || (toastData.filePath ? 8000 : 4500);
    toastTimer = setTimeout(() => {
      set({ toast: null });
    }, duration);
  },
  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return { theme: next };
    }),

  setSession: (session) =>
    set({
      currentUser: session ? session.user : null,
      permissions: session ? session.permissions : [],
      isLocked: false,
      activeRoute: 'dashboard',
    }),

  lockSession: () => set({ isLocked: true }),
  unlockSession: () => set({ isLocked: false }),
  logout: () =>
    set({
      currentUser: null,
      permissions: [],
      isLocked: false,
      activeRoute: 'dashboard',
    }),

  setShopSettings: (settings) => set({ shopSettings: settings }),
}));
