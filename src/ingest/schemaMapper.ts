/**
 * ingest/schemaMapper.ts — Smart Schema Mapping Engine
 * Governed by PRD REQ-002, §4.2, and TS-001.
 */

import {
  CanonicalField,
  FIELD_ALIASES,
  IngestError,
  IngestErrorCode,
  SchemaMapping
} from '../types/ingest';

/**
 * Clean a header string for comparison only.
 * Strips UTF-8 BOM, trims whitespace, and converts to lowercase.
 * NEVER mutates the stored/returned header name.
 */
function normalizeHeaderForMatch(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '_');
}


/**
 * Auto-detect schema mapping from CSV headers and merge with optional manual overrides.
 * PRD REQ-002: Header normalization (lowercase compare only for matching — never mutate stored text).
 */
export function autoDetectSchema(
  headers: string[],
  manualOverrides?: Partial<SchemaMapping>
): SchemaMapping {
  if (!headers || headers.length === 0) {
    throw new IngestError(
      IngestErrorCode.EMPTY_FILE,
      'Cannot map schema from empty header list.'
    );
  }

  const claimedHeaders = new Set<string>();
  const mapping: Partial<SchemaMapping> = {};

  // 1. Apply explicit manual overrides first (if valid)
  if (manualOverrides) {
    for (const [key, rawHeader] of Object.entries(manualOverrides)) {
      const field = key as CanonicalField;
      if (rawHeader && headers.includes(rawHeader)) {
        mapping[field] = rawHeader;
        claimedHeaders.add(rawHeader);
      }
    }
  }

  const normalizedHeaders = headers.map(h => ({
    original: h,
    normalized: normalizeHeaderForMatch(h)
  }));

  // Canonical field detection order
  const fields: CanonicalField[] = ['text', 'user_id', 'account_id', 'feedback_id', 'tier'];

  // 2. Pass 1: Exact alias match for ALL fields first
  for (const field of fields) {
    if (mapping[field]) continue;
    const aliases = FIELD_ALIASES[field];
    for (const alias of aliases) {
      const normAlias = normalizeHeaderForMatch(alias);
      const match = normalizedHeaders.find(
        h => !claimedHeaders.has(h.original) && h.normalized === normAlias
      );
      if (match) {
        mapping[field] = match.original;
        claimedHeaders.add(match.original);
        break;
      }
    }
  }

  // 3. Pass 2: Partial/Token match for remaining unmapped fields
  for (const field of fields) {
    if (mapping[field]) continue;
    const aliases = FIELD_ALIASES[field];
    for (const alias of aliases) {
      const normAlias = normalizeHeaderForMatch(alias);
      // Skip very short aliases like 'id' from token-matching to prevent false positives on other fields
      if (normAlias.length <= 2) continue;

      const match = normalizedHeaders.find(h => {
        if (claimedHeaders.has(h.original)) return false;
        return (
          h.normalized.startsWith(`${normAlias}_`) ||
          h.normalized.endsWith(`_${normAlias}`) ||
          h.normalized.includes(`_${normAlias}_`) ||
          h.normalized.includes(normAlias)
        );
      });

      if (match) {
        mapping[field] = match.original;
        claimedHeaders.add(match.original);
        break;
      }
    }
  }

  // 4. Validation: Raw Feedback Text is strictly mandatory (REQ-002)
  if (!mapping.text) {
    throw new IngestError(
      IngestErrorCode.MISSING_MANDATORY_COLUMN,
      'Raw Feedback Text is mandatory but no matching column was found. Please map a feedback text column manually.',
      { availableHeaders: headers }
    );
  }

  return mapping as SchemaMapping;
}
