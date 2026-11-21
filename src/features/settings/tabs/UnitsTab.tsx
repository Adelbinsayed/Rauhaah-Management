import type { ShopSettings } from '@/domain/auth/types';
import React from 'react';

interface UnitsTabProps {
  tolaConvention: ShopSettings['tolaConvention'];
  onTolaConventionChange: (val: ShopSettings['tolaConvention']) => void;
}

export const UnitsTab: React.FC<UnitsTabProps> = ({
  tolaConvention,
  onTolaConventionChange,
}) => {
  return (
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
              onChange={() => onTolaConventionChange('volume_12ml')}
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
              onChange={() => onTolaConventionChange('weight_11g')}
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
  );
};
