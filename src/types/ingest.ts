/**
 * types/ingest.ts — SIFT Ingestion and Schema Mapping Types
 * Governed by PRD REQ-001, REQ-002, §4.1–4.2, TS-001, TS-010, and IC-001.
 */

export type CanonicalField = 'text' | 'tier' | 'feedback_id' | 'user_id' | 'account_id';

export enum IngestErrorCode {
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  ROW_LIMIT_EXCEEDED = 'ROW_LIMIT_EXCEEDED',
  EMPTY_FILE = 'EMPTY_FILE',
  MISSING_MANDATORY_COLUMN = 'MISSING_MANDATORY_COLUMN',
  PARSE_ERROR = 'PARSE_ERROR'
}

export class IngestError extends Error {
  public readonly code: IngestErrorCode;
  public readonly details?: unknown;

  constructor(code: IngestErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'IngestError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, IngestError.prototype);
  }
}

/**
 * Exact alias dictionaries per PRD §4.2
 */
export const FIELD_ALIASES: Record<CanonicalField, readonly string[]> = {
  text: ['feedback', 'text', 'comment', 'description', 'notes', 'review', 'issue_description'],
  tier: ['tier', 'plan', 'arr', 'mrr', 'customer_tier', 'account_type'],
  feedback_id: ['id', 'uuid', 'row_id', 'ticket_id', 'feedback_id'],
  user_id: ['user_id', 'author_id', 'email', 'submitter'],
  account_id: ['account_id', 'company', 'org_id', 'domain', 'customer_name']
};

/**
 * Mapping between canonical fields and raw CSV header names
 */
export interface SchemaMapping {
  text: string; // Mandatory: header name for Raw Feedback Text
  tier?: string | null;
  feedback_id?: string | null;
  user_id?: string | null;
  account_id?: string | null;
}

/**
 * Ingested customer feedback row
 * RULE (IC-001): `text` and all cell values are stored EXACTLY as parsed,
 * preserving verbatim casing, whitespace, newlines, and punctuation.
 */
export interface RawFeedbackRow {
  feedback_id: string; // Guaranteed globally unique (e.g. FB-001 or FB-001_row2)
  text: string;        // Exact verbatim source text
  tier?: string;       // Exact source tier text or undefined (isolated as UNKNOWN downstream)
  account_id?: string;
  user_id?: string;
  rawRow: Record<string, string>; // Preserves entire unmutated row
  rowIndex: number;    // 1-indexed source row number
}

export interface IngestionOptions {
  delimiter?: string;          // Manual delimiter override (comma, tab, semicolon)
  mapping?: Partial<SchemaMapping>; // Manual schema mapping override
  maxFileSize?: number;        // Max file size in bytes (default 10MB)
  maxRows?: number;            // Max rows allowed (default 2,000)
}

export interface IngestionResult {
  rows: RawFeedbackRow[];
  headers: string[];
  mapping: SchemaMapping;
  delimiter: string;
  rowCount: number;
  warnings: string[];
}
