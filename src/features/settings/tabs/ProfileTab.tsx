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
  currency,
  onCurrencyChange,
  address,
  onAddressChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
          Shop / Brand Name
        </label>
        <input
          type="text"
          required
          value={shopName}
          onChange={(e) => onShopNameChange(e.target.value)}
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
            onChange={(e) => onPhoneChange(e.target.value)}
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
            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
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
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Shop address for receipts and document headers"
          className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-brand-black border border-neutral-200 dark:border-brand-border rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand-gold"
        />
      </div>
    </div>
  );
};
