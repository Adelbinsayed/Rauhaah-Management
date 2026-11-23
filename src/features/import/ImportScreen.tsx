import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FolderSync,
  History,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { canViewCost, hasPermission } from '../../domain/auth/permissions';
import { catalogRepo } from '../../data/repositories/catalogRepo';
import { importRepo } from '../../data/repositories/importRepo';
import { parseCsvContent } from '../../domain/import/csvParser';
import { validateCsvImport } from '../../domain/import/importValidator';
import { CSV_TEMPLATES, downloadCsvFile } from '../../domain/import/templates';
import { downloadCsv } from '../../lib/csvExport';
import type {
  ImportLogEntry,
  ImportType,
  ValidationResult,
} from '../../domain/import/types';
import type { Brand, Category, Sellable } from '../../domain/catalog/types';

interface ImportScreenProps {
  deviceId?: string;
}

export const ImportScreen: React.FC<ImportScreenProps> = ({ deviceId = 'local-device' }) => {
  const { currentUser, permissions, showToast } = useAppStore();
  const canRunImport = hasPermission(permissions, 'import.run');
  const [activeTab, setActiveTab] = useState<'wizard' | 'folder' | 'logs'>('wizard');

  // Catalogs for validation
  const [products, setProducts] = useState<Sellable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Wizard state
  const [selectedType, setSelectedType] = useState<ImportType>('products');
  const [fileName, setFileName] = useState('');
  const [rawCsvText, setRawCsvText] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<ImportLogEntry | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'update' | 'unchanged' | 'error'>('all');
  const [previewSearch, setPreviewSearch] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Audit Logs state
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Flashing Success Modal
  const [successModal, setSuccessModal] = useState<{
    title: string;
    message: string;
    successCount: number;
    errorCount: number;
    type: ImportType;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCatalogData = async () => {
    try {
      const [p, c, b] = await Promise.all([
        catalogRepo.getSellables(undefined, canViewCost(permissions)),
        catalogRepo.getCategories(),
        catalogRepo.getBrands(),
      ]);
      setProducts(p);
      setCategories(c);
      setBrands(b);
    } catch (err) {
      console.error('Failed to load catalog for import validation:', err);
    }
  };

  const loadLogs = async () => {
    try {
      setLoadingLogs(true);
      const logEntries = await importRepo.getImportLogs();
      setLogs(logEntries);
    } catch (err) {
      console.error('Failed to load import logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!canRunImport) return;
    loadCatalogData();
  }, [canRunImport]);

  useEffect(() => {
    if (!canRunImport) return;
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, canRunImport]);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setFileError(null);

    // Auto-detect import type from filename if matching convention
    let detectedType: ImportType = selectedType;
    const lowerName = file.name.toLowerCase();
    if (lowerName.startsWith('price') || lowerName.includes('prices')) {
      detectedType = 'prices';
    } else if (lowerName.startsWith('stock') || lowerName.includes('inventory')) {
      detectedType = 'stock';
    } else if (lowerName.startsWith('prod') || lowerName.includes('products')) {
      detectedType = 'products';
    }
    setSelectedType(detectedType);

    const reader = new FileReader();
    reader.onerror = () => {
      const msg = 'Failed to read the selected CSV file.';
      setFileError(msg);
      showToast({ type: 'error', title: 'File Read Error', message: msg });
    };
    reader.onload = async (e) => {
      const text = String(e.target?.result || '');
      setRawCsvText(text);
      await processCsvFile(text, file.name, detectedType);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const processCsvFile = async (text: string, name: string, importType: ImportType = selectedType) => {
    const parseOut = parseCsvContent(text);
    if (parseOut.rows.length === 0) {
      const msg = 'The selected CSV file appears to be empty.';
      setFileError(msg);
      showToast({ type: 'error', title: 'Empty CSV File', message: msg });
      return;
    }

    const validated = validateCsvImport({
      importType,
      fileName: name,
      rawContent: text,
      rows: parseOut.rows,
      existingProducts: products,
      categories,
      brands,
    });

    setValidationResult(validated);

    // Check duplicate file hash
    try {
      const dup = await importRepo.checkDuplicateFileHash(validated.fileHash);
      setDuplicateWarning(dup);
    } catch (err) {
      console.warn('Failed to check duplicate file hash:', err);
      setDuplicateWarning(null);
    }
  };

  // Re-validate if user changes the import type or catalog loads
  useEffect(() => {
    if (rawCsvText && fileName) {
      const parseOut = parseCsvContent(rawCsvText);
      const validated = validateCsvImport({
        importType: selectedType,
        fileName,
        rawContent: rawCsvText,
        rows: parseOut.rows,
        existingProducts: products,
        categories,
        brands,
      });
      setValidationResult(validated);
    }
  }, [selectedType, products, categories, brands]);

  const handleExecuteImport = async () => {
    if (!validationResult || !currentUser) return;
    try {
      setIsExecuting(true);
      const res = await importRepo.executeImport(validationResult, currentUser.id, deviceId);
      await loadCatalogData();

      setSuccessModal({
        title: 'CSV Import Completed Successfully!',
        message: `${res.successCount} record(s) processed and updated in the system.`,
        successCount: res.successCount,
        errorCount: res.errorCount,
        type: validationResult.importType,
      });

      // Reset wizard
      setValidationResult(null);
      setRawCsvText('');
      setFileName('');
      setDuplicateWarning(null);
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Import Failed',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDownloadErrorReport = async () => {
    if (!validationResult) return;
    const errorRows = validationResult.rows.filter((r) => r.status === 'error');
    if (errorRows.length === 0) return;

    await downloadCsv(
      `import_errors_${validationResult.fileName}`,
      ['Row_Number', 'SKU', 'Barcode', 'Product_Name', 'Error_Messages'],
      errorRows.map((r) => [
        r.rowNumber,
        r.sku,
        r.barcode || '',
        r.name || '',
        r.errors.join('; '),
      ]),
      {
        title: 'Error Report Exported',
        message: 'CSV validation error report has been saved.',
      }
    );
  };

  // Filtered rows for the preview table
  const filteredPreviewRows = useMemo(() => {
    if (!validationResult) return [];
    return validationResult.rows.filter((row) => {
      const matchesFilter = previewFilter === 'all' || row.status === previewFilter;
      const term = previewSearch.trim().toLowerCase();
      const matchesSearch =
        !term ||
        row.sku.toLowerCase().includes(term) ||
        (row.name && row.name.toLowerCase().includes(term)) ||
        (row.barcode && row.barcode.toLowerCase().includes(term));
      return matchesFilter && matchesSearch;
    });
  }, [validationResult, previewFilter, previewSearch]);

  if (!canRunImport) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="p-6 rounded-xl bg-surface border border-hairline text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-warning mx-auto" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-ink">Access Denied</h2>
          <p className="text-xs text-ink-secondary">
            You do not have permission to run CSV imports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent-ink">
              <FileSpreadsheet className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <span>CSV Import &amp; Bulk Data</span>
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            Import new products, bulk update price lists, and adjust physical stock counts using Excel or CSV.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-surface border border-hairline rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'wizard'
                ? 'bg-accent text-accent-fg font-semibold'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Import Wizard</span>
          </button>
          <button
            onClick={() => setActiveTab('folder')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'folder'
                ? 'bg-accent text-accent-fg font-semibold'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Drop-in Folder</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'logs'
                ? 'bg-accent text-accent-fg font-semibold'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <History className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Audit History</span>
          </button>
        </div>
      </div>

      {/* TAB 1: IMPORT WIZARD */}
      {activeTab === 'wizard' && (
        <div className="space-y-6">
          {/* Step 1: Mode & Templates Card */}
          <div className="p-5 rounded-xl bg-surface border border-hairline space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-accent text-accent-fg text-xs font-semibold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-semibold text-ink">Select Import Type &amp; Download Templates</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['products', 'prices', 'stock'] as ImportType[]).map((type) => {
                const tmpl = CSV_TEMPLATES[type];
                const isSelected = selectedType === type;
                if (!canRunImport) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="p-6 rounded-xl bg-surface border border-hairline text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-warning mx-auto" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-ink">Access Denied</h2>
          <p className="text-xs text-ink-secondary">
            You do not have permission to run CSV imports.
          </p>
        </div>
      </div>
    );
  }

  return (
                  <div
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-accent/10 border-accent/50 text-ink'
                        : 'bg-canvas border-hairline text-ink-secondary hover:border-hairline-strong'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-accent-ink">
                          {type === 'products' ? 'New & Existing Products' : type === 'prices' ? 'Price List Update' : 'Stock Count / Audit'}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />}
                      </div>
                      <h4 className="text-sm font-semibold text-ink mt-1">{tmpl.title}</h4>
                      <p className="text-[11px] text-ink-secondary mt-1 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadCsvFile(tmpl.fileName, tmpl.content);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-subtle hover:bg-raised text-ink text-xs font-medium transition-colors self-start border border-hairline"
                    >
                      <Download className="w-3.5 h-3.5 text-accent-ink" strokeWidth={1.5} />
                      <span>Download Sample CSV</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Upload Dropzone */}
          {!validationResult && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileSelect(f);
              }}
              className={`p-8 rounded-xl bg-surface border-2 border-dashed transition-colors text-center space-y-4 ${
                isDragging ? 'border-accent bg-accent/5' : 'border-hairline hover:border-accent/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  e.target.value = '';
                }}
                className="hidden"
              />

              {fileError && (
                <div className="max-w-md mx-auto flex items-center gap-2 p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs text-left">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              <div className="w-14 h-14 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent-ink mx-auto">
                <UploadCloud className="w-7 h-7" strokeWidth={1.5} />
              </div>

              <div>
                <h3 className="text-base font-semibold text-ink">Choose or Drag &amp; Drop CSV File</h3>
                <p className="text-xs text-ink-secondary mt-1">
                  Supports UTF-8, Excel CSV with BOM, comma, or semicolon delimited files.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Browse Computer File (.csv)
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Verification & Preview Section */}
          {validationResult && (
            <div className="space-y-4">
              {/* Duplicate File Warning Banner */}
              {duplicateWarning && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/25 text-ink text-xs">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-warning" strokeWidth={1.5} />
                  <div>
                    <h4 className="font-semibold text-warning">Duplicate File Warning</h4>
                    <p className="text-ink-secondary mt-0.5">
                      An identical file (<strong>{duplicateWarning.fileName}</strong>) was already imported on{' '}
                      {new Date(duplicateWarning.createdAt).toLocaleString()} by{' '}
                      <strong>{duplicateWarning.userName || 'Admin'}</strong>. Re-importing may re-apply the same numbers.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-surface border border-hairline">
                  <div className="text-[11px] text-ink-secondary font-medium">Total Rows</div>
                  <div className="text-lg font-bold text-ink font-mono tabular-nums mt-0.5">
                    {validationResult.summary.totalRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-positive/10 border border-positive/25">
                  <div className="text-[11px] text-positive font-medium">New Records</div>
                  <div className="text-lg font-bold text-positive font-mono tabular-nums mt-0.5">
                    +{validationResult.summary.newRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/25">
                  <div className="text-[11px] text-accent-ink font-medium">Updates</div>
                  <div className="text-lg font-bold text-accent-ink font-mono tabular-nums mt-0.5">
                    {validationResult.summary.updateRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-hairline">
                  <div className="text-[11px] text-ink-secondary font-medium">Unchanged</div>
                  <div className="text-lg font-bold text-ink-muted font-mono tabular-nums mt-0.5">
                    {validationResult.summary.unchangedRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-negative/10 border border-negative/25">
                  <div className="text-[11px] text-negative font-medium">Row Errors</div>
                  <div className="text-lg font-bold text-negative font-mono tabular-nums mt-0.5">
                    {validationResult.summary.errorRows}
                  </div>
                </div>
              </div>

              {/* Table Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-hairline">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['all', 'new', 'update', 'unchanged', 'error'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setPreviewFilter(filter)}
                      className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        previewFilter === filter
                          ? 'bg-accent text-accent-fg font-semibold'
                          : 'bg-canvas text-ink-secondary hover:text-ink border border-hairline'
                      }`}
                    >
                      {filter} (
                      {filter === 'all'
                        ? validationResult.summary.totalRows
                        : filter === 'new'
                        ? validationResult.summary.newRows
                        : filter === 'update'
                        ? validationResult.summary.updateRows
                        : filter === 'unchanged'
                        ? validationResult.summary.unchangedRows
                        : validationResult.summary.errorRows}
                      )
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Filter preview rows..."
                    className="px-3 py-1.5 bg-canvas border border-hairline rounded-lg text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent w-48"
                  />
                  {validationResult.hasErrors && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-negative/15 hover:bg-negative/25 text-negative text-xs font-medium border border-negative/30 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Error CSV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Preview Table */}
              <div className="overflow-x-auto rounded-xl border border-hairline bg-surface max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-subtle text-ink-secondary font-medium border-b border-hairline">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3 w-28">Status</th>
                      <th className="py-2.5 px-3">Product / SKU</th>
                      <th className="py-2.5 px-3">Changes &amp; Proposed Values</th>
                      <th className="py-2.5 px-3">Validation &amp; Diagnostics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline text-ink-secondary">
                    {filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-ink-muted">
                          No rows match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-subtle/60 transition-colors">
                          <td className="py-2.5 px-3 text-center text-ink-muted font-mono tabular-nums">
                            {row.rowNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                                row.status === 'new'
                                  ? 'bg-positive/15 text-positive border border-positive/25'
                                  : row.status === 'update'
                                  ? 'bg-accent/15 text-accent-ink border border-accent/25'
                                  : row.status === 'error'
                                  ? 'bg-negative/15 text-negative border border-negative/25'
                                  : 'bg-subtle text-ink-secondary border border-hairline'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-ink">{row.name || '—'}</div>
                            <div className="text-[11px] text-ink-muted font-mono">SKU: {row.sku}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            {row.changes.length === 0 ? (
                              <span className="text-ink-muted">No values altered</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {row.changes.map((c, i) => (
                                  <div
                                    key={i}
                                    className="p-1 px-2 rounded bg-canvas border border-hairline text-[11px]"
                                  >
                                    <span className="text-ink-secondary">{c.label}: </span>
                                    {c.oldValue !== null && (
                                      <span className="text-ink-muted line-through mr-1 font-mono tabular-nums">
                                        {c.oldValue}
                                      </span>
                                    )}
                                    <span className="text-positive font-semibold font-mono tabular-nums">
                                      {c.newValue}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {row.errors.length > 0 ? (
                              <div className="text-negative space-y-0.5 font-medium">
                                {row.errors.map((e, idx) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{e}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-positive text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Passed Validation</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-hairline">
                <div className="flex items-center gap-2 text-xs text-ink-secondary">
                  <FileText className="w-4 h-4 text-accent-ink" strokeWidth={1.5} />
                  <span>File: <strong className="text-ink">{validationResult.fileName}</strong></span>
                  <span>&bull;</span>
                  <span>
                    Valid rows to apply: <strong className="text-positive">{validationResult.summary.newRows + validationResult.summary.updateRows}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setValidationResult(null);
                      setRawCsvText('');
                      setFileName('');
                      setDuplicateWarning(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-hairline text-ink-secondary hover:text-ink hover:bg-subtle text-xs font-medium transition-colors"
                  >
                    Cancel / Choose Another File
                  </button>

                  <button
                    type="button"
                    disabled={isExecuting || validationResult.summary.newRows + validationResult.summary.updateRows === 0}
                    onClick={handleExecuteImport}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <span>{isExecuting ? 'Applying to Database...' : 'Confirm & Apply Import'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DROP-IN FOLDER */}
      {activeTab === 'folder' && (
        <div className="p-6 rounded-xl bg-surface border border-hairline space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent-ink shrink-0">
              <FolderSync className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">Automated Drop-In Folder Import</h3>
              <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                You can drop files directly into your portable <code className="text-accent-ink bg-canvas border border-hairline px-1.5 py-0.5 rounded font-mono">Import/</code> folder from your file explorer.
                The app automatically processes files matching the naming patterns below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-canvas border border-hairline space-y-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-positive/15 text-positive border border-positive/25 inline-block">
                prices_*.csv
              </span>
              <h4 className="text-xs font-semibold text-ink">Price Updates</h4>
              <p className="text-[11px] text-ink-secondary">
                Any file named like <code className="text-ink font-mono">prices_nov26.csv</code> updates retail, wholesale, and cost prices.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-hairline space-y-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent/15 text-accent-ink border border-accent/25 inline-block">
                products_*.csv
              </span>
              <h4 className="text-xs font-semibold text-ink">Catalog Products</h4>
              <p className="text-[11px] text-ink-secondary">
                Files like <code className="text-ink font-mono">products_new_batch.csv</code> add products, categories, brands, and opening stock.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-hairline space-y-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/25 inline-block">
                stock_*.csv
              </span>
              <h4 className="text-xs font-semibold text-ink">Inventory Counts</h4>
              <p className="text-[11px] text-ink-secondary">
                Files like <code className="text-ink font-mono">stock_audit.csv</code> adjust and sync active inventory quantities.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-canvas border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">Folder Destination Pipeline</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/15 text-warning border border-warning/25">
                  Coming Soon
                </span>
              </div>
              <div className="text-[11px] text-ink-secondary mt-0.5">
                Automatic folder watching is planned for a future release. For now, please use the{' '}
                <strong className="text-ink">Import Wizard</strong> tab to upload CSV files directly.
              </div>
            </div>

            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-subtle text-ink-muted border border-hairline text-xs font-semibold cursor-not-allowed opacity-60 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coming Soon</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Past CSV Import Audit Logs</h3>
            <button
              type="button"
              onClick={loadLogs}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-hairline bg-surface text-xs text-ink-secondary hover:text-ink transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="border-b border-hairline bg-subtle text-ink-secondary font-medium">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-3">File Name</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-right">Total Rows</th>
                  <th className="py-3 px-3 text-right">Successful</th>
                  <th className="py-3 px-3 text-right">Errors</th>
                  <th className="py-3 px-3">Imported By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink-secondary">
                {loadingLogs ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-ink-muted">
                      Loading audit history...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-ink-muted">
                      No import history found yet. Upload a CSV to view audit entries.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-subtle/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-ink-secondary">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-medium text-ink">{log.fileName}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium capitalize bg-subtle border border-hairline text-ink-secondary">
                          {log.importType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-ink">
                        {log.totalRows}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-positive">
                        {log.successRows}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-negative">
                        {log.errorRows}
                      </td>
                      <td className="py-3 px-3 text-ink-secondary">{log.userName || 'Owner'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Flashing Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-surface border border-positive/40 rounded-2xl shadow-lg p-6 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-positive/15 border border-positive/30 flex items-center justify-center text-positive">
              <CheckCircle2 className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-positive/15 text-positive border border-positive/25 mb-1.5">
                Bulk Import Executed
              </span>
              <h3 className="text-base font-semibold text-ink">{successModal.title.replace(/!$/, '')}</h3>
              <p className="text-xs text-ink-secondary mt-1">{successModal.message}</p>
            </div>

            <div className="bg-canvas border border-hairline rounded-xl p-3.5 space-y-2 text-left text-xs">
              <div className="flex justify-between items-center text-ink-secondary">
                <span>Import Mode</span>
                <span className="font-semibold text-accent-ink uppercase">{successModal.type}</span>
              </div>
              <div className="flex justify-between items-center text-ink-secondary">
                <span>Successfully Applied</span>
                <span className="font-semibold text-positive font-mono tabular-nums">
                  {successModal.successCount} rows
                </span>
              </div>
              {successModal.errorCount > 0 && (
                <div className="flex justify-between items-center text-ink-secondary">
                  <span>Skipped (Errors)</span>
                  <span className="font-semibold text-negative font-mono tabular-nums">
                    {successModal.errorCount} rows
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSuccessModal(null)}
              autoFocus
              className="w-full py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors cursor-pointer"
            >
              OK (Close)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
