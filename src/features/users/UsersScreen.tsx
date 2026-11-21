import { useAppStore } from '@/app/store';
import { authRepo, hashSecret } from '@/data/repositories/authRepo';
import { canManageUsers } from '@/domain/auth/permissions';
import type { Role, User } from '@/domain/auth/types';
import { formatDhakaDateTime } from '@/lib/dates';
import {
  AlertCircle,
  CheckCircle2,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface UsersScreenProps {
  deviceId: string;
}

export function UsersScreen({ deviceId }: UsersScreenProps) {
  const { currentUser, permissions } = useAppStore();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allUsers, allRoles] = await Promise.all([
        authRepo.getUsers(),
        authRepo.getRoles(),
      ]);
      setUsers(allUsers);
      setRoles(allRoles);
      if (allRoles.length > 0 && !newRoleId) {
        const staffRole = allRoles.find((r) => r.name === 'staff') || allRoles[0];
        setNewRoleId(staffRole.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!canManageUsers(permissions)) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-negative/15 border border-negative/25 text-negative flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-ink">Access Denied</h2>
        <p className="text-xs text-ink-secondary mt-1">
          Only accounts with the <code>user.manage</code> permission (Owner) can view and modify users and roles.
        </p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAddError(null);

    if (newUsername.trim().length < 3) {
      setAddError('Username must be at least 3 characters.');
      return;
    }
    if (newPassword.length < 6) {
      setAddError('Password must be at least 6 characters.');
      return;
    }
    if (newPin.trim() && !/^\d{4,6}$/.test(newPin.trim())) {
      setAddError('Quick PIN must be 4 to 6 numbers.');
      return;
    }

    setAddLoading(true);
    try {
      const passwordHash = await hashSecret(newPassword);
      const pinHash = newPin.trim() ? await hashSecret(newPin.trim()) : null;

      await authRepo.createUser({
        username: newUsername.trim(),
        displayName: newDisplayName.trim() || newUsername.trim(),
        passwordHash,
        pinHash,
        roleId: newRoleId,
        deviceId,
        performedByUserId: currentUser.id,
        performedByUsername: currentUser.username,
      });

      setShowAddModal(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewPin('');
      await loadData();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditRoleId(user.roleId);
    setEditIsActive(user.isActive);
    setResetPassword('');
    setResetPin('');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !editingUser) return;
    setEditError(null);

    if (resetPassword && resetPassword.length < 6) {
      setEditError('New password must be at least 6 characters.');
      return;
    }
    if (resetPin.trim() && !/^\d{4,6}$/.test(resetPin.trim())) {
      setEditError('New PIN must be 4 to 6 numbers.');
      return;
    }

    setEditLoading(true);
    try {
      const updates: {
        displayName?: string;
        roleId?: string;
        isActive?: boolean;
        passwordHash?: string;
        pinHash?: string | null;
      } = {
        displayName: editDisplayName.trim(),
        roleId: editRoleId,
        isActive: editIsActive,
      };

      if (resetPassword) {
        updates.passwordHash = await hashSecret(resetPassword);
      }
      if (resetPin) {
        updates.pinHash = await hashSecret(resetPin.trim());
      }

      await authRepo.updateUser(
        editingUser.id,
        updates,
        deviceId,
        currentUser.id,
        currentUser.username
      );

      setEditingUser(null);
      await loadData();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-ink flex items-center gap-2.5">
            <UsersIcon className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
            <span>Users &amp; staff roles</span>
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Manage cashier and manager access. Staff accounts cannot view cost or profit figures.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAddError(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover transition-colors duration-150 ease-unslop self-start"
        >
          <UserPlus className="w-4 h-4" strokeWidth={1.75} />
          <span>Add Staff / User</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-raised/70 border-b border-hairline text-ink-muted font-medium">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Quick PIN</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink-secondary">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">
                    Loading users…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isOwner = u.roleName === 'owner';
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-raised/50 transition-colors duration-150 ease-unslop"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-ink">
                          {u.displayName}
                        </div>
                        <div className="text-[11px] text-ink-muted font-mono">@{u.username}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                            isOwner
                              ? 'bg-accent/12 text-accent-ink border-accent/25'
                              : 'bg-raised text-ink-secondary border-hairline'
                          }`}
                        >
                          <Shield className="w-3 h-3" strokeWidth={1.5} />
                          <span>{u.roleDisplayName}</span>
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {u.hasPin ? (
                          <span className="inline-flex items-center gap-1.5 text-positive text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span>Configured</span>
                          </span>
                        ) : (
                          <span className="text-ink-muted text-xs">None</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                            u.isActive
                              ? 'bg-positive/10 text-positive border-positive/25'
                              : 'bg-raised text-ink-muted border-hairline'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-ink-muted tabular-nums">
                        {u.lastLoginAt ? formatDhakaDateTime(u.lastLoginAt) : 'Never logged in'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="px-3 py-1 rounded-md border border-hairline bg-raised text-xs font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors duration-150 ease-unslop"
                        >
                          Edit / Reset
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roles & Permissions Reference Card */}
      <div className="rounded-xl border border-hairline bg-surface p-5 space-y-3">
        <h3 className="text-sm font-medium text-ink flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
          <span>Role permissions matrix</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {roles.map((r) => (
            <div
              key={r.id}
              className="p-3.5 rounded-lg border border-hairline bg-raised/50 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{r.displayName}</span>
                <span className="text-[11px] font-mono text-ink-muted">{r.name}</span>
              </div>
              <p className="text-xs text-ink-secondary">{r.description}</p>
              <div className="pt-1 flex flex-wrap gap-1">
                {r.permissions.map((p) => (
                  <span
                    key={p}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                      p.startsWith('cost') || p.startsWith('profit')
                        ? 'bg-accent/12 text-accent-ink border border-accent/20'
                        : 'bg-surface border border-hairline text-ink-secondary'
                    }`}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-5 relative">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-raised"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-accent/12 border border-accent/25 text-accent-ink">
                <UserPlus className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-medium text-ink">Create new user</h3>
            </div>

            {addError && (
              <div className="p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                  placeholder="cashier1"
                  className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Arif Rahman"
                  className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Role
                </label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
                >
                  {roles
                    .filter((r) => r.name !== 'owner')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.displayName} ({r.name === 'staff' ? 'No cost/profit' : 'Can view cost'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-ink-secondary">
                    Quick PIN (optional)
                  </label>
                  <span className="text-xs text-ink-muted">4–6 digits</span>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent font-mono tracking-widest text-center"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2 px-4 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop disabled:opacity-40"
                >
                  {addLoading ? 'Creating User…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Reset User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-5 relative">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="absolute right-4 top-4 p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-raised"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-accent/12 border border-accent/25 text-accent-ink">
                <UserCheck className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-medium text-ink">Edit user: @{editingUser.username}</h3>
                <p className="text-xs text-ink-muted">Update account details or reset credentials</p>
              </div>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>

              {editingUser.roleName !== 'owner' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">
                      Role
                    </label>
                    <select
                      value={editRoleId}
                      onChange={(e) => setEditRoleId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
                    >
                      {roles
                        .filter((r) => r.name !== 'owner')
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.displayName}
                          </option>
                        ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-hairline bg-raised cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="rounded border-hairline-strong accent-accent"
                    />
                    <span className="text-xs text-ink-secondary">
                      Account is active (uncheck to block login)
                    </span>
                  </label>
                </>
              )}

              <div className="pt-2 border-t border-hairline space-y-3">
                <div className="text-xs font-medium text-ink-muted">
                  Password &amp; PIN reset (leave blank to keep unchanged)
                </div>

                <div>
                  <label className="block text-xs text-ink-secondary mb-1">New password</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Leave empty to keep current password"
                    className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ink-secondary mb-1">New quick PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetPin}
                    onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Leave empty to keep current PIN"
                    className="w-full px-3.5 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink focus:outline-none focus:border-accent font-mono tracking-widest text-center"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2 px-4 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop disabled:opacity-40"
                >
                  {editLoading ? 'Saving Changes…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
