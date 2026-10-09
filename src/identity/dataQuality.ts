/**
 * identity/dataQuality.ts — SIFT Data Quality Metrics and Warning Banner Engine
 * Governed by PRD REQ-004, §4.6, TS-002, TS-017, TS-024; IC-012.
 */

import {
  DataQualityMetrics,
  ProcessedFeedbackRow,
  QualityAlertBanner
} from '../types/identity';

export interface DataQualityOptions {
  isTierColumnMapped?: boolean;
  isAccountColumnMapped?: boolean;
}

/**
 * Formats a percentage value for user display:
 * Whole numbers format as integers (e.g. "12%", "100%"),
 * fractional numbers format to one decimal place (e.g. "5.5%").
 */
export function formatPercentage(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/**
 * Calculates the three data quality metrics per PRD §4.6 and IC-012:
 * 1. Unknown Tier %
 * 2. Missing Account ID %
 * 3. Rows with >= 1 issue % (distinct-row union deduplication)
 *
 * RULES:
 * - If a column is not mapped, its missing metric is 100%.
 * - Distinct-row union: a single row lacking both tier and account ID counts as 1 row with issues.
 */
export function calculateDataQualityMetrics(
  rows: ProcessedFeedbackRow[],
  options: DataQualityOptions = {}
): DataQualityMetrics {
  const isTierColumnMapped = options.isTierColumnMapped ?? true;
  const isAccountColumnMapped = options.isAccountColumnMapped ?? true;
  const totalRows = rows.length;

  if (totalRows === 0) {
    return {
      totalRows: 0,
      unknownTierCount: 0,
      unknownTierPercentage: 0,
      isTierColumnMapped,
      missingAccountIdCount: 0,
      missingAccountIdPercentage: 0,
      isAccountColumnMapped,
      rowsWithIssuesCount: 0,
      rowsWithIssuesPercentage: 0
    };
  }

  let unknownTierCount = 0;
  let missingAccountIdCount = 0;
  let rowsWithIssuesCount = 0;

  for (const row of rows) {
    const isUnknownTier = !isTierColumnMapped || row.tierResolution.canonicalTier === 'UNKNOWN';

    const accountId = row.identity.accountId;
    const isMissingAccount = !isAccountColumnMapped || accountId === null || accountId === undefined || accountId.trim() === '';

    if (isUnknownTier) {
      unknownTierCount++;
    }

    if (isMissingAccount) {
      missingAccountIdCount++;
    }

    // Distinct-row union: flagged if either or both metadata fields are missing/unknown
    if (isUnknownTier || isMissingAccount) {
      rowsWithIssuesCount++;
    }
  }

  const unknownTierPercentage = isTierColumnMapped
    ? (unknownTierCount / totalRows) * 100
    : 100;

  const missingAccountIdPercentage = isAccountColumnMapped
    ? (missingAccountIdCount / totalRows) * 100
    : 100;

  const rowsWithIssuesPercentage = (rowsWithIssuesCount / totalRows) * 100;

  return {
    totalRows,
    unknownTierCount: isTierColumnMapped ? unknownTierCount : totalRows,
    unknownTierPercentage,
    isTierColumnMapped,
    missingAccountIdCount: isAccountColumnMapped ? missingAccountIdCount : totalRows,
    missingAccountIdPercentage,
    isAccountColumnMapped,
    rowsWithIssuesCount,
    rowsWithIssuesPercentage
  };
}

/**
 * Generates the QualityAlertBanner state from data quality metrics.
 *
 * TRIGGER RULE:
 * Banner triggers when Rows with >= 1 issue % > 5.0%.
 * Banner text uses that exact union percentage per PRD §4.6 and REQ-004.
 */
export function createQualityAlertBanner(metrics: DataQualityMetrics): QualityAlertBanner {
  const triggered = metrics.rowsWithIssuesPercentage > 5.0;
  const formattedPct = formatPercentage(metrics.rowsWithIssuesPercentage);

  const message = `Data Quality Warning: ${formattedPct} of records lack customer tier or account metadata and are evaluated provisionally (1.0x weight). Priority scores may reflect submission volume rather than verified account revenue.`;
  const collapsedText = `Data Quality Alert (${formattedPct} metadata missing)`;

  return {
    triggered,
    issuePercentage: metrics.rowsWithIssuesPercentage,
    message,
    collapsedText
  };
}
