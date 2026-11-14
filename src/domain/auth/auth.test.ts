import { describe, expect, it } from 'vitest';
import {
  canEditPrices,
  canManageSettings,
  canManageUsers,
  canViewCost,
  canViewProfit,
  DEFAULT_ROLE_PERMISSIONS,
  hasPermission,
} from './permissions';
import {
  generateRecoveryCode,
  isValidRecoveryCodeFormat,
  normalizeRecoveryCode,
} from './recoveryCode';

describe('Role permissions', () => {
  it('owner has full access to costs, profit, users, and settings', () => {
    const ownerPerms = DEFAULT_ROLE_PERMISSIONS.owner;
    expect(canViewCost(ownerPerms)).toBe(true);
    expect(canViewProfit(ownerPerms)).toBe(true);
    expect(canEditPrices(ownerPerms)).toBe(true);
    expect(canManageUsers(ownerPerms)).toBe(true);
    expect(canManageSettings(ownerPerms)).toBe(true);
  });

  it('manager has cost and pricing access but cannot manage users or settings', () => {
    const managerPerms = DEFAULT_ROLE_PERMISSIONS.manager;
    expect(canViewCost(managerPerms)).toBe(true);
    expect(canViewProfit(managerPerms)).toBe(true);
    expect(canEditPrices(managerPerms)).toBe(true);
    expect(canManageUsers(managerPerms)).toBe(false);
    expect(canManageSettings(managerPerms)).toBe(false);
  });

  it('staff CANNOT view cost, profit, edit prices, or manage settings/users', () => {
    const staffPerms = DEFAULT_ROLE_PERMISSIONS.staff;
    expect(canViewCost(staffPerms)).toBe(false);
    expect(canViewProfit(staffPerms)).toBe(false);
    expect(canEditPrices(staffPerms)).toBe(false);
    expect(canManageUsers(staffPerms)).toBe(false);
    expect(canManageSettings(staffPerms)).toBe(false);

    expect(hasPermission(staffPerms, 'pos.access')).toBe(true);
    expect(hasPermission(staffPerms, 'price_checker.access')).toBe(true);
    expect(hasPermission(staffPerms, 'sale.create')).toBe(true);
    expect(hasPermission(staffPerms, 'sale.view_own')).toBe(true);
  });
});

describe('Recovery Code Generation and Validation', () => {
  it('generates a valid recovery code in RAUH-XXXX-XXXX-XXXX format', () => {
    const code = generateRecoveryCode();
    expect(isValidRecoveryCodeFormat(code)).toBe(true);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(50);
  });

  it('normalizes recovery code inputs with missing hyphens or lower-case', () => {
    const raw = 'rauh23456789abcd';
    const norm = normalizeRecoveryCode(raw);
    expect(norm).toBe('RAUH-2345-6789-ABCD');
  });
});
