/**
 * types/scoring.ts — Deterministic Scoring Engine & Weight Types
 * Governed by PRD REQ-008, §6.1–6.6, TS-003, TS-008, TS-011;
 * MDD §3.4–3.5, §3.8; IC-002; GAP-02, GAP-11, GAP-12.
 */

/**
 * Raw slider weight inputs from user controls (range 0 to 100).
 * Rule (IC-002): 'arr' is a proxy for relative priority, not verified ARR dollars.
 * UI Label is strictly 'Impact Score / Tier-Weighted Impact', never ARR or $.
 */
export interface SliderWeights {
  arr: number; // Impact / Tier-weighted proxy weight (default: 40)
  vol: number; // Volume / Frequency weight (default: 40)
  sev: number; // Severity weight (default: 20)
}

/**
 * Normalized slider weights summing strictly to 1.0 (100%).
 * Defaults to 0.40 / 0.40 / 0.20 when all sliders are set to 0.
 */
export interface NormalizedWeights {
  wArr: number; // W_ARR in [0, 1]
  wVol: number; // W_Vol in [0, 1]
  wSev: number; // W_Sev in [0, 1]
}

/**
 * Physical raw metrics for a cluster before normalization.
 */
export interface ClusterScoringMetrics {
  I_c: number; // Raw Tier-Weighted Impact: sum over unique affected accounts of TierWeight
  U_c: number; // Unique affected accounts count (confirmed unique accounts + estimated account rows)
  S_c: number; // Severity rating: max member severity in {1, 2, 3}
  N_c: number; // Incident volume: total feedback rows in cluster
  confirmedAccountsCount: number;
  estimatedAccountsCount: number;
}

/**
 * Normalized metric components for a cluster (all in [0, 1]).
 */
export interface ClusterNormalizedMetrics {
  I_n: number; // Normalized Impact: I_c / max_I (or 1.0 for single cluster, 0.0 for zero denominator)
  F_n: number; // Normalized Frequency: U_c / max_U (or 1.0 for single cluster, 0.0 for zero denominator)
  S_n: number; // Normalized Severity: S_c / 3.0
}

/**
 * Full mathematical calculation breakdown object for card hover tooltip and deep-dive drawer.
 */
export interface ScoringBreakdown {
  rawMetrics: ClusterScoringMetrics;
  normalizedMetrics: ClusterNormalizedMetrics;
  weights: NormalizedWeights;
  rawWeightedSum: number; // (W_ARR * I_n + W_Vol * F_n + W_Sev * S_n)
  unroundedScore: number; // 100 * rawWeightedSum
  priorityScore: number;  // P_c = Round_1(unroundedScore)
  formulaDisplay: string; // Explanatory human-readable math formula string
  impactLabel: string;   // 'Impact Score / Tier-Weighted Impact' per IC-002
}

/**
 * Status flags and badges for a scored cluster.
 */
export interface ClusterScoringFlags {
  isCriticalBlocker: boolean;       // S_c === 3
  criticalBlockerBadge?: string;    // 'Critical Blocker' or 'Critical Blocker (Low Frequency)' when U_c < 3
  isSmallSample: boolean;           // U_c < 3
  smallSampleBadge?: string;        // 'Small Sample Size (Low Confidence)'
  isUnclusteredBucket: boolean;     // CLUST-UNC (GAP-11)
}

/**
 * Final scored cluster object ready for matrix visualization and ranked card list.
 */
export interface ScoredCluster {
  cluster_id: string;
  cluster_title: string;
  canonical_category: string;
  problem_summary: string;
  root_cause_hypothesis: string;
  severity_rating: number; // S_c in {1, 2, 3}
  member_feedback_ids: string[];
  quotes: Array<{ feedback_id: string; quote_snippet: string }>;
  
  // Scoring outputs
  priority_score: number; // P_c in [0, 100] (0.0 for CLUST-UNC)
  rank: number;           // 1-based rank after tie-break sorting (CLUST-UNC ranked last)
  metrics: ClusterScoringMetrics;
  normalized: ClusterNormalizedMetrics;
  breakdown: ScoringBreakdown;
  flags: ClusterScoringFlags;
  
  // Matrix plot coordinates (fixed physical coordinates, F_n on X, I_n on Y)
  coordinates: {
    x: number; // F_n in [0, 1]
    y: number; // I_n in [0, 1]
  };
}

/**
 * Dataset-wide scoring summary including global maximums and quality/sample size banners.
 */
export interface DatasetScoringResult {
  scoredClusters: ScoredCluster[];
  unclusteredBucket: ScoredCluster | null;
  datasetMetrics: {
    totalRows: number;
    totalClusters: number;
    maxImpact: number;    // max_I over scored clusters (excluding CLUST-UNC)
    maxFrequency: number; // max_U over scored clusters (excluding CLUST-UNC)
  };
  normalizedWeights: NormalizedWeights;
  warningBanner?: string | null; // e.g. GAP-02: 'Low Sample Size: Minimum 25 items recommended' if total rows < 10
}
