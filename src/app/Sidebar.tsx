import {
  BarChart3,
  Boxes,
  FileSpreadsheet,
  FlaskConical,
  LayoutDashboard,
  Package,
  Receipt,
  SearchCheck,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { en } from '@/lib/i18n/en';
import { cn } from '@/lib/utils';
import { type NavRoute, useAppStore } from './store';

interface NavItem {
  id: NavRoute;
  label: string;
  icon: ComponentType<{ className?: string }>;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: en.nav.dashboard, icon: LayoutDashboard },
  { id: 'price-checker', label: en.nav.priceChecker, icon: SearchCheck },
  { id: 'pos', label: en.nav.pos, icon: ShoppingCart },
  { id: 'sales', label: en.nav.sales, icon: Receipt },
  { id: 'products', label: en.nav.products, icon: Package, section: 'Catalog & Stock' },
  { id: 'price-list', label: en.nav.priceList, icon: Tag },
  { id: 'stock', label: en.nav.stock, icon: Boxes },
  { id: 'blends', label: en.nav.blends, icon: FlaskConical },
  { id: 'purchases', label: en.nav.purchases, icon: ShoppingBag, section: 'Operations' },
  { id: 'suppliers', label: en.nav.suppliers, icon: Truck },
  { id: 'customers', label: en.nav.customers, icon: UserCheck },
  { id: 'expenses', label: en.nav.expenses, icon: Wallet },
  { id: 'reports', label: en.nav.reports, icon: BarChart3, section: 'Admin' },
  { id: 'import', label: en.nav.import, icon: FileSpreadsheet },
  { id: 'users', label: en.nav.users, icon: Users },
  { id: 'settings', label: en.nav.settings, icon: Settings },
];

export function Sidebar() {
  const { activeRoute, setActiveRoute } = useAppStore();

  return (
    <aside className="w-60 shrink-0 border-r border-neutral-200 bg-[#F9F9F9] dark:border-brand-border dark:bg-brand-black flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-brand-border flex items-center justify-center bg-brand-black">
        <img
          src="/assets/rauhaah-logo-white.png"
          alt="Rauhaah — Live Peaceful"
          className="h-10 w-auto object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.id;
          return (
            <div key={item.id}>
              {item.section && (
                <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  {item.section}
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveRoute(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                  active
                    ? 'bg-brand-gold text-brand-black shadow-sm'
                    : 'text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-brand-surface'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-brand-border text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center justify-between">
        <span>{en.app.version}</span>
        <span>Phase 0</span>
      </div>
    </aside>
  );
}
