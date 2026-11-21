import { isTauriRuntime } from '@/data/db';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/app/store';

export interface CsvExportOptions {
  title?: string;
  message?: string;
  showModal?: boolean;
}

export interface CsvExportResult {
  success: boolean;
  path: string;
}

/**
 * Escapes a single CSV cell value according to RFC 4180 rules.
 */
export function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Zero-dependency RFC 4180 compliant CSV generator and downloader.
 * Supports:
 * - Desktop mode (Tauri): saves directly via native file writer with BOM.
 * - Browser fallback: Data URI or Blob download.
 * - Global toast/modal notification on completion.
 */
export async function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  options?: CsvExportOptions
): Promise<CsvExportResult> {
  const lines: string[] = [];
  // UTF-8 BOM (\uFEFF) so Microsoft Excel & spreadsheet applications recognize UTF-8 & BDT symbols
  lines.push('\uFEFF' + headers.map(escapeCsvCell).join(','));

  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }

  const csvContent = lines.join('\r\n');
  const targetFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  let savedPath = '';

  // 1. Desktop Mode (Tauri): direct filesystem save & file revelation
  if (isTauriRuntime()) {
    try {
      savedPath = await invoke<string>('export_csv_file', {
        filename: targetFilename,
        content: csvContent,
      });
    } catch (err) {
      console.warn('Tauri export_csv_file failed, falling back to browser download:', err);
    }
  }

  // 2. Web browser fallback using Data URI
  if (!savedPath) {
    try {
      const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      const a = document.createElement('a');
      a.href = encodedUri;
      a.download = targetFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      savedPath = targetFilename;
    } catch (err) {
      console.error('Browser data URI download failed:', err);
    }
  }

  // 3. Blob fallback
  if (!savedPath) {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      savedPath = targetFilename;
    } catch (err) {
      console.error('Blob download failed:', err);
    }
  }

  const finalPath = savedPath || targetFilename;

  // Trigger global success popup dialog
  if (options?.showModal !== false) {
    useAppStore.getState().showExportSuccess({
      filename: targetFilename,
      filePath: finalPath,
      title: options?.title || 'CSV Export Successful!',
      message: options?.message || 'Your file has been downloaded and saved to your computer.',
      rowCount: rows.length,
    });
  }

  return { success: true, path: finalPath };
}
