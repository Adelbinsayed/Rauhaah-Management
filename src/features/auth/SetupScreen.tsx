import { authRepo, hashSecret } from '@/data/repositories/authRepo';
import { generateRecoveryCode } from '@/domain/auth/recoveryCode';
import type { AuthSession } from '@/domain/auth/types';
import { AlertCircle, CheckCircle2, Copy, Eye, EyeOff, KeyRound, ShieldAlert, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen bg-brand-black text-white flex flex-col justify-center items-center p-6 selection:bg-brand-gold selection:text-brand-black">
      <div className="w-full max-w-lg bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-gold/15 border border-brand-gold/30 text-brand-gold mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {step === 'form' ? 'First-Run Setup' : 'Owner Recovery Code'}
          </h1>
          <p className="text-xs text-neutral-400">
            {step === 'form'
              ? 'Initialize your portable database and configure the primary Owner account.'
              : 'Keep this emergency code in a safe place to recover your account if needed.'}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'form' ? (
          <form onSubmit={handleProceedToRecovery} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Shop / Brand Name
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Rauhaah Perfumes & Attar"
                className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Owner Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="owner"
                  className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Owner"
                  className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Owner Password (min 6 characters)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Quick POS Unlock PIN (Optional)
                </label>
                <span className="text-[10px] text-neutral-400">4–6 digits</span>
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 1234"
                className="w-full px-3.5 py-2.5 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-lg bg-brand-gold text-brand-black font-bold text-sm hover:bg-brand-gold-hover transition-colors shadow-lg shadow-brand-gold/10"
            >
              Continue to Recovery Code →
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>IMPORTANT: Save this recovery code securely</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Because all data is stored offline in your local database with Argon2 encryption, Sooktec cannot reset your password for you. If you ever forget your password, this code is the only way to regain access.
              </p>

              <div className="flex items-center gap-2 bg-brand-black border border-brand-border rounded-lg p-3">
                <KeyRound className="w-4 h-4 text-brand-gold shrink-0" />
                <code className="flex-1 font-mono text-base font-bold text-brand-gold tracking-wider text-center select-all">
                  {recoveryCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-brand-surface hover:bg-neutral-700 text-neutral-200 transition-colors flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-brand-border bg-brand-black/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={(e) => setConfirmedSaved(e.target.checked)}
                className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold"
              />
              <span className="text-xs text-neutral-300">
                I have copied or written down this recovery code and stored it in a secure location.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="px-4 py-2.5 rounded-lg border border-brand-border text-xs text-neutral-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!confirmedSaved || loading}
                onClick={handleFinishSetup}
                className="flex-1 py-3 px-4 rounded-lg bg-brand-gold text-brand-black font-bold text-sm hover:bg-brand-gold-hover transition-colors disabled:opacity-40 shadow-lg shadow-brand-gold/10"
              >
                {loading ? 'Initializing Database…' : 'Complete Setup & Launch →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
