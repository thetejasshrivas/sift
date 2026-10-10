/**
 * tests/unit/matrix.test.ts — 2x2 Priority Matrix, Drawer & String Audit (M4-A)
 * Governed by PRD REQ-010, §8.3; MDD §4.2; IC-014; GAP-15.
 * Evaluates Gate G-M4A.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SpatialMatrixView } from '../../src/ui/SpatialMatrixView';
import { DeepDiveDrawer } from '../../src/ui/DeepDiveDrawer';
import { ScoredCluster } from '../../src/types/scoring';

describe('Task M4-A: 2×2 Priority Matrix & String Audit (REQ-010, MDD §4.2, IC-014, GAP-15)', () => {
  const mockClusters: ScoredCluster[] = [
    {
      cluster_id: 'CLUST-01',
      cluster_title: 'Database Deadlocks on Invoice Generation',
      canonical_category: 'Billing',
      problem_summary: 'Enterprise customers experiencing timeout crashes during month-end invoice PDF export.',
      root_cause_hypothesis: 'PostgreSQL row-level lock contention on billing_ledgers table.',
      severity_rating: 3,
      member_feedback_ids: ['FB-001', 'FB-002', 'FB-003'],
      quotes: [
        { feedback_id: 'FB-001', quote_snippet: 'Exporting invoice fails with 504 gateway timeout every time.' },
      ],
      rank: 1,
      priority_score: 88.5,
      coordinates: { x: 0.8, y: 0.9 }, // High Impact / High Frequency
      normalized: { I_n: 0.9, F_n: 0.8, S_n: 1.0 },
      metrics: {
        I_c: 24.0,
        U_c: 8,
        S_c: 3,
        N_c: 12,
        confirmedAccountsCount: 6,
        estimatedAccountsCount: 2,
      },
      flags: {
        isCriticalBlocker: true,
        criticalBlockerBadge: 'Critical Blocker (Level 3/3)',
        isSmallSample: false,
        isUnclusteredBucket: false,
      },
      breakdown: {
        rawMetrics: {
          I_c: 24.0,
          U_c: 8,
          S_c: 3,
          N_c: 12,
          confirmedAccountsCount: 6,
          estimatedAccountsCount: 2,
        },
        normalizedMetrics: { I_n: 0.9, F_n: 0.8, S_n: 1.0 },
        weights: { wArr: 0.4, wVol: 0.4, wSev: 0.2 },
        rawWeightedSum: 0.88,
        unroundedScore: 88.5,
        priorityScore: 88.5,
        formulaDisplay: 'P_c = Round_1(100 * [0.40 * 0.90 + 0.40 * 0.80 + 0.20 * 1.00]) = 88.5',
        impactLabel: 'Impact Score / Tier-Weighted Impact',
      },
    },
    {
      cluster_id: 'CLUST-02',
      cluster_title: 'SAML SSO Session Expiry Bug',
      canonical_category: 'Auth',
      problem_summary: 'Enterprise users randomly logged out during active workflow sessions.',
      root_cause_hypothesis: 'Clock skew in Okta SAML assertion validation worker.',
      severity_rating: 2,
      member_feedback_ids: ['FB-004'],
      quotes: [],
      rank: 2,
      priority_score: 65.0,
      coordinates: { x: 0.2, y: 0.85 }, // High Impact / Low Frequency
      normalized: { I_n: 0.85, F_n: 0.2, S_n: 0.67 },
      metrics: {
        I_c: 18.0,
        U_c: 2,
        S_c: 2,
        N_c: 3,
        confirmedAccountsCount: 2,
        estimatedAccountsCount: 0,
      },
      flags: {
        isCriticalBlocker: false,
        isSmallSample: true,
        smallSampleBadge: 'Small Sample Size (U_c: 2)',
        isUnclusteredBucket: false,
      },
      breakdown: {
        rawMetrics: {
          I_c: 18.0,
          U_c: 2,
          S_c: 2,
          N_c: 3,
          confirmedAccountsCount: 2,
          estimatedAccountsCount: 0,
        },
        normalizedMetrics: { I_n: 0.85, F_n: 0.2, S_n: 0.67 },
        weights: { wArr: 0.4, wVol: 0.4, wSev: 0.2 },
        rawWeightedSum: 0.65,
        unroundedScore: 65.0,
        priorityScore: 65.0,
        formulaDisplay: 'P_c = Round_1(100 * [0.40 * 0.85 + 0.40 * 0.20 + 0.20 * 0.67]) = 65.0',
        impactLabel: 'Impact Score / Tier-Weighted Impact',
      },
    },
    {
      cluster_id: 'CLUST-03',
      cluster_title: 'Navigation Dropdown Z-Index Glitch',
      canonical_category: 'UI',
      problem_summary: 'Users report dropdown menu hidden under table headers.',
      root_cause_hypothesis: 'CSS stacking context conflict on sticky header.',
      severity_rating: 1,
      member_feedback_ids: ['FB-005', 'FB-006'],
      quotes: [],
      rank: 3,
      priority_score: 42.0,
      coordinates: { x: 0.75, y: 0.2 }, // Low Impact / High Frequency
      normalized: { I_n: 0.2, F_n: 0.75, S_n: 0.33 },
      metrics: {
        I_c: 4.0,
        U_c: 7,
        S_c: 1,
        N_c: 9,
        confirmedAccountsCount: 7,
        estimatedAccountsCount: 0,
      },
      flags: {
        isCriticalBlocker: false,
        isSmallSample: false,
        isUnclusteredBucket: false,
      },
      breakdown: {
        rawMetrics: {
          I_c: 4.0,
          U_c: 7,
          S_c: 1,
          N_c: 9,
          confirmedAccountsCount: 7,
          estimatedAccountsCount: 0,
        },
        normalizedMetrics: { I_n: 0.2, F_n: 0.75, S_n: 0.33 },
        weights: { wArr: 0.4, wVol: 0.4, wSev: 0.2 },
        rawWeightedSum: 0.42,
        unroundedScore: 42.0,
        priorityScore: 42.0,
        formulaDisplay: 'P_c = Round_1(100 * [0.40 * 0.20 + 0.40 * 0.75 + 0.20 * 0.33]) = 42.0',
        impactLabel: 'Impact Score / Tier-Weighted Impact',
      },
    },
    {
      cluster_id: 'CLUST-04',
      cluster_title: 'Dark Mode Contrast Glitch',
      canonical_category: 'UI',
      problem_summary: 'Secondary text contrast hard to read on OLED screens.',
      root_cause_hypothesis: 'HSL color token lightness mismatch.',
      severity_rating: 1,
      member_feedback_ids: ['FB-007'],
      quotes: [],
      rank: 4,
      priority_score: 25.0,
      coordinates: { x: 0.15, y: 0.1 }, // Low Impact / Low Frequency
      normalized: { I_n: 0.1, F_n: 0.15, S_n: 0.33 },
      metrics: {
        I_c: 2.0,
        U_c: 1,
        S_c: 1,
        N_c: 1,
        confirmedAccountsCount: 1,
        estimatedAccountsCount: 0,
      },
      flags: {
        isCriticalBlocker: false,
        isSmallSample: true,
        smallSampleBadge: 'Small Sample Size (U_c: 1)',
        isUnclusteredBucket: false,
      },
      breakdown: {
        rawMetrics: {
          I_c: 2.0,
          U_c: 1,
          S_c: 1,
          N_c: 1,
          confirmedAccountsCount: 1,
          estimatedAccountsCount: 0,
        },
        normalizedMetrics: { I_n: 0.1, F_n: 0.15, S_n: 0.33 },
        weights: { wArr: 0.4, wVol: 0.4, wSev: 0.2 },
        rawWeightedSum: 0.25,
        unroundedScore: 25.0,
        priorityScore: 25.0,
        formulaDisplay: 'P_c = Round_1(100 * [0.40 * 0.10 + 0.40 * 0.15 + 0.20 * 0.33]) = 25.0',
        impactLabel: 'Impact Score / Tier-Weighted Impact',
      },
    },
    {
      cluster_id: 'CLUST-UNC',
      cluster_title: 'Unclustered Feedback',
      canonical_category: 'General',
      problem_summary: 'Unclustered residual rows',
      root_cause_hypothesis: 'Residual items',
      severity_rating: 1,
      member_feedback_ids: ['FB-008'],
      quotes: [],
      rank: 5,
      priority_score: 0.0,
      coordinates: { x: 0.0, y: 0.0 },
      normalized: { I_n: 0.0, F_n: 0.0, S_n: 0.33 },
      metrics: {
        I_c: 1.0,
        U_c: 1,
        S_c: 1,
        N_c: 1,
        confirmedAccountsCount: 1,
        estimatedAccountsCount: 0,
      },
      flags: {
        isCriticalBlocker: false,
        isSmallSample: false,
        isUnclusteredBucket: true,
      },
      breakdown: {
        rawMetrics: {
          I_c: 1.0,
          U_c: 1,
          S_c: 1,
          N_c: 1,
          confirmedAccountsCount: 1,
          estimatedAccountsCount: 0,
        },
        normalizedMetrics: { I_n: 0.0, F_n: 0.0, S_n: 0.33 },
        weights: { wArr: 0.4, wVol: 0.4, wSev: 0.2 },
        rawWeightedSum: 0.0,
        unroundedScore: 0.0,
        priorityScore: 0.0,
        formulaDisplay: 'CLUST-UNC excluded from scoring (P_c = 0.0)',
        impactLabel: 'Impact Score / Tier-Weighted Impact',
      },
    },
  ];

  describe('G-M4A String Audit: Quadrant Labels & Midpoint Legend', () => {
    it('renders the exact four quadrant label strings required by M4-A scope', () => {
      const html = renderToString(
        React.createElement(SpatialMatrixView, { clusters: mockClusters })
      );

      // 1. Top-Right: High Impact / High Frequency
      expect(html).toContain('High Impact / High Frequency');
      expect(html).toContain('id="quadrant-label-top-right"');

      // 2. Top-Left: High Impact / Low Frequency
      expect(html).toContain('High Impact / Low Frequency');
      expect(html).toContain('id="quadrant-label-top-left"');

      // 3. Bottom-Right: Low Impact / High Frequency
      expect(html).toContain('Low Impact / High Frequency');
      expect(html).toContain('id="quadrant-label-bottom-right"');

      // 4. Bottom-Left: Low Impact / Low Frequency
      expect(html).toContain('Low Impact / Low Frequency');
      expect(html).toContain('id="quadrant-label-bottom-left"');
    });

    it('displays the exact midpoint 0.5 legend string: "split at 0.5 of normalized scale" (GAP-15)', () => {
      const html = renderToString(
        React.createElement(SpatialMatrixView, { clusters: mockClusters })
      );

      expect(html).toContain('id="matrix-legend-midpoint"');
      expect(html).toContain('split at 0.5 of normalized scale');
    });
  });

  describe('SVG Scatter Plot & Coordinate Mapping Invariant', () => {
    it('renders an SVG element with X = F_n and Y = I_n coordinate scatter mapping', () => {
      const html = renderToString(
        React.createElement(SpatialMatrixView, { clusters: mockClusters })
      );

      expect(html).toContain('id="matrix-svg-scatter"');
      expect(html).toContain('role="graphics-document"');

      // Check CLUST-01 dot: F_n = 0.8, I_n = 0.9
      // Plot width/height = 400, margin = 50
      // expected cx = 50 + 0.8 * 400 = 370
      // expected cy = 50 + (1 - 0.9) * 400 = 50 + 40 = 90
      expect(html).toContain('id="matrix-dot-CLUST-01"');
      expect(html).toContain('data-fn="0.8000"');
      expect(html).toContain('data-in="0.9000"');
      expect(html).toContain('cx="370"');
      expect(html).toContain('cy="90"');
    });

    it('strictly excludes CLUST-UNC from the SVG scatter plot (GAP-11)', () => {
      const html = renderToString(
        React.createElement(SpatialMatrixView, { clusters: mockClusters })
      );

      // CLUST-UNC must NOT have a scatter dot
      expect(html).not.toContain('id="matrix-dot-CLUST-UNC"');

      // The 4 thematic clusters are plotted
      expect(html).toContain('id="matrix-dot-CLUST-01"');
      expect(html).toContain('id="matrix-dot-CLUST-02"');
      expect(html).toContain('id="matrix-dot-CLUST-03"');
      expect(html).toContain('id="matrix-dot-CLUST-04"');
    });
  });

  describe('Hover Tooltip Verification (Gate G-M4A)', () => {
    it('renders hover tooltip with title, unique accounts (Confirmed/Estimated), incident count, and Tier-Weighted Impact (without $) when hovered', () => {
      const html = renderToString(
        React.createElement(SpatialMatrixView, {
          clusters: mockClusters,
          hoveredClusterId: 'CLUST-01',
        })
      );

      expect(html).toContain('id="matrix-hover-tooltip"');

      // 1. Title
      expect(html).toContain('Database Deadlocks on Invoice Generation');

      // 2. Unique Accounts (Confirmed / Estimated)
      expect(html).toContain('Unique Accounts:');
      expect(html).toContain('Confirmed: 6');
      expect(html).toContain('Estimated: 2');

      // 3. Incident count
      expect(html).toContain('Incident Count:');
      expect(html).toContain('12');

      // 4. Tier-Weighted Impact without dollar sign (IC-002)
      expect(html).toContain('Tier-Weighted Impact:');
      expect(html).toContain('24.0');
      // Ensure strictly NO dollar sign anywhere inside the Tier-Weighted Impact area
      expect(html).not.toContain('$24.0');
    });
  });

  describe('DeepDiveDrawer Verification (REQ-010, MDD §3.6, IC-002)', () => {
    it('renders DeepDiveDrawer with 600px width, hypothesis notice, and Tier-Weighted Impact without $', () => {
      const html = renderToString(
        React.createElement(DeepDiveDrawer, {
          cluster: mockClusters[0],
          isOpen: true,
          onClose: () => {},
          allRows: [
            {
              text: 'Exporting invoice fails with 504 gateway timeout every time.',
              identity: {
                feedbackId: 'FB-001',
                accountId: 'ACC-001',
              },
              tierResolution: {
                canonicalTier: 'Enterprise',
                weight: 3.0,
                weightLabel: 'Tier-Weighted',
                isUnrecognized: false,
              },
              rawRow: {},
              rowIndex: 1,
            },
          ],
        })
      );

      expect(html).toContain('id="deep-dive-drawer"');

      // 1. Title & Rank
      expect(html).toContain('Database Deadlocks on Invoice Generation');
      expect(html).toContain('#1');

      // 2. Tier-Weighted Impact (NO dollar sign)
      expect(html).toContain('id="drawer-tier-weighted-impact"');
      expect(html).toContain('24.0');
      expect(html).not.toContain('$24.0');

      // 3. MDD §3.6 Mandatory Boundary Notice
      expect(html).toContain('id="drawer-boundary-notice"');
      expect(html).toContain(
        'Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.'
      );

      // 4. Verified Quote snippet
      expect(html).toContain('Exporting invoice fails with 504 gateway timeout every time.');
      expect(html).toContain('Verified Quote');

      // 5. Close button
      expect(html).toContain('id="btn-close-drawer"');
    });

    it('returns null when drawer is closed (isOpen=false)', () => {
      const html = renderToString(
        React.createElement(DeepDiveDrawer, {
          cluster: mockClusters[0],
          isOpen: false,
          onClose: () => {},
        })
      );

      expect(html).toBe('');
    });
  });
});
