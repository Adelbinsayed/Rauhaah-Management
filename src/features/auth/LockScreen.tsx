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
      if (!dbUser) {
        setError('User record not found.');
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
        unlockSession();
      } else {
        setError('Incorrect PIN or password.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white select-none">
      <div className="w-full max-w-sm bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-7 space-y-6 text-center">
        {/* User Icon & Lock Badge */}
        <div className="relative inline-block mx-auto">
          <div className="w-16 h-16 rounded-full bg-brand-gold/15 border border-brand-gold/40 flex items-center justify-center text-brand-gold font-bold text-2xl italic">
            {currentUser.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-brand-gold text-brand-black shadow">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">{currentUser.displayName}</h2>
          <p className="text-xs text-neutral-400 capitalize">
            {currentUser.roleDisplayName} · Screen Locked
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
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
              placeholder={currentUser.hasPin ? 'Enter PIN or password' : 'Enter password'}
              className="w-full px-4 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-center text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold font-mono tracking-widest"
            />
            <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold-hover transition-colors shadow-lg shadow-brand-gold/10 disabled:opacity-40"
          >
            {loading ? 'Unlocking…' : 'Unlock Screen'}
          </button>
        </form>

        <div className="pt-2 border-t border-brand-border">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Switch User / Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
