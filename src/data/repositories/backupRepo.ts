import { invoke } from '@tauri-apps/api/core';

export interface BackupItem {
  filename: string;
  path: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  isSafetySnapshot: boolean;
  integrityOk: boolean;
}

export interface DbHealthStats {
  dbSizeBytes: number;
  dbSizeFormatted: string;
  totalSalesCount: number;
  totalCustomersCount: number;
  totalProductsCount: number;
  integrityStatus: string;
  lastBackupAt: string | null;
}

export const backupRepo = {
  async getDbHealth(): Promise<DbHealthStats> {
    try {
      return await invoke<DbHealthStats>('get_db_health');
    } catch (err: unknown) {
      console.warn('Fallback getting db health:', err);
      return {
        dbSizeBytes: 0,
        dbSizeFormatted: 'Unknown',
        totalSalesCount: 0,
        totalCustomersCount: 0,
        totalProductsCount: 0,
        integrityStatus: 'ok',
        lastBackupAt: null,
      };
    }
  },

  async listBackups(): Promise<BackupItem[]> {
    try {
      return await invoke<BackupItem[]>('list_backups');
    } catch (err: unknown) {
      console.warn('Failed to list backups:', err);
      return [];
    }
  },

  async createBackup(label?: string): Promise<BackupItem> {
    return await invoke<BackupItem>('create_backup', { label });
  },

  async restoreBackup(filename: string): Promise<string> {
    return await invoke<string>('restore_backup', { filename });
  },

  async exportBackupToDownloads(filename: string): Promise<string> {
    return await invoke<string>('export_backup_to_downloads', { filename });
  },

  async deleteBackup(filename: string): Promise<boolean> {
    return await invoke<boolean>('delete_backup', { filename });
  },
};
