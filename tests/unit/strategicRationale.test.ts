/**
 * tests/unit/strategicRationale.test.ts
 * Unit Test Suite for Task M5-A: Strategic Trade-off Rationale Generator (PM)
 * Governed by PRD REQ-012, §7.4; MDD §3.7, §3.9; IC-001, IC-002; GAP-07, GAP-17; Gate G-M5A.
 */

import { describe, it, expect } from 'vitest';
import {
  generateStrategicTradeoffRationale,
  calculateSegmentBreakdown,
  getRuleBasedRecommendation,
} from '../../src/outputs/strategicRationale';
import { ScoredCluster } from '../../src/types/scoring';
import { ProcessedFeedbackRow } from '../../src/types/identity';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DeepDiveDrawer } from '../../src/ui/DeepDiveDrawer';

describe('Task M5-A: Strategic Trade-off Rationale Generator (REQ-012, Gate G-M5A)', () => {
  const mockCluster: ScoredCluster = {
    cluster_id: 'CLUST-01',
    cluster_title: 'Bulk CSV Export Timeout and Failure',
    canonical_category: 'Export & Reporting',
    problem_summary:
      'Bulk CSV exports fail silently or trigger HTTP 504 gateway timeouts when table exceeds 10,000 rows.',
    root_cause_hypothesis:
      'Worker thread memory exhaustion when serializing large in-memory result sets.',
    severity_rating: 3,
    member_feedback_ids: ['FB-001', 'FB-002', 'FB-003', 'FB-004'],
    quotes: [
      {
        feedback_id: 'FB-001',
        quote_snippet: 'Export button hangs indefinitely on large datasets over 10k rows',
      },
      {
        feedback_id: 'FB-002',
        quote_snippet: 'Paraphrased quote that does not match verbatim row text',
      },
      {
        feedback_id: 'FB-003',
        quote_snippet: 'CSV download fails with 504 error',
      },
      {
        feedback_id: 'FB-999',
        quote_snippet: 'Source row does not exist in dataset',
      },
    ],
    priority_score: 84.5,
    rank: 1,
    metrics: {
      I_c: 18.0,
      U_c: 4,
      S_c: 3,
      N_c: 4,
      confirmedAccountsCount: 3,
      estimatedAccountsCount: 1,
    },
    normalized: {
      I_n: 0.8182,
      F_n: 0.7500,
      S_n: 1.0,
    },
    breakdown: {
      rawMetrics: {
        I_c: 18.0,
        U_c: 4,
        S_c: 3,
        N_c: 4,
        confirmedAccountsCount: 3,
        estimatedAccountsCount: 1,
      },
      normalizedMetrics: {
        I_n: 0.8182,
        F_n: 0.7500,
        S_n: 1.0,
      },
      weights: {
        wArr: 0.4,
        wVol: 0.4,
        wSev: 0.2,
      },
      rawWeightedSum: 0.8473,
      unroundedScore: 84.73,
      priorityScore: 84.5,
      formulaDisplay: '100 * [ 0.40 * 0.8182 + 0.40 * 0.7500 + 0.20 * 1.0000 ] = 84.5',
      impactLabel: 'Impact Score / Tier-Weighted Impact',
    },
    flags: {
      isCriticalBlocker: true,
      criticalBlockerBadge: 'Critical Blocker',
      isSmallSample: false,
      isUnclusteredBucket: false,
    },
    coordinates: {
      x: 0.7500,
      y: 0.8182,
    },
  };

  const mockRows: ProcessedFeedbackRow[] = [
    {
      rowIndex: 1,
      rawRow: {},
      text: 'Export button hangs indefinitely on large datasets over 10k rows and crashes Chrome.',
      identity: {
        feedbackId: 'FB-001',
        accountId: 'ACC-ENT-1',
      },
      tierResolution: {
        canonicalTier: 'Enterprise',
        weight: 3.0,
        weightLabel: 'Tier-Weighted',
        isUnrecognized: false,
      },
    },
    {
      rowIndex: 2,
      rawRow: {},
      text: 'Completely different text from what the AI summarized.',
      identity: {
        feedbackId: 'FB-002',
        accountId: 'ACC-PRO-1',
      },
      tierResolution: {
        canonicalTier: 'Pro / Mid-Market',
        weight: 2.0,
        weightLabel: 'Tier-Weighted',
        isUnrecognized: false,
      },
    },
    {
      rowIndex: 3,
      rawRow: {},
      text: 'CSV download fails with 504 error during peak hours.',
      identity: {
        feedbackId: 'FB-003',
        accountId: 'ACC-FREE-1',
      },
      tierResolution: {
        canonicalTier: 'Free / Starter',
        weight: 1.0,
        weightLabel: 'Tier-Weighted',
        isUnrecognized: false,
      },
    },
    {
      rowIndex: 4,
      rawRow: {},
      text: 'Export stopped working after last Tuesday update.',
      identity: {
        feedbackId: 'FB-004',
        accountId: null, // Estimated account (no Account ID)
      },
      tierResolution: {
        canonicalTier: 'UNKNOWN',
        weight: 1.0,
        weightLabel: 'Tier-Weighted',
        isUnrecognized: true,
      },
    },
  ];

  describe('Section 1: Header Template & Affected Accounts (§7.4)', () => {
    it('generates the exact markdown title and subtitle with Priority Score, Severity, and Affected Accounts', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      expect(md).toContain('# Strategic Trade-off Rationale: Bulk CSV Export Timeout and Failure');
      expect(md).toContain('**Priority Score:** 84.5/100');
      expect(md).toContain('**Severity:** Level 3');
      expect(md).toContain('**Affected Accounts:** 4 (Confirmed: 3, Estimated: 1)');
    });

    it('handles clusters where all accounts are confirmed (0 estimated)', () => {
      const clusterConfirmedOnly: ScoredCluster = {
        ...mockCluster,
        metrics: {
          ...mockCluster.metrics,
          confirmedAccountsCount: 4,
          estimatedAccountsCount: 0,
        },
      };

      const md = generateStrategicTradeoffRationale(clusterConfirmedOnly, mockRows);
      expect(md).toContain('**Affected Accounts:** 4 (Confirmed: 4, Estimated: 0)');
    });
  });

  describe('Section 2: Executive Summary (REQ-012)', () => {
    it('renders ## 1. Executive Summary with the AI problem_summary text', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      expect(md).toContain('## 1. Executive Summary');
      expect(md).toContain(
        'Bulk CSV exports fail silently or trigger HTTP 504 gateway timeouts when table exceeds 10,000 rows.'
      );
    });
  });

  describe('Section 3: Business Impact, Proxy Labels & Strict Non-$ Audit (IC-002, §7.4)', () => {
    it('renders ## 2. Business Impact with Impact Score (I_n) and Raw Tier Weight (I_c)', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      expect(md).toContain('## 2. Business Impact');
      expect(md).toContain('- **Impact Score (I_n):** 0.8182 (Raw Tier Weight: 18.0)');
    });

    it('renders Frequency Score (F_n) with total incidents N_c', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      expect(md).toContain('- **Frequency Score (F_n):** 0.7500 (Total Incidents: 4)');
    });

    it('strictly avoids "$" and "ARR" currency labels next to proxy weights (IC-002)', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      // Verify no dollar signs anywhere in the generated deliverable
      expect(md).not.toContain('$');
      // Verify no 'ARR' label in Section 2
      const section2 = md.split('## 2. Business Impact')[1].split('## 3. Verbatim Customer Evidence')[0];
      expect(section2).not.toMatch(/\bARR\b/);
      expect(section2).not.toContain('revenue');
    });
  });

  describe('Section 4: Account Segment Breakdown Counts & GAP-12 Logic', () => {
    it('correctly calculates breakdown counts across Enterprise, Mid-Market, Free/Starter, and UNKNOWN', () => {
      const breakdown = calculateSegmentBreakdown(mockCluster, mockRows);

      expect(breakdown.Enterprise).toBe(1);
      expect(breakdown.MidMarket).toBe(1);
      expect(breakdown.FreeStarter).toBe(1);
      expect(breakdown.UNKNOWN).toBe(1);
      expect(breakdown.Enterprise + breakdown.MidMarket + breakdown.FreeStarter + breakdown.UNKNOWN).toBe(4);
    });

    it('renders the Account Segment Breakdown line in markdown', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      expect(md).toContain(
        '- **Account Segment Breakdown:** Enterprise: 1, Mid-Market: 1, Free/Starter: 1, UNKNOWN: 1'
      );
    });

    it('resolves account tier conflict using highest weight among rows for confirmed accounts (GAP-12)', () => {
      const rowsWithConflict: ProcessedFeedbackRow[] = [
        {
          rowIndex: 1,
          rawRow: {},
          text: 'Ticket 1 from Free user in company ACC-MULTI',
          identity: { feedbackId: 'FB-010', accountId: 'ACC-MULTI' },
          tierResolution: { canonicalTier: 'Free / Starter', weight: 1.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
        },
        {
          rowIndex: 2,
          rawRow: {},
          text: 'Ticket 2 from Enterprise admin in company ACC-MULTI',
          identity: { feedbackId: 'FB-011', accountId: 'ACC-MULTI' },
          tierResolution: { canonicalTier: 'Enterprise', weight: 3.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
        },
      ];

      const clusterMulti: ScoredCluster = {
        ...mockCluster,
        member_feedback_ids: ['FB-010', 'FB-011'],
        metrics: { ...mockCluster.metrics, U_c: 1, confirmedAccountsCount: 1, estimatedAccountsCount: 0 },
      };

      const breakdown = calculateSegmentBreakdown(clusterMulti, rowsWithConflict);
      expect(breakdown.Enterprise).toBe(1); // Enterprise (3.0) wins over Free (1.0)
      expect(breakdown.FreeStarter).toBe(0);
      expect(breakdown.MidMarket).toBe(0);
      expect(breakdown.UNKNOWN).toBe(0);
    });
  });

  describe('Section 5: Verbatim Customer Evidence & IC-001 Exact Quote Verification', () => {
    it('includes ONLY verified verbatim quotes, each tagged [Verified Quote]', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      expect(md).toContain('## 3. Verbatim Customer Evidence');
      // FB-001 is exact substring
      expect(md).toContain(
        '> "Export button hangs indefinitely on large datasets over 10k rows" — Account: ACC-ENT-1 (Feedback ID: FB-001) [Verified Quote]'
      );
      // FB-003 is exact substring
      expect(md).toContain(
        '> "CSV download fails with 504 error" — Account: ACC-FREE-1 (Feedback ID: FB-003) [Verified Quote]'
      );

      // FB-002 is unverified paraphrase -> MUST NOT appear as a verified quote
      expect(md).not.toContain('Paraphrased quote that does not match verbatim row text');
      // FB-999 source row not found -> MUST NOT appear
      expect(md).not.toContain('Source row does not exist in dataset');
    });

    it('appends unverified omission notice when quotes are omitted: "N additional quote(s) could not be verified and are omitted"', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      // 2 quotes omitted: FB-002 (unverified paraphrase) and FB-999 (source row not found)
      expect(md).toContain('*2 additional quote(s) could not be verified and are omitted.*');
    });

    it('renders fallback notice when zero quotes can be verified', () => {
      const clusterNoVerified: ScoredCluster = {
        ...mockCluster,
        quotes: [
          { feedback_id: 'FB-002', quote_snippet: 'Non matching text' },
        ],
      };

      const md = generateStrategicTradeoffRationale(clusterNoVerified, mockRows);
      expect(md).toContain('> [No verbatim quotes verified against source records]');
      expect(md).toContain('*1 additional quote(s) could not be verified and are omitted.*');
    });
  });

  describe('Section 6: Strategic Recommendation & Labeling (GAP-17)', () => {
    it('labels recommendation as "Suggested (rule-based)" by default', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      expect(md).toContain('## 4. Strategic Recommendation');
      expect(md).toContain('**Source:** Suggested (rule-based)');
      // For Level 3 Blocker
      expect(md).toContain('Immediate Engineering Intervention');
    });

    it('labels recommendation as "AI-drafted" when specified in options', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows, {
        recommendationSource: 'AI-drafted',
        customRecommendation: 'Custom AI strategy to deprecate synchronous worker pipelines.',
      });

      expect(md).toContain('## 4. Strategic Recommendation');
      expect(md).toContain('**Source:** AI-drafted');
      expect(md).toContain('Custom AI strategy to deprecate synchronous worker pipelines.');
    });

    it('derives appropriate rule-based recommendation across matrix quadrants', () => {
      // 1. Critical Blocker low frequency
      const lowFreqBlocker: ScoredCluster = {
        ...mockCluster,
        metrics: { ...mockCluster.metrics, U_c: 2 },
      };
      expect(getRuleBasedRecommendation(lowFreqBlocker)).toContain('Expedite immediate engineering root-cause analysis');

      // 2. High Impact / High Frequency
      const highBoth: ScoredCluster = {
        ...mockCluster,
        severity_rating: 2,
        flags: { ...mockCluster.flags, isCriticalBlocker: false },
        normalized: { I_n: 0.8, F_n: 0.8, S_n: 0.67 },
      };
      expect(getRuleBasedRecommendation(highBoth)).toContain('Top Priority Sprint Candidate');

      // 3. High Impact / Low Frequency
      const highImpactLowFreq: ScoredCluster = {
        ...mockCluster,
        severity_rating: 2,
        flags: { ...mockCluster.flags, isCriticalBlocker: false },
        normalized: { I_n: 0.8, F_n: 0.2, S_n: 0.67 },
      };
      expect(getRuleBasedRecommendation(highImpactLowFreq)).toContain('Targeted Account Engagement');

      // 4. Low Impact / High Frequency
      const lowImpactHighFreq: ScoredCluster = {
        ...mockCluster,
        severity_rating: 2,
        flags: { ...mockCluster.flags, isCriticalBlocker: false },
        normalized: { I_n: 0.2, F_n: 0.8, S_n: 0.67 },
      };
      expect(getRuleBasedRecommendation(lowImpactHighFreq)).toContain('Product Usability Optimization');

      // 5. Low Impact / Low Frequency
      const lowBoth: ScoredCluster = {
        ...mockCluster,
        severity_rating: 1,
        flags: { ...mockCluster.flags, isCriticalBlocker: false },
        normalized: { I_n: 0.2, F_n: 0.2, S_n: 0.33 },
      };
      expect(getRuleBasedRecommendation(lowBoth)).toContain('Low Immediate Priority');
    });
  });

  describe('Section 7: Contradictory Evidence Notice (MDD §3.9, GAP-07)', () => {
    it('includes ## 5. Contradictory Evidence stating it is not built in P0 (GAP-07)', () => {
      const md = generateStrategicTradeoffRationale(mockCluster, mockRows);

      expect(md).toContain('## 5. Contradictory Evidence');
      expect(md).toContain('Contradictory Evidence analysis not built in P0 (GAP-07)');
    });
  });

  describe('Section 8: DeepDiveDrawer Integration, Clipboard Copy & Error Fallback', () => {
    it('renders the Copy Strategic Rationale button in the drawer', () => {
      const html = renderToString(
        React.createElement(DeepDiveDrawer, {
          cluster: mockCluster,
          isOpen: true,
          onClose: () => {},
          allRows: mockRows,
        })
      );

      expect(html).toContain('id="btn-copy-strategic-rationale"');
      expect(html).toContain('Copy Strategic Rationale');
    });

    it('generates deliverable that can be copied to clipboard without error', () => {
      const deliverable = generateStrategicTradeoffRationale(mockCluster, mockRows);
      expect(deliverable).toBeDefined();
      expect(typeof deliverable).toBe('string');
      expect(deliverable.length).toBeGreaterThan(100);
    });
  });
});
