/**
 * src/verify/quoteVerifier.ts
 * Exact Quote Verification Engine (M4-C)
 * Governed by PRD REQ-011, §7.1, TS-005; MDD §3.7; IC-001; Part VII TS-005/005b.
 * 
 * Source Authority Hierarchy (AGENTS.md Section 1 & IC-001):
 * - IC-001 overrides PRD REQ-011's case-insensitive option and .trim().
 * - Quoted snippets must be exact verbatim substrings of the source CSV row.
 * - Any non-exact match is strictly NOT verified.
 */

export type VerificationStatus =
  | 'VERIFIED'
  | 'NEAR_MATCH'
  | 'UNVERIFIED'
  | 'SOURCE_NOT_FOUND';

export interface QuoteVerificationResult {
  status: VerificationStatus;
  isVerified: boolean;
  badgeLabel: string;
  sourceFound: boolean;
  rawText?: string;
  diagnosticMatch: boolean;
  normalizedSnippet?: string;
  normalizedRawText?: string;
}

/**
 * Normalization helper for diagnostic secondary check.
 * Lowercase + collapsed whitespace + stripped punctuation.
 * NOTE: Used ONLY for diagnostic near-match detection, NEVER for VERIFIED status.
 */
export function normalizeForDiagnostic(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // strip all punctuation & symbols
    .replace(/\s+/g, ' ')            // collapse consecutive whitespace
    .trim();
}

/**
 * Pure Quote Verification function.
 * 
 * Rules:
 * 1. Returns VERIFIED only if snippet.length > 0 and rawText.includes(snippet)
 *    - Strictly NO .trim(), NO .toLowerCase(), NO whitespace/punctuation/unicode normalization,
 *      NO fuzzy matching, NO case-insensitive option (IC-001 overrides PRD REQ-011).
 * 2. If rawText is undefined or null (e.g. feedback ID not found in dataset):
 *    - status: 'SOURCE_NOT_FOUND', badgeLabel: 'Source row not found', isVerified: false.
 * 3. If snippet is empty or missing:
 *    - status: 'UNVERIFIED', badgeLabel: 'Unverified / Rewritten', isVerified: false.
 * 4. Otherwise, if not exact substring:
 *    - Diagnostic check: if normalized comparison matches (normRaw.includes(normSnippet) and normSnippet.length > 0):
 *      - status: 'NEAR_MATCH', badgeLabel: 'Near Match / Normalized — Not Verbatim Verified'
 *      - isVerified: false (Must NEVER use the word 'Verified' alone or green badge)
 *    - If normalized comparison also fails:
 *      - status: 'UNVERIFIED', badgeLabel: 'Unverified / Rewritten'
 *      - isVerified: false
 */
export function verify(
  snippet: string | undefined | null,
  rawText: string | undefined | null
): QuoteVerificationResult {
  // 1. Guard: missing source row
  if (rawText === undefined || rawText === null) {
    return {
      status: 'SOURCE_NOT_FOUND',
      isVerified: false,
      badgeLabel: 'Source row not found',
      sourceFound: false,
      diagnosticMatch: false,
    };
  }

  // 2. Guard: invalid or empty snippet (empty string must never be verified)
  if (!snippet || typeof snippet !== 'string' || snippet.length === 0) {
    return {
      status: 'UNVERIFIED',
      isVerified: false,
      badgeLabel: 'Unverified / Rewritten',
      sourceFound: true,
      rawText,
      diagnosticMatch: false,
    };
  }

  // 3. Exact verbatim substring check (IC-001: strictly no trim, no case-folding)
  if (rawText.includes(snippet)) {
    return {
      status: 'VERIFIED',
      isVerified: true,
      badgeLabel: 'Verified Quote',
      sourceFound: true,
      rawText,
      diagnosticMatch: true,
    };
  }

  // 4. Secondary diagnostic: normalized check (lowercase + collapsed whitespace + stripped punctuation)
  const normSnippet = normalizeForDiagnostic(snippet);
  const normRaw = normalizeForDiagnostic(rawText);

  if (normSnippet.length > 0 && normRaw.includes(normSnippet)) {
    return {
      status: 'NEAR_MATCH',
      isVerified: false,
      badgeLabel: 'Near Match / Normalized — Not Verbatim Verified',
      sourceFound: true,
      rawText,
      diagnosticMatch: true,
      normalizedSnippet: normSnippet,
      normalizedRawText: normRaw,
    };
  }

  // 5. Unverified / Rewritten
  return {
    status: 'UNVERIFIED',
    isVerified: false,
    badgeLabel: 'Unverified / Rewritten',
    sourceFound: true,
    rawText,
    diagnosticMatch: false,
    normalizedSnippet: normSnippet,
    normalizedRawText: normRaw,
  };
}

/**
 * Helper to verify a quote against a collection of ingested ProcessedFeedbackRows.
 */
export function verifyQuoteAgainstRows(
  feedbackId: string,
  quoteSnippet: string,
  rows?: Array<{ identity: { feedbackId: string }; text: string }>
): QuoteVerificationResult {
  if (!rows || rows.length === 0) {
    return {
      status: 'SOURCE_NOT_FOUND',
      isVerified: false,
      badgeLabel: 'Source row not found',
      sourceFound: false,
      diagnosticMatch: false,
    };
  }

  const row = rows.find((r) => r.identity.feedbackId === feedbackId);
  if (!row) {
    return {
      status: 'SOURCE_NOT_FOUND',
      isVerified: false,
      badgeLabel: 'Source row not found',
      sourceFound: false,
      diagnosticMatch: false,
    };
  }

  return verify(quoteSnippet, row.text);
}
