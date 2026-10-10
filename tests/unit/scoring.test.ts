/**
 * tests/unit/scoring.test.ts — Deterministic Scoring Engine Unit Tests
 * Governed by PRD REQ-008, §6.1–6.6, TS-003, TS-008, TS-011;
 * MDD §3.4–3.5, §3.8; IC-002; GAP-02, GAP-11, GAP-12.
 * Evaluates Gate G-M3A.
 */

import { describe, it, expect } from 'vitest';
import {
  round1,
  normalizeSliderWeights,
  DEFAULT_SLIDER_WEIGHTS,
  DEFAULT_NORMALIZED_WEIGHTS,
  getTierWeight,
  resolveAccountTierWeight,
  calculateClusterRawMetrics,
  normalizeClusterMetrics,
  calculatePriorityScore,
  scoreAndRankClusters,
} from '../../src/scoring';
import { ReconciledCluster } from '../../src/types/ai';
import { ProcessedFeedbackRow } from '../../src/types/identity';

/**
 * ==============================================================================
 * PART VII / §7.4 INDEPENDENT TEST VECTOR TABLE (Hand-Calculated Benchmarks)
 * ==============================================================================
 * | Vec | Scenario | Raw Inputs (I_c, U_c, S_c, maxI, maxU) | Sliders (ARR, Vol, Sev) | Weights (W_ARR, W_Vol, W_Sev) | Components (I_n, F_n, S_n) | Expected P_c |
 * |:---:|:---|:---|:---|:---|:---|:---|
 * | V01 | TS-003: Priority Invariant | I_n=0.8, F_n=0.5, S_n=1.0 | 40, 40, 20 | 0.40, 0.40, 0.20 | 0.80, 0.50, 1.00 | 72.0 |
 * | V02 | PRD §6.6: Worked Example | I_c=12, maxI=15, U_c=10, maxU=20, S_c=3 | 50, 30, 20 | 0.50, 0.30, 0.20 | 0.80, 0.50, 1.00 | 75.0 |
 * | V03 | TS-008: All-Zero Sliders | I_c=10, maxI=10, U_c=8, maxU=8, S_c=3 | 0, 0, 0 | 0.40, 0.40, 0.20 (Default) | 1.00, 1.00, 1.00 | 100.0 |
 * | V04 | TS-011: Free-Tier Only | 10 Free (I_c=10, maxI=10, U_c=10, maxU=10), S_c=1 | 40, 40, 20 | 0.40, 0.40, 0.20 | 1.00, 1.00, 0.3333 | 86.7 |
 * | V05 | Critical Blocker (Low Freq) | I_c=6, maxI=12, U_c=2, maxU=10, S_c=3 | 40, 40, 20 | 0.40, 0.40, 0.20 | 0.50, 0.20, 1.00 | 48.0 |
 * | V06 | Single Cluster (No NaN) | I_c=9, U_c=3, S_c=2 (single cluster) | 40, 40, 20 | 0.40, 0.40, 0.20 | 1.00, 1.00, 0.6667 | 93.3 |
 * | V07 | Pure Impact Weighting | I_n=0.73, F_n=0.10, S_n=1.00 | 100, 0, 0 | 1.00, 0.00, 0.00 | 0.73, 0.10, 1.00 | 73.0 |
 * | V08 | Pure Volume Weighting | I_n=0.20, F_n=0.65, S_n=1.00 | 0, 100, 0 | 0.00, 1.00, 0.00 | 0.20, 0.65, 1.00 | 65.0 |
 * | V09 | Pure Severity Weighting | S_c=2 -> S_n=2/3 | 0, 0, 100 | 0.00, 0.00, 1.00 | 0.00, 0.00, 0.6667 | 66.7 |
 * | V10 | Zero Denominator Safety | maxI=0, maxU=0, S_c=1 | 40, 40, 20 | 0.40, 0.40, 0.20 | 0.00, 0.00, 0.3333 | 6.7 |
 */

