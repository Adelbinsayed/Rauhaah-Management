import React from 'react';
import type { CartItem, CartTotals, Customer, SalePayment } from '../../domain/pos/types';
import type { ShopSettings } from '../../domain/auth/types';

export interface PrintableReceiptProps {
  invoiceNumber: string;
  createdAt?: string;
  cashierName?: string;
  customer: Customer | null;
  items: CartItem[];
  totals: CartTotals;
  payments: SalePayment[];
  shopSettings?: ShopSettings | null;
  paperWidth?: '80mm' | '58mm' | 'a4';
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  invoiceNumber,
  createdAt,
  cashierName,
  customer,
  items,
  totals,
  payments,
  shopSettings,
  paperWidth,
}) => {
  const widthMode = paperWidth || shopSettings?.invoicePaperWidth || '80mm';
  const showLogo = shopSettings?.showLogoOnInvoice !== false;
  const showCashier = shopSettings?.showCashierOnInvoice !== false;

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const shopName = shopSettings?.shopName || 'RAUHAAH';
  const shopPhone = shopSettings?.phone || '01970084325';
  const shopAddress = shopSettings?.address || 'Dhaka, Bangladesh';
  const subtitle = shopSettings?.invoiceSubtitle || 'Live Peaceful • Luxury Fragrances & Lifestyle';
  const footerNote =
    shopSettings?.invoiceFooterNote ||
    'Items can be exchanged within 7 days with original invoice & intact seal. Poured oils are non-exchangeable.';

  const widthStyle =
    widthMode === '58mm'
      ? { width: '58mm', maxWidth: '58mm' }
      : widthMode === 'a4'
      ? { width: '100%', maxWidth: '210mm' }
      : { width: '80mm', maxWidth: '80mm' };

  return (
    <div
      id="printable-receipt"
      style={widthStyle}
      className="bg-white text-black p-3 font-mono text-[11px] leading-tight select-none"
    >
      {/* Brand Header */}
      <div className="text-center pb-2 border-b border-dashed border-black/40">
        {showLogo && (
          <div className="flex justify-center mb-1">
            <span className="text-base font-extrabold tracking-widest uppercase">
              ✦ {shopName} ✦
            </span>
          </div>
        )}

        <div className="text-[10px] text-gray-700 italic mb-0.5">{subtitle}</div>
        {shopAddress && <div className="text-[10px] text-gray-800">{shopAddress}</div>}
        {shopPhone && <div className="text-[10px] font-bold">Hotline: {shopPhone}</div>}
      </div>

      {/* Invoice Meta */}
      <div className="py-2 border-b border-dashed border-black/40 text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span className="font-bold">INVOICE:</span>
          <span className="font-bold font-mono">{invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{dateStr}</span>
        </div>
        {showCashier && cashierName && (
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{cashierName}</span>
          </div>
        )}
        <div className="flex justify-between pt-0.5">
          <span>Customer:</span>
          <span className="font-semibold">
            {customer ? `${customer.name} (${customer.phone})` : 'Walk-in Customer'}
          </span>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="py-2 border-b border-dashed border-black/40">
        <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-black/20 uppercase">
          <span>Item</span>
          <span className="text-right">Qty × Price &nbsp; Total</span>
        </div>

        <div className="divide-y divide-dashed divide-black/20 pt-1">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="py-1">
              <div className="font-bold text-[10.5px]">
                {item.productName}
                {item.bottleSizeMl ? ` (${item.bottleSizeMl}ml)` : ''}
              </div>
              <div className="flex justify-between text-[10px] text-gray-800">
                <span>
                  {item.quantity} {item.unitCode} × ৳{item.unitPriceBdt.toFixed(2)}
                </span>
                <span className="font-bold text-black font-mono">
                  ৳{item.lineTotalBdt.toFixed(2)}
                </span>
              </div>
              {item.discountAmountBdt > 0 && (
                <div className="text-[9.5px] text-gray-600">
                  Disc: -৳{item.discountAmountBdt.toFixed(2)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Financial Totals */}
      <div className="py-2 border-b border-dashed border-black/40 space-y-1 text-[10.5px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-mono">৳{totals.subtotalBdt.toFixed(2)}</span>
        </div>

        {(totals.itemDiscountBdt > 0 || totals.cartDiscountBdt > 0) && (
          <div className="flex justify-between text-gray-800">
            <span>Total Discount:</span>
            <span className="font-mono font-semibold">
              -৳{(totals.itemDiscountBdt + totals.cartDiscountBdt).toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm font-extrabold pt-1 border-t border-black">
          <span>TOTAL PAYABLE:</span>
          <span className="font-mono">৳{totals.totalAmountBdt.toFixed(2)}</span>
        </div>

        {/* Payments Breakdown */}
        <div className="pt-1 border-t border-dashed border-black/30 text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span>
              Paid ({payments.map((p) => p.method.toUpperCase()).join(' + ')}):
            </span>
            <span className="font-mono font-semibold">৳{totals.paidAmountBdt.toFixed(2)}</span>
          </div>

          {totals.changeAmountBdt > 0 && (
            <div className="flex justify-between">
              <span>Change Returned:</span>
              <span className="font-mono">৳{totals.changeAmountBdt.toFixed(2)}</span>
            </div>
          )}

          {totals.dueAmountBdt > 0 && (
            <div className="flex justify-between font-bold">
              <span>Customer Due:</span>
              <span className="font-mono">৳{totals.dueAmountBdt.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Notes & Policy */}
      <div className="pt-2 text-center text-[9px] space-y-1 text-gray-700">
        <p className="leading-tight px-1">{footerNote}</p>
        <div className="font-bold text-[10px] tracking-widest uppercase text-black pt-1">
          *** THANK YOU • VISIT AGAIN ***
        </div>
        <div className="text-[8px] text-gray-500 pt-0.5">
          Powered by Rauhaah Management &bull; Sooktec
        </div>
      </div>
    </div>
  );
};
