/**
 * identity/accountCounter.ts — SIFT Dual-Reporting Account Counting Engine
 * Governed by PRD §4.5, TS-017; MDD §3.3; IC-012.
 */

import { AccountCountMetrics, ProcessedFeedbackRow } from '../types/identity';

export interface AccountCounterOptions {
  isAccountColumnMapped?: boolean;
}

/**
 * Computes dual-reporting account metrics:
 * 1. Confirmed Unique Accounts: Count of distinct verified, non-empty, trimmed Account IDs.
 * 2. Estimated Account Coverage: Confirmed unique accounts + 1 provisional account per missing row (U = N for those).
 *
 * RULE (IC-012): Distinct-row deduplication — a single Account ID appearing across N rows counts as 1 confirmed account.
 * RULE (TS-017): When Account ID is missing or unmapped, show Confirmed: 0, Estimated: N, and render warning pill.
 */
export function computeAccountCounts(
  rows: Array<ProcessedFeedbackRow | { accountId?: string | null; identity?: { accountId?: string | null } }>,
  options: AccountCounterOptions = {}
): AccountCountMetrics {
  const isAccountColumnMapped = options.isAccountColumnMapped ?? true;

  if (!isAccountColumnMapped || rows.length === 0) {
    const total = rows.length;
    return {
      confirmedUniqueAccounts: 0,
      missingAccountIdRows: total,
      estimatedAccountCoverage: total, // U = N provisional
      distinctAccountIds: [],
      isAccountUnmappedWarning: true,
      warningPillText: 'Account IDs Unmapped — Frequency Estimated'
    };
  }

  const distinctSet = new Set<string>();
  let missingRows = 0;

  for (const row of rows) {
    let accountId: string | null | undefined = null;

    if ('identity' in row && row.identity) {
      accountId = row.identity.accountId;
    } else if ('accountId' in row) {
      accountId = row.accountId;
    }

    if (accountId !== undefined && accountId !== null) {
      const trimmed = accountId.trim();
      if (trimmed.length > 0) {
        distinctSet.add(trimmed);
        continue;
      }
    }

    // Row lacks a verified Account ID
    missingRows++;
  }

  const confirmedCount = distinctSet.size;
  const estimatedCoverage = confirmedCount + missingRows;
  const hasMissing = missingRows > 0;

  return {
    confirmedUniqueAccounts: confirmedCount,
    missingAccountIdRows: missingRows,
    estimatedAccountCoverage: estimatedCoverage,
    distinctAccountIds: Array.from(distinctSet).sort(),
    isAccountUnmappedWarning: hasMissing,
    warningPillText: hasMissing ? 'Account IDs Unmapped — Frequency Estimated' : undefined
  };
}
