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
        <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Access Denied</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
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
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <UsersIcon className="w-5 h-5 text-brand-gold" />
            <span>Users & Staff Roles</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Manage cashier and manager access. Staff accounts are strictly restricted from seeing cost or profit.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAddError(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-gold text-brand-black text-xs font-bold hover:bg-brand-gold-hover transition-colors shadow-sm self-start"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff / User</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-brand-black/60 border-b border-neutral-200 dark:border-brand-border text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Quick PIN</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Login</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-brand-border text-neutral-700 dark:text-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-neutral-400">
                    Loading users…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-neutral-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isOwner = u.roleName === 'owner';
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {u.displayName}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono">@{u.username}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isOwner
                              ? 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30'
                              : u.roleName === 'manager'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{u.roleDisplayName}</span>
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {u.hasPin ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Configured</span>
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-[11px]">None</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.isActive
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-neutral-500/10 text-neutral-400'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-neutral-500 dark:text-neutral-400">
                        {u.lastLoginAt ? formatDhakaDateTime(u.lastLoginAt) : 'Never logged in'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="px-3 py-1 rounded border border-neutral-200 dark:border-brand-border text-[11px] font-medium hover:border-brand-gold hover:text-brand-gold transition-colors"
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
      <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-5 space-y-3">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-gold" />
          <span>Role Permissions Matrix</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {roles.map((r) => (
            <div
              key={r.id}
              className="p-3.5 rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50/50 dark:bg-brand-black/40 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 dark:text-white">{r.displayName}</span>
                <span className="text-[10px] uppercase font-mono text-neutral-400">{r.name}</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{r.description}</p>
              <div className="pt-1 flex flex-wrap gap-1">
                {r.permissions.map((p) => (
                  <span
                    key={p}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono ${
                      p.startsWith('cost') || p.startsWith('profit')
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 space-y-5 relative">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-brand-gold/15 text-brand-gold">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Create New User</h3>
            </div>

            {addError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. cashier1"
                  className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Arif Rahman"
                  className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold"
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
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Quick PIN (Optional)
                  </label>
                  <span className="text-[10px] text-neutral-400">4–6 digits</span>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold font-mono tracking-widest text-center"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-brand-border text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2 px-4 rounded-lg bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold-hover transition-colors disabled:opacity-40"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 space-y-5 relative">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-brand-gold/15 text-brand-gold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Edit User: @{editingUser.username}</h3>
                <p className="text-[11px] text-neutral-400">Update account details or reset credentials</p>
              </div>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold"
                />
              </div>

              {editingUser.roleName !== 'owner' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Role
                    </label>
                    <select
                      value={editRoleId}
                      onChange={(e) => setEditRoleId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold"
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

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-brand-border bg-brand-black/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="rounded border-brand-border text-brand-gold focus:ring-brand-gold"
                    />
                    <span className="text-xs text-neutral-200">
                      Account is Active (Uncheck to block login)
                    </span>
                  </label>
                </>
              )}

              <div className="pt-2 border-t border-brand-border/60 space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Password & PIN Reset (Leave blank to keep unchanged)
                </div>

                <div>
                  <label className="block text-xs text-neutral-300 mb-1">New Password</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Leave empty to keep current password"
                    className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-300 mb-1">New Quick PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetPin}
                    onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Leave empty to keep current PIN"
                    className="w-full px-3.5 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold font-mono tracking-widest text-center"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg border border-brand-border text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2 px-4 rounded-lg bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold-hover transition-colors disabled:opacity-40"
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
