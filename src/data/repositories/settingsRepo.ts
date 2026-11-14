import { dbBatchTx, dbQuery } from '@/data/db';
import type { ShopSettings } from '@/domain/auth/types';
import { nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Rauhaah Perfumes & Attar',
  phone: '',
  address: '',
  currency: 'BDT',
  invoicePrefix: 'MAIN-',
  negativeStockPolicy: 'warn_allow',
  tolaConvention: 'volume_12ml',
  idleLockMinutes: 5,
  paymentMethods: ['Cash', 'bKash', 'Nagad', 'Card', 'Bank'],
};

export const settingsRepo = {
  async getSettings(): Promise<ShopSettings> {
    const rows = await dbQuery<{ key: string; value: string }>(
      'SELECT key, value FROM settings WHERE deleted_at IS NULL'
    );
    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.key, r.value);
    }

    let paymentMethods = DEFAULT_SETTINGS.paymentMethods;
    const pmRaw = map.get('payment_methods');
    if (pmRaw) {
      try {
        paymentMethods = JSON.parse(pmRaw);
      } catch {
        paymentMethods = pmRaw.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    return {
      shopName: map.get('shop_name') ?? DEFAULT_SETTINGS.shopName,
      phone: map.get('shop_phone') ?? DEFAULT_SETTINGS.phone,
      address: map.get('shop_address') ?? DEFAULT_SETTINGS.address,
      currency: map.get('currency') ?? DEFAULT_SETTINGS.currency,
      invoicePrefix: map.get('invoice_prefix') ?? DEFAULT_SETTINGS.invoicePrefix,
      negativeStockPolicy:
        (map.get('negative_stock_policy') as ShopSettings['negativeStockPolicy']) ??
        DEFAULT_SETTINGS.negativeStockPolicy,
      tolaConvention:
        (map.get('tola_convention') as ShopSettings['tolaConvention']) ??
        DEFAULT_SETTINGS.tolaConvention,
      idleLockMinutes: Number(map.get('idle_lock_minutes') ?? DEFAULT_SETTINGS.idleLockMinutes),
      paymentMethods,
    };
  },

  async updateSettings(
    settings: Partial<ShopSettings>,
    deviceId: string,
    userId: string,
    username: string
  ): Promise<void> {
    const now = nowUtcIso();
    const batch: { sql: string; params: (string | number | null)[] }[] = [];

    const pairs: [string, string][] = [];
    if (settings.shopName !== undefined) pairs.push(['shop_name', settings.shopName.trim()]);
    if (settings.phone !== undefined) pairs.push(['shop_phone', settings.phone.trim()]);
    if (settings.address !== undefined) pairs.push(['shop_address', settings.address.trim()]);
    if (settings.currency !== undefined) pairs.push(['currency', settings.currency.trim()]);
    if (settings.invoicePrefix !== undefined)
      pairs.push(['invoice_prefix', settings.invoicePrefix.trim()]);
    if (settings.negativeStockPolicy !== undefined)
      pairs.push(['negative_stock_policy', settings.negativeStockPolicy]);
    if (settings.tolaConvention !== undefined)
      pairs.push(['tola_convention', settings.tolaConvention]);
    if (settings.idleLockMinutes !== undefined)
      pairs.push(['idle_lock_minutes', settings.idleLockMinutes.toString()]);
    if (settings.paymentMethods !== undefined)
      pairs.push(['payment_methods', JSON.stringify(settings.paymentMethods)]);

    for (const [key, value] of pairs) {
      batch.push({
        sql: `INSERT INTO settings (id, key, value, created_at, updated_at, device_id)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at,
                deleted_at = NULL,
                device_id = excluded.device_id`,
        params: [uuidv7(), key, value, now, now, deviceId],
      });
      batch.push({
        sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
              VALUES (?, 'settings', ?, 'update', ?, 0)`,
        params: [uuidv7(), key, now],
      });
    }

    batch.push({
      sql: `INSERT INTO audit_log (id, user_id, username, action, details, created_at, device_id)
            VALUES (?, ?, ?, 'settings.update', ?, ?, ?)`,
      params: [
        uuidv7(),
        userId,
        username,
        JSON.stringify({ updatedKeys: pairs.map(([k]) => k) }),
        now,
        deviceId,
      ],
    });

    await dbBatchTx(batch);
  },
};
