/**
 * identity/tierMapper.ts — SIFT Customer Tier Normalization and Weight Resolution
 * Governed by PRD REQ-003, §4.4, TS-002; MDD §3.2; IC-002; GAP-10.
 */

import {
  RECOGNIZED_TIER_ALIASES,
  TIER_WEIGHT_LABEL,
  TIER_WEIGHTS,
  TierResolution
} from '../types/identity';

/**
 * Standard missing/null string representations that resolve to UNKNOWN without generating an error pill.
 */
const STANDARD_UNKNOWN_STRINGS = new Set([
  '',
  'unknown',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  '-',
  '--'
]);

/**
 * Detects whether a string represents a numeric ARR / MRR value.
 * Per GAP-10: Numeric ARR/MRR values are NOT converted to tiers in P0.
 */
export function isNumericArrValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Matches currency symbols ($ € £ ¥ ₹), digits, separators, optional k/m/b suffixes, /mo, /yr
  const pattern = /^[\s$€£¥₹]*\d+([.,]\d+)*\s*(k|m|b|\/mo|\/yr|per month|per year)?\s*$/i;
  if (pattern.test(trimmed)) {
    return true;
  }

  // Check if string is a numeric literal with currency stripped
  const stripped = trimmed.replace(/[$€£¥₹,\s]/g, '');
  return stripped.length > 0 && !isNaN(Number(stripped));
}

/**
 * Normalizes a raw tier string and resolves canonical tier, weight, and metadata.
 *
 * RULES:
 * 1. Recognized buckets:
 *    - Enterprise = 3.0
 *    - Pro / Mid-Market = 2.0 (aliases: pro, mid-market, mid market, midmarket, 'pro / mid-market')
 *    - Free / Starter = 1.0 (aliases: free, starter)
 *    - UNKNOWN = 1.0
 * 2. Blank / null / N/A / unrecognized -> UNKNOWN (weight 1.0).
 * 3. Raw dataset values are never modified.
 * 4. Non-standard tier strings generate an informational pill.
 * 5. Numeric ARR/MRR values are NOT converted to tiers in P0 (GAP-10) — generate a notice and treat as UNKNOWN.
 * 6. Label tier weights 'Tier-Weighted' everywhere; never use $/ARR wording (IC-002).
 */
export function resolveCustomerTier(rawTier?: string | null): TierResolution {
  // 1. Missing, null, undefined, or empty
  if (rawTier === undefined || rawTier === null) {
    return {
      canonicalTier: 'UNKNOWN',
      weight: TIER_WEIGHTS.UNKNOWN,
      weightLabel: TIER_WEIGHT_LABEL,
      rawTier: rawTier ?? null,
      isUnrecognized: false
    };
  }

  const trimmed = rawTier.trim();
  const normalized = trimmed.toLowerCase();

  // 2. Standard empty or recognized null representation
  if (STANDARD_UNKNOWN_STRINGS.has(normalized)) {
    return {
      canonicalTier: 'UNKNOWN',
      weight: TIER_WEIGHTS.UNKNOWN,
      weightLabel: TIER_WEIGHT_LABEL,
      rawTier,
      isUnrecognized: false
    };
  }

  // 3. Check Enterprise aliases
  for (const alias of RECOGNIZED_TIER_ALIASES.Enterprise) {
    if (normalized === alias) {
      return {
        canonicalTier: 'Enterprise',
        weight: TIER_WEIGHTS.Enterprise,
        weightLabel: TIER_WEIGHT_LABEL,
        rawTier,
        isUnrecognized: false
      };
    }
  }

  // 4. Check Pro / Mid-Market aliases
  for (const alias of RECOGNIZED_TIER_ALIASES['Pro / Mid-Market']) {
    if (normalized === alias) {
      return {
        canonicalTier: 'Pro / Mid-Market',
        weight: TIER_WEIGHTS['Pro / Mid-Market'],
        weightLabel: TIER_WEIGHT_LABEL,
        rawTier,
        isUnrecognized: false
      };
    }
  }

  // 5. Check Free / Starter aliases
  for (const alias of RECOGNIZED_TIER_ALIASES['Free / Starter']) {
    if (normalized === alias) {
      return {
        canonicalTier: 'Free / Starter',
        weight: TIER_WEIGHTS['Free / Starter'],
        weightLabel: TIER_WEIGHT_LABEL,
        rawTier,
        isUnrecognized: false
      };
    }
  }

  // 6. Numeric ARR/MRR detection (GAP-10)
  if (isNumericArrValue(trimmed)) {
    return {
      canonicalTier: 'UNKNOWN',
      weight: TIER_WEIGHTS.UNKNOWN,
      weightLabel: TIER_WEIGHT_LABEL,
      rawTier,
      isUnrecognized: true,
      isNumericArrNotice: true,
      noticeText: `Numeric ARR/MRR value detected ('${trimmed}'). Numeric ARR values are not converted to tiers in P0 (GAP-10) and are evaluated as UNKNOWN (1.0x Tier-Weighted).`,
      informationalPill: `Numeric ARR: '${trimmed}' → UNKNOWN (1.0x ${TIER_WEIGHT_LABEL})`
    };
  }

  // 7. Non-standard unrecognized string
  return {
    canonicalTier: 'UNKNOWN',
    weight: TIER_WEIGHTS.UNKNOWN,
    weightLabel: TIER_WEIGHT_LABEL,
    rawTier,
    isUnrecognized: true,
    isNumericArrNotice: false,
    informationalPill: `Non-standard tier: '${trimmed}' evaluated as UNKNOWN (1.0x ${TIER_WEIGHT_LABEL})`
  };
}
