/**
 * scoring/engine.ts — Deterministic Hybrid Priority Scoring Engine
 * Governed by PRD REQ-008, §6.1–6.6, TS-003, TS-008, TS-011;
 * MDD §3.4–3.5, §3.8; IC-002; GAP-02, GAP-11, GAP-12.
 */

import { ReconciledCluster } from '../types/ai';
import { ProcessedFeedbackRow } from '../types/identity';
import {
  SliderWeights,
  NormalizedWeights,
  ClusterScoringMetrics,
  ClusterNormalizedMetrics,
  ScoringBreakdown,
  ClusterScoringFlags,
  ScoredCluster,
  DatasetScoringResult,
} from '../types/scoring';
import { round1 } from './round';
import { normalizeSliderWeights } from './weights';
import { getTierWeight, resolveAccountTierWeight } from './tierWeight';

/**
 * Mandatory impact label per IC-002 (never ARR or $).
 */
export const IMPACT_LABEL = 'Impact Score / Tier-Weighted Impact' as const;

/**
 * Calculates raw physical cluster metrics (I_c, U_c, S_c, N_c) from member rows.
 * Implements GAP-12 (Account Tier Conflict Rule) and estimated account coverage.
 */
export function calculateClusterRawMetrics(
  memberFeedbackIds: string[],
  rows: ProcessedFeedbackRow[],
  severityRating: number
): ClusterScoringMetrics {
  const rowMap = new Map<string, ProcessedFeedbackRow>();
  for (const r of rows) {
    rowMap.set(r.identity.feedbackId, r);
  }

  // Account -> array of raw tier strings
  const confirmedAccountTiers = new Map<string, string[]>();
  let estimatedAccountsCount = 0;
  let estimatedImpactSum = 0.0;

  for (const id of memberFeedbackIds) {
    const row = rowMap.get(id);
    const rawAccountId = row?.identity?.accountId?.trim();
    const tier = row?.tierResolution?.canonicalTier || row?.tierResolution?.rawTier;

    if (rawAccountId && rawAccountId.length > 0) {
      const list = confirmedAccountTiers.get(rawAccountId) || [];
      if (tier) list.push(tier);
      confirmedAccountTiers.set(rawAccountId, list);
    } else {
      // Estimated account row: counts as its own provisional account with row's tier weight
      estimatedAccountsCount++;
      estimatedImpactSum += getTierWeight(tier);
    }
  }

  // Calculate confirmed account impact using GAP-12 conflict rule (highest tier weight among rows)
  let confirmedImpactSum = 0.0;
  for (const tiers of confirmedAccountTiers.values()) {
    confirmedImpactSum += resolveAccountTierWeight(tiers);
  }

  const confirmedAccountsCount = confirmedAccountTiers.size;
  const U_c = confirmedAccountsCount + estimatedAccountsCount;
  const I_c = confirmedImpactSum + estimatedImpactSum;
  const N_c = memberFeedbackIds.length;
  const S_c = Math.max(1, Math.min(3, Math.round(severityRating || 1)));

  return {
    I_c,
    U_c,
    S_c,
    N_c,
    confirmedAccountsCount,
    estimatedAccountsCount,
  };
}

/**
 * Normalizes cluster metrics to [0, 1] relative to dataset-wide maximums.
 * PRD §6.3–6.4: Single cluster defaults to I_n=1.0, F_n=1.0 (no NaN).
 * Zero denominator defaults safely to 0.0.
 */
export function normalizeClusterMetrics(
  raw: ClusterScoringMetrics,
  options: { maxI: number; maxU: number; isSingleCluster?: boolean }
): ClusterNormalizedMetrics {
  const S_n = Math.min(1.0, Math.max(0.0, raw.S_c / 3.0));

  if (options.isSingleCluster) {
    return {
      I_n: 1.0,
      F_n: 1.0,
      S_n,
    };
  }

  const I_n = options.maxI > 0 ? Math.min(1.0, Math.max(0.0, raw.I_c / options.maxI)) : 0.0;
  const F_n = options.maxU > 0 ? Math.min(1.0, Math.max(0.0, raw.U_c / options.maxU)) : 0.0;

  return {
    I_n,
    F_n,
    S_n,
  };
}

