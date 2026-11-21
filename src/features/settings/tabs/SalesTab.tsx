import type { ShopSettings } from '@/domain/auth/types';
import React from 'react';

interface SalesTabProps {
  invoicePrefix: string;
  onInvoicePrefixChange: (value: string) => void;
  negativeStockPolicy: ShopSettings['negativeStockPolicy'];
  onNegativeStockPolicyChange: (policy: ShopSettings['negativeStockPolicy']) => void;
  paymentMethods: string[];
  newPaymentMethod: string;
  onNewPaymentMethodChange: (value: string) => void;
  onAddPaymentMethod: () => void;
  onRemovePaymentMethod: (pm: string) => void;
}

export const SalesTab: React.FC<SalesTabProps> = ({
  invoicePrefix,
  onInvoicePrefixChange,
  negativeStockPolicy,
  onNegativeStockPolicyChange,
  paymentMethods,
  newPaymentMethod,
  onNewPaymentMethodChange,
  onAddPaymentMethod,
  onRemovePaymentMethod,
}) => {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
          Invoice Document Prefix
        </label>
        <input
          type="text"
          required
          value={invoicePrefix}
          onChange={(e) => onInvoicePrefixChange(e.target.value.toUpperCase())}
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
              onChange={() => onNegativeStockPolicyChange('warn_allow')}
              className="text-brand-gold focus:ring-brand-gold"
            />
            <div>
              <div className="font-semibold text-neutral-900 dark:text-white">
                Warn &amp; Allow (Recommended for Rauhaah)
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
              onChange={() => onNegativeStockPolicyChange('block')}
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
              onChange={() => onNegativeStockPolicyChange('allow_silent')}
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
                  onClick={() => onRemovePaymentMethod(pm)}
                  className="hover:text-red-400 cursor-pointer"
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
            onChange={(e) => onNewPaymentMethodChange(e.target.value)}
            placeholder="Add method (e.g. Upay)"
            className="flex-1 px-3 py-1.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
          />
          <button
            type="button"
            onClick={onAddPaymentMethod}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-brand-border text-xs hover:border-brand-gold hover:text-brand-gold font-semibold cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
