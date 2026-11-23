import React from 'react';

interface ProfileTabProps {
  shopName: string;
  onShopNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  shopName,
  onShopNameChange,
  phone,
  onPhoneChange,
  address,
  onAddressChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1.5">
          Shop / Brand Name
        </label>
        <input
          type="text"
          required
          value={shopName}
          onChange={(e) => onShopNameChange(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-canvas border border-hairline rounded-lg text-sm text-ink focus:outline-none focus:border-accent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Phone Number
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+880 1..."
            className="w-full px-3.5 py-2.5 bg-canvas border border-hairline rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Currency
          </label>
          <input
            type="text"
            value="BDT (৳)"
            readOnly
            disabled
            aria-label="Currency (read-only for v1)"
            className="w-full px-3.5 py-2.5 bg-subtle border border-hairline rounded-lg text-sm text-ink-muted font-mono cursor-not-allowed select-none"
          />
          <p className="text-[11px] text-ink-muted mt-1">
            Fixed to Bangladeshi Taka (BDT) for v1.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1.5">
          Store Address / Location
        </label>
        <textarea
          rows={2}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Shop address for receipts and document headers"
          className="w-full px-3.5 py-2.5 bg-canvas border border-hairline rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
        />
      </div>
    </div>
  );
};
