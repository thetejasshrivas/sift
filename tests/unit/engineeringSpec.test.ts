/**
 * tests/unit/engineeringSpec.test.ts
 * Unit Test Suite for Task M5-B: Developer Engineering Specification Generator with 5-Tier Safety Decoupling
 * Governed by PRD REQ-012, §7.2–7.4, TS-013; DEC-005; Gate G-M5B.
 */

import { describe, it, expect } from 'vitest';
import {
  generateEngineeringSpecification,
  resolveNeedsInvestigation,
} from '../../src/outputs/engineeringSpec';
import { INVESTIGATION_PLACEHOLDER } from '../../src/verify/missingContext';
import { ScoredCluster } from '../../src/types/scoring';
import { ProcessedFeedbackRow } from '../../src/types/identity';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DeepDiveDrawer } from '../../src/ui/DeepDiveDrawer';

describe('Task M5-B: Engineering Spec Generator with 5-Tier Decoupling (REQ-012, TS-013, Gate G-M5B)', () => {
  const mockClusterWithTechSignals: ScoredCluster = {
    cluster_id: 'CLUST-01',
    cluster_title: 'Bulk CSV Export Gateway Timeout',
    canonical_category: 'Export & Reporting',
    problem_summary:
      'Bulk CSV exports fail with HTTP 504 gateway timeout when table exceeds 10,000 rows.',
    root_cause_hypothesis:
      'Worker thread memory exhaustion during JSON serialization of large datasets.',
    severity_rating: 3,
    member_feedback_ids: ['FB-001', 'FB-002', 'FB-003'],
    quotes: [
      {
        feedback_id: 'FB-001',
        quote_snippet: 'Export button hangs indefinitely on large datasets over 10k rows',
      },
      {
        feedback_id: 'FB-002',
        quote_snippet: 'Paraphrased text that is not in the source row',
      },
      {
        feedback_id: 'FB-003',
        quote_snippet: 'CSV download fails with 504 error',
      },
    ],
    priority_score: 84.5,
    rank: 1,
    metrics: {
      I_c: 18.0,
      U_c: 3,
      S_c: 3,
      N_c: 3,
      confirmedAccountsCount: 3,
      estimatedAccountsCount: 0,
    },
    normalized: { I_n: 0.8182, F_n: 0.75, S_n: 1.0 },
    breakdown: {} as any,
    flags: {
      isCriticalBlocker: true,
      isSmallSample: false,
      isUnclusteredBucket: false,
    },
    coordinates: { x: 0.75, y: 0.8182 },
  };

  const mockRowsWithTechSignals: ProcessedFeedbackRow[] = [
    {
      rowIndex: 1,
      rawRow: {},
      text: 'Export button hangs indefinitely on large datasets over 10k rows on Chrome.',
      identity: { feedbackId: 'FB-001', accountId: 'ACC-1' },
      tierResolution: { canonicalTier: 'Enterprise', weight: 3.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
    },
    {
      rowIndex: 2,
      rawRow: {},
      text: 'Totally different text here.',
      identity: { feedbackId: 'FB-002', accountId: 'ACC-2' },
      tierResolution: { canonicalTier: 'Pro / Mid-Market', weight: 2.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
    },
    {
      rowIndex: 3,
      rawRow: {},
      text: 'CSV download fails with 504 error during peak hours.',
      identity: { feedbackId: 'FB-003', accountId: 'ACC-3' },
      tierResolution: { canonicalTier: 'Free / Starter', weight: 1.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
    },
  ];

  const mockClusterWithoutTechSignals: ScoredCluster = {
    cluster_id: 'CLUST-02',
    cluster_title: 'Unintuitive Navigation and Button Placement',
    canonical_category: 'Navigation & Usability',
    problem_summary:
      'Users find the checkout flow confusing and complain that buttons are hard to locate.',
    root_cause_hypothesis:
      'Suboptimal visual hierarchy in checkout navigation bar.',
    severity_rating: 1,
    member_feedback_ids: ['FB-010', 'FB-011'],
    quotes: [
      {
        feedback_id: 'FB-010',
        quote_snippet: 'Checkout navigation is confusing',
      },
    ],
    priority_score: 42.0,
    rank: 4,
    metrics: {
      I_c: 4.0,
      U_c: 2,
      S_c: 1,
      N_c: 2,
      confirmedAccountsCount: 2,
      estimatedAccountsCount: 0,
    },
    normalized: { I_n: 0.2, F_n: 0.3, S_n: 0.33 },
    breakdown: {} as any,
    flags: {
      isCriticalBlocker: false,
      isSmallSample: true,
      isUnclusteredBucket: false,
    },
    coordinates: { x: 0.3, y: 0.2 },
  };

  const mockRowsWithoutTechSignals: ProcessedFeedbackRow[] = [
    {
      rowIndex: 1,
      rawRow: {},
      text: 'Checkout navigation is confusing and requires too many clicks.',
      identity: { feedbackId: 'FB-010', accountId: 'ACC-10' },
      tierResolution: { canonicalTier: 'Free / Starter', weight: 1.0, weightLabel: 'Tier-Weighted', isUnrecognized: false },
    },
    {
      rowIndex: 2,
      rawRow: {},
      text: 'I cannot find where the proceed button went.',
      identity: { feedbackId: 'FB-011', accountId: 'ACC-11' },
      tierResolution: { canonicalTier: 'UNKNOWN', weight: 1.0, weightLabel: 'Tier-Weighted', isUnrecognized: true },
    },
  ];

  describe('Five-Tier Safety Decoupling Framework (PRD §7.2, §7.4)', () => {
    it('generates the exact markdown title and subtitle with Target Cluster ID and Severity Rating', () => {
      const spec = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals);

      expect(spec).toContain('# Engineering Specification: Bulk CSV Export Gateway Timeout');
      expect(spec).toContain('**Target Cluster ID:** CLUST-01 | **Severity Rating:** Level 3');
    });

    it('renders Tier 1: Customer-Reported Observation with problem_summary', () => {
      const spec = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals);

      expect(spec).toContain('## 1. Customer-Reported Observation');
      expect(spec).toContain(
        'Bulk CSV exports fail with HTTP 504 gateway timeout when table exceeds 10,000 rows.'
      );
    });

    it('renders Tier 2: Verified Verbatim Receipts containing ONLY exact substring matches', () => {
      const spec = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals);

      expect(spec).toContain('## 2. Verified Verbatim Receipts');
      // Exact substring matches are included
      expect(spec).toContain(
        '- `[FB-001]`: "Export button hangs indefinitely on large datasets over 10k rows" [Verified]'
      );
      expect(spec).toContain(
        '- `[FB-003]`: "CSV download fails with 504 error" [Verified]'
      );

      // Unverified paraphrase MUST NOT appear as verified receipt
      expect(spec).not.toContain('Paraphrased text that is not in the source row');
      // Omission count notice
      expect(spec).toContain('*1 additional quote(s) could not be verified and are omitted.*');
    });

    it('renders Tier 3: AI Root-Cause Hypothesis with mandatory boundary label and notice (MDD §3.6)', () => {
      const spec = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals);

      expect(spec).toContain('## 3. AI Root-Cause Hypothesis');
      expect(spec).toContain(
        'Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.'
      );
      expect(spec).toContain('Worker thread memory exhaustion during JSON serialization of large datasets.');
    });

    it('renders Tier 4: Proposed Technical Investigation labeled "Candidate — AI-drafted"', () => {
      const spec = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals);

      expect(spec).toContain('## 4. Proposed Technical Investigation');
      expect(spec).toContain('Candidate — AI-drafted');
      expect(spec).toContain('1. Inspect application logs and server metrics');
    });

    it('renders Tier 5: Candidate Acceptance Criteria + "Suggested potential solutions (require engineering confirmation)"', () => {
      const spec = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals);

      expect(spec).toContain('## 5. Candidate Acceptance Criteria');
      expect(spec).toContain('Suggested potential solutions (require engineering confirmation)');
      expect(spec).toContain('Candidate — AI-drafted');
      expect(spec).toContain('- [ ] Validate issue reproduction against the identified failure pattern');
    });
  });

  describe('Missing Context Safety Placeholder Injection (REQ-012, TS-013, DEC-005)', () => {
    it('omits [NEEDS INVESTIGATION] when technical environment context is present in member rows', () => {
      expect(resolveNeedsInvestigation(mockClusterWithTechSignals, mockRowsWithTechSignals)).toBe(false);

      const spec = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals);
      expect(spec).not.toContain(INVESTIGATION_PLACEHOLDER);
    });

    it('inserts [NEEDS INVESTIGATION: Technical Context Missing in Source Feedback] at the top of Section 4 when technical signals are absent (TS-013)', () => {
      expect(resolveNeedsInvestigation(mockClusterWithoutTechSignals, mockRowsWithoutTechSignals)).toBe(true);

      const spec = generateEngineeringSpecification(mockClusterWithoutTechSignals, mockRowsWithoutTechSignals);

      // Section 4 must have the exact literal string
      expect(spec).toContain('## 4. Proposed Technical Investigation');
      expect(spec).toContain(INVESTIGATION_PLACEHOLDER);

      // Verify that the placeholder appears immediately at the top of section 4
      const section4Content = spec.split('## 4. Proposed Technical Investigation')[1].split('## 5. Candidate Acceptance Criteria')[0];
      const trimmedSec4 = section4Content.trim();
      expect(trimmedSec4.startsWith(INVESTIGATION_PLACEHOLDER)).toBe(true);
    });

    it('honors explicit needs_investigation boolean override in options', () => {
      // Force true override on cluster with tech signals
      const specForcedTrue = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals, {
        needs_investigation: true,
      });
      expect(specForcedTrue).toContain(INVESTIGATION_PLACEHOLDER);

      // Force false override on cluster without tech signals
      const specForcedFalse = generateEngineeringSpecification(mockClusterWithoutTechSignals, mockRowsWithoutTechSignals, {
        needs_investigation: false,
      });
      expect(specForcedFalse).not.toContain(INVESTIGATION_PLACEHOLDER);
    });
  });

  describe('Safety Guardrail: PRD §7.4 Example Endpoints/Metrics must NOT appear as facts', () => {
    it('does not state /api/v1/export, <3.0 seconds, or <0.01% as fixed facts', () => {
      const spec1 = generateEngineeringSpecification(mockClusterWithTechSignals, mockRowsWithTechSignals);
      const spec2 = generateEngineeringSpecification(mockClusterWithoutTechSignals, mockRowsWithoutTechSignals);

      // Example strings from PRD §7.4 should not be hard-coded into general specs
      expect(spec1).not.toContain('/api/v1/export');
      expect(spec1).not.toContain('<3.0 seconds');
      expect(spec1).not.toContain('<0.01%');

      expect(spec2).not.toContain('/api/v1/export');
      expect(spec2).not.toContain('<3.0 seconds');
      expect(spec2).not.toContain('<0.01%');
    });
  });

  describe('DeepDiveDrawer Integration & Action Button', () => {
    it('renders the Copy Engineering Spec button in the deep-dive drawer', () => {
      const html = renderToString(
        React.createElement(DeepDiveDrawer, {
          cluster: mockClusterWithTechSignals,
          isOpen: true,
          onClose: () => {},
          allRows: mockRowsWithTechSignals,
        })
      );

      expect(html).toContain('id="btn-copy-engineering-spec"');
      expect(html).toContain('Copy Engineering Spec');
    });
  });
});
