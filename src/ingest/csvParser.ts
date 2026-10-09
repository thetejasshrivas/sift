/**
 * ingest/csvParser.ts — Ephemeral In-Memory CSV Parsing Engine
 * Governed by PRD REQ-001, REQ-002, §4.1–4.2, TS-001, TS-010, and IC-001.
 */

import Papa, { ParseResult } from 'papaparse';
import {
  IngestError,
  IngestErrorCode,
  IngestionOptions,
  IngestionResult,
  RawFeedbackRow,
  SchemaMapping
} from '../types/ingest';
import { autoDetectSchema } from './schemaMapper';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per REQ-001
export const MAX_ROW_COUNT = 2000;                  // 2,000 rows per REQ-001
export const VALID_DELIMITERS = [',', '\t', ';'] as const;

/**
 * Validates that file name strictly has a .csv extension.
 * Rejects non-CSV extensions (.xlsx, .pdf, .json, etc.) with a typed error.
 */
export function validateFileName(fileName: string): void {
  if (!fileName || typeof fileName !== 'string') {
    throw new IngestError(
      IngestErrorCode.INVALID_FILE_TYPE,
      'Invalid file name provided.'
    );
  }

  const cleanName = fileName.trim().toLowerCase();
  if (!cleanName.endsWith('.csv')) {
    const ext = cleanName.includes('.') ? `.${cleanName.split('.').pop()}` : 'none';
    throw new IngestError(
      IngestErrorCode.INVALID_FILE_TYPE,
      `Unsupported file type "${ext}". Only .csv files are supported.`,
      { fileName, detectedExtension: ext }
    );
  }
}

/**
 * Validates file buffer or size in bytes.
 */
export function validateFileSize(sizeBytes: number, maxSize = MAX_FILE_SIZE_BYTES): void {
  if (sizeBytes > maxSize) {
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const maxMb = (maxSize / (1024 * 1024)).toFixed(0);
    throw new IngestError(
      IngestErrorCode.FILE_TOO_LARGE,
      `File size (${sizeMb} MB) exceeds maximum allowed limit of ${maxMb} MB.`,
      { sizeBytes, maxSizeBytes: maxSize }
    );
  }
}

/**
 * Strips UTF-8 Byte Order Mark (\uFEFF) if present at the start of text.
 */
export function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

/**
 * Auto-detect delimiter from the first few lines of CSV text.
 * Restricts candidates to comma, tab, and semicolon per REQ-001.
 */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 4096);
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0 };

  let inQuotes = false;
  for (let i = 0; i < sample.length; i++) {
    const char = sample[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && (char === ',' || char === '\t' || char === ';')) {
      counts[char]++;
    }
    if (char === '\n' && (counts[','] > 0 || counts['\t'] > 0 || counts[';'] > 0)) {
      // Sampled enough for first row
      break;
    }
  }

  let bestDelimiter = ',';
  let maxCount = -1;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delim;
    }
  }

  return maxCount > 0 ? bestDelimiter : ',';
}

/**
 * Parse raw CSV text content in-memory with full schema mapping and ID isolation.
 * RULE (IC-001): Zero cell mutation. Text is preserved exact and verbatim.
 */
