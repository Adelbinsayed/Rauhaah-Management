import { invoke } from '@tauri-apps/api/core';
import { uuidv7 } from '@/lib/ids';
import { nowUtcIso } from '@/lib/dates';

export type SqlParam = string | number | boolean | null;

export interface BatchStatement {
  sql: string;
  params: SqlParam[];
}

export type ChangeLogOperation = 'insert' | 'update' | 'delete';

/**
 * Creates a standardized audit entry statement for SQLite change_log table.
 * Deduplicates raw SQL and guarantees parameter alignment across all repositories.
 */
export function createChangeLogStatement(
  tableName: string,
  rowId: string,
  operation: ChangeLogOperation,
  timestamp?: string,
  logId?: string
): BatchStatement {
  return {
    sql: `INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
          VALUES (?, ?, ?, ?, ?, 0)`,
    params: [logId || uuidv7(), tableName, rowId, operation, timestamp || nowUtcIso()],
  };
}

export interface DbInfo {
  dbPath: string;
  dataDir: string;
  backupsDir: string;
  importDir: string;
  journalMode: string;
  deviceId: string;
  appliedMigrations: number[];
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Execute a parameterized SELECT query and return rows as typed objects.
 * All SQL must live inside `src/data/`.
 */
export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: SqlParam[] = []
): Promise<T[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<T[]>('db_query', { sql, params });
}

/**
 * Execute a single parameterized INSERT / UPDATE / DELETE statement.
 */
export async function dbExecute(sql: string, params: SqlParam[] = []): Promise<number> {
  if (!isTauriRuntime()) {
    return 0;
  }
  return invoke<number>('db_execute', { sql, params });
}

/**
 * Execute multiple parameterized SQL statements atomically inside a single
 * Rust-managed `BEGIN IMMEDIATE ... COMMIT` transaction.
 */
export async function dbBatchTx(statements: BatchStatement[]): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('db_batch_tx', { statements });
}

/**
 * Retrieve portable SQLite path, directories, WAL status, and migration info.
 */
export async function getDbInfo(): Promise<DbInfo | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<DbInfo>('db_info');
}
