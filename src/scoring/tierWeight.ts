/**
 * scoring/tierWeight.ts — Customer Tier Weight Resolvers & Account Conflict Handling
 * Governed by PRD REQ-003, §6.3; MDD §3.2, §3.4; IC-002; GAP-12.
 *
 * Rules:
 * 1. Tier weights are proxies for relative priority, not verified ARR dollar values (IC-002).
 *    Enterprise = 3.0, Pro / Mid-Market = 2.0, Free / Starter = 1.0, UNKNOWN = 1.0.
 * 2. Account tier conflict rule (GAP-12): When an account appears in multiple rows with different
 *    tiers, the account is assigned the HIGHEST tier weight among its rows.
 */

import { TIER_WEIGHTS } from '../types/identity';

/**
 * Returns the numeric proxy weight for a given tier name.
 * Enterprise -> 3.0, Pro / Mid-Market -> 2.0, Free / Starter -> 1.0, UNKNOWN -> 1.0.
 */
export function getTierWeight(tier?: string | null): number {
  if (!tier || typeof tier !== 'string') {
    return TIER_WEIGHTS.UNKNOWN;
  }

  const clean = tier.trim().toLowerCase();

  if (clean === 'enterprise') {
    return TIER_WEIGHTS.Enterprise; // 3.0
  }

  if (
    clean === 'pro' ||
    clean === 'mid-market' ||
    clean === 'mid market' ||
    clean === 'midmarket' ||
    clean === 'pro / mid-market' ||
    clean === 'pro/mid-market' ||
    clean === 'mid_market'
  ) {
    return TIER_WEIGHTS['Pro / Mid-Market']; // 2.0
  }

  if (
    clean === 'free' ||
    clean === 'starter' ||
    clean === 'free / starter' ||
    clean === 'free/starter'
  ) {
    return TIER_WEIGHTS['Free / Starter']; // 1.0
  }

  return TIER_WEIGHTS.UNKNOWN; // 1.0
}

/**
 * Resolves the effective tier weight for an account across multiple rows.
 * Governed by GAP-12 (Account Tier Conflict Rule): takes the HIGHEST tier weight among its rows.
 */
export function resolveAccountTierWeight(rowTiers: Array<string | undefined | null>): number {
  if (!rowTiers || rowTiers.length === 0) {
    return TIER_WEIGHTS.UNKNOWN;
  }

  let maxWeight = 1.0;
  for (const tier of rowTiers) {
    const w = getTierWeight(tier);
    if (w > maxWeight) {
      maxWeight = w;
    }
  }

  return maxWeight;
}
