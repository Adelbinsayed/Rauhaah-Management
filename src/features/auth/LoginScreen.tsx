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
  const [mode, setMode] = useState<'password' | 'pin'>('password');
  const [username, setUsername] = useState('');
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
    <div className="min-h-screen bg-brand-black text-white flex flex-col justify-center items-center p-6 selection:bg-brand-gold selection:text-brand-black">
      <div className="w-full max-w-sm bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-7 space-y-6">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img
            src="/assets/rauhaah-logo-white.png"
            alt="Rauhaah"
            className="h-12 w-auto object-contain mb-1"
          />
          <p className="text-xs text-neutral-400">Sign in to access your shop terminal</p>
        </div>

        {/* Mode switcher tabs (Password vs PIN) */}
        <div className="grid grid-cols-2 p-1 bg-brand-black border border-brand-border rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setError(null);
            }}
            className={`py-1.5 rounded transition-colors ${
              mode === 'password'
                ? 'bg-brand-surface text-brand-gold shadow-sm'
                : 'text-neutral-400 hover:text-white'
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
            className={`py-1.5 rounded transition-colors ${
              mode === 'pin'
                ? 'bg-brand-surface text-brand-gold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Quick PIN
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. cashier or owner"
                className="w-full pl-9 pr-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
              <UserIcon className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            </div>
          </div>

          {mode === 'password' ? (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                />
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Quick 4–6 Digit PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold font-mono tracking-widest text-center"
                />
                <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-gold text-brand-black font-bold text-sm hover:bg-brand-gold-hover transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/10 disabled:opacity-40"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Authenticating…' : 'Sign In'}</span>
          </button>
        </form>

        <div className="text-center pt-1 border-t border-brand-border">
          <button
            type="button"
            onClick={() => setShowRecovery(true)}
            className="text-xs text-neutral-400 hover:text-brand-gold transition-colors inline-flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Forgot Owner Password? (Recovery Code)</span>
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
