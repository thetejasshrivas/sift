/**
 * types/identity.ts — SIFT Identity, Tier Mapping, and Data Quality Types
 * Governed by PRD REQ-003, REQ-004, §4.3–4.6, TS-002, TS-017, TS-024;
 * MDD §3.2; IC-002, IC-012; GAP-10.
 */

/**
 * Recognized customer tier categories.
 * RULE (IC-002): Tier weights are proxies for relative priority, not verified ARR dollar values.
 * Never label them as actual revenue or ARR.
 */
export type CustomerTier = 'Enterprise' | 'Pro / Mid-Market' | 'Free / Starter' | 'UNKNOWN';

/**
 * Mandatory weight label per IC-002.
 * Never use '$/ARR' wording.
 */
export const TIER_WEIGHT_LABEL = 'Tier-Weighted' as const;

/**
 * Tier weights per PRD REQ-003 and MDD §3.2.
 */
export const TIER_WEIGHTS: Readonly<Record<CustomerTier, number>> = {
  Enterprise: 3.0,
  'Pro / Mid-Market': 2.0,
  'Free / Starter': 1.0,
  UNKNOWN: 1.0
};

/**
 * Recognized aliases for customer tiers.
 */
export const RECOGNIZED_TIER_ALIASES: Readonly<Record<Exclude<CustomerTier, 'UNKNOWN'>, readonly string[]>> = {
  Enterprise: ['enterprise'],
  'Pro / Mid-Market': ['pro', 'mid-market', 'mid market', 'midmarket', 'pro / mid-market', 'pro/mid-market', 'mid_market'],
  'Free / Starter': ['free', 'starter', 'free / starter', 'free/starter']
};

/**
 * Result of tier resolution.
 * Raw dataset value is preserved unmodified.
 */
export interface TierResolution {
  canonicalTier: CustomerTier;
  weight: number;
  weightLabel: typeof TIER_WEIGHT_LABEL;
  rawTier?: string | null;
  isUnrecognized: boolean;
  isNumericArrNotice?: boolean;
  informationalPill?: string;
  noticeText?: string;
}

/**
 * Four-Tier Identity Model per PRD §4.3.
 * Feedback ID, User ID, Account ID, and Cluster ID are strictly separated.
 */
export interface FeedbackIdentity {
  feedbackId: string;         // Unique row identifier (e.g. FB-001)
  userId?: string | null;     // End-user submitter identifier
  accountId?: string | null;  // Paying corporate entity identifier
  clusterId?: string | null;  // Assigned grouping identifier (e.g. CLUST-01)
}

/**
 * Dual-reporting Account Count metrics per PRD §4.5, MDD §3.3, and TS-017.
 */
export interface AccountCountMetrics {
  confirmedUniqueAccounts: number;   // Distinct non-empty trimmed Account IDs
  missingAccountIdRows: number;      // Rows lacking Account ID
  estimatedAccountCoverage: number;  // Confirmed unique accounts + 1 provisional account per missing row (U=N)
  distinctAccountIds: string[];      // Verified distinct trimmed Account IDs
  isAccountUnmappedWarning: boolean; // True if account column is unmapped or missing account IDs
  warningPillText?: string;          // Warning pill text when account identity is unmapped/missing
}

/**
 * Data Quality Metrics per PRD §4.6 and IC-012.
 * Calculates three distinct numbers, using distinct-row union deduplication for issues.
 */
export interface DataQualityMetrics {
  totalRows: number;
  // Metric 1: Unknown Tier %
  unknownTierCount: number;
  unknownTierPercentage: number;
  isTierColumnMapped: boolean;
  // Metric 2: Missing Account ID %
  missingAccountIdCount: number;
  missingAccountIdPercentage: number;
  isAccountColumnMapped: boolean;
  // Metric 3: Rows with >= 1 issue % (distinct-row union)
  rowsWithIssuesCount: number;
  rowsWithIssuesPercentage: number;
}

/**
 * Quality Alert Banner state per PRD REQ-004 and §4.6.
 */
export interface QualityAlertBanner {
  triggered: boolean;               // True if rowsWithIssuesPercentage > 5.0%
  issuePercentage: number;          // Union issue percentage (used in banner text)
  message: string;                  // Full warning text per PRD §4.6
  collapsedText: string;            // Compact header pill text
}

/**
 * Normalized row representation combining verbatim text, isolated identities, and tier resolution.
 */
export interface ProcessedFeedbackRow {
  identity: FeedbackIdentity;
  text: string;                     // Verbatim unmutated source text (IC-001)
  tierResolution: TierResolution;
  rawRow: Record<string, string>;   // Raw unmutated source row
  rowIndex: number;                 // 1-indexed source row number
}
