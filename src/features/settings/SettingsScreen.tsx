import { useAppStore } from '@/app/store';
import { authRepo } from '@/data/repositories/authRepo';
import { backupRepo, type BackupItem, type DbHealthStats } from '@/data/repositories/backupRepo';
import { settingsRepo } from '@/data/repositories/settingsRepo';
import { canManageSettings } from '@/domain/auth/permissions';
import type { AuditLogEntry, ShopSettings } from '@/domain/auth/types';
import {
  buildEscposTestSlip,
  getAvailablePrinters,
  getDefaultPrinter,
  printDirectEscpos,
} from '@/domain/pos/escpos';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  CreditCard,
  Database,
  FolderOpen,
  History,
  Lock,
  Receipt,
  Save,
  Scale,
  Settings as SettingsIcon,
  ShieldAlert,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AuditTab } from './tabs/AuditTab';
import { BackupTab } from './tabs/BackupTab';
import { InvoiceTab } from './tabs/InvoiceTab';
import { ProfileTab } from './tabs/ProfileTab';
import { SalesTab } from './tabs/SalesTab';
import { SecurityTab } from './tabs/SecurityTab';
import { UnitsTab } from './tabs/UnitsTab';

interface SettingsScreenProps {
  deviceId: string;
}

export function SettingsScreen({ deviceId }: SettingsScreenProps) {
  const { currentUser, permissions, setShopSettings } = useAppStore();
  const [activeTab, setActiveTab] = useState<
    'profile' | 'sales' | 'invoice' | 'units' | 'security' | 'backup' | 'audit'
  >('profile');

  // Form states
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('BDT');
  const [invoicePrefix, setInvoicePrefix] = useState('MAIN-');
  const [negativeStockPolicy, setNegativeStockPolicy] =
    useState<ShopSettings['negativeStockPolicy']>('warn_allow');
  const [tolaConvention, setTolaConvention] =
    useState<ShopSettings['tolaConvention']>('volume_12ml');
  const [idleLockMinutes, setIdleLockMinutes] = useState(5);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([
    'Cash',
    'bKash',
    'Nagad',
    'Card',
    'Bank',
  ]);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  // Invoice & Receipt Design states
  const [invoiceSubtitle, setInvoiceSubtitle] = useState('');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState('');
  const [invoicePaperWidth, setInvoicePaperWidth] = useState<'80mm' | '58mm' | 'a4'>('80mm');
  const [showLogoOnInvoice, setShowLogoOnInvoice] = useState(true);
  const [showCashierOnInvoice, setShowCashierOnInvoice] = useState(true);

  // Direct Thermal Printing states
  const [printerEngine, setPrinterEngine] =
    useState<'direct_escpos' | 'browser'>('direct_escpos');
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [autoCutReceipt, setAutoCutReceipt] = useState(true);
  const [kickCashDrawer, setKickCashDrawer] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<string | null>(null);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const [testSlipMsg, setTestSlipMsg] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  // Database & Backups states
  const [dbHealth, setDbHealth] = useState<DbHealthStats | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupLabel, setBackupLabel] = useState('');
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restoreConfirmModal, setRestoreConfirmModal] = useState<BackupItem | null>(null);
  const [backupToast, setBackupToast] = useState<{
    message: string;
    path?: string;
  } | null>(null);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial settings
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
        setInvoiceSubtitle(
          s.invoiceSubtitle || 'Live Peaceful • Luxury Fragrances & Lifestyle'
        );
        setInvoiceFooterNote(
          s.invoiceFooterNote ||
            'Items can be exchanged within 7 days with original invoice & intact seal. Poured oils are non-exchangeable.'
        );
        setInvoicePaperWidth(s.invoicePaperWidth || '80mm');
        setShowLogoOnInvoice(s.showLogoOnInvoice !== false);
        setShowCashierOnInvoice(s.showCashierOnInvoice !== false);

        setPrinterEngine(s.printerEngine || 'direct_escpos');
        setSelectedPrinter(s.selectedPrinter || '');
        setAutoCutReceipt(s.autoCutReceipt !== false);
        setKickCashDrawer(s.kickCashDrawer === true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    loadPrintersList();
  }, [setShopSettings]);

  // Load printers
  const loadPrintersList = async () => {
    setLoadingPrinters(true);
    try {
      const [list, def] = await Promise.all([
        getAvailablePrinters(),
        getDefaultPrinter(),
      ]);
      setAvailablePrinters(list);
      setDefaultPrinter(def);
      if (!selectedPrinter && def) {
        setSelectedPrinter(def);
      }
    } catch (err: unknown) {
      console.warn('Failed to load printers:', err);
    } finally {
      setLoadingPrinters(false);
    }
  };

  // Load audit or backup when respective tab is active
  useEffect(() => {
    if (activeTab === 'audit') {
      setLoadingAudit(true);
      authRepo
        .getAuditLogs(100)
        .then((logs) => setAuditLogs(logs))
        .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoadingAudit(false));
    } else if (activeTab === 'backup') {
      loadBackupData();
    }
  }, [activeTab]);

  const loadBackupData = async () => {
    setLoadingBackups(true);
    try {
      const [health, list] = await Promise.all([
        backupRepo.getDbHealth(),
        backupRepo.listBackups(),
      ]);
      setDbHealth(health);
      setBackups(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingBackups(false);
    }
  };

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
        invoiceSubtitle,
        invoiceFooterNote,
        invoicePaperWidth,
        showLogoOnInvoice,
        showCashierOnInvoice,
        printerEngine,
        selectedPrinter,
        autoCutReceipt,
        kickCashDrawer,
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

  const handleTestPrintSlip = async () => {
    setTestingPrinter(true);
    setTestSlipMsg(null);
    try {
      const pWidth = invoicePaperWidth === '58mm' ? '58mm' : '80mm';
      const slipBytes = buildEscposTestSlip(
        {
          shopName,
          phone,
          address,
          currency,
          invoicePrefix,
          negativeStockPolicy,
          tolaConvention,
          idleLockMinutes,
          paymentMethods,
        },
        pWidth
      );

      const target = selectedPrinter || defaultPrinter;
      const res = await printDirectEscpos(slipBytes, target);
      if (res.success) {
        setTestSlipMsg({
          success: true,
          text: `Test receipt slip sent directly to "${target || 'Default Thermal Printer'}"! Check printer output.`,
        });
      } else {
        setTestSlipMsg({
          success: false,
          text: res.error || 'Failed to print test slip. Ensure printer is connected and powered on.',
        });
      }
    } catch (err: unknown) {
      setTestSlipMsg({
        success: false,
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTestingPrinter(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setError(null);
    try {
      const created = await backupRepo.createBackup(backupLabel.trim() || undefined);
      setBackupLabel('');
      setBackupToast({
        message: `Backup snapshot "${created.filename}" created successfully! (${created.sizeFormatted})`,
      });
      setTimeout(() => setBackupToast(null), 6000);
      await loadBackupData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleExportBackup = async (filename: string) => {
    try {
      const savedPath = await backupRepo.exportBackupToDownloads(filename);
      setBackupToast({
        message: `Backup snapshot "${filename}" saved to Downloads folder!`,
        path: savedPath,
      });
      setTimeout(() => setBackupToast(null), 8000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to permanently delete backup snapshot "${filename}"?`)) {
      return;
    }
    try {
      await backupRepo.deleteBackup(filename);
      setBackupToast({
        message: `Snapshot "${filename}" deleted.`,
      });
      setTimeout(() => setBackupToast(null), 4000);
      await loadBackupData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreConfirmModal) return;
    setRestoringBackup(true);
    setError(null);
    try {
      const msg = await backupRepo.restoreBackup(restoreConfirmModal.filename);
      setRestoreConfirmModal(null);
      setBackupToast({
        message: msg,
      });
      setTimeout(() => setBackupToast(null), 8000);
      await loadBackupData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoringBackup(false);
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

  const currentSettingsPreview: ShopSettings = {
    shopName,
    phone,
    address,
    currency,
    invoicePrefix,
    negativeStockPolicy,
    tolaConvention,
    idleLockMinutes,
    paymentMethods,
    invoiceSubtitle,
    invoiceFooterNote,
    invoicePaperWidth,
    showLogoOnInvoice,
    showCashierOnInvoice,
    printerEngine,
    selectedPrinter,
    autoCutReceipt,
    kickCashDrawer,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
          <SettingsIcon className="w-5 h-5 text-brand-gold" />
          <span>Shop Settings &amp; System Administration</span>
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Store parameters, thermal printer hardware, offline SQLite backups, and system audit log.
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

      {/* Floating Backup Toast */}
      {backupToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-brand-surface border border-emerald-500/60 text-white rounded-xl shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Database Snapshot Action</div>
            <div className="text-[11px] text-neutral-300">{backupToast.message}</div>
          </div>
          {backupToast.path && (
            <button
              type="button"
              onClick={() => invoke('reveal_in_explorer', { path: backupToast.path })}
              className="ml-2 px-2.5 py-1.5 rounded-lg bg-brand-gold text-brand-black text-[11px] font-bold hover:bg-brand-gold/90 transition-colors flex items-center gap-1 shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Show in Folder</span>
            </button>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
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
          <span>Sales &amp; POS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoice')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'invoice'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Receipt Template &amp; Printer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'backup'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database &amp; Backups</span>
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
          <span>Units &amp; Measurement</span>
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
          <Lock className="w-4 h-4" />
          <span>Security &amp; Terminal Lock</span>
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
          <span>Audit Trail</span>
        </button>
      </div>

      {activeTab === 'audit' ? (
        <AuditTab
          auditLogs={auditLogs}
          loadingAudit={loadingAudit}
          onRefresh={() => {
            setLoadingAudit(true);
            authRepo.getAuditLogs(100).then(setAuditLogs).finally(() => setLoadingAudit(false));
          }}
        />
      ) : activeTab === 'backup' ? (
        <BackupTab
          dbHealth={dbHealth}
          backups={backups}
          loadingBackups={loadingBackups}
          creatingBackup={creatingBackup}
          backupLabel={backupLabel}
          onBackupLabelChange={setBackupLabel}
          onCreateBackup={handleCreateBackup}
          onExportBackup={handleExportBackup}
          onDeleteBackup={handleDeleteBackup}
          onRefreshBackups={loadBackupData}
          restoringBackup={restoringBackup}
          restoreConfirmModal={restoreConfirmModal}
          onOpenRestoreModal={setRestoreConfirmModal}
          onCloseRestoreModal={() => setRestoreConfirmModal(null)}
          onExecuteRestore={handleExecuteRestore}
        />
      ) : (
        /* Settings Forms */
        <form onSubmit={handleSave} className="rounded-xl border border-neutral-200 dark:border-brand-border bg-white dark:bg-brand-surface p-6 shadow-sm space-y-6">
          <div className="space-y-6">
            {activeTab === 'profile' && (
              <ProfileTab
                shopName={shopName}
                onShopNameChange={setShopName}
                phone={phone}
                onPhoneChange={setPhone}
                currency={currency}
                onCurrencyChange={setCurrency}
                address={address}
                onAddressChange={setAddress}
              />
            )}

            {activeTab === 'sales' && (
              <SalesTab
                invoicePrefix={invoicePrefix}
                onInvoicePrefixChange={setInvoicePrefix}
                negativeStockPolicy={negativeStockPolicy}
                onNegativeStockPolicyChange={setNegativeStockPolicy}
                paymentMethods={paymentMethods}
                newPaymentMethod={newPaymentMethod}
                onNewPaymentMethodChange={setNewPaymentMethod}
                onAddPaymentMethod={addPaymentMethod}
                onRemovePaymentMethod={removePaymentMethod}
              />
            )}

            {activeTab === 'invoice' && (
              <InvoiceTab
                printerEngine={printerEngine}
                onPrinterEngineChange={setPrinterEngine}
                selectedPrinter={selectedPrinter}
                onSelectedPrinterChange={setSelectedPrinter}
                availablePrinters={availablePrinters}
                defaultPrinter={defaultPrinter}
                loadingPrinters={loadingPrinters}
                onRefreshPrinters={loadPrintersList}
                testingPrinter={testingPrinter}
                onTestPrintSlip={handleTestPrintSlip}
                testSlipMsg={testSlipMsg}
                autoCutReceipt={autoCutReceipt}
                onAutoCutReceiptChange={setAutoCutReceipt}
                kickCashDrawer={kickCashDrawer}
                onKickCashDrawerChange={setKickCashDrawer}
                invoiceSubtitle={invoiceSubtitle}
                onInvoiceSubtitleChange={setInvoiceSubtitle}
                invoicePaperWidth={invoicePaperWidth}
                onInvoicePaperWidthChange={setInvoicePaperWidth}
                invoiceFooterNote={invoiceFooterNote}
                onInvoiceFooterNoteChange={setInvoiceFooterNote}
                showLogoOnInvoice={showLogoOnInvoice}
                onShowLogoOnInvoiceChange={setShowLogoOnInvoice}
                showCashierOnInvoice={showCashierOnInvoice}
                onShowCashierOnInvoiceChange={setShowCashierOnInvoice}
                cashierName={currentUser?.displayName || currentUser?.username || 'Cashier'}
                previewShopSettings={currentSettingsPreview}
              />
            )}

            {activeTab === 'units' && (
              <UnitsTab
                tolaConvention={tolaConvention}
                onTolaConventionChange={setTolaConvention}
              />
            )}

            {activeTab === 'security' && (
              <SecurityTab
                idleLockMinutes={idleLockMinutes}
                onIdleLockMinutesChange={setIdleLockMinutes}
              />
            )}

            <div className="pt-4 border-t border-neutral-200 dark:border-brand-border flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-gold text-brand-black text-xs font-bold hover:bg-brand-gold-hover transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
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
