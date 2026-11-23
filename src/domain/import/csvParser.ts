/**
 * Zero-dependency RFC 4180 compliant CSV Parser
 * Handles:
 * - Commas & delimiters inside quoted fields
 * - Escaped double quotes ("")
 * - Multiline fields with newlines inside quotes
 * - UTF-8 Byte Order Mark (\uFEFF)
 * - CRLF and LF line endings
 */

/**
 * Normalizes CSV column header:
 * - strips BOM (\uFEFF)
 * - trims whitespace
 * - converts to lowercase
 * - replaces spaces & hyphens with underscores
 * - removes any non-alphanumeric character (except underscore)
 */
export function normalizeHeader(header: string): string {
  if (!header) return '';
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\/-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

/**
 * Strips currency symbols (৳, $, BDT), commas, percent signs, and spaces.
 * Returns parsed number, or null if empty / NaN.
 */
export function parseNumberField(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;

  // Remove currency symbols, currency codes, commas, percentage, and whitespace
  const cleaned = str
    .replace(/[৳$€£]/g, '')
    .replace(/\b(bdt|tk|taka|usd)\b/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/%/g, '');

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Computes a fast deterministic hex hash of the file text
 * to detect repeat/duplicate file imports.
 */
export function computeStringHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return hash.toString(16).padStart(12, '0');
}

/**
 * Auto-detects delimiter (comma vs semicolon) from the first unquoted header line.
 */
function detectCsvDelimiter(text: string): ',' | ';' {
  let commaCount = 0;
  let semicolonCount = 0;
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          i++;
        } else {
          insideQuotes = false;
        }
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === '\r' || char === '\n') {
        break;
      } else if (char === ',') {
        commaCount++;
      } else if (char === ';') {
        semicolonCount++;
      }
    }
  }

  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * RFC 4180 lexer: parses raw text into a 2D array of string cells.
 */
export function parseCsvRows(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(cleanText);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote ("")
          currentCell += '"';
          i++; // skip next quote
        } else {
          // Closing quote
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // skip \n of CRLF
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Push remaining cell and row if any
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export interface ParseCsvOutput {
  headers: string[];
  rawHeaders: string[];
  rows: Record<string, string>[];
}

/**
 * Parses raw CSV string into normalized records using the first line as headers.
 */
export function parseCsvContent(csvString: string): ParseCsvOutput {
  const grid = parseCsvRows(csvString);
  if (grid.length === 0) {
    return { headers: [], rawHeaders: [], rows: [] };
  }

  const rawHeaders = grid[0];
  const headers = rawHeaders.map((h) => normalizeHeader(h));
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < grid.length; r++) {
    const rowValues = grid[r];
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const colName = headers[c];
      if (colName) {
        rowObj[colName] = rowValues[c] ?? '';
      }
    }
    rows.push(rowObj);
  }

  return {
    headers,
    rawHeaders,
    rows,
  };
}
