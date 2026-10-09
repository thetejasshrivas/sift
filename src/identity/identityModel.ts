/**
 * identity/identityModel.ts — SIFT Four-Tier Identity Model
 * Governed by PRD §4.3, REQ-003; MDD §3.2; IC-001.
 */

import { RawFeedbackRow } from '../types/ingest';
import {
  FeedbackIdentity,
  ProcessedFeedbackRow
} from '../types/identity';
import { resolveCustomerTier } from './tierMapper';

/**
 * Creates an isolated FeedbackIdentity ensuring all four identifiers remain distinct.
 */
export function createFeedbackIdentity(
  feedbackId: string,
  options?: {
    userId?: string | null;
    accountId?: string | null;
    clusterId?: string | null;
  }
): FeedbackIdentity {
  const cleanId = (val?: string | null): string | null => {
    if (val === undefined || val === null) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    feedbackId: feedbackId.trim(),
    userId: cleanId(options?.userId),
    accountId: cleanId(options?.accountId),
    clusterId: cleanId(options?.clusterId)
  };
}

/**
 * Transforms an ingested RawFeedbackRow into a ProcessedFeedbackRow,
 * keeping the four identity tiers isolated, resolving customer tier,
 * and preserving verbatim text and raw row data untouched (IC-001).
 */
export function processFeedbackRow(rawRow: RawFeedbackRow): ProcessedFeedbackRow {
  const identity = createFeedbackIdentity(rawRow.feedback_id, {
    userId: rawRow.user_id,
    accountId: rawRow.account_id
  });

  const tierResolution = resolveCustomerTier(rawRow.tier);

  return {
    identity,
    text: rawRow.text, // Verbatim source text unchanged (IC-001)
    tierResolution,
    rawRow: rawRow.rawRow,
    rowIndex: rawRow.rowIndex
  };
}

/**
 * Batch processes an array of RawFeedbackRows.
 */
export function processFeedbackRows(rawRows: RawFeedbackRow[]): ProcessedFeedbackRow[] {
  return rawRows.map(processFeedbackRow);
}
