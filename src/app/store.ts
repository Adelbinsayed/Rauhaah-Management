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
  setActiveRoute: (route: NavRoute) => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeRoute: 'dashboard',
  theme: 'dark',
  setActiveRoute: (route) => set({ activeRoute: route }),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return { theme: next };
    }),
}));
