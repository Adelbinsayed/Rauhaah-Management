import type { PermissionKey, RoleName } from './types';

export const ALL_PERMISSIONS: PermissionKey[] = [
  'cost.view',
  'profit.view',
  'price.edit',
  'stock.adjust',
  'sale.void',
  'report.view',
  'user.manage',
  'import.run',
  'settings.manage',
  'pos.access',
  'price_checker.access',
  'sale.create',
  'sale.view_own',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  owner: [
    'cost.view',
    'profit.view',
    'price.edit',
    'stock.adjust',
    'sale.void',
    'report.view',
    'user.manage',
    'import.run',
    'settings.manage',
    'pos.access',
    'price_checker.access',
    'sale.create',
    'sale.view_own',
  ],
  manager: [
    'cost.view',
    'profit.view',
    'price.edit',
    'stock.adjust',
    'sale.void',
    'report.view',
    'import.run',
    'pos.access',
    'price_checker.access',
    'sale.create',
    'sale.view_own',
  ],
  staff: ['pos.access', 'price_checker.access', 'sale.create', 'sale.view_own'],
};

export function hasPermission(
  permissions: PermissionKey[] | undefined,
  key: PermissionKey
): boolean {
  if (!permissions) return false;
  return permissions.includes(key);
}

export function canViewCost(permissions: PermissionKey[] | undefined): boolean {
  return hasPermission(permissions, 'cost.view');
}

export function canViewProfit(permissions: PermissionKey[] | undefined): boolean {
  return hasPermission(permissions, 'profit.view');
}

export function canEditPrices(permissions: PermissionKey[] | undefined): boolean {
  return hasPermission(permissions, 'price.edit');
}

export function canManageUsers(permissions: PermissionKey[] | undefined): boolean {
  return hasPermission(permissions, 'user.manage');
}

export function canManageSettings(permissions: PermissionKey[] | undefined): boolean {
  return hasPermission(permissions, 'settings.manage');
}

export function canRunImport(permissions: PermissionKey[] | undefined): boolean {
  return hasPermission(permissions, 'import.run');
}

export const ROUTE_PERMISSIONS: Partial<Record<string, PermissionKey>> = {
  pos: 'pos.access',
  'price-checker': 'price_checker.access',
  'price-list': 'price.edit',
  blends: 'cost.view',
  purchases: 'cost.view',
  suppliers: 'cost.view',
  expenses: 'profit.view',
  reports: 'report.view',
  import: 'import.run',
  users: 'user.manage',
  settings: 'settings.manage',
};
