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

interface AppState {
  activeRoute: NavRoute;
  theme: 'dark' | 'light';
  currentUser: User | null;
  permissions: PermissionKey[];
  isLocked: boolean;
  shopSettings: ShopSettings | null;

  setActiveRoute: (route: NavRoute) => void;
  toggleTheme: () => void;
  setSession: (session: AuthSession | null) => void;
  lockSession: () => void;
  unlockSession: () => void;
  logout: () => void;
  setShopSettings: (settings: ShopSettings) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeRoute: 'dashboard',
  theme: 'dark',
  currentUser: null,
  permissions: [],
  isLocked: false,
  shopSettings: null,

  setActiveRoute: (route) => set({ activeRoute: route }),
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
