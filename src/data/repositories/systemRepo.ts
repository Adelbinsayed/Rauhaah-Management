import { nowUtcIso } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import { dbBatchTx, dbQuery, type DbInfo, getDbInfo } from '../db';

export interface BranchRow {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export const systemRepo = {
  async getDbInfo(): Promise<DbInfo | null> {
    return getDbInfo();
  },

  async getBranches(): Promise<BranchRow[]> {
    return dbQuery<BranchRow>(
      'SELECT id, name, code, created_at FROM branches WHERE deleted_at IS NULL ORDER BY created_at ASC'
    );
  },

  async getSetting(key: string): Promise<string | null> {
    const rows = await dbQuery<SettingRow>(
      'SELECT key, value, updated_at FROM settings WHERE key = ? AND deleted_at IS NULL LIMIT 1',
      [key]
    );
    return rows[0]?.value ?? null;
  },

  async setSetting(key: string, value: string, deviceId: string): Promise<void> {
    const now = nowUtcIso();
    const existing = await dbQuery<{ id: string }>(
      'SELECT id FROM settings WHERE key = ? LIMIT 1',
      [key]
    );

    if (existing.length > 0) {
      const id = existing[0].id;
      await dbBatchTx([
        {
          sql: 'UPDATE settings SET value = ?, updated_at = ?, deleted_at = NULL, device_id = ? WHERE id = ?',
          params: [value, now, deviceId, id],
        },
        {
          sql: 'INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced) VALUES (?, ?, ?, ?, ?, 0)',
          params: [uuidv7(), 'settings', id, 'update', now],
        },
      ]);
    } else {
      const id = uuidv7();
      await dbBatchTx([
        {
          sql: 'INSERT INTO settings (id, key, value, created_at, updated_at, device_id) VALUES (?, ?, ?, ?, ?, ?)',
          params: [id, key, value, now, now, deviceId],
        },
        {
          sql: 'INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced) VALUES (?, ?, ?, ?, ?, 0)',
          params: [uuidv7(), 'settings', id, 'insert', now],
        },
      ]);
    }
  },
};