describe('Deterministic Scoring Engine (REQ-008 & MDD §3.5)', () => {
  describe('Documented Rounding Helper (round1) with .x5 Half-Up Boundaries', () => {
    it('correctly rounds values on .x5 half-up boundaries and standard precision', () => {
      // Half-up boundary tests
      expect(round1(72.05)).toBe(72.1);
      expect(round1(72.04)).toBe(72.0);
      expect(round1(72.06)).toBe(72.1);
      expect(round1(85.15)).toBe(85.2);
      expect(round1(85.14)).toBe(85.1);
      expect(round1(0.05)).toBe(0.1);
      expect(round1(0.04)).toBe(0.0);
      expect(round1(99.95)).toBe(100.0);
      expect(round1(99.94)).toBe(99.9);
      expect(round1(72.0)).toBe(72.0);
      expect(round1(0.0)).toBe(0.0);
    });
  });

  describe('Slider Weight Normalization & All-Zero Fallback (REQ-008 & §6.1–6.2)', () => {
    it('normalizes slider weights summing to 1.0', () => {
      const weights = normalizeSliderWeights({ arr: 50, vol: 30, sev: 20 });
      expect(weights.wArr).toBe(0.50);
      expect(weights.wVol).toBe(0.30);
      expect(weights.wSev).toBe(0.20);
      expect(weights.wArr + weights.wVol + weights.wSev).toBeCloseTo(1.0, 5);
    });

    it('defaults to 40/40/20 baseline weights when all sliders are set to 0 (TS-008)', () => {
      const weights = normalizeSliderWeights({ arr: 0, vol: 0, sev: 0 });
      expect(weights.wArr).toBe(0.40);
      expect(weights.wVol).toBe(0.40);
      expect(weights.wSev).toBe(0.20);
      expect(weights).toEqual(DEFAULT_NORMALIZED_WEIGHTS);
    });

    it('handles omitted, undefined or empty slider weights with default 40/40/20', () => {
      expect(normalizeSliderWeights()).toEqual(DEFAULT_NORMALIZED_WEIGHTS);
      expect(normalizeSliderWeights({})).toEqual(DEFAULT_NORMALIZED_WEIGHTS);
    });

    it('handles single 100% slider correctly', () => {
      const arrOnly = normalizeSliderWeights({ arr: 100, vol: 0, sev: 0 });
      expect(arrOnly).toEqual({ wArr: 1.0, wVol: 0.0, wSev: 0.0 });

      const volOnly = normalizeSliderWeights({ arr: 0, vol: 100, sev: 0 });
      expect(volOnly).toEqual({ wArr: 0.0, wVol: 1.0, wSev: 0.0 });

      const sevOnly = normalizeSliderWeights({ arr: 0, vol: 0, sev: 100 });
      expect(sevOnly).toEqual({ wArr: 0.0, wVol: 0.0, wSev: 1.0 });
    });
  });

  describe('Customer Tier Weights (IC-002, PRD §6.3)', () => {
    it('maps tiers to exact proxy weights: Enterprise 3.0, Pro 2.0, Free 1.0, UNKNOWN 1.0', () => {
      expect(getTierWeight('Enterprise')).toBe(3.0);
      expect(getTierWeight('enterprise')).toBe(3.0);
      expect(getTierWeight('Pro')).toBe(2.0);
      expect(getTierWeight('Pro / Mid-Market')).toBe(2.0);
      expect(getTierWeight('mid-market')).toBe(2.0);
      expect(getTierWeight('Free')).toBe(1.0);
      expect(getTierWeight('Free / Starter')).toBe(1.0);
      expect(getTierWeight('starter')).toBe(1.0);
      expect(getTierWeight('UNKNOWN')).toBe(1.0);
      expect(getTierWeight(undefined)).toBe(1.0);
      expect(getTierWeight('')).toBe(1.0);
      expect(getTierWeight('unrecognized_custom_tier')).toBe(1.0);
    });

    it('resolves account tier conflict rule to highest weight among its rows (GAP-12)', () => {
      // Account with Pro (2.0) and Enterprise (3.0) rows -> resolves to Enterprise 3.0
      expect(resolveAccountTierWeight(['Pro', 'Enterprise'])).toBe(3.0);
      // Account with Free (1.0), UNKNOWN (1.0), and Pro (2.0) -> resolves to Pro 2.0
      expect(resolveAccountTierWeight(['Free', 'UNKNOWN', 'Pro'])).toBe(2.0);
      // Account with only Free rows -> resolves to 1.0
      expect(resolveAccountTierWeight(['Free', 'Free'])).toBe(1.0);
      // Account with unknown / empty tiers -> resolves to 1.0
      expect(resolveAccountTierWeight([undefined, ''])).toBe(1.0);
    });
  });

  describe('Independent Hand-Calculated Test Vectors (Table §7.4)', () => {
    it('Vector 1 (TS-003): Invariant I_n=0.8, F_n=0.5, S_n=1.0, weights 40/40/20 yields P_c = 72.0 exactly', () => {
      const weights = { wArr: 0.40, wVol: 0.40, wSev: 0.20 };
      const normalized = { I_n: 0.80, F_n: 0.50, S_n: 1.00 };
      const breakdown = calculatePriorityScore(
        { I_c: 8, U_c: 5, S_c: 3, N_c: 5, confirmedAccountsCount: 5, estimatedAccountsCount: 0 },
        normalized,
        weights
      );
      expect(breakdown.priorityScore).toBe(72.0);
      expect(breakdown.rawWeightedSum).toBe(0.72);
      expect(breakdown.unroundedScore).toBe(72.0);
    });

    it('Vector 2 (PRD §6.6): Worked Example with I_c=12, maxI=15, U_c=10, maxU=20, S_c=3 yields P_c = 75.0', () => {
      const weights = normalizeSliderWeights({ arr: 50, vol: 30, sev: 20 });
      const normalized = normalizeClusterMetrics(
        { I_c: 12.0, U_c: 10, S_c: 3, N_c: 10, confirmedAccountsCount: 10, estimatedAccountsCount: 0 },
        { maxI: 15.0, maxU: 20, isSingleCluster: false }
      );
      expect(normalized.I_n).toBe(0.80);
      expect(normalized.F_n).toBe(0.50);
      expect(normalized.S_n).toBe(1.00);

      const breakdown = calculatePriorityScore(
        { I_c: 12.0, U_c: 10, S_c: 3, N_c: 10, confirmedAccountsCount: 10, estimatedAccountsCount: 0 },
        normalized,
        weights
      );
      expect(breakdown.priorityScore).toBe(75.0);
    });

    it('Vector 3 (TS-008): All sliders set to 0 defaults to 40/40/20 and does not evaluate to NaN', () => {
      const weights = normalizeSliderWeights({ arr: 0, vol: 0, sev: 0 });
      const normalized = normalizeClusterMetrics(
        { I_c: 10.0, U_c: 8, S_c: 3, N_c: 8, confirmedAccountsCount: 8, estimatedAccountsCount: 0 },
        { maxI: 10.0, maxU: 8, isSingleCluster: false }
      );
      const breakdown = calculatePriorityScore(
        { I_c: 10.0, U_c: 8, S_c: 3, N_c: 8, confirmedAccountsCount: 8, estimatedAccountsCount: 0 },
        normalized,
        weights
      );
      expect(breakdown.priorityScore).toBe(100.0);
      expect(Number.isNaN(breakdown.priorityScore)).toBe(false);
    });

    it('Vector 4 (TS-011): Free-tier-only dataset yields I_n = 1.0 and P_c = 86.7', () => {
      const weights = normalizeSliderWeights({ arr: 40, vol: 40, sev: 20 });
      const raw = { I_c: 10.0, U_c: 10, S_c: 1, N_c: 10, confirmedAccountsCount: 10, estimatedAccountsCount: 0 };
      const normalized = normalizeClusterMetrics(raw, { maxI: 10.0, maxU: 10, isSingleCluster: false });
      expect(normalized.I_n).toBe(1.0); // Not 0.0!
      expect(normalized.F_n).toBe(1.0);
      expect(normalized.S_n).toBeCloseTo(1 / 3, 5);

      const breakdown = calculatePriorityScore(raw, normalized, weights);
      // 100 * (0.40 * 1.0 + 0.40 * 1.0 + 0.20 * (1/3)) = 100 * (0.80 + 0.066667) = 86.6667 -> 86.7
      expect(breakdown.priorityScore).toBe(86.7);
    });

    it('Vector 5: Critical Blocker with Low Frequency (U_c < 3) displays appropriate flags and P_c = 48.0', () => {
      const weights = normalizeSliderWeights({ arr: 40, vol: 40, sev: 20 });
      const raw = { I_c: 6.0, U_c: 2, S_c: 3, N_c: 2, confirmedAccountsCount: 2, estimatedAccountsCount: 0 };
      const normalized = normalizeClusterMetrics(raw, { maxI: 12.0, maxU: 10, isSingleCluster: false });
      expect(normalized.I_n).toBe(0.50);
      expect(normalized.F_n).toBe(0.20);
      expect(normalized.S_n).toBe(1.00);

      const breakdown = calculatePriorityScore(raw, normalized, weights);
      // 100 * (0.40 * 0.50 + 0.40 * 0.20 + 0.20 * 1.0) = 100 * (0.20 + 0.08 + 0.20) = 48.0
      expect(breakdown.priorityScore).toBe(48.0);
    });

    it('Vector 6: Single Cluster Dataset evaluates I_n = 1.0, F_n = 1.0 without NaN and P_c = 93.3', () => {
      const weights = normalizeSliderWeights({ arr: 40, vol: 40, sev: 20 });
      const raw = { I_c: 9.0, U_c: 3, S_c: 2, N_c: 3, confirmedAccountsCount: 3, estimatedAccountsCount: 0 };
      const normalized = normalizeClusterMetrics(raw, { maxI: 9.0, maxU: 3, isSingleCluster: true });
      expect(normalized.I_n).toBe(1.0);
      expect(normalized.F_n).toBe(1.0);
      expect(normalized.S_n).toBeCloseTo(2 / 3, 5);

      const breakdown = calculatePriorityScore(raw, normalized, weights);
      // 100 * (0.40 * 1.0 + 0.40 * 1.0 + 0.20 * (2/3)) = 100 * (0.80 + 0.133333) = 93.3333 -> 93.3
      expect(breakdown.priorityScore).toBe(93.3);
      expect(Number.isNaN(breakdown.priorityScore)).toBe(false);
    });

    it('Vector 7: Pure Impact Weighting isolates I_n contribution', () => {
      const weights = normalizeSliderWeights({ arr: 100, vol: 0, sev: 0 });
      const normalized = { I_n: 0.73, F_n: 0.10, S_n: 1.00 };
      const breakdown = calculatePriorityScore(
        { I_c: 7.3, U_c: 1, S_c: 3, N_c: 1, confirmedAccountsCount: 1, estimatedAccountsCount: 0 },
        normalized,
        weights
      );
      expect(breakdown.priorityScore).toBe(73.0);
    });

    it('Vector 8: Pure Volume Weighting isolates F_n contribution', () => {
      const weights = normalizeSliderWeights({ arr: 0, vol: 100, sev: 0 });
      const normalized = { I_n: 0.20, F_n: 0.65, S_n: 1.00 };
      const breakdown = calculatePriorityScore(
        { I_c: 2, U_c: 6, S_c: 3, N_c: 6, confirmedAccountsCount: 6, estimatedAccountsCount: 0 },
        normalized,
        weights
      );
      expect(breakdown.priorityScore).toBe(65.0);
    });

    it('Vector 9: Pure Severity Weighting isolates S_n contribution', () => {
      const weights = normalizeSliderWeights({ arr: 0, vol: 0, sev: 100 });
      const normalized = { I_n: 0.0, F_n: 0.0, S_n: 2 / 3 };
      const breakdown = calculatePriorityScore(
        { I_c: 0, U_c: 0, S_c: 2, N_c: 1, confirmedAccountsCount: 0, estimatedAccountsCount: 0 },
        normalized,
        weights
      );
      expect(breakdown.priorityScore).toBe(66.7);
    });

    it('Vector 10: Zero Denominator Safety prevents divide-by-zero errors', () => {
      const weights = normalizeSliderWeights({ arr: 40, vol: 40, sev: 20 });
      const normalized = normalizeClusterMetrics(
        { I_c: 0, U_c: 0, S_c: 1, N_c: 0, confirmedAccountsCount: 0, estimatedAccountsCount: 0 },
        { maxI: 0, maxU: 0, isSingleCluster: false }
      );
      expect(normalized.I_n).toBe(0.0);
      expect(normalized.F_n).toBe(0.0);
      expect(normalized.S_n).toBeCloseTo(1 / 3, 5);

      const breakdown = calculatePriorityScore(
        { I_c: 0, U_c: 0, S_c: 1, N_c: 0, confirmedAccountsCount: 0, estimatedAccountsCount: 0 },
        normalized,
        weights
      );
      expect(breakdown.priorityScore).toBe(6.7);
    });
  });

  describe('Cluster Metrics Calculation & Account Tier Conflict Rules (GAP-12)', () => {
    it('aggregates unique affected accounts and handles estimated accounts without account_id', () => {
      const rows: ProcessedFeedbackRow[] = [
        // ACC-A with tier Pro and Enterprise (conflict rule: max tier = Enterprise 3.0)
        {
          identity: { feedbackId: 'FB-01', accountId: 'ACC-A' },
          tierResolution: { canonicalTier: 'Pro / Mid-Market', weight: 2.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
          text: 'Issue 1'
        } as ProcessedFeedbackRow,
        {
          identity: { feedbackId: 'FB-02', accountId: 'ACC-A' },
          tierResolution: { canonicalTier: 'Enterprise', weight: 3.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
          text: 'Issue 2'
        } as ProcessedFeedbackRow,
        // ACC-B with Free (weight 1.0)
        {
          identity: { feedbackId: 'FB-03', accountId: 'ACC-B' },
          tierResolution: { canonicalTier: 'Free / Starter', weight: 1.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
          text: 'Issue 3'
        } as ProcessedFeedbackRow,
        // Unmapped row 1 (estimated account with Enterprise 3.0)
        {
          identity: { feedbackId: 'FB-04', accountId: null },
          tierResolution: { canonicalTier: 'Enterprise', weight: 3.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
          text: 'Issue 4'
        } as ProcessedFeedbackRow,
        // Unmapped row 2 (estimated account with Free 1.0)
        {
          identity: { feedbackId: 'FB-05', accountId: '' },
          tierResolution: { canonicalTier: 'Free / Starter', weight: 1.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
          text: 'Issue 5'
        } as ProcessedFeedbackRow
      ];

      const metrics = calculateClusterRawMetrics(
        ['FB-01', 'FB-02', 'FB-03', 'FB-04', 'FB-05'],
        rows,
        3 // S_c
      );

      expect(metrics.N_c).toBe(5);
      expect(metrics.confirmedAccountsCount).toBe(2); // ACC-A, ACC-B
      expect(metrics.estimatedAccountsCount).toBe(2); // 2 rows lacking account ID
      expect(metrics.U_c).toBe(4); // 2 confirmed + 2 estimated
      // Impact: ACC-A (3.0) + ACC-B (1.0) + Estimated 1 (3.0) + Estimated 2 (1.0) = 8.0
      expect(metrics.I_c).toBe(8.0);
      expect(metrics.S_c).toBe(3);
    });
  });

  describe('Full Dataset Scoring, Tie-Breaking, and Flagging Rules', () => {
    it('breaks ties strictly by P_c desc -> I_c desc -> U_c desc -> cluster_id asc', () => {
      const clusters: ReconciledCluster[] = [
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Cluster 2',
          canonical_category: 'Perf',
          problem_summary: 'Lag',
          root_cause_hypothesis: 'Query',
          severity_rating: 3,
          member_feedback_ids: ['FB-01', 'FB-02', 'FB-03'],
          quotes: []
        },
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Cluster 1',
          canonical_category: 'Export',
          problem_summary: 'Timeout',
          root_cause_hypothesis: 'Worker',
          severity_rating: 3,
          member_feedback_ids: ['FB-04', 'FB-05', 'FB-06'],
          quotes: []
        },
        {
          cluster_id: 'CLUST-03',
          cluster_title: 'Cluster 3',
          canonical_category: 'Auth',
          problem_summary: 'SAML error',
          root_cause_hypothesis: 'IdP',
          severity_rating: 2,
          member_feedback_ids: ['FB-07', 'FB-08'],
          quotes: []
        }
      ];

      const rows: ProcessedFeedbackRow[] = [
        // CLUST-02: ACC-1 (3.0), ACC-2 (3.0), ACC-3 (3.0) -> I_c = 9.0, U_c = 3
        { identity: { feedbackId: 'FB-01', accountId: 'ACC-1' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-02', accountId: 'ACC-2' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-03', accountId: 'ACC-3' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        // CLUST-01: ACC-4 (3.0), ACC-5 (3.0), ACC-6 (3.0) -> I_c = 9.0, U_c = 3 (identical P_c, I_c, U_c to CLUST-02)
        { identity: { feedbackId: 'FB-04', accountId: 'ACC-4' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-05', accountId: 'ACC-5' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-06', accountId: 'ACC-6' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        // CLUST-03: ACC-7 (2.0), ACC-8 (2.0) -> I_c = 4.0, U_c = 2
        { identity: { feedbackId: 'FB-07', accountId: 'ACC-7' }, tierResolution: { weight: 2.0, canonicalTier: 'Pro / Mid-Market' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-08', accountId: 'ACC-8' }, tierResolution: { weight: 2.0, canonicalTier: 'Pro / Mid-Market' } } as ProcessedFeedbackRow,
      ];

      const result = scoreAndRankClusters(clusters, rows, { arr: 40, vol: 40, sev: 20 });
      expect(result.scoredClusters).toHaveLength(3);

      // CLUST-01 and CLUST-02 have identical P_c, I_c, U_c. CLUST-01 wins on ID asc!
      expect(result.scoredClusters[0].cluster_id).toBe('CLUST-01');
      expect(result.scoredClusters[0].rank).toBe(1);
      expect(result.scoredClusters[1].cluster_id).toBe('CLUST-02');
      expect(result.scoredClusters[1].rank).toBe(2);
      expect(result.scoredClusters[2].cluster_id).toBe('CLUST-03');
      expect(result.scoredClusters[2].rank).toBe(3);
    });

    it('attaches Critical Blocker badges with Low Frequency suffix when U_c < 3, and Small Sample badge', () => {
      const clusters: ReconciledCluster[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Critical with High Volume',
          canonical_category: 'Crash',
          problem_summary: 'Fatal 500',
          root_cause_hypothesis: 'OOM',
          severity_rating: 3,
          member_feedback_ids: ['FB-01', 'FB-02', 'FB-03', 'FB-04'],
          quotes: []
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Critical with Low Volume',
          canonical_category: 'Corruption',
          problem_summary: 'Data loss',
          root_cause_hypothesis: 'Race condition',
          severity_rating: 3,
          member_feedback_ids: ['FB-05'],
          quotes: []
        },
        {
          cluster_id: 'CLUST-03',
          cluster_title: 'Minor cosmetic',
          canonical_category: 'UI',
          problem_summary: 'Typo',
          root_cause_hypothesis: 'CSS',
          severity_rating: 1,
          member_feedback_ids: ['FB-06', 'FB-07'],
          quotes: []
        }
      ];

      const rows: ProcessedFeedbackRow[] = [
        { identity: { feedbackId: 'FB-01', accountId: 'ACC-1' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-02', accountId: 'ACC-2' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-03', accountId: 'ACC-3' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-04', accountId: 'ACC-4' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-05', accountId: 'ACC-5' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-06', accountId: 'ACC-6' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-07', accountId: 'ACC-7' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,
      ];

      const result = scoreAndRankClusters(clusters, rows, DEFAULT_SLIDER_WEIGHTS);

      const cl1 = result.scoredClusters.find((c) => c.cluster_id === 'CLUST-01')!;
      expect(cl1.flags.isCriticalBlocker).toBe(true);
      expect(cl1.flags.criticalBlockerBadge).toBe('Critical Blocker');
      expect(cl1.flags.isSmallSample).toBe(false);

      const cl2 = result.scoredClusters.find((c) => c.cluster_id === 'CLUST-02')!;
      expect(cl2.flags.isCriticalBlocker).toBe(true);
      expect(cl2.flags.criticalBlockerBadge).toBe('Critical Blocker (Low Frequency)');
      expect(cl2.flags.isSmallSample).toBe(true);
      expect(cl2.flags.smallSampleBadge).toBe('Small Sample Size (Low Confidence)');

      const cl3 = result.scoredClusters.find((c) => c.cluster_id === 'CLUST-03')!;
      expect(cl3.flags.isCriticalBlocker).toBe(false);
      expect(cl3.flags.isSmallSample).toBe(true);
      expect(cl3.flags.smallSampleBadge).toBe('Small Sample Size (Low Confidence)');
    });

    it('excludes CLUST-UNC from normalization maximums and assigns P_c = 0.0 (GAP-11)', () => {
      const clusters: ReconciledCluster[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Main Cluster',
          canonical_category: 'Export',
          problem_summary: 'Timeout',
          root_cause_hypothesis: 'OOM',
          severity_rating: 3,
          member_feedback_ids: ['FB-01', 'FB-02'],
          quotes: []
        },
        {
          cluster_id: 'CLUST-UNC',
          cluster_title: 'Unclustered Feedback',
          canonical_category: 'Unassigned',
          problem_summary: 'Unclustered items',
          root_cause_hypothesis: 'Diverse issues',
          severity_rating: 1,
          member_feedback_ids: ['FB-03', 'FB-04', 'FB-05', 'FB-06', 'FB-07'],
          quotes: [],
          isUnclustered: true
        }
      ];

      const rows: ProcessedFeedbackRow[] = [
        { identity: { feedbackId: 'FB-01', accountId: 'ACC-1' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-02', accountId: 'ACC-2' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-03', accountId: 'ACC-3' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-04', accountId: 'ACC-4' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-05', accountId: 'ACC-5' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-06', accountId: 'ACC-6' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-07', accountId: 'ACC-7' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
      ];

      const result = scoreAndRankClusters(clusters, rows, DEFAULT_SLIDER_WEIGHTS);
      expect(result.scoredClusters).toHaveLength(1); // CLUST-UNC segregated into unclusteredBucket
      expect(result.unclusteredBucket).not.toBeNull();
      expect(result.unclusteredBucket?.cluster_id).toBe('CLUST-UNC');
      expect(result.unclusteredBucket?.priority_score).toBe(0.0);

      // Max values derived exclusively from CLUST-01 (excluding CLUST-UNC)
      expect(result.datasetMetrics.maxImpact).toBe(6.0); // 2 Enterprise accounts
      expect(result.datasetMetrics.maxFrequency).toBe(2);
      expect(result.scoredClusters[0].normalized.I_n).toBe(1.0);
      expect(result.scoredClusters[0].normalized.F_n).toBe(1.0);
    });

    it('triggers dataset warning banner when total rows < 10 (GAP-02)', () => {
      const clusters: ReconciledCluster[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Cluster',
          canonical_category: 'Perf',
          problem_summary: 'Slow',
          root_cause_hypothesis: 'Index',
          severity_rating: 2,
          member_feedback_ids: ['FB-01', 'FB-02', 'FB-03'],
          quotes: []
        }
      ];

      // 3 rows (< 10)
      const rows: ProcessedFeedbackRow[] = [
        { identity: { feedbackId: 'FB-01', accountId: 'ACC-1' }, tierResolution: { weight: 2.0, canonicalTier: 'Pro / Mid-Market' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-02', accountId: 'ACC-2' }, tierResolution: { weight: 2.0, canonicalTier: 'Pro / Mid-Market' } } as ProcessedFeedbackRow,
        { identity: { feedbackId: 'FB-03', accountId: 'ACC-3' }, tierResolution: { weight: 2.0, canonicalTier: 'Pro / Mid-Market' } } as ProcessedFeedbackRow,
      ];

      const result = scoreAndRankClusters(clusters, rows, DEFAULT_SLIDER_WEIGHTS);
      expect(result.warningBanner).toBe('Low Sample Size: Minimum 25 items recommended');

      // 10 rows (>= 10)
      const tenRows = Array.from({ length: 10 }, (_, i) => ({
        identity: { feedbackId: `FB-${i + 1}`, accountId: `ACC-${i + 1}` },
        tierResolution: { weight: 2.0, canonicalTier: 'Pro / Mid-Market' }
      })) as ProcessedFeedbackRow[];

      const normalResult = scoreAndRankClusters(
        [{ ...clusters[0], member_feedback_ids: tenRows.map(r => r.identity.feedbackId) }],
        tenRows,
        DEFAULT_SLIDER_WEIGHTS
      );
      expect(normalResult.warningBanner).toBeNull();
    });

    it('returns a full breakdown object for tooltips with IC-002 compliant impact labels', () => {
      const clusters: ReconciledCluster[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Cluster',
          canonical_category: 'Perf',
          problem_summary: 'Slow',
          root_cause_hypothesis: 'Index',
          severity_rating: 2,
          member_feedback_ids: ['FB-01'],
          quotes: []
        }
      ];

      const rows: ProcessedFeedbackRow[] = [
        { identity: { feedbackId: 'FB-01', accountId: 'ACC-1' }, tierResolution: { weight: 2.0, canonicalTier: 'Pro / Mid-Market' } } as ProcessedFeedbackRow,
      ];

      const result = scoreAndRankClusters(clusters, rows, DEFAULT_SLIDER_WEIGHTS);
      const breakdown = result.scoredClusters[0].breakdown;

      expect(breakdown).toBeDefined();
      expect(breakdown.impactLabel).toBe('Impact Score / Tier-Weighted Impact');
      expect(breakdown.formulaDisplay).toContain('P_c = Round_1(100 * [');
      expect(breakdown.rawWeightedSum).toBeGreaterThan(0);
      expect(breakdown.unroundedScore).toBeGreaterThan(0);
      expect(breakdown.priorityScore).toBe(round1(breakdown.unroundedScore));
    });
  });
});
