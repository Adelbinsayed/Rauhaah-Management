import { authRepo, hashSecret } from '@/data/repositories/authRepo';
import { generateRecoveryCode } from '@/domain/auth/recoveryCode';
import type { AuthSession } from '@/domain/auth/types';
import { AlertCircle, CheckCircle2, Copy, Eye, EyeOff, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';

interface SetupScreenProps {
  deviceId: string;
  onSetupComplete: (session: AuthSession) => void;
}

export function SetupScreen({ deviceId, onSetupComplete }: SetupScreenProps) {
  const [step, setStep] = useState<'form' | 'recovery'>('form');

  // Form State
  const [shopName, setShopName] = useState('Rauhaah Perfumes & Attar');
  const [username, setUsername] = useState('owner');
  const [displayName, setDisplayName] = useState('Owner');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Recovery Code State
  const [recoveryCode, setRecoveryCode] = useState('');
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleProceedToRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!shopName.trim()) {
      setError('Please enter your shop name.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (pin.trim() && !/^\d{4,6}$/.test(pin.trim())) {
      setError('Quick PIN must be 4 to 6 numbers.');
      return;
    }

    const code = generateRecoveryCode();
    setRecoveryCode(code);
    setStep('recovery');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleFinishSetup = async () => {
    if (!confirmedSaved) {
      setError('Please confirm that you have saved your recovery code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const passwordHash = await hashSecret(password);
      const pinHash = pin.trim() ? await hashSecret(pin.trim()) : null;
      const recoveryCodeHash = await hashSecret(recoveryCode);

      const session = await authRepo.setupFirstRun({
        shopName,
        username,
        displayName,
        passwordHash,
        pinHash,
        recoveryCodeHash,
        deviceId,
      });

      onSetupComplete(session);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-center items-center p-6 selection:bg-accent selection:text-accent-fg">
      <div className="w-full max-w-lg bg-surface border border-hairline-strong rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.06)] dark:shadow-none p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-accent/12 border border-accent/25 text-accent-ink mb-2">
            <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-medium text-ink">
            {step === 'form' ? 'First-run setup' : 'Owner recovery code'}
          </h1>
          <p className="text-xs text-ink-muted">
            {step === 'form'
              ? 'Initialize your local database and configure the primary owner account'
              : 'Store this emergency code securely to recover access if needed'}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        {step === 'form' ? (
          <form onSubmit={handleProceedToRecovery} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                Shop or brand name
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Rauhaah Perfumes & Attar"
                className="w-full px-3.5 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  Owner username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="owner"
                  className="w-full px-3.5 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  Display name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Owner"
                  className="w-full px-3.5 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                Owner password (min 6 characters)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                Confirm password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-ink-secondary">
                  Quick POS unlock PIN (optional)
                </label>
                <span className="text-xs text-ink-muted">4–6 digits</span>
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                className="w-full px-3.5 py-2.5 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-lg bg-accent text-accent-fg font-semibold text-sm hover:bg-accent-hover transition-colors duration-150 ease-unslop"
            >
              Continue to Recovery Code →
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-warning/10 border border-warning/25 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-warning">
                <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>Save this recovery code securely</span>
              </div>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Because all data is stored offline in your local database with Argon2 encryption, Sooktec cannot reset your password for you. If you ever forget your password, this code is the only way to regain access.
              </p>

              <div className="flex items-center gap-2 bg-raised border border-hairline rounded-lg p-3">
                <KeyRound className="w-4 h-4 text-accent-ink shrink-0" strokeWidth={1.5} />
                <code className="flex-1 font-mono text-base font-medium text-accent-ink tracking-wider text-center select-all">
                  {recoveryCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-surface border border-hairline hover:border-hairline-strong text-ink transition-colors duration-150 ease-unslop flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-positive" strokeWidth={1.5} />
                      <span className="text-positive">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-hairline bg-raised cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={(e) => setConfirmedSaved(e.target.checked)}
                className="mt-0.5 rounded border-hairline-strong accent-accent"
              />
              <span className="text-xs text-ink-secondary">
                I have copied or written down this recovery code and stored it in a secure location.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="px-4 py-2.5 rounded-lg border border-hairline bg-raised text-xs text-ink-secondary hover:text-ink transition-colors duration-150 ease-unslop"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!confirmedSaved || loading}
                onClick={handleFinishSetup}
                className="flex-1 py-3 px-4 rounded-lg bg-accent text-accent-fg font-semibold text-sm hover:bg-accent-hover transition-colors duration-150 ease-unslop disabled:opacity-40"
              >
                {loading ? 'Initializing database…' : 'Complete Setup & Launch →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
