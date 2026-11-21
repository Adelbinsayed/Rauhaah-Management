import type { CartItem, CartTotals, Customer, SalePayment } from './types';
import type { ShopSettings } from '../auth/types';
import { invoke } from '@tauri-apps/api/core';

export async function getAvailablePrinters(): Promise<string[]> {
  try {
    return await invoke<string[]>('get_printers');
  } catch (err: unknown) {
    console.warn('Failed to query printers:', err);
    return [];
  }
}

export async function getDefaultPrinter(): Promise<string | null> {
  try {
    return await invoke<string | null>('get_default_printer');
  } catch (err: unknown) {
    console.warn('Failed to query default printer:', err);
    return null;
  }
}

export async function printDirectEscpos(
  data: Uint8Array,
  printerName?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    let target = printerName?.trim();
    if (!target) {
      target = (await getDefaultPrinter()) || undefined;
    }
    if (!target) {
      return {
        success: false,
        error: 'No printer found. Please select a thermal printer in Settings > Printer.',
      };
    }

    const dataArray = Array.from(data);
    await invoke('print_raw_escpos', { printerName: target, data: dataArray });
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface EscposReceiptOptions {
  invoiceNumber: string;
  createdAt?: string;
  cashierName?: string;
  customer: Customer | null;
  items: CartItem[];
  totals: CartTotals;
  payments: SalePayment[];
  shopSettings?: ShopSettings | null;
  paperWidth?: '80mm' | '58mm';
  autoCut?: boolean;
  kickDrawer?: boolean;
}

export class EscposBuilder {
  private buffer: number[] = [];
  private cols: number;

  constructor(paperWidth: '80mm' | '58mm' = '80mm') {
    this.cols = paperWidth === '58mm' ? 32 : 48;
    this.init();
  }

  // ESC @: Initialize printer
  init() {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  // Alignment: 0=Left, 1=Center, 2=Right
  align(mode: 'left' | 'center' | 'right') {
    const val = mode === 'center' ? 0x01 : mode === 'right' ? 0x02 : 0x00;
    this.buffer.push(0x1b, 0x61, val);
    return this;
  }

  // Bold on/off
  bold(enable: boolean = true) {
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  // Text size: normal or double height/width
  textSize(mode: 'normal' | 'double_height' | 'double_both') {
    if (mode === 'double_both') {
      this.buffer.push(0x1d, 0x21, 0x11);
    } else if (mode === 'double_height') {
      this.buffer.push(0x1d, 0x21, 0x01);
    } else {
      this.buffer.push(0x1d, 0x21, 0x00);
    }
    return this;
  }

  // Invert / White-on-black on/off
  invert(enable: boolean = true) {
    this.buffer.push(0x1d, 0x42, enable ? 0x01 : 0x00);
    return this;
  }

  // Feed n lines
  feed(lines: number = 1) {
    this.buffer.push(0x1b, 0x64, lines);
    return this;
  }

  // Append raw string
  text(str: string) {
    // Replace non-ASCII / special Bengali symbols to safe printable representations
    // or standard currency notation "Tk " / "BDT "
    const safeStr = str
      .replace(/৳/g, 'Tk ')
      .replace(/—/g, '-')
      .replace(/–/g, '-')
      .replace(/•/g, '*');

    for (let i = 0; i < safeStr.length; i++) {
      const code = safeStr.charCodeAt(i);
      if (code < 128) {
        this.buffer.push(code);
      } else {
        this.buffer.push(0x20); // fallback space
      }
    }
    return this;
  }

  // Print text followed by LF
  line(str: string = '') {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  // Print horizontal divider line
  divider(char: string = '-') {
    this.align('left');
    this.line(char.repeat(this.cols));
    return this;
  }

  // Print centered line
  centerLine(str: string) {
    this.align('center');
    this.line(str);
    this.align('left');
    return this;
  }

  // Print two columns justified across width (e.g. Subtotal ....... 1,200.00)
  twoCol(left: string, right: string) {
    this.align('left');
    const safeLeft = left.replace(/৳/g, 'Tk ');
    const safeRight = right.replace(/৳/g, 'Tk ');
    const totalSpaces = this.cols - safeLeft.length - safeRight.length;

    if (totalSpaces > 0) {
      this.line(safeLeft + ' '.repeat(totalSpaces) + safeRight);
    } else {
      // If too long, print left then right aligned
      this.line(safeLeft);
      this.align('right');
      this.line(safeRight);
      this.align('left');
    }
    return this;
  }

  // Print three columns (e.g. Item | Qty x Rate | Amount)
  threeCol(col1: string, col2: string, col3: string, w1?: number, w2?: number, w3?: number) {
    this.align('left');
    const width1 = w1 ?? (this.cols === 32 ? 14 : 22);
    const width2 = w2 ?? (this.cols === 32 ? 9 : 14);
    const width3 = w3 ?? (this.cols - width1 - width2);

    const c1 = col1.padEnd(width1).slice(0, width1);
    const c2 = col2.padStart(width2).slice(0, width2);
    const c3 = col3.padStart(width3).slice(0, width3);

    this.line(c1 + c2 + c3);
    return this;
  }

  // Cut paper: GS V 65 3 (feed 3 lines and cut)
  cut() {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, 0x41, 0x03);
    return this;
  }

  // Kick cash drawer: ESC p 0 25 250 (pulse pin 2)
  kickDrawer() {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  // Return generated bytes as Uint8Array
  toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Builds a complete raw ESC/POS thermal receipt payload ready to stream to a POS printer
 */
export function buildEscposReceipt(options: EscposReceiptOptions): Uint8Array {
  const {
    invoiceNumber,
    createdAt,
    cashierName,
    customer,
    items,
    totals,
    payments,
    shopSettings,
    paperWidth = '80mm',
    autoCut = true,
    kickDrawer = false,
  } = options;

  const b = new EscposBuilder(paperWidth);

  // Optional Cash drawer kick on cash sale
  if (kickDrawer) {
    b.kickDrawer();
  }

  const shopName = shopSettings?.shopName || 'RAUHAAH';
  const subtitle = shopSettings?.invoiceSubtitle || 'Live Peaceful * Luxury Fragrances';
  const address = shopSettings?.address || 'Dhaka, Bangladesh';
  const phone = shopSettings?.phone || '01970084325';
  const footerNote =
    shopSettings?.invoiceFooterNote ||
    'Items can be exchanged within 7 days with original invoice & intact seal. Poured oils are non-exchangeable.';

  const dateStr = createdAt
    ? new Date(createdAt).toLocaleString('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

  // 1. Header: Brand
  b.align('center');
  b.bold(true);
  b.textSize('double_both');
  b.line(shopName);

  b.textSize('normal');
  b.bold(false);
  if (subtitle) b.line(subtitle);
  if (address) b.line(address);
  if (phone) b.line(`Hotline: ${phone}`);
  b.divider('=');

  // 2. Metadata
  b.twoCol(`INVOICE: ${invoiceNumber}`, dateStr);
  if (cashierName) {
    b.twoCol(`Cashier: ${cashierName}`, '');
  }
  const custName = customer ? `${customer.name} (${customer.phone})` : 'Walk-in Customer';
  b.twoCol(`Customer:`, custName);
  b.divider('-');

  // 3. Line Items Table Header
  b.threeCol('ITEM / DESCRIPTION', 'QTY x RATE', 'TOTAL');
  b.divider('-');

  // 4. Line Items
  items.forEach((item) => {
    let title = item.productName;
    if (item.sellableType === 'loose_decant' && item.bottleSizeMl) {
      title += ` (${item.bottleSizeMl}ml)`;
    }
    b.line(title);

    const qtyStr = `${item.quantity}${item.unitCode} x ${item.unitPriceBdt.toFixed(0)}`;
    const totalStr = `Tk ${item.lineTotalBdt.toFixed(2)}`;
    b.twoCol(`  ${qtyStr}`, totalStr);

    if (item.discountAmountBdt > 0) {
      b.twoCol(`  (Discount -Tk ${item.discountAmountBdt.toFixed(2)})`, '');
    }
  });

  b.divider('-');

  // 5. Financial Totals
  b.twoCol('Gross Subtotal:', `Tk ${totals.subtotalBdt.toFixed(2)}`);

  if (totals.cartDiscountBdt > 0) {
    b.twoCol('Special Discount:', `-Tk ${totals.cartDiscountBdt.toFixed(2)}`);
  }

  b.divider('-');
  b.bold(true);
  b.textSize('double_height');
  b.twoCol('NET PAYABLE:', `Tk ${totals.totalAmountBdt.toFixed(2)}`);
  b.textSize('normal');
  b.bold(false);
  b.divider('-');

  // 6. Payments Tendered
  if (payments && payments.length > 0) {
    payments.forEach((p) => {
      const methodLabel = p.method.toUpperCase();
      const ref = p.reference ? ` (${p.reference})` : '';
      b.twoCol(`Paid [${methodLabel}${ref}]:`, `Tk ${p.amountBdt.toFixed(2)}`);
    });
  } else {
    b.twoCol('Paid Amount:', `Tk ${totals.paidAmountBdt.toFixed(2)}`);
  }

  if (totals.changeAmountBdt > 0) {
    b.twoCol('Change Returned:', `Tk ${totals.changeAmountBdt.toFixed(2)}`);
  }

  if (totals.dueAmountBdt > 0) {
    b.bold(true);
    b.twoCol('OUTSTANDING DUE:', `Tk ${totals.dueAmountBdt.toFixed(2)}`);
    b.bold(false);
  }

  b.divider('=');

  // 7. Policy & Footer
  b.align('center');
  b.line('Thank you for shopping with Rauhaah!');
  b.feed(1);
  if (footerNote) {
    b.line(footerNote);
  }

  b.feed(1);
  b.line('*** LIVE PEACEFUL ***');

  // 8. Auto-Cut
  if (autoCut) {
    b.cut();
  }

  return b.toBytes();
}

/**
 * Builds a fast test slip to verify printer communication, cutter, and drawer
 */
export function buildEscposTestSlip(settings?: ShopSettings | null, widthMode: '80mm' | '58mm' = '80mm'): Uint8Array {
  const b = new EscposBuilder(widthMode);

  b.align('center');
  b.bold(true);
  b.textSize('double_both');
  b.line(settings?.shopName || 'RAUHAAH');
  b.textSize('normal');
  b.bold(false);
  b.line('DIRECT ESC/POS TEST PRINT');
  b.line(new Date().toLocaleString());
  b.divider('=');

  b.align('left');
  b.line('Printer Communication: OK');
  b.line(`Paper Width: ${widthMode} Mode`);
  b.line(`Hardware Interface: Raw Winspool / TCP`);
  b.divider('-');

  b.twoCol('Left Column Test', 'Right Column OK');
  b.bold(true);
  b.twoCol('Bold Formatting:', 'PASSED');
  b.bold(false);
  b.divider('=');

  b.align('center');
  b.line('Direct ESC/POS is fully operational!');
  b.line('Bypassing Windows print dialog active.');
  b.feed(2);
  b.cut();

  return b.toBytes();
}
