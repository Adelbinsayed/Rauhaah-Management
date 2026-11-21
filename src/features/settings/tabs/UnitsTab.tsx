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
        <label className="block text-xs font-medium text-ink-secondary mb-2">
          Default Tola Unit Convention
        </label>
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-hairline bg-canvas hover:border-hairline-strong cursor-pointer transition-colors">
            <input
              type="radio"
              name="tola"
              value="volume_12ml"
              checked={tolaConvention === 'volume_12ml'}
              onChange={() => onTolaConventionChange('volume_12ml')}
              className="accent-accent"
            />
            <div>
              <div className="font-semibold text-ink">
                Volume Convention: 1 tola = 12 ml (Attar retail standard)
              </div>
              <div className="text-[11px] text-ink-secondary">
                Common South Asian retail convention for loose attar decants and bottles.
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-hairline bg-canvas hover:border-hairline-strong cursor-pointer transition-colors">
            <input
              type="radio"
              name="tola"
              value="weight_11g"
              checked={tolaConvention === 'weight_11g'}
              onChange={() => onTolaConventionChange('weight_11g')}
              className="accent-accent"
            />
            <div>
              <div className="font-semibold text-ink">
                Weight Convention: 1 tola = 11.664 grams
              </div>
              <div className="text-[11px] text-ink-secondary">
                Traditional Indian subcontinent mass measurement for raw bulk purchases.
              </div>
            </div>
          </label>
        </div>
        <p className="text-[11px] text-ink-secondary mt-2">
          Note: You can also specify an individual oil&apos;s specific density in the product catalog for exact gram-to-ml conversion.
        </p>
      </div>
    </div>
  );
};
