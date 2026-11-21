import { authRepo, verifySecret } from '@/data/repositories/authRepo';
import type { AuthSession } from '@/domain/auth/types';
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, LogIn, User as UserIcon } from 'lucide-react';
import React, { useState } from 'react';
import { RecoveryModal } from './RecoveryModal';

interface LoginScreenProps {
  deviceId: string;
  onLoginSuccess: (session: AuthSession) => void;
}

export function LoginScreen({ deviceId, onLoginSuccess }: LoginScreenProps) {
  const [savedUser] = useState<string>(() => {
    try {
      return localStorage.getItem('rauhaah_remembered_username') || '';
    } catch {
      return '';
    }
  });

  const [mode, setMode] = useState<'password' | 'pin'>('pin');
  const [username, setUsername] = useState(savedUser);
  const [rememberUsername, setRememberUsername] = useState(true);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError('Please enter your username.');
      return;
    }

    setLoading(true);
    try {
      const dbUser = await authRepo.findUserByUsername(cleanUser);
      if (!dbUser) {
        await authRepo.recordLoginFailure(cleanUser, 'User not found', deviceId);
        setError('Invalid username or password.');
        setLoading(false);
        return;
      }

      if (dbUser.is_active !== 1) {
        await authRepo.recordLoginFailure(cleanUser, 'Account deactivated', deviceId);
        setError('This account has been deactivated. Please contact the owner.');
        setLoading(false);
        return;
      }

      let authenticated = false;
      if (mode === 'password') {
        if (!password) {
          setError('Please enter your password.');
          setLoading(false);
          return;
        }
        authenticated = await verifySecret(password, dbUser.password_hash);
      } else {
        if (!pin) {
          setError('Please enter your PIN.');
          setLoading(false);
          return;
        }
        if (!dbUser.pin_hash) {
          setError('No PIN configured for this account. Please use password login.');
          setLoading(false);
          return;
        }
        authenticated = await verifySecret(pin, dbUser.pin_hash);
      }

      if (!authenticated) {
        await authRepo.recordLoginFailure(cleanUser, 'Incorrect credentials', deviceId);
        setError('Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      // Login success
      if (rememberUsername) {
        try {
          localStorage.setItem('rauhaah_remembered_username', cleanUser);
        } catch {
          // ignore
        }
      } else {
        try {
          localStorage.removeItem('rauhaah_remembered_username');
        } catch {
          // ignore
        }
      }

      await authRepo.recordLoginSuccess(dbUser, deviceId);
      const permissions = await authRepo.getRolePermissions(dbUser.role_id);

      onLoginSuccess({
        user: {
          id: dbUser.id,
          username: dbUser.username,
          displayName: dbUser.display_name,
          roleId: dbUser.role_id,
          roleName: dbUser.role_name,
          roleDisplayName: dbUser.role_display_name,
          hasPin: Boolean(dbUser.pin_hash),
          isActive: true,
          lastLoginAt: dbUser.last_login_at,
          createdAt: dbUser.created_at,
          updatedAt: dbUser.updated_at,
        },
        permissions,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-center items-center p-6 selection:bg-accent selection:text-accent-fg">
      <div className="w-full max-w-sm bg-surface border border-hairline-strong rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.06)] dark:shadow-none p-7 space-y-6">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img
            src="/assets/rauhaah-logo-white.png"
            alt="Rauhaah"
            className="hidden dark:block h-11 w-auto object-contain mb-1"
          />
          <img
            src="/assets/rauhaah-logo-dark.png"
            alt="Rauhaah"
            className="block dark:hidden h-11 w-auto object-contain mb-1"
          />
          <p className="text-xs text-ink-muted">Sign in to access your shop terminal</p>
        </div>

        {/* Mode switcher tabs (Password vs PIN) */}
        <div className="grid grid-cols-2 p-1 bg-raised border border-hairline rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setError(null);
            }}
            className={`py-1.5 rounded-md transition-colors duration-150 ease-unslop ${
              mode === 'password'
                ? 'bg-surface text-accent-ink border border-hairline shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('pin');
              setError(null);
            }}
            className={`py-1.5 rounded-md transition-colors duration-150 ease-unslop ${
              mode === 'pin'
                ? 'bg-surface text-accent-ink border border-hairline shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Quick PIN
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-ink-secondary">
                Username
              </label>
              {savedUser && username === savedUser && (
                <button
                  type="button"
                  onClick={() => {
                    setUsername('');
                    try {
                      localStorage.removeItem('rauhaah_remembered_username');
                    } catch {}
                  }}
                  className="text-xs text-ink-muted hover:text-accent-ink transition-colors duration-150 ease-unslop"
                >
                  Switch user
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus={!savedUser}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full pl-9 pr-3.5 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
              />
              <UserIcon className="w-4 h-4 text-ink-muted absolute left-3 top-3" strokeWidth={1.5} />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="rememberUsername"
                checked={rememberUsername}
                onChange={(e) => setRememberUsername(e.target.checked)}
                className="rounded border-hairline-strong accent-accent w-3.5 h-3.5 cursor-pointer"
              />
              <label htmlFor="rememberUsername" className="text-xs text-ink-muted cursor-pointer select-none">
                Remember username on this device
              </label>
            </div>
          </div>

          {mode === 'password' ? (
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus={Boolean(savedUser)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                />
                <Lock className="w-4 h-4 text-ink-muted absolute left-3 top-3" strokeWidth={1.5} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                Quick 4–6 digit PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus={Boolean(savedUser)}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent font-mono tracking-widest text-center"
                />
                <KeyRound className="w-4 h-4 text-ink-muted absolute left-3 top-3" strokeWidth={1.5} />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-accent text-accent-fg font-semibold text-sm hover:bg-accent-hover transition-colors duration-150 ease-unslop flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <LogIn className="w-4 h-4" strokeWidth={1.75} />
            <span>{loading ? 'Authenticating…' : 'Sign In'}</span>
          </button>
        </form>

        <div className="text-center pt-3 border-t border-hairline">
          <button
            type="button"
            onClick={() => setShowRecovery(true)}
            className="text-xs text-ink-muted hover:text-accent-ink transition-colors duration-150 ease-unslop inline-flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Forgot owner password? (Recovery code)</span>
          </button>
        </div>
      </div>

      {showRecovery && (
        <RecoveryModal
          deviceId={deviceId}
          onClose={() => setShowRecovery(false)}
          onRecoverySuccess={() => {
            setShowRecovery(false);
            setMode('password');
            setError('Password reset successfully. Please log in with your new password.');
          }}
        />
      )}
    </div>
  );
}
