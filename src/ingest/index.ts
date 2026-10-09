/**
 * ingest/index.ts — Public Ingestion Module API
 * Governed by PRD REQ-001, REQ-002, §4.1–4.2, TS-001, TS-010, and IC-001.
 */

export * from '../types/ingest';
export { autoDetectSchema } from './schemaMapper';
export {
  parseCsvText,
  parseCsvFile,
  validateFileName,
  validateFileSize,
  detectDelimiter,
  stripBOM,
  MAX_FILE_SIZE_BYTES,
  MAX_ROW_COUNT
} from './csvParser';
