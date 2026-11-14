export type RoleName = 'owner' | 'manager' | 'staff';

export type PermissionKey =
  | 'cost.view'
  | 'profit.view'
  | 'price.edit'
  | 'stock.adjust'
  | 'sale.void'
  | 'report.view'
  | 'user.manage'
  | 'import.run'
  | 'settings.manage'
  | 'pos.access'
  | 'price_checker.access'
  | 'sale.create'
  | 'sale.view_own';

export interface Role {
  id: string;
  name: RoleName;
  displayName: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionKey[];
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  roleId: string;
  roleName: RoleName;
  roleDisplayName: string;
  hasPin: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
  permissions: PermissionKey[];
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  details: string | null;
  createdAt: string;
  branchId: string | null;
  deviceId: string;
}

export interface ShopSettings {
  shopName: string;
  phone: string;
  address: string;
  currency: string;
  invoicePrefix: string;
  negativeStockPolicy: 'warn_allow' | 'block' | 'allow_silent';
  tolaConvention: 'volume_12ml' | 'weight_11g';
  idleLockMinutes: number;
  paymentMethods: string[];
}