/**
 * Calculates the deterministic Hybrid Priority Score (P_c) and complete breakdown object.
 * Formula: P_c = Round_1( 100 * [ W_ARR * I_n + W_Vol * F_n + W_Sev * S_n ] )
 */
export function calculatePriorityScore(
  raw: ClusterScoringMetrics,
  normalized: ClusterNormalizedMetrics,
  weights: NormalizedWeights
): ScoringBreakdown {
  const rawWeightedSum =
    weights.wArr * normalized.I_n +
    weights.wVol * normalized.F_n +
    weights.wSev * normalized.S_n;

  const unroundedScore = 100.0 * rawWeightedSum;
  const priorityScore = round1(unroundedScore);

  const formulaDisplay = `P_c = Round_1(100 * [${weights.wArr.toFixed(2)} * ${normalized.I_n.toFixed(2)} + ${weights.wVol.toFixed(2)} * ${normalized.F_n.toFixed(2)} + ${weights.wSev.toFixed(2)} * ${normalized.S_n.toFixed(2)}]) = ${priorityScore.toFixed(1)}`;

  return {
    rawMetrics: raw,
    normalizedMetrics: normalized,
    weights,
    rawWeightedSum,
    unroundedScore,
    priorityScore,
    formulaDisplay,
    impactLabel: IMPACT_LABEL,
  };
}

/**
 * Evaluates cluster status flags and badges.
 * Rules:
 * - Critical Blocker when S_c === 3
 *   Suffix '(Low Frequency)' when U_c < 3
 * - Small Sample badge when U_c < 3
 */
export function evaluateClusterFlags(
  S_c: number,
  U_c: number,
  isUnclustered: boolean = false
): ClusterScoringFlags {
  if (isUnclustered) {
    return {
      isCriticalBlocker: false,
      isSmallSample: false,
      isUnclusteredBucket: true,
    };
  }

  const isCriticalBlocker = S_c === 3;
  const isSmallSample = U_c < 3;

  let criticalBlockerBadge: string | undefined;
  if (isCriticalBlocker) {
    criticalBlockerBadge = isSmallSample
      ? 'Critical Blocker (Low Frequency)'
      : 'Critical Blocker';
  }

  const smallSampleBadge = isSmallSample
    ? 'Small Sample Size (Low Confidence)'
    : undefined;

  return {
    isCriticalBlocker,
    criticalBlockerBadge,
    isSmallSample,
    smallSampleBadge,
    isUnclusteredBucket: false,
  };
}

/**
 * Scores, ranks, and sorts all clusters in a dataset.
 * Rules:
 * 1. Segregates CLUST-UNC from normalization maximums (GAP-11).
 * 2. Calculates global max_I and max_U over standard clusters.
 * 3. Breaks ties strictly: P_c desc -> I_c desc -> U_c desc -> cluster_id asc.
 * 4. Assigns 1-based ranks.
 * 5. Flags sample size warning banner if total rows < 10 (GAP-02).
 */
