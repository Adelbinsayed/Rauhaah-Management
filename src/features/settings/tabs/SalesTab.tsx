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
        <label className="block text-xs font-medium text-ink-secondary mb-1.5">
          Invoice Document Prefix
        </label>
        <input
          type="text"
          required
          value={invoicePrefix}
          onChange={(e) => onInvoicePrefixChange(e.target.value.toUpperCase())}
          placeholder="INV"
          className="w-full px-3.5 py-2.5 bg-canvas border border-hairline rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent font-mono"
        />
        <p className="text-[11px] text-ink-muted mt-1">
          Prefix used to generate branch/device safe invoice numbers (e.g. <code>INV-202611-0001</code>).
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-2">
          Negative Stock Policy (When Stock reaches 0)
        </label>
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-hairline bg-canvas hover:border-hairline-strong cursor-pointer transition-colors">
            <input
              type="radio"
              name="neg_stock"
              value="warn_allow"
              checked={negativeStockPolicy === 'warn_allow'}
              onChange={() => onNegativeStockPolicyChange('warn_allow')}
              className="accent-accent"
            />
            <div>
              <div className="font-semibold text-ink">
                Warn &amp; Allow (Recommended)
              </div>
              <div className="text-[11px] text-ink-secondary">
                Cashier is shown a prominent warning badge at the POS, but the sale is not blocked.
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-hairline bg-canvas hover:border-hairline-strong cursor-pointer transition-colors">
            <input
              type="radio"
              name="neg_stock"
              value="block"
              checked={negativeStockPolicy === 'block'}
              onChange={() => onNegativeStockPolicyChange('block')}
              className="accent-accent"
            />
            <div>
              <div className="font-semibold text-ink">Strict Block</div>
              <div className="text-[11px] text-ink-secondary">
                Never permit a sale if inventory quantity is zero or insufficient.
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-hairline bg-canvas hover:border-hairline-strong cursor-pointer transition-colors">
            <input
              type="radio"
              name="neg_stock"
              value="allow_silent"
              checked={negativeStockPolicy === 'allow_silent'}
              onChange={() => onNegativeStockPolicyChange('allow_silent')}
              className="accent-accent"
            />
            <div>
              <div className="font-semibold text-ink">Allow Silently</div>
              <div className="text-[11px] text-ink-secondary">
                Record negative movements without popup warnings.
              </div>
            </div>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-2">
          Accepted Payment Methods
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {paymentMethods.map((pm) => (
            <span
              key={pm}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent-ink text-xs font-medium"
            >
              <span>{pm}</span>
              {paymentMethods.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemovePaymentMethod(pm)}
                  className="hover:text-negative cursor-pointer"
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddPaymentMethod();
              }
            }}
            placeholder="Add method (e.g. Upay)"
            className="flex-1 px-3 py-1.5 bg-canvas border border-hairline rounded-lg text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={onAddPaymentMethod}
            className="px-3 py-1.5 rounded-lg border border-hairline text-xs text-ink-secondary hover:border-accent hover:text-accent-ink font-medium transition-colors cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
