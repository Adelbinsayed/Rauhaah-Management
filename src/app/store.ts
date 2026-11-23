import type { AuthSession, PermissionKey, ShopSettings, User } from '@/domain/auth/types';
import type { HeldCart } from '@/domain/pos/types';
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
  heldCarts: HeldCart[];

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
  holdCart: (cart: HeldCart) => void;
  removeHeldCart: (id: string) => void;
}

const THEME_STORAGE_KEY = 'rauhaah_theme';

function getInitialTheme(): 'dark' | 'light' {
  let theme: 'dark' | 'light' = 'dark';
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    }
  } catch {
    // Ignore storage access errors
  }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
  return theme;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set) => ({
  activeRoute: 'dashboard',
  theme: getInitialTheme(),
  currentUser: null,
  permissions: [],
  isLocked: false,
  shopSettings: null,
  exportModal: null,
  toast: null,
  heldCarts: [],

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
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        }
      } catch {
        // Ignore storage access errors
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return { theme: next };
    }),

  holdCart: (cart) =>
    set((state) => ({
      heldCarts: [cart, ...state.heldCarts],
    })),

  removeHeldCart: (id) =>
    set((state) => ({
      heldCarts: state.heldCarts.filter((h) => h.id !== id),
    })),

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
