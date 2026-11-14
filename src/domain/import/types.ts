export type ImportType = 'prices' | 'products' | 'stock';

export type RowValidationStatus = 'new' | 'update' | 'unchanged' | 'error';

export interface FieldChange {
  field: string;
  label: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

export interface CsvPreviewRow {
  rowNumber: number;
  sku: string;
  barcode?: string | null;
  name?: string;
  status: RowValidationStatus;
  errors: string[];
  warnings: string[];
  changes: FieldChange[];
  payload: Record<string, unknown>;
}

export interface ValidationSummary {
  totalRows: number;
  newRows: number;
  updateRows: number;
  unchangedRows: number;
  errorRows: number;
}

export interface ValidationResult {
  importType: ImportType;
  fileName: string;
  fileHash: string;
  summary: ValidationSummary;
  rows: CsvPreviewRow[];
  hasErrors: boolean;
}

export interface ImportLogEntry {
  id: string;
  fileName: string;
  fileHash: string | null;
  importType: ImportType;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorDetails: string | null;
  createdAt: string;
  userId?: string | null;
  userName?: string | null;
}
