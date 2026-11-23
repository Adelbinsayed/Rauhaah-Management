import { authRepo, verifySecret } from '@/data/repositories/authRepo';
import { useAppStore } from '@/app/store';
import { AlertCircle, KeyRound, Lock, LogOut } from 'lucide-react';
import React, { useState } from 'react';

interface LockScreenProps {
  deviceId: string;
}

export function LockScreen({ deviceId: _deviceId }: LockScreenProps) {
  const { currentUser, unlockSession, logout } = useAppStore();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!currentUser) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const dbUser = await authRepo.findUserByUsername(currentUser.username);
      if (!dbUser || dbUser.is_active !== 1) {
        setError('Account is inactive or unavailable.');
        setSecret('');
        setLoading(false);
        return;
      }

      // Check against PIN first if numeric, then password
      let ok = false;
      if (dbUser.pin_hash && /^\d+$/.test(secret.trim())) {
        ok = await verifySecret(secret.trim(), dbUser.pin_hash);
      }
      if (!ok) {
        ok = await verifySecret(secret, dbUser.password_hash);
      }

      if (ok) {
        setSecret('');
        unlockSession();
      } else {
        setError('Incorrect PIN or password.');
        setSecret('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSecret('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-canvas/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-ink select-none">
      <div className="w-full max-w-sm bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-none p-7 space-y-6 text-center">
        {/* User Icon & Lock Badge */}
        <div className="relative inline-block mx-auto">
          <div className="w-16 h-16 rounded-full bg-accent/12 border border-accent/30 flex items-center justify-center text-accent-ink font-medium text-2xl">
            {currentUser.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-accent text-accent-fg border border-surface">
            <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-ink">{currentUser.displayName}</h2>
          <p className="text-xs text-ink-muted capitalize mt-0.5">
            {currentUser.roleDisplayName} · Terminal locked
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              autoFocus
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={currentUser.hasPin ? 'PIN or password' : 'Password'}
              className="w-full px-4 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-center text-ink placeholder-ink-muted focus:outline-none focus:border-accent font-mono tracking-widest"
            />
            <KeyRound className="w-4 h-4 text-ink-muted absolute left-3 top-3" strokeWidth={1.5} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-accent text-accent-fg font-semibold text-xs hover:bg-accent-hover transition-colors duration-150 ease-unslop disabled:opacity-40"
          >
            {loading ? 'Unlocking…' : 'Unlock Screen'}
          </button>
        </form>

        <div className="pt-3 border-t border-hairline">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-ink-muted hover:text-ink transition-colors duration-150 ease-unslop inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Switch user / Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
