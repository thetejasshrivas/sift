/**
 * tests/unit/sliders.test.ts — Calibration Sliders, Reset & 60-FPS Re-ranking (M3-B)
 * Governed by PRD REQ-009, §6.2, §8.3, TS-006; MDD §2.4, §4.3; IC-002, IC-014; GAP-03.
 * Evaluates Gate G-M3B.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  scoreAndRankClusters,
  DEFAULT_SLIDER_WEIGHTS,
  DEFAULT_NORMALIZED_WEIGHTS,
  normalizeSliderWeights,
} from '../../src/scoring';
import { ReconciledCluster } from '../../src/types/ai';
import { ProcessedFeedbackRow } from '../../src/types/identity';
import { SliderWeights } from '../../src/types/scoring';

describe('Calibration Sliders, Reset & 60-FPS Re-ranking (REQ-009 & TS-006)', () => {
  // Test fixture setup with distinct physical profiles
  const testClusters: ReconciledCluster[] = [
    {
      cluster_id: 'CLUST-01',
      cluster_title: 'Enterprise Billing Lag',
      canonical_category: 'Billing',
      problem_summary: 'Enterprise customers reporting payment processing lag',
      root_cause_hypothesis: 'Database lock contention',
      severity_rating: 1, // S_c = 1 (low severity)
      member_feedback_ids: ['FB-001', 'FB-002'], // 2 Enterprise accounts
      quotes: [],
    },
    {
      cluster_id: 'CLUST-02',
      cluster_title: 'Mass UX Navigation Glitch',
      canonical_category: 'Navigation',
      problem_summary: 'Free tier users confused by navigation dropdown',
      root_cause_hypothesis: 'CSS z-index collision',
      severity_rating: 1, // S_c = 1
      member_feedback_ids: ['FB-003', 'FB-004', 'FB-005', 'FB-006', 'FB-007', 'FB-008'], // 6 Free accounts (high volume)
      quotes: [],
    },
    {
      cluster_id: 'CLUST-03',
      cluster_title: 'Data Loss Crash on Export',
      canonical_category: 'Export',
      problem_summary: 'Critical data loss on export timeout',
      root_cause_hypothesis: 'Memory leak in worker',
      severity_rating: 3, // S_c = 3 (Critical Blocker)
      member_feedback_ids: ['FB-009'], // 1 Pro account
      quotes: [],
    },
    {
      cluster_id: 'CLUST-UNC',
      cluster_title: 'Unclustered Feedback',
      canonical_category: 'General',
      problem_summary: 'Unclustered miscellaneous rows',
      root_cause_hypothesis: 'Disparate complaints',
      severity_rating: 1,
      member_feedback_ids: ['FB-010'],
      quotes: [],
      isUnclustered: true,
    },
  ];

  const testRows: ProcessedFeedbackRow[] = [
    // CLUST-01: 2 Enterprise accounts -> I_c = 6.0, U_c = 2
    { identity: { feedbackId: 'FB-001', accountId: 'ACC-ENT-1' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,
    { identity: { feedbackId: 'FB-002', accountId: 'ACC-ENT-2' }, tierResolution: { weight: 3.0, canonicalTier: 'Enterprise' } } as ProcessedFeedbackRow,

    // CLUST-02: 6 Free accounts -> I_c = 6.0, U_c = 6
    { identity: { feedbackId: 'FB-003', accountId: 'ACC-FREE-1' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,
    { identity: { feedbackId: 'FB-004', accountId: 'ACC-FREE-2' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,
    { identity: { feedbackId: 'FB-005', accountId: 'ACC-FREE-3' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,
    { identity: { feedbackId: 'FB-006', accountId: 'ACC-FREE-4' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,
    { identity: { feedbackId: 'FB-007', accountId: 'ACC-FREE-5' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,
    { identity: { feedbackId: 'FB-008', accountId: 'ACC-FREE-6' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,

    // CLUST-03: 1 Pro account -> I_c = 2.0, U_c = 1, S_c = 3
    { identity: { feedbackId: 'FB-009', accountId: 'ACC-PRO-1' }, tierResolution: { weight: 2.0, canonicalTier: 'Pro / Mid-Market' } } as ProcessedFeedbackRow,

    // CLUST-UNC: 1 Free account
    { identity: { feedbackId: 'FB-010', accountId: 'ACC-UNC-1' }, tierResolution: { weight: 1.0, canonicalTier: 'Free / Starter' } } as ProcessedFeedbackRow,
  ];

  describe('TS-006: Live Slider Re-ranking & Stationary Matrix Coordinates Invariant', () => {
    it('re-ranks cards dynamically when Impact (ARR) slider is set to 100% while matrix coordinates (F_n, I_n) remain strictly stationary', () => {
      // 1. Initial baseline scoring (40/40/20)
      const baselineResult = scoreAndRankClusters(testClusters, testRows, DEFAULT_SLIDER_WEIGHTS);
      const baselineClusters = baselineResult.scoredClusters;

      expect(baselineClusters.length).toBe(3);

      // Record baseline coordinates and ranks
      const initialCoords = new Map<string, { x: number; y: number }>();
      for (const c of baselineClusters) {
        initialCoords.set(c.cluster_id, { ...c.coordinates });
      }

      // Max values: maxI = 6.0, maxU = 6
      // CLUST-01: I_n = 6/6 = 1.0, F_n = 2/6 = 0.3333, S_n = 1/3 = 0.3333
      // CLUST-02: I_n = 6/6 = 1.0, F_n = 6/6 = 1.0, S_n = 1/3 = 0.3333
      // CLUST-03: I_n = 2/6 = 0.3333, F_n = 1/6 = 0.1667, S_n = 3/3 = 1.0

      // Under 40/40/20:
      // CLUST-02: 100 * [0.4*1.0 + 0.4*1.0 + 0.2*(1/3)] = 100 * [0.4 + 0.4 + 0.0667] = 86.7 -> Rank 1
      // CLUST-01: 100 * [0.4*1.0 + 0.4*0.3333 + 0.2*(1/3)] = 100 * [0.4 + 0.1333 + 0.0667] = 60.0 -> Rank 2
      // CLUST-03: 100 * [0.4*0.3333 + 0.4*0.1667 + 0.2*1.0] = 100 * [0.1333 + 0.0667 + 0.2] = 40.0 -> Rank 3
      expect(baselineClusters[0].cluster_id).toBe('CLUST-02');
      expect(baselineClusters[0].rank).toBe(1);
      expect(baselineClusters[0].priority_score).toBe(86.7);

      expect(baselineClusters[1].cluster_id).toBe('CLUST-01');
      expect(baselineClusters[1].rank).toBe(2);
      expect(baselineClusters[1].priority_score).toBe(60.0);

      expect(baselineClusters[2].cluster_id).toBe('CLUST-03');
      expect(baselineClusters[2].rank).toBe(3);
      expect(baselineClusters[2].priority_score).toBe(40.0);

      // 2. Set Impact (ARR) slider to 100% (TS-006 action)
      const impactOnlyResult = scoreAndRankClusters(testClusters, testRows, { arr: 100, vol: 0, sev: 0 });
      const impactClusters = impactOnlyResult.scoredClusters;

      // When Impact = 100%, CLUST-01 and CLUST-02 both have I_n = 1.0 (score 100.0)
      // Tie-break: P_c equal -> I_c equal (6.0) -> U_c desc: CLUST-02 has U_c=6 vs CLUST-01 has U_c=2
      expect(impactClusters[0].cluster_id).toBe('CLUST-02');
      expect(impactClusters[0].priority_score).toBe(100.0);
      expect(impactClusters[1].cluster_id).toBe('CLUST-01');
      expect(impactClusters[1].priority_score).toBe(100.0);
      expect(impactClusters[2].cluster_id).toBe('CLUST-03');
      expect(impactClusters[2].priority_score).toBe(33.3);

      // 3. Set Severity slider to 100% (inverts ranking)
      const severityOnlyResult = scoreAndRankClusters(testClusters, testRows, { arr: 0, vol: 0, sev: 100 });
      const severityClusters = severityOnlyResult.scoredClusters;

      // CLUST-03 has S_n = 1.0 (Level 3), so with 100% Severity it leaps to Rank 1!
      expect(severityClusters[0].cluster_id).toBe('CLUST-03');
      expect(severityClusters[0].rank).toBe(1);
      expect(severityClusters[0].priority_score).toBe(100.0);

      // 4. COORDINATE INVARIANCE VERIFICATION (REQ-009 & TS-006):
      // Matrix coordinates (F_n, I_n) MUST remain 100% identical regardless of slider weights
      for (const c of impactClusters) {
        const initial = initialCoords.get(c.cluster_id)!;
        expect(c.coordinates.x).toBe(initial.x);
        expect(c.coordinates.y).toBe(initial.y);
        expect(c.normalized.F_n).toBe(initial.x);
        expect(c.normalized.I_n).toBe(initial.y);
      }

      for (const c of severityClusters) {
        const initial = initialCoords.get(c.cluster_id)!;
        expect(c.coordinates.x).toBe(initial.x);
        expect(c.coordinates.y).toBe(initial.y);
      }
    });

    it('coordinates strictly reflect (F_n, I_n) and never depend on slider weights', () => {
      const weightsA: SliderWeights = { arr: 80, vol: 10, sev: 10 };
      const weightsB: SliderWeights = { arr: 10, vol: 80, sev: 10 };
      const weightsC: SliderWeights = { arr: 0, vol: 0, sev: 100 };

      const resA = scoreAndRankClusters(testClusters, testRows, weightsA);
      const resB = scoreAndRankClusters(testClusters, testRows, weightsB);
      const resC = scoreAndRankClusters(testClusters, testRows, weightsC);

      const findCoord = (res: typeof resA, id: string) =>
        res.scoredClusters.find((c) => c.cluster_id === id)!.coordinates;

      for (const id of ['CLUST-01', 'CLUST-02', 'CLUST-03']) {
        const cA = findCoord(resA, id);
        const cB = findCoord(resB, id);
        const cC = findCoord(resC, id);

        expect(cA.x).toBe(cB.x);
        expect(cA.y).toBe(cB.y);
        expect(cA.x).toBe(cC.x);
        expect(cA.y).toBe(cC.y);
      }
    });
  });

  describe('Slider Weight Normalization & Reset Button (GAP-03)', () => {
    it('normalizes slider weights accurately to percentages summing to 100%', () => {
      const weights: SliderWeights = { arr: 60, vol: 30, sev: 10 };
      const norm = normalizeSliderWeights(weights);

      expect(norm.wArr).toBe(0.60);
      expect(norm.wVol).toBe(0.30);
      expect(norm.wSev).toBe(0.10);
      expect(Math.round(norm.wArr * 100)).toBe(60);
      expect(Math.round(norm.wVol * 100)).toBe(30);
      expect(Math.round(norm.wSev * 100)).toBe(10);
    });

    it('resets to 40/40/20 baseline weights when reset is triggered (GAP-03)', () => {
      // Simulating the Reset button action
      const userEditedWeights: SliderWeights = { arr: 90, vol: 5, sev: 5 };
      expect(userEditedWeights).not.toEqual(DEFAULT_SLIDER_WEIGHTS);

      const resetWeights: SliderWeights = { ...DEFAULT_SLIDER_WEIGHTS };
      expect(resetWeights).toEqual({ arr: 40, vol: 40, sev: 20 });

      const normReset = normalizeSliderWeights(resetWeights);
      expect(normReset).toEqual(DEFAULT_NORMALIZED_WEIGHTS);
      expect(normReset.wArr).toBe(0.40);
      expect(normReset.wVol).toBe(0.40);
      expect(normReset.wSev).toBe(0.20);
    });
  });

  describe('Formula Breakdown Object & Tooltip Compliance (IC-002)', () => {
    it('breakdown object exposes accurate components, formula string, and IC-002 compliant label', () => {
      const result = scoreAndRankClusters(testClusters, testRows, DEFAULT_SLIDER_WEIGHTS);
      const clust1 = result.scoredClusters.find((c) => c.cluster_id === 'CLUST-01')!;

      const { breakdown } = clust1;
      expect(breakdown).toBeDefined();

      // Rule IC-002: Label is strictly 'Impact Score / Tier-Weighted Impact', never ARR or $
      expect(breakdown.impactLabel).toBe('Impact Score / Tier-Weighted Impact');
      expect(breakdown.formulaDisplay).toContain('P_c = Round_1');

      // Unrounded score matches exact mathematical sum
      const expectedSum = 0.4 * clust1.normalized.I_n + 0.4 * clust1.normalized.F_n + 0.2 * clust1.normalized.S_n;
      expect(breakdown.rawWeightedSum).toBeCloseTo(expectedSum, 5);
      expect(breakdown.unroundedScore).toBeCloseTo(100 * expectedSum, 5);
      expect(breakdown.priorityScore).toBe(clust1.priority_score);
    });
  });

  describe('RequestAnimationFrame Batching Logic Harness', () => {
    it('batches consecutive slider changes so only the latest weights execute per frame', () => {
      // Mock requestAnimationFrame and cancelAnimationFrame
      let nextFrameId = 1;
      const callbacks = new Map<number, FrameRequestCallback>();

      const mockRaf = vi.fn((cb: FrameRequestCallback) => {
        const id = nextFrameId++;
        callbacks.set(id, cb);
        return id;
      });

      // Simulation of a component slider drag handler with RAF batching
      let rafId: number | null = null;
      let pendingWeights: SliderWeights = { ...DEFAULT_SLIDER_WEIGHTS };
      const onWeightsChange = vi.fn();

      const handleSliderInput = (newWeights: SliderWeights) => {
        pendingWeights = newWeights;
        if (rafId === null) {
          rafId = mockRaf(() => {
            rafId = null;
            onWeightsChange(pendingWeights);
          });
        }
      };

      // User rapidly drags slider 5 times within one display frame interval
      handleSliderInput({ arr: 45, vol: 40, sev: 20 });
      handleSliderInput({ arr: 50, vol: 40, sev: 20 });
      handleSliderInput({ arr: 55, vol: 40, sev: 20 });
      handleSliderInput({ arr: 60, vol: 40, sev: 20 });
      handleSliderInput({ arr: 70, vol: 40, sev: 20 });

      // Only ONE RAF should have been scheduled despite 5 drag input events
      expect(mockRaf).toHaveBeenCalledTimes(1);
      expect(onWeightsChange).not.toHaveBeenCalled();

      // Flush animation frame (display refresh tick)
      for (const [, cb] of callbacks) {
        cb(performance.now());
      }
      callbacks.clear();

      // onWeightsChange called exactly ONCE with the LATEST batched weights (arr: 70)
      expect(onWeightsChange).toHaveBeenCalledTimes(1);
      expect(onWeightsChange).toHaveBeenCalledWith({ arr: 70, vol: 40, sev: 20 });
    });
  });
});