export function parseCsvText(
  csvText: string,
  options: IngestionOptions = {}
): IngestionResult {
  const cleanText = stripBOM(csvText);

  if (!cleanText || cleanText.trim().length === 0) {
    throw new IngestError(
      IngestErrorCode.EMPTY_FILE,
      'The provided CSV file is empty.'
    );
  }

  // 1. Determine delimiter (manual override or auto-detection)
  const delimiter = options.delimiter ?? detectDelimiter(cleanText);

  // 2. Execute PapaParse locally in memory (zero network calls)
  const parsed: ParseResult<Record<string, string>> = Papa.parse(cleanText, {
    delimiter,
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header: string) => header.replace(/^\uFEFF/, '') // Strip BOM from first header only
  });

  if (parsed.errors && parsed.errors.length > 0) {
    // Only throw on fatal errors (e.g. delimiters, unclosed quotes)
    const fatalErrors = parsed.errors.filter(
      e => e.type === 'Delimiter' || e.code === 'UndetectableDelimiter'
    );
    if (fatalErrors.length > 0) {
      throw new IngestError(
        IngestErrorCode.PARSE_ERROR,
        `CSV parsing error: ${fatalErrors[0].message}`,
        fatalErrors
      );
    }
  }

  const rawRows = parsed.data || [];
  const headers = parsed.meta.fields || [];

  if (headers.length === 0 || rawRows.length === 0) {
    throw new IngestError(
      IngestErrorCode.EMPTY_FILE,
      'The CSV file contains no data rows.'
    );
  }

  // 3. Row count limit validation (REQ-001: max 2,000 rows)
  const maxRows = options.maxRows ?? MAX_ROW_COUNT;
  if (rawRows.length > maxRows) {
    throw new IngestError(
      IngestErrorCode.ROW_LIMIT_EXCEEDED,
      `Row count (${rawRows.length}) exceeds maximum limit of ${maxRows} rows.`,
      { rowCount: rawRows.length, maxRows }
    );
  }

  // 4. Smart Schema Mapping with validation
  const mapping: SchemaMapping = autoDetectSchema(headers, options.mapping);

  // 5. Build normalized rows with unique ID assignment and verbatim cell storage
  const rows: RawFeedbackRow[] = [];
  const seenIds = new Map<string, number>(); // ID -> occurrence count
  const warnings: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const rowIndex = i + 1;

    // Get exact verbatim feedback text
    const textCell = rawRow[mapping.text];
    const verbatimText = textCell !== undefined && textCell !== null ? String(textCell) : '';

    // Handle feedback ID: use mapped column if present and non-empty, else generate FB-001...
    let baseId: string;
    if (mapping.feedback_id && rawRow[mapping.feedback_id]) {
      baseId = String(rawRow[mapping.feedback_id]).trim();
    } else {
      baseId = `FB-${String(rowIndex).padStart(3, '0')}`;
    }

    // Handle duplicate IDs per TS-010: append _row2, _row3, etc.
    let uniqueId: string;
    const currentCount = seenIds.get(baseId) || 0;
    if (currentCount === 0) {
      uniqueId = baseId;
      seenIds.set(baseId, 1);
    } else {
      const nextCount = currentCount + 1;
      seenIds.set(baseId, nextCount);
      uniqueId = `${baseId}_row${nextCount}`;
      warnings.push(`Duplicate ID "${baseId}" at row ${rowIndex} renamed to "${uniqueId}".`);
    }

    // Optional metadata fields (stored verbatim or undefined)
    const tier = mapping.tier && rawRow[mapping.tier] !== undefined
      ? String(rawRow[mapping.tier])
      : undefined;

    const account_id = mapping.account_id && rawRow[mapping.account_id] !== undefined
      ? String(rawRow[mapping.account_id])
      : undefined;

    const user_id = mapping.user_id && rawRow[mapping.user_id] !== undefined
      ? String(rawRow[mapping.user_id])
      : undefined;

    rows.push({
      feedback_id: uniqueId,
      text: verbatimText,
      tier,
      account_id,
      user_id,
      rawRow,
      rowIndex
    });
  }

  return {
    rows,
    headers,
    mapping,
    delimiter,
    rowCount: rows.length,
    warnings
  };
}

/**
 * Parse an uploaded File or Blob object in the browser.
 * Validates file extension and size before reading text stream into memory.
 */
export async function parseCsvFile(
  file: File | Blob & { name?: string },
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const fileName = (file as File).name || 'data.csv';
  validateFileName(fileName);

  const fileSize = file.size || 0;
  validateFileSize(fileSize, options.maxFileSize);

  // Read text with encoding awareness
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new IngestError(IngestErrorCode.PARSE_ERROR, 'Failed to read file from browser.'));
    reader.readAsText(file, 'utf-8');
  });

  return parseCsvText(text, options);
}
