import { dbBatchTx, dbQuery, isTauriRuntime } from '@/data/db';
import type { AuditLogEntry, PermissionKey, Role, RoleName, User } from '@/domain/auth/types';
import { nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import { invoke } from '@tauri-apps/api/core';

export interface UserDbRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  pin_hash: string | null;
  role_id: string;
  role_name: RoleName;
  role_display_name: string;
  recovery_code_hash: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleDbRow {
  id: string;
  name: RoleName;
  display_name: string;
  description: string;
  is_system: number;
}

export interface PermissionDbRow {
  role_id: string;
  permission_key: PermissionKey;
}

/**
 * Invokes Rust Argon2 commands for secure password hashing and verification.
 * Falls back to browser WebCrypto if running in pure browser preview mode.
 */
export async function hashSecret(secret: string): Promise<string> {
  if (isTauriRuntime()) {
    return invoke<string>('hash_password', { password: secret });
  }
  // Browser preview fallback (SHA-256 for mock preview only)
  const enc = new TextEncoder().encode(secret);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return 'mock_' + Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  if (isTauriRuntime()) {
    return invoke<boolean>('verify_password', { password: secret, hash });
  }
  const mock = await hashSecret(secret);
  return mock === hash;
}

export const authRepo = {
  /**
   * Check if any user exists. If 0, first-run setup is required.
   */
  async hasUsers(): Promise<boolean> {
    const rows = await dbQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL'
    );
    return (rows[0]?.count ?? 0) > 0;
  },

  /**
   * Retrieve all roles with their assigned permissions.
   */
  async getRoles(): Promise<Role[]> {
    const roleRows = await dbQuery<RoleDbRow>(
      'SELECT id, name, display_name, description, is_system FROM roles WHERE deleted_at IS NULL ORDER BY name ASC'
    );
    const permRows = await dbQuery<PermissionDbRow>(
      'SELECT role_id, permission_key FROM role_permissions'
    );

    return roleRows.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name,
      description: r.description,
      isSystem: r.is_system === 1,
      permissions: permRows
        .filter((p) => p.role_id === r.id)
        .map((p) => p.permission_key),
    }));
  },

  /**
   * Find user by username (includes password/pin hashes for authentication).
   */
  async findUserByUsername(username: string): Promise<UserDbRow | null> {
    const rows = await dbQuery<UserDbRow>(
      `SELECT u.id, u.username, u.display_name, u.password_hash, u.pin_hash,
              u.role_id, r.name as role_name, r.display_name as role_display_name,
              u.recovery_code_hash, u.is_active, u.last_login_at, u.created_at, u.updated_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.username) = LOWER(?) AND u.deleted_at IS NULL
       LIMIT 1`,
      [username.trim()]
    );
    return rows[0] ?? null;
  },

  /**
   * Get permissions for a role ID.
   */
  async getRolePermissions(roleId: string): Promise<PermissionKey[]> {
    const rows = await dbQuery<{ permission_key: PermissionKey }>(
      'SELECT permission_key FROM role_permissions WHERE role_id = ?',
      [roleId]
    );
    return rows.map((r) => r.permission_key);
  },

  /**
   * Update last login timestamp and record audit log.
   */
  async recordLoginSuccess(user: UserDbRow, deviceId: string): Promise<void> {
    const now = nowUtcIso();
    await dbBatchTx([
      {
        sql: 'UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?',
        params: [now, now, user.id],
      },
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, ?, ?, 'auth.login_success', ?, ?, ?)`,
        params: [
          uuidv7(),
          user.id,
          user.username,
          JSON.stringify({ role: user.role_name }),
          now,
          deviceId,
        ],
      },
      {
        sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
              VALUES (?, 'users', ?, 'update', ?, 0)`,
        params: [uuidv7(), user.id, now],
      },
    ]);
  },

  /**
   * Record login failure in audit log.
   */
  async recordLoginFailure(username: string, reason: string, deviceId: string): Promise<void> {
    const now = nowUtcIso();
    await dbBatchTx([
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, NULL, ?, 'auth.login_failed', ?, ?, ?)`,
        params: [uuidv7(), username, JSON.stringify({ reason }), now, deviceId],
      },
    ]);
  },

  /**
   * First-run setup: creates Owner user, saves initial settings, and records audit event.
   */
  async setupFirstRun(data: {
    shopName: string;
    username: string;
    displayName: string;
    passwordHash: string;
    pinHash: string | null;
    recoveryCodeHash: string;
    deviceId: string;
  }): Promise<{ user: User; permissions: PermissionKey[] }> {
    const roles = await this.getRoles();
    const ownerRole = roles.find((r) => r.name === 'owner');
    if (!ownerRole) {
      throw new Error('Default owner role not found in database');
    }

    const now = nowUtcIso();
    const userId = uuidv7();

    await dbBatchTx([
      // 1. Create owner user
      {
        sql: `INSERT INTO users (id, username, display_name, password_hash, pin_hash, role_id, recovery_code_hash, is_active, last_login_at, created_at, updated_at, device_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        params: [
          userId,
          data.username.trim(),
          data.displayName.trim(),
          data.passwordHash,
          data.pinHash,
          ownerRole.id,
          data.recoveryCodeHash,
          now,
          now,
          now,
          data.deviceId,
        ],
      },
      // 2. Set shop name
      {
        sql: `INSERT INTO settings (id, key, value, created_at, updated_at, device_id)
              VALUES (?, 'shop_name', ?, ?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        params: [uuidv7(), data.shopName.trim(), now, now, data.deviceId],
      },
      // 3. Audit log
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, ?, ?, 'system.first_run_setup', ?, ?, ?)`,
        params: [
          uuidv7(),
          userId,
          data.username.trim(),
          JSON.stringify({ shopName: data.shopName.trim(), role: 'owner' }),
          now,
          data.deviceId,
        ],
      },
      // 4. Change log
      {
        sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
              VALUES (?, 'users', ?, 'insert', ?, 0)`,
        params: [uuidv7(), userId, now],
      },
    ]);

    const user: User = {
      id: userId,
      username: data.username.trim(),
      displayName: data.displayName.trim(),
      roleId: ownerRole.id,
      roleName: 'owner',
      roleDisplayName: ownerRole.displayName,
      hasPin: Boolean(data.pinHash),
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };

    return { user, permissions: ownerRole.permissions };
  },

  /**
   * Reset owner password using recovery code.
   */
  async recoverOwnerPassword(
    recoveryCode: string,
    newPasswordHash: string,
    deviceId: string
  ): Promise<boolean> {
    const users = await dbQuery<UserDbRow>(
      `SELECT u.* FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'owner' AND u.deleted_at IS NULL`
    );

    for (const owner of users) {
      if (!owner.recovery_code_hash) continue;
      const matched = await verifySecret(recoveryCode, owner.recovery_code_hash);
      if (matched) {
        const now = nowUtcIso();
        await dbBatchTx([
          {
            sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
            params: [newPasswordHash, now, owner.id],
          },
          {
            sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
                  VALUES (?, ?, ?, 'auth.password_recovered', 'Password reset via recovery code', ?, ?)`,
            params: [uuidv7(), owner.id, owner.username, now, deviceId],
          },
          {
            sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
                  VALUES (?, 'users', ?, 'update', ?, 0)`,
            params: [uuidv7(), owner.id, now],
          },
        ]);
        return true;
      }
    }
    return false;
  },

  /**
   * Get all active and inactive users (for Users management screen).
   */
  async getUsers(): Promise<User[]> {
    const rows = await dbQuery<UserDbRow>(
      `SELECT u.id, u.username, u.display_name, u.role_id,
              r.name as role_name, r.display_name as role_display_name,
              u.pin_hash, u.is_active, u.last_login_at, u.created_at, u.updated_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.deleted_at IS NULL
       ORDER BY (r.name = 'owner') DESC, u.username ASC`
    );

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      roleId: r.role_id,
      roleName: r.role_name,
      roleDisplayName: r.role_display_name,
      hasPin: Boolean(r.pin_hash),
      isActive: r.is_active === 1,
      lastLoginAt: r.last_login_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  /**
   * Create a new user (staff or manager).
   */
  async createUser(data: {
    username: string;
    displayName: string;
    passwordHash: string;
    pinHash: string | null;
    roleId: string;
    deviceId: string;
    performedByUserId: string;
    performedByUsername: string;
  }): Promise<string> {
    const existing = await this.findUserByUsername(data.username);
    if (existing) {
      throw new Error(`Username "${data.username}" is already taken.`);
    }

    const now = nowUtcIso();
    const userId = uuidv7();

    await dbBatchTx([
      {
        sql: `INSERT INTO users (id, username, display_name, password_hash, pin_hash, role_id, is_active, created_at, updated_at, device_id)
              VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        params: [
          userId,
          data.username.trim(),
          data.displayName.trim(),
          data.passwordHash,
          data.pinHash,
          data.roleId,
          now,
          now,
          data.deviceId,
        ],
      },
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, ?, ?, 'user.create', ?, ?, ?)`,
        params: [
          uuidv7(),
          data.performedByUserId,
          data.performedByUsername,
          JSON.stringify({ createdUserId: userId, username: data.username.trim() }),
          now,
          data.deviceId,
        ],
      },
      {
        sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
              VALUES (?, 'users', ?, 'insert', ?, 0)`,
        params: [uuidv7(), userId, now],
      },
    ]);

    return userId;
  },

  /**
   * Update an existing user.
   */
  async updateUser(
    id: string,
    updates: {
      displayName?: string;
      roleId?: string;
      isActive?: boolean;
      passwordHash?: string;
      pinHash?: string | null;
    },
    deviceId: string,
    performedByUserId: string,
    performedByUsername: string
  ): Promise<void> {
    const now = nowUtcIso();
    const sets: string[] = ['updated_at = ?', 'device_id = ?'];
    const params: (string | number | null)[] = [now, deviceId];

    if (updates.displayName !== undefined) {
      sets.push('display_name = ?');
      params.push(updates.displayName.trim());
    }
    if (updates.roleId !== undefined) {
      sets.push('role_id = ?');
      params.push(updates.roleId);
    }
    if (updates.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }
    if (updates.passwordHash !== undefined) {
      sets.push('password_hash = ?');
      params.push(updates.passwordHash);
    }
    if (updates.pinHash !== undefined) {
      sets.push('pin_hash = ?');
      params.push(updates.pinHash);
    }

    params.push(id);

    await dbBatchTx([
      {
        sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
        params,
      },
      {
        sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
              VALUES (?, ?, ?, 'user.update', ?, ?, ?)`,
        params: [
          uuidv7(),
          performedByUserId,
          performedByUsername,
          JSON.stringify({ updatedUserId: id, changes: Object.keys(updates) }),
          now,
          deviceId,
        ],
      },
      {
        sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
              VALUES (?, 'users', ?, 'update', ?, 0)`,
        params: [uuidv7(), id, now],
      },
    ]);
  },

  /**
   * Retrieve audit logs.
   */
  async getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    const rows = await dbQuery<{
      id: string;
      user_id: string | null;
      username: string | null;
      action: string;
      details: string | null;
      created_at: string;
      branch_id: string | null;
      device_id: string;
    }>(
      `SELECT id, user_id, username, action, details, created_at, branch_id, device_id
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      action: r.action,
      details: r.details,
      createdAt: r.created_at,
      branchId: r.branch_id,
      deviceId: r.device_id,
    }));
  },
};
