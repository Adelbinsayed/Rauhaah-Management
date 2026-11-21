import type { PermissionKey } from '@/domain/auth/types';
import { en } from '@/lib/i18n/en';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Boxes,
  FileSpreadsheet,
  FlaskConical,
  LayoutDashboard,
  Lock,
  LogOut,
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
import { type NavRoute, useAppStore } from './store';

interface NavItem {
  id: NavRoute;
  label: string;
  icon: ComponentType<{ className?: string }>;
  section?: string;
  requiredPermission?: PermissionKey;
  disabled?: boolean;
  disabledBadge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: en.nav.dashboard, icon: LayoutDashboard },
  { id: 'price-checker', label: en.nav.priceChecker, icon: SearchCheck },
  { id: 'pos', label: en.nav.pos, icon: ShoppingCart },
  { id: 'sales', label: en.nav.sales, icon: Receipt },
  { id: 'products', label: en.nav.products, icon: Package, section: 'Catalog & Stock' },
  { id: 'price-list', label: en.nav.priceList, icon: Tag, requiredPermission: 'price.edit' },
  { id: 'stock', label: en.nav.stock, icon: Boxes },
  {
    id: 'blends',
    label: en.nav.blends,
    icon: FlaskConical,
    requiredPermission: 'cost.view',
    disabled: true,
    disabledBadge: 'Paused',
  },
  { id: 'purchases', label: en.nav.purchases, icon: ShoppingBag, section: 'Operations', requiredPermission: 'cost.view' },
  { id: 'suppliers', label: en.nav.suppliers, icon: Truck, requiredPermission: 'cost.view' },
  { id: 'customers', label: en.nav.customers, icon: UserCheck },
  { id: 'expenses', label: en.nav.expenses, icon: Wallet, requiredPermission: 'profit.view' },
  { id: 'reports', label: en.nav.reports, icon: BarChart3, section: 'Admin', requiredPermission: 'report.view' },
  { id: 'import', label: en.nav.import, icon: FileSpreadsheet, requiredPermission: 'import.run' },
  { id: 'users', label: en.nav.users, icon: Users, requiredPermission: 'user.manage' },
  { id: 'settings', label: en.nav.settings, icon: Settings, requiredPermission: 'settings.manage' },
];

export function Sidebar() {
  const { activeRoute, setActiveRoute, currentUser, permissions, lockSession, logout } = useAppStore();

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.requiredPermission) return true;
    return permissions.includes(item.requiredPermission);
  });

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
        {visibleNavItems.map((item) => {
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
                disabled={item.disabled}
                onClick={() => !item.disabled && setActiveRoute(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed text-neutral-400 dark:text-neutral-500 hover:bg-transparent'
                    : active
                    ? 'bg-brand-gold text-brand-black shadow-sm font-semibold'
                    : 'text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-brand-surface'
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.disabledBadge && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 shrink-0">
                    {item.disabledBadge}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* User Footer Profile & Lock/Logout */}
      {currentUser && (
        <div className="p-3 border-t border-neutral-200 dark:border-brand-border bg-neutral-100/60 dark:bg-brand-surface/40 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-neutral-900 dark:text-white truncate">
              {currentUser.displayName}
            </div>
            <div className="text-[10px] font-medium text-brand-gold uppercase tracking-wider">
              {currentUser.roleDisplayName}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={lockSession}
              title="Lock Terminal"
              className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-brand-surface text-neutral-500 dark:text-neutral-400 hover:text-brand-gold transition-colors"
            >
              <Lock className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-brand-surface text-neutral-500 dark:text-neutral-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
