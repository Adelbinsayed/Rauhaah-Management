import { useAppStore } from '@/app/store';
import { authRepo } from '@/data/repositories/authRepo';
import { settingsRepo } from '@/data/repositories/settingsRepo';
import { canManageSettings } from '@/domain/auth/permissions';
import type { AuditLogEntry, ShopSettings } from '@/domain/auth/types';
import { formatDhakaDateTime } from '@/lib/dates';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  Save,
  Scale,
  Settings as SettingsIcon,
  ShieldAlert,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface SettingsScreenProps {
  deviceId: string;
}

export function SettingsScreen({ deviceId }: SettingsScreenProps) {
  const { currentUser, permissions, setShopSettings } = useAppStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'sales' | 'units' | 'security' | 'audit'>('profile');

  // Form states
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('BDT');
  const [invoicePrefix, setInvoicePrefix] = useState('MAIN-');
  const [negativeStockPolicy, setNegativeStockPolicy] = useState<ShopSettings['negativeStockPolicy']>('warn_allow');
  const [tolaConvention, setTolaConvention] = useState<ShopSettings['tolaConvention']>('volume_12ml');
  const [idleLockMinutes, setIdleLockMinutes] = useState(5);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash', 'bKash', 'Nagad', 'Card', 'Bank']);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const s = await settingsRepo.getSettings();
        setShopSettings(s);
        setShopName(s.shopName);
        setPhone(s.phone);
        setAddress(s.address);
        setCurrency(s.currency);
        setInvoicePrefix(s.invoicePrefix);
        setNegativeStockPolicy(s.negativeStockPolicy);
        setTolaConvention(s.tolaConvention);
        setIdleLockMinutes(s.idleLockMinutes);
        setPaymentMethods(s.paymentMethods);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
  }, [setShopSettings]);

  useEffect(() => {
    if (activeTab === 'audit') {
      setLoadingAudit(true);
      authRepo
        .getAuditLogs(100)
        .then((logs) => setAuditLogs(logs))
        .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoadingAudit(false));
    }
  }, [activeTab]);

  if (!canManageSettings(permissions)) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Access Denied</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Only accounts with the <code>settings.manage</code> permission (Owner) can modify store configuration and view audit logs.
        </p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const updated: ShopSettings = {
        shopName,
        phone,
        address,
        currency,
        invoicePrefix,
        negativeStockPolicy,
        tolaConvention,
        idleLockMinutes,
        paymentMethods,
      };

      await settingsRepo.updateSettings(
        updated,
        deviceId,
        currentUser.id,
        currentUser.username
      );

      setShopSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const addPaymentMethod = () => {
    const val = newPaymentMethod.trim();
    if (val && !paymentMethods.includes(val)) {
      setPaymentMethods([...paymentMethods, val]);
      setNewPaymentMethod('');
    }
  };

  const removePaymentMethod = (pm: string) => {
    setPaymentMethods(paymentMethods.filter((p) => p !== pm));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
          <SettingsIcon className="w-5 h-5 text-brand-gold" />
          <span>Shop Settings & Audit Log</span>
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Store parameters, sales counter policies, units convention, auto-lock security, and system audit trail.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Settings successfully saved and recorded to audit log!</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-brand-border overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Shop Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'sales'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Sales & Counter</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('units')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'units'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Attar Units (Tola)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Idle Auto-Lock</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Log Trail</span>
        </button>
      </div>

      {activeTab === 'audit' ? (
        /* Audit Trail Table */
        <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-200 dark:border-brand-border flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                Recent Security & Audit Events
              </h3>
              <p className="text-[11px] text-neutral-400">
                Logins, credential updates, user creations, and setting modifications
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoadingAudit(true);
                authRepo.getAuditLogs(100).then(setAuditLogs).finally(() => setLoadingAudit(false));
              }}
              className="text-xs text-brand-gold hover:underline"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-brand-black/60 border-b border-neutral-200 dark:border-brand-border text-neutral-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-brand-border text-neutral-700 dark:text-neutral-200">
                {loadingAudit ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                      Loading audit logs…
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                      <td className="px-4 py-2.5 text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                        {formatDhakaDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-neutral-900 dark:text-white">
                        {log.username ? `@${log.username}` : 'System'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-brand-gold text-[11px]">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400 text-[11px] max-w-xs truncate">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Settings Form */
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-6 shadow-sm space-y-5">
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                    Shop / Brand Name
                  </label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+880 1..."
                      className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                      Currency Code
                    </label>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                    Store Address / Location
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop address for receipts and document headers"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
                  />
                </div>
              </div>
            )}

            {activeTab === 'sales' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                    Invoice Document Prefix
                  </label>
                  <input
                    type="text"
                    required
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                    placeholder="MAIN-"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold font-mono"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Prefix used to generate branch/device safe invoice numbers (e.g. <code>MAIN-S-000123</code>).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                    Negative Stock Policy (When Stock reaches 0)
                  </label>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50/50 dark:bg-brand-black/40 cursor-pointer">
                      <input
                        type="radio"
                        name="neg_stock"
                        value="warn_allow"
                        checked={negativeStockPolicy === 'warn_allow'}
                        onChange={() => setNegativeStockPolicy('warn_allow')}
                        className="text-brand-gold focus:ring-brand-gold"
                      />
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          Warn & Allow (Recommended for Rauhaah)
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Cashier is shown a prominent warning badge at the POS, but the sale is not blocked.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50/50 dark:bg-brand-black/40 cursor-pointer">
                      <input
                        type="radio"
                        name="neg_stock"
                        value="block"
                        checked={negativeStockPolicy === 'block'}
                        onChange={() => setNegativeStockPolicy('block')}
                        className="text-brand-gold focus:ring-brand-gold"
                      />
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white">Strict Block</div>
                        <div className="text-[11px] text-neutral-400">
                          Never permit a sale if inventory quantity is zero or insufficient.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50/50 dark:bg-brand-black/40 cursor-pointer">
                      <input
                        type="radio"
                        name="neg_stock"
                        value="allow_silent"
                        checked={negativeStockPolicy === 'allow_silent'}
                        onChange={() => setNegativeStockPolicy('allow_silent')}
                        className="text-brand-gold focus:ring-brand-gold"
                      />
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white">Allow Silently</div>
                        <div className="text-[11px] text-neutral-400">
                          Record negative movements without popup warnings.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                    Accepted Payment Methods
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {paymentMethods.map((pm) => (
                      <span
                        key={pm}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-semibold"
                      >
                        <span>{pm}</span>
                        {paymentMethods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePaymentMethod(pm)}
                            className="hover:text-red-400"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 max-w-xs">
                    <input
                      type="text"
                      value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value)}
                      placeholder="Add method (e.g. Upay)"
                      className="flex-1 px-3 py-1.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
                    />
                    <button
                      type="button"
                      onClick={addPaymentMethod}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-xs hover:border-brand-gold hover:text-brand-gold font-semibold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'units' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                    Default Tola Unit Convention
                  </label>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50/50 dark:bg-brand-black/40 cursor-pointer">
                      <input
                        type="radio"
                        name="tola"
                        value="volume_12ml"
                        checked={tolaConvention === 'volume_12ml'}
                        onChange={() => setTolaConvention('volume_12ml')}
                        className="text-brand-gold focus:ring-brand-gold"
                      />
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          Volume Convention: 1 tola = 12 ml (Attar retail standard)
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Common South Asian retail convention for loose attar decants and bottles.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-brand-border bg-neutral-50/50 dark:bg-brand-black/40 cursor-pointer">
                      <input
                        type="radio"
                        name="tola"
                        value="weight_11g"
                        checked={tolaConvention === 'weight_11g'}
                        onChange={() => setTolaConvention('weight_11g')}
                        className="text-brand-gold focus:ring-brand-gold"
                      />
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          Weight Convention: 1 tola = 11.664 grams
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Traditional Indian subcontinent mass measurement for raw bulk purchases.
                        </div>
                      </div>
                    </label>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-2">
                    Note: You can also specify an individual oil&apos;s specific density in the product catalog for exact gram-to-ml conversion.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                    Terminal Idle Lock Timeout
                  </label>
                  <select
                    value={idleLockMinutes}
                    onChange={(e) => setIdleLockMinutes(Number(e.target.value))}
                    className="w-full max-w-xs px-3.5 py-2.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
                  >
                    <option value={1}>1 Minute</option>
                    <option value={2}>2 Minutes</option>
                    <option value={5}>5 Minutes (Default)</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={0}>Never Auto-Lock</option>
                  </select>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    When no mouse or keyboard activity occurs for this duration, the screen locks automatically to protect your POS terminal.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-neutral-200 dark:border-brand-border flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-gold text-brand-black text-xs font-bold hover:bg-brand-gold-hover transition-colors shadow-sm disabled:opacity-40"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving Changes…' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
