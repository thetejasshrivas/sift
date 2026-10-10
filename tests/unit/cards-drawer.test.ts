/**
 * tests/unit/cards-drawer.test.ts — Ranked Cards, Badges, Filters & Deep-Dive Drawer (M4-B)
 * Governed by PRD REQ-010, REQ-011, REQ-012, §8.2–8.4; MDD §2.4, §2.7, §3.6; GAP-02, GAP-04, GAP-15; IC-001, IC-002, IC-013.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RankedCardList } from '../../src/ui/RankedCardList';
import { DeepDiveDrawer } from '../../src/ui/DeepDiveDrawer';
import { ScoredCluster } from '../../src/types/scoring';
import { scoreAndRankClusters, DEFAULT_SLIDER_WEIGHTS } from '../../src/scoring';
import { ProcessedFeedbackRow } from '../../src/types/identity';

describe('Task M4-B: Ranked Cards, Badges, Filters & Deep-Dive Drawer (REQ-010, REQ-011, REQ-012)', () => {
  const mockClusters: ScoredCluster[] = [
    {
      cluster_id: 'CLUST-01',
      cluster_title: 'Silent API Timeout during CSV Export',
      canonical_category: 'Export',
      problem_summary: 'Large exports (>10,000 rows) fail silently with HTTP 504 Gateway Timeout.',
      root_cause_hypothesis: 'Unpaginated SQL query execution in worker thread leads to gateway timeout.',
      severity_rating: 3,
      member_feedback_ids: ['FB-001', 'FB-002'],
      quotes: [
        { feedback_id: 'FB-001', quote_snippet: 'Exporting invoice fails with 504 gateway timeout every time.' },
      ],
      rank: 1,
      priority_score: 85.5,
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
        criticalBlockerBadge: 'Critical Blocker',
        isSmallSample: false,
        isUnclusteredBucket: false,
        isFrequencyEstimated: true,
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
        unroundedScore: 85.5,
        priorityScore: 85.5,
        formulaDisplay: 'P_c = Round_1(100 * [0.40 * 0.90 + 0.40 * 0.80 + 0.20 * 1.00]) = 85.5',
        impactLabel: 'Impact Score / Tier-Weighted Impact',
      },
    },
    {
      cluster_id: 'CLUST-02',
      cluster_title: 'SAML SSO Configuration Failure',
      canonical_category: 'Auth',
      problem_summary: 'Enterprise customers unable to complete initial Okta SAML connection.',
      root_cause_hypothesis: 'Clock skew tolerance mismatch on SAML assertion timestamp verification.',
      severity_rating: 3,
      member_feedback_ids: ['FB-003'],
      quotes: [
        { feedback_id: 'FB-003', quote_snippet: 'SAML login fails repeatedly for our team' },
      ],
      rank: 2,
      priority_score: 62.0,
      coordinates: { x: 0.2, y: 0.75 }, // High Impact / Low Frequency
      normalized: { I_n: 0.75, F_n: 0.2, S_n: 1.0 },
      metrics: {
        I_c: 12.0,
        U_c: 2,
        S_c: 3,
        N_c: 2,
        confirmedAccountsCount: 2,
        estimatedAccountsCount: 0,
      },
      flags: {
        isCriticalBlocker: true,
        criticalBlockerBadge: 'Critical Blocker (Low Frequency)',
        isSmallSample: true,
        smallSampleBadge: 'Small Sample Size (Low Confidence)',
        isUnclusteredBucket: false,
        isUncertain: true,
      },
      breakdown: {
        rawMetrics: {
          I_c: 12.0,
          U_c: 2,
          S_c: 3,
          N_c: 2,
          confirmedAccountsCount: 2,
          estimatedAccountsCount: 0,
        },
        normalizedMetrics: { I_n: 0.75, F_n: 0.2, S_n: 1.0 },
        weights: { wArr: 0.4, wVol: 0.4, wSev: 0.2 },
        rawWeightedSum: 0.62,
        unroundedScore: 62.0,
        priorityScore: 62.0,
        formulaDisplay: 'P_c = Round_1(100 * [0.40 * 0.75 + 0.40 * 0.20 + 0.20 * 1.00]) = 62.0',
        impactLabel: 'Impact Score / Tier-Weighted Impact',
      },
    },
    {
      cluster_id: 'CLUST-03',
      cluster_title: 'Dark Mode Alignment Inconsistencies',
      canonical_category: 'UI Alignment',
      problem_summary: 'Navigation dropdown text is hard to read in dark mode.',
      root_cause_hypothesis: 'CSS specificity conflict between dark theme variables and legacy layout classes.',
      severity_rating: 1,
      member_feedback_ids: ['FB-004', 'FB-005', 'FB-006'],
      quotes: [],
      rank: 3,
      priority_score: 45.0,
      coordinates: { x: 0.65, y: 0.3 }, // Low Impact / High Frequency
      normalized: { I_n: 0.3, F_n: 0.65, S_n: 0.33 },
      metrics: {
        I_c: 6.0,
        U_c: 6,
        S_c: 1,
        N_c: 8,
        confirmedAccountsCount: 6,
        estimatedAccountsCount: 0,
      },
      flags: {
        isCriticalBlocker: false,
        isSmallSample: false,
        isUnclusteredBucket: false,
      },
      breakdown: {
        rawMetrics: {
          I_c: 6.0,
          U_c: 6,
          S_c: 1,
          N_c: 8,
          confirmedAccountsCount: 6,
          estimatedAccountsCount: 0,
        },
        normalizedMetrics: { I_n: 0.3, F_n: 0.65, S_n: 0.33 },
        weights: { wArr: 0.4, wVol: 0.4, wSev: 0.2 },
        rawWeightedSum: 0.45,
        unroundedScore: 45.0,
        priorityScore: 45.0,
        formulaDisplay: 'P_c = Round_1(100 * [0.40 * 0.30 + 0.40 * 0.65 + 0.20 * 0.33]) = 45.0',
        impactLabel: 'Impact Score / Tier-Weighted Impact',
      },
    },
  ];

  describe('RankedCardList Badges & Metrics (REQ-010, MDD §2.4, GAP-15, IC-002)', () => {
    it('renders all required badges with exact strings and conditions', () => {
      const html = renderToString(
        React.createElement(RankedCardList, {
          clusters: mockClusters,
          isAccountIdsUnmapped: true,
        })
      );

      // 1. Gold: High Tier-Weighted Impact (I_n >= 0.5)
      expect(html).toContain('High Tier-Weighted Impact');
      expect(html).toContain('badge-high-impact-CLUST-01');

      // 2. Blue: High Volume (F_n >= 0.5)
      expect(html).toContain('High Volume');
      expect(html).toContain('badge-high-volume-CLUST-01');

      // 3. Red: Critical Blocker (with suffix '(Low Frequency)' when U_c < 3)
      expect(html).toContain('Critical Blocker');
      expect(html).toContain('badge-critical-blocker-CLUST-01');
      expect(html).toContain('Critical Blocker (Low Frequency)');
      expect(html).toContain('badge-critical-blocker-CLUST-02');

      // 4. Gray: Small Sample (Low Confidence) when U_c < 3
      expect(html).toContain('Small Sample (Low Confidence)');
      expect(html).toContain('badge-small-sample-CLUST-02');

      // 5. Amber: Uncertain Cluster — Review Recommended
      expect(html).toContain('Uncertain Cluster — Review Recommended');
      expect(html).toContain('badge-uncertain-CLUST-02');

      // 6. Indigo: Account IDs Unmapped — Frequency Estimated
      expect(html).toContain('Account IDs Unmapped — Frequency Estimated');
      expect(html).toContain('badge-estimated-freq-CLUST-01');

      // 7. Tier-Weighted Impact rendered strictly without $ sign (IC-002)
      expect(html).toContain('Tier-Weighted Impact:');
      expect(html).toContain('24.0');
      expect(html).not.toContain('$24.0');
      expect(html).not.toContain('$12.0');
    });

    it('renders search input and badge toggle filter buttons (GAP-04)', () => {
      const html = renderToString(
        React.createElement(RankedCardList, { clusters: mockClusters })
      );

      expect(html).toContain('id="input-card-search"');
      expect(html).toContain('id="badge-toggle-filters"');
      expect(html).toContain('id="filter-btn-all"');
      expect(html).toContain('id="filter-btn-high-impact"');
      expect(html).toContain('id="filter-btn-high-volume"');
      expect(html).toContain('id="filter-btn-critical-blocker"');
      expect(html).toContain('id="filter-btn-small-sample"');
      expect(html).toContain('id="filter-btn-uncertain"');
    });

    it('includes aria-live polite screen-reader announcer for score/filter updates', () => {
      const html = renderToString(
        React.createElement(RankedCardList, { clusters: mockClusters })
      );

      expect(html).toContain('id="cards-live-announcer"');
      expect(html).toContain('aria-live="polite"');
    });
  });

  describe('DeepDiveDrawer Specifications (REQ-010, REQ-011, REQ-012, IC-001, IC-013)', () => {
    const mockRows: ProcessedFeedbackRow[] = [
      {
        rowIndex: 1,
        rawRow: { 'Feedback ID': 'FB-001', 'Feedback': 'Exporting invoice fails with 504 gateway timeout every time.' },
        text: 'Exporting invoice fails with 504 gateway timeout every time.',
        tierResolution: {
          canonicalTier: 'Enterprise',
          weight: 3.0,
          weightLabel: 'Tier-Weighted',
          isUnrecognized: false,
        },
        identity: {
          feedbackId: 'FB-001',
          accountId: 'ACC-001',
        },
      },
    ];

    it('renders observation, verbatim quote verification badge, hypothesis, breakdown, and action buttons', () => {
      const html = renderToString(
        React.createElement(DeepDiveDrawer, {
          cluster: mockClusters[0],
          isOpen: true,
          onClose: () => {},
          allRows: mockRows,
        })
      );

      // 1. Observation
      expect(html).toContain('id="drawer-observation-heading"');
      expect(html).toContain('Observation');
      expect(html).toContain('Large exports (&gt;10,000 rows) fail silently with HTTP 504 Gateway Timeout.');

      // 2. Quotes with Exact Substring Verification Badge (IC-001 / REQ-011)
      expect(html).toContain('id="drawer-quotes-section"');
      expect(html).toContain('Exporting invoice fails with 504 gateway timeout every time.');
      expect(html).toContain('✓ Verified Quote');

      // 3. Root-Cause Hypothesis with Mandatory Boundary Notice (MDD §3.6)
      expect(html).toContain('Root-Cause Hypothesis');
      expect(html).toContain('id="drawer-boundary-notice"');
      expect(html).toContain(
        'Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.'
      );

      // 4. Mathematical Score Breakdown
      expect(html).toContain('id="drawer-score-breakdown"');
      expect(html).toContain('id="drawer-formula-display"');
      expect(html).toContain('Impact Weight (W_ARR):');
      expect(html).toContain('Frequency Weight (W_Vol):');
      expect(html).toContain('Severity Weight (W_Sev):');

      // 5. Action Buttons (PM & Eng Only in P0 per IC-013)
      expect(html).toContain('id="btn-copy-strategic-rationale"');
      expect(html).toContain('Copy Strategic Rationale');
      expect(html).toContain('id="btn-copy-engineering-spec"');
      expect(html).toContain('Copy Engineering Spec');

      // Strictly NO CS Advisory in P0 (IC-013)
      expect(html).not.toContain('btn-copy-cs-advisory');
      expect(html).not.toContain('Generate CS Advisory');

      // 6. Accessibility & ARIA Dialog Attributes
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('id="drawer-live-announcer"');
      expect(html).toContain('aria-live="polite"');
    });

    it('returns null when drawer is closed', () => {
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

  describe('Tie-Break Ordering Invariant (PRD §6.5, MDD §3.5)', () => {
    it('sorts clusters by P_c desc -> I_c desc -> U_c desc -> cluster_id asc', () => {
      const rows: ProcessedFeedbackRow[] = [
        {
          rowIndex: 1,
          rawRow: {},
          text: 'test 1',
          tierResolution: {
            canonicalTier: 'Pro / Mid-Market',
            weight: 2.0,
            weightLabel: 'Tier-Weighted',
            isUnrecognized: false,
          },
          identity: { feedbackId: 'FB-1', accountId: 'A-1' },
        },
        {
          rowIndex: 2,
          rawRow: {},
          text: 'test 2',
          tierResolution: {
            canonicalTier: 'Pro / Mid-Market',
            weight: 2.0,
            weightLabel: 'Tier-Weighted',
            isUnrecognized: false,
          },
          identity: { feedbackId: 'FB-2', accountId: 'A-2' },
        },
      ];

      // Two clusters with equal P_c
      const clusters = [
        {
          cluster_id: 'CLUST-B',
          cluster_title: 'Cluster B',
          canonical_category: 'Cat',
          problem_summary: 'Problem B',
          root_cause_hypothesis: 'Hypothesis B',
          severity_rating: 2,
          member_feedback_ids: ['FB-1'],
          quotes: [],
        },
        {
          cluster_id: 'CLUST-A',
          cluster_title: 'Cluster A',
          canonical_category: 'Cat',
          problem_summary: 'Problem A',
          root_cause_hypothesis: 'Hypothesis A',
          severity_rating: 2,
          member_feedback_ids: ['FB-2'],
          quotes: [],
        },
      ];

      const scored = scoreAndRankClusters(clusters, rows, DEFAULT_SLIDER_WEIGHTS);
      // Equal scores and equal metrics -> tie-break by cluster_id asc (CLUST-A before CLUST-B)
      expect(scored.scoredClusters[0].cluster_id).toBe('CLUST-A');
      expect(scored.scoredClusters[1].cluster_id).toBe('CLUST-B');
      expect(scored.scoredClusters[0].rank).toBe(1);
      expect(scored.scoredClusters[1].rank).toBe(2);
    });
  });
});