export function scoreAndRankClusters(
  clusters: ReconciledCluster[],
  rows: ProcessedFeedbackRow[],
  sliderWeights?: Partial<SliderWeights>
): DatasetScoringResult {
  const weights = normalizeSliderWeights(sliderWeights);
  const totalRows = rows.length;

  // 1. Segregate standard clusters from CLUST-UNC bucket (GAP-11)
  const standardClusters: ReconciledCluster[] = [];
  let rawUnclusteredCluster: ReconciledCluster | null = null;

  for (const c of clusters) {
    if (c.cluster_id === 'CLUST-UNC' || c.isUnclustered) {
      rawUnclusteredCluster = c;
    } else {
      standardClusters.push(c);
    }
  }

  // 2. Calculate raw metrics for standard clusters
  const standardWithRaw = standardClusters.map((cluster) => {
    const rawMetrics = calculateClusterRawMetrics(
      cluster.member_feedback_ids || [],
      rows,
      cluster.severity_rating || 1
    );
    return { cluster, rawMetrics };
  });

  // 3. Determine dataset maximums (strictly excluding CLUST-UNC per GAP-11)
  let maxImpact = 0.0;
  let maxFrequency = 0;

  for (const item of standardWithRaw) {
    if (item.rawMetrics.I_c > maxImpact) maxImpact = item.rawMetrics.I_c;
    if (item.rawMetrics.U_c > maxFrequency) maxFrequency = item.rawMetrics.U_c;
  }

  const isSingleCluster = standardWithRaw.length === 1;

  // 4. Normalize metrics and compute P_c for each standard cluster
  const scoredList: ScoredCluster[] = standardWithRaw.map(({ cluster, rawMetrics }) => {
    const normalized = normalizeClusterMetrics(rawMetrics, {
      maxI: maxImpact,
      maxU: maxFrequency,
      isSingleCluster,
    });

    const breakdown = calculatePriorityScore(rawMetrics, normalized, weights);
    const flags = evaluateClusterFlags(rawMetrics.S_c, rawMetrics.U_c, false);

    return {
      cluster_id: cluster.cluster_id,
      cluster_title: cluster.cluster_title,
      canonical_category: cluster.canonical_category,
      problem_summary: cluster.problem_summary,
      root_cause_hypothesis: cluster.root_cause_hypothesis,
      severity_rating: rawMetrics.S_c,
      member_feedback_ids: cluster.member_feedback_ids,
      quotes: cluster.quotes || [],
      priority_score: breakdown.priorityScore,
      rank: 0, // Assigned after tie-break sort
      metrics: rawMetrics,
      normalized,
      breakdown,
      flags,
      coordinates: {
        x: normalized.F_n,
        y: normalized.I_n,
      },
    };
  });

  // 5. Tie-break sorting: P_c desc -> I_c desc -> U_c desc -> cluster_id asc
  scoredList.sort((a, b) => {
    // 1. Priority Score descending
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    // 2. Raw Impact (I_c) descending
    if (b.metrics.I_c !== a.metrics.I_c) {
      return b.metrics.I_c - a.metrics.I_c;
    }
    // 3. Unique Frequency (U_c) descending
    if (b.metrics.U_c !== a.metrics.U_c) {
      return b.metrics.U_c - a.metrics.U_c;
    }
    // 4. Cluster ID ascending (lexicographical stable tie-break)
    return a.cluster_id.localeCompare(b.cluster_id);
  });

  // Assign 1-based ranks
  scoredList.forEach((cluster, index) => {
    cluster.rank = index + 1;
  });

  // 6. Process CLUST-UNC bucket if present (GAP-11: S=1, P=0, excluded from matrix coordinates)
  let scoredUnclustered: ScoredCluster | null = null;
  if (rawUnclusteredCluster) {
    const rawMetrics = calculateClusterRawMetrics(
      rawUnclusteredCluster.member_feedback_ids || [],
      rows,
      1
    );
    const normalized: ClusterNormalizedMetrics = {
      I_n: 0.0,
      F_n: 0.0,
      S_n: 1.0 / 3.0,
    };
    const breakdown = calculatePriorityScore(rawMetrics, normalized, weights);
    breakdown.priorityScore = 0.0; // Enforce exact 0.0 per GAP-11

    scoredUnclustered = {
      cluster_id: rawUnclusteredCluster.cluster_id || 'CLUST-UNC',
      cluster_title: rawUnclusteredCluster.cluster_title || 'Unclustered Feedback',
      canonical_category: rawUnclusteredCluster.canonical_category || 'Unassigned',
      problem_summary: rawUnclusteredCluster.problem_summary || 'Isolated for manual review',
      root_cause_hypothesis: rawUnclusteredCluster.root_cause_hypothesis || 'Multiple disparate causes',
      severity_rating: 1,
      member_feedback_ids: rawUnclusteredCluster.member_feedback_ids || [],
      quotes: rawUnclusteredCluster.quotes || [],
      priority_score: 0.0,
      rank: scoredList.length + 1,
      metrics: rawMetrics,
      normalized,
      breakdown,
      flags: evaluateClusterFlags(1, rawMetrics.U_c, true),
      coordinates: { x: 0.0, y: 0.0 },
    };
  }

  // 7. Dataset-wide quality warning banner (GAP-02: < 10 rows triggers sample size banner)
  const warningBanner =
    totalRows < 10 ? 'Low Sample Size: Minimum 25 items recommended' : null;

  return {
    scoredClusters: scoredList,
    unclusteredBucket: scoredUnclustered,
    datasetMetrics: {
      totalRows,
      totalClusters: standardClusters.length,
      maxImpact,
      maxFrequency,
    },
    normalizedWeights: weights,
    warningBanner,
  };
}
