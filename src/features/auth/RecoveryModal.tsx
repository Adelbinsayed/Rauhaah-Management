import { authRepo, hashSecret } from '@/data/repositories/authRepo';
import { normalizeRecoveryCode } from '@/domain/auth/recoveryCode';
import { AlertCircle, CheckCircle2, KeyRound, X } from 'lucide-react';
import React, { useState } from 'react';

interface RecoveryModalProps {
  deviceId: string;
  onClose: () => void;
  onRecoverySuccess: () => void;
}

export function RecoveryModal({ deviceId, onClose, onRecoverySuccess }: RecoveryModalProps) {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = normalizeRecoveryCode(code);
    if (!normalized.startsWith('RAUH-')) {
      setError('Please enter a valid recovery code starting with RAUH-');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const newHash = await hashSecret(newPassword);
      const ok = await authRepo.recoverOwnerPassword(normalized, newHash, deviceId);
      if (!ok) {
        setError('Invalid recovery code. Please check your emergency code and try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onRecoverySuccess();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-6 space-y-5 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-neutral-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-brand-gold/15 border border-brand-gold/30 text-brand-gold">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Owner Password Recovery</h2>
            <p className="text-xs text-neutral-400">Reset your password using the recovery code.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Password successfully reset! You can now log in with your new password.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Recovery Code
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="RAUH-XXXX-XXXX-XXXX"
                className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-brand-gold font-mono tracking-wider focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                New Password (min 6 characters)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-brand-border text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-lg bg-brand-gold text-brand-black font-bold text-xs hover:bg-brand-gold-hover transition-colors disabled:opacity-40"
              >
                {loading ? 'Verifying Code…' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
