import { ROUTE_PERMISSIONS } from '@/domain/auth/permissions';
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
  icon: ComponentType<{ className?: string; strokeWidth?: string | number }>;
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
    const requiredPerm = item.requiredPermission ?? ROUTE_PERMISSIONS[item.id];
    if (!requiredPerm) return true;
    return permissions.includes(requiredPerm);
  });

  return (
    <aside className="w-60 shrink-0 border-r border-hairline bg-sidebar flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="h-14 px-5 border-b border-hairline flex items-center justify-center bg-sidebar">
        <img
          src="/assets/rauhaah-logo-white.png"
          alt="Rauhaah — Live Peaceful"
          className="hidden dark:block h-9 w-auto object-contain"
        />
        <img
          src="/assets/rauhaah-logo-dark.png"
          alt="Rauhaah — Live Peaceful"
          className="block dark:hidden h-9 w-auto object-contain"
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
                <div className="px-3 pt-5 pb-1.5 text-xs font-medium text-ink-muted">
                  {item.section}
                </div>
              )}
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => !item.disabled && setActiveRoute(item.id)}
                className={cn(
                  'w-full h-9 flex items-center justify-between px-3 rounded-lg text-sm transition-colors duration-150 ease-unslop text-left',
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed text-ink-muted'
                    : active
                    ? 'bg-surface dark:bg-raised text-ink font-medium border border-hairline-strong shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-ink-secondary hover:text-ink hover:bg-raised/60 font-normal'
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0',
                      active ? 'text-accent-ink' : 'text-ink-muted'
                    )}
                    strokeWidth={1.5}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                )}
                {item.disabledBadge && (
                  <span className="text-[11px] font-mono text-ink-muted shrink-0">
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
        <div className="p-3 border-t border-hairline bg-sidebar flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink truncate">
              {currentUser.displayName}
            </div>
            <div className="text-xs text-accent-ink">
              {currentUser.roleDisplayName}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={lockSession}
              title="Lock Terminal"
              className="p-1.5 rounded-lg hover:bg-raised text-ink-muted hover:text-ink transition-colors duration-150 ease-unslop"
            >
              <Lock className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg hover:bg-raised text-ink-muted hover:text-negative transition-colors duration-150 ease-unslop"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
