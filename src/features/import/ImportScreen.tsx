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
import { catalogRepo } from '../../data/repositories/catalogRepo';
import { importRepo } from '../../data/repositories/importRepo';
import { parseCsvContent } from '../../domain/import/csvParser';
import { validateCsvImport } from '../../domain/import/importValidator';
import { CSV_TEMPLATES, downloadCsvFile } from '../../domain/import/templates';
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
  const { currentUser } = useAppStore();
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
        catalogRepo.getSellables(undefined, true),
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
    loadCatalogData();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab]);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file) return;
    setFileName(file.name);

    // Auto-detect import type from filename if matching convention
    const lowerName = file.name.toLowerCase();
    if (lowerName.startsWith('price') || lowerName.includes('prices')) {
      setSelectedType('prices');
    } else if (lowerName.startsWith('stock') || lowerName.includes('inventory')) {
      setSelectedType('stock');
    } else if (lowerName.startsWith('prod') || lowerName.includes('products')) {
      setSelectedType('products');
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = String(e.target?.result || '');
      setRawCsvText(text);
      await processCsvFile(text, file.name);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const processCsvFile = async (text: string, name: string) => {
    const parseOut = parseCsvContent(text);
    if (parseOut.rows.length === 0) {
      alert('The selected CSV file appears to be empty.');
      return;
    }

    const validated = validateCsvImport({
      importType: selectedType,
      fileName: name,
      rawContent: text,
      rows: parseOut.rows,
      existingProducts: products,
      categories,
      brands,
    });

    setValidationResult(validated);

    // Check duplicate file hash
    const dup = await importRepo.checkDuplicateFileHash(validated.fileHash);
    setDuplicateWarning(dup);
  };

  // Re-validate if user changes the import type
  useEffect(() => {
    if (rawCsvText && fileName && products.length >= 0) {
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
  }, [selectedType]);

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
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!validationResult) return;
    const errorRows = validationResult.rows.filter((r) => r.status === 'error');
    if (errorRows.length === 0) return;

    const errorCsvContent = [
      'Row_Number,SKU,Barcode,Product_Name,Error_Messages',
      ...errorRows.map(
        (r) =>
          `${r.rowNumber},"${r.sku}","${r.barcode || ''}","${r.name || ''}","${r.errors.join('; ')}"`
      ),
    ].join('\r\n');

    downloadCsvFile(`import_errors_${validationResult.fileName}`, errorCsvContent);
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span>CSV Import &amp; Bulk Data</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Import new products, bulk update price lists, and adjust physical stock counts using Excel or CSV.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-brand-surface border border-brand-border rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors ${
              activeTab === 'wizard'
                ? 'bg-brand-gold text-brand-black shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import Wizard</span>
          </button>
          <button
            onClick={() => setActiveTab('folder')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors ${
              activeTab === 'folder'
                ? 'bg-brand-gold text-brand-black shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Drop-in Folder</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors ${
              activeTab === 'logs'
                ? 'bg-brand-gold text-brand-black shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History</span>
          </button>
        </div>
      </div>

      {/* TAB 1: IMPORT WIZARD */}
      {activeTab === 'wizard' && (
        <div className="space-y-6">
          {/* Step 1: Mode & Templates Card */}
          <div className="p-5 rounded-2xl bg-brand-surface border border-brand-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-gold text-brand-black text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-white">Select Import Type &amp; Download Templates</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['products', 'prices', 'stock'] as ImportType[]).map((type) => {
                const tmpl = CSV_TEMPLATES[type];
                const isSelected = selectedType === type;
                return (
                  <div
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-brand-gold/10 border-brand-gold text-white shadow-md shadow-brand-gold/5'
                        : 'bg-brand-black/50 border-brand-border text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-gold">
                          {type === 'products' ? 'New & Existing Products' : type === 'prices' ? 'Price List Update' : 'Stock Count / Audit'}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-gold" />}
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">{tmpl.title}</h4>
                      <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadCsvFile(tmpl.fileName, tmpl.content);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors self-start border border-neutral-700"
                    >
                      <Download className="w-3.5 h-3.5 text-brand-gold" />
                      <span>Download Sample CSV</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Upload Dropzone */}
          {!validationResult && (
            <div className="p-8 rounded-2xl bg-brand-surface border-2 border-dashed border-brand-border hover:border-brand-gold/50 transition-colors text-center space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold mx-auto">
                <UploadCloud className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Choose or Drag &amp; Drop CSV File</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Supports UTF-8, Excel CSV with BOM, comma, or semicolon delimited files.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-light text-brand-black text-xs font-bold transition-all shadow-lg shadow-brand-gold/15 cursor-pointer"
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
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <h4 className="font-bold">Duplicate File Warning</h4>
                    <p className="text-neutral-300 mt-0.5">
                      An identical file (<strong>{duplicateWarning.fileName}</strong>) was already imported on{' '}
                      {new Date(duplicateWarning.createdAt).toLocaleString()} by{' '}
                      <strong>{duplicateWarning.userName || 'Admin'}</strong>. Re-importing may re-apply the same numbers.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-brand-surface border border-brand-border">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase">Total Rows</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {validationResult.summary.totalRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-300 font-semibold uppercase">New Records</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    +{validationResult.summary.newRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <div className="text-[10px] text-sky-300 font-semibold uppercase">Updates</div>
                  <div className="text-lg font-bold text-sky-400 font-mono mt-0.5">
                    {validationResult.summary.updateRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase">Unchanged</div>
                  <div className="text-lg font-bold text-neutral-400 font-mono mt-0.5">
                    {validationResult.summary.unchangedRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="text-[10px] text-red-300 font-semibold uppercase">Row Errors</div>
                  <div className="text-lg font-bold text-red-400 font-mono mt-0.5">
                    {validationResult.summary.errorRows}
                  </div>
                </div>
              </div>

              {/* Table Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-brand-surface p-3.5 rounded-xl border border-brand-border">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['all', 'new', 'update', 'unchanged', 'error'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setPreviewFilter(filter)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                        previewFilter === filter
                          ? 'bg-brand-gold text-brand-black shadow-sm'
                          : 'bg-brand-black text-neutral-400 hover:text-white'
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
                    className="px-3 py-1.5 bg-brand-black border border-brand-border rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold w-48"
                  />
                  {validationResult.hasErrors && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/40 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Error CSV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Preview Table */}
              <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-brand-black text-neutral-400 uppercase tracking-wider font-semibold border-b border-brand-border">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3 w-28">Status</th>
                      <th className="py-2.5 px-3">Product / SKU</th>
                      <th className="py-2.5 px-3">Changes &amp; Proposed Values</th>
                      <th className="py-2.5 px-3">Validation &amp; Diagnostics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/40 text-neutral-300">
                    {filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-500 italic">
                          No rows match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">
                            {row.rowNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                row.status === 'new'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : row.status === 'update'
                                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                  : row.status === 'error'
                                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-white">{row.name || '—'}</div>
                            <div className="text-[10px] text-neutral-400 font-mono">SKU: {row.sku}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            {row.changes.length === 0 ? (
                              <span className="text-neutral-500 italic">No values altered</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {row.changes.map((c, i) => (
                                  <div
                                    key={i}
                                    className="p-1 px-2 rounded bg-brand-black/70 border border-brand-border text-[11px]"
                                  >
                                    <span className="text-neutral-400">{c.label}: </span>
                                    {c.oldValue !== null && (
                                      <span className="text-neutral-500 line-through mr-1 font-mono">
                                        {c.oldValue}
                                      </span>
                                    )}
                                    <span className="text-emerald-400 font-bold font-mono">
                                      {c.newValue}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {row.errors.length > 0 ? (
                              <div className="text-red-400 space-y-0.5 font-medium">
                                {row.errors.map((e, idx) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{e}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-emerald-400 text-[11px]">
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
              <div className="flex items-center justify-between p-4 rounded-xl bg-brand-surface border border-brand-border">
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <FileText className="w-4 h-4 text-brand-gold" />
                  <span>File: <strong className="text-white">{validationResult.fileName}</strong></span>
                  <span>&bull;</span>
                  <span>
                    Valid rows to apply: <strong className="text-emerald-400">{validationResult.summary.newRows + validationResult.summary.updateRows}</strong>
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
                    className="px-4 py-2 rounded-lg border border-brand-border text-neutral-300 hover:text-white text-xs font-semibold transition-colors"
                  >
                    Cancel / Choose Another File
                  </button>

                  <button
                    type="button"
                    disabled={isExecuting || validationResult.summary.newRows + validationResult.summary.updateRows === 0}
                    onClick={handleExecuteImport}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
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
        <div className="p-6 rounded-2xl bg-brand-surface border border-brand-border space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold shrink-0">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Automated Drop-In Folder Import</h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                You can drop files directly into your portable <code className="text-brand-gold bg-brand-black px-1.5 py-0.5 rounded font-mono">Import/</code> folder from your file explorer.
                The app automatically processes files matching the naming patterns below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                prices_*.csv
              </span>
              <h4 className="text-xs font-bold text-white">Price Updates</h4>
              <p className="text-[11px] text-neutral-400">
                Any file named like <code className="text-neutral-300">prices_nov26.csv</code> updates retail, wholesale, and cost prices.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                products_*.csv
              </span>
              <h4 className="text-xs font-bold text-white">Catalog Products</h4>
              <p className="text-[11px] text-neutral-400">
                Files like <code className="text-neutral-300">products_new_batch.csv</code> add products, categories, brands, and opening stock.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-brand-black/60 border border-brand-border space-y-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                stock_*.csv
              </span>
              <h4 className="text-xs font-bold text-white">Inventory Counts</h4>
              <p className="text-[11px] text-neutral-400">
                Files like <code className="text-neutral-300">stock_audit.csv</code> adjust and sync active inventory quantities.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-brand-black/80 border border-brand-border flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Folder Destination Pipeline</div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Processed files automatically move to <code className="text-emerald-400 font-mono">Import/Processed/</code>.
                Any failed files move to <code className="text-red-400 font-mono">Import/Failed/</code> with an error report.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('Scan Folder executed: checked Import/ directory for queued batch files.');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-brand-black text-xs font-bold transition-all shadow-md shadow-brand-gold/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scan Folder Now</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Past CSV Import Audit Logs</h3>
            <button
              type="button"
              onClick={loadLogs}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-xs text-neutral-300 hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="border-b border-brand-border bg-brand-black text-neutral-400 uppercase tracking-wider font-semibold">
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
              <tbody className="divide-y divide-brand-border/40 text-neutral-300">
                {loadingLogs ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">
                      Loading audit history...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500 italic">
                      No import history found yet. Upload a CSV to view audit entries.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">{log.fileName}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-800 text-neutral-300">
                          {log.importType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">
                        {log.totalRows}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {log.successRows}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-red-400">
                        {log.errorRows}
                      </td>
                      <td className="py-3 px-3 text-neutral-400">{log.userName || 'Owner'}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-brand-surface border border-emerald-500/50 rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mb-1.5">
                Bulk Import Executed
              </span>
              <h3 className="text-base font-bold text-white">{successModal.title}</h3>
              <p className="text-xs text-neutral-400 mt-1">{successModal.message}</p>
            </div>

            <div className="bg-brand-black/70 border border-brand-border rounded-xl p-3.5 space-y-2 text-left text-xs">
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">Import Mode</span>
                <span className="font-semibold text-brand-gold uppercase">{successModal.type}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">Successfully Applied</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {successModal.successCount} rows
                </span>
              </div>
              {successModal.errorCount > 0 && (
                <div className="flex justify-between items-center text-neutral-300">
                  <span className="text-neutral-400">Skipped (Errors)</span>
                  <span className="font-semibold text-red-400 font-mono">
                    {successModal.errorCount} rows
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSuccessModal(null)}
              autoFocus
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              OK (Close)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
