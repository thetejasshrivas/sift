/**
 * tests/unit/quoteVerifier.test.ts — Exact Quote Verification Engine & Receipts (M4-C)
 * Governed by PRD REQ-011, §7.1, TS-005; MDD §3.7; IC-001; Part VII TS-005/005b.
 * Evaluates Gate G-M4C.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  verify,
  normalizeForDiagnostic,
  verifyQuoteAgainstRows,
} from '../../src/verify';
import { DeepDiveDrawer } from '../../src/ui/DeepDiveDrawer';
import { ScoredCluster } from '../../src/types/scoring';
import { ProcessedFeedbackRow } from '../../src/types/identity';

describe('Task M4-C: Exact Quote Verification Engine (TS-005, TS-005b, REQ-011, IC-001)', () => {
  const sampleRawText = 'Exporting invoice fails with 504 gateway timeout every time on large accounts.';

  describe('TS-005: Pure verify(snippet, rawText) Function Contract & IC-001 Invariants', () => {
    it('returns VERIFIED (isVerified=true) only for exact verbatim substring matches', () => {
      const result = verify('Exporting invoice fails with 504 gateway timeout', sampleRawText);
      expect(result.status).toBe('VERIFIED');
      expect(result.isVerified).toBe(true);
      expect(result.badgeLabel).toBe('Verified Quote');
      expect(result.sourceFound).toBe(true);
      expect(result.diagnosticMatch).toBe(true);
      expect(result.rawText).toBe(sampleRawText);
    });

    it('returns VERIFIED for complete exact sentence match', () => {
      const result = verify(sampleRawText, sampleRawText);
      expect(result.status).toBe('VERIFIED');
      expect(result.isVerified).toBe(true);
      expect(result.badgeLabel).toBe('Verified Quote');
    });

    it('strictly rejects case mismatches (IC-001 overrides PRD case-insensitive option)', () => {
      // Lowercase 'exporting' instead of 'Exporting'
      const result = verify('exporting invoice fails with 504 gateway timeout', sampleRawText);
      expect(result.status).not.toBe('VERIFIED');
      expect(result.isVerified).toBe(false);
      // But should trigger diagnostic near-match
      expect(result.status).toBe('NEAR_MATCH');
      expect(result.badgeLabel).toBe('Near Match / Normalized — Not Verbatim Verified');
    });

    it('strictly rejects leading/trailing whitespace differences (IC-001 overrides .trim())', () => {
      // Leading space added
      const leadRes = verify(' Exporting invoice fails with 504 gateway timeout', sampleRawText);
      expect(leadRes.status).not.toBe('VERIFIED');
      expect(leadRes.isVerified).toBe(false);
      expect(leadRes.status).toBe('NEAR_MATCH');

      // Trailing space beyond end of string
      const trailRes = verify(sampleRawText + ' ', sampleRawText);
      expect(trailRes.status).not.toBe('VERIFIED');
      expect(trailRes.isVerified).toBe(false);
      expect(trailRes.status).toBe('NEAR_MATCH');
    });

    it('strictly rejects internal whitespace variance (extra spaces)', () => {
      const result = verify('Exporting  invoice  fails', sampleRawText);
      expect(result.status).not.toBe('VERIFIED');
      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('NEAR_MATCH');
    });

    it('strictly rejects punctuation differences (extra or missing punctuation)', () => {
      const result = verify('Exporting invoice fails with 504 gateway timeout!', sampleRawText);
      expect(result.status).not.toBe('VERIFIED');
      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('NEAR_MATCH');
    });

    it('returns UNVERIFIED (isVerified=false) for empty or whitespace-only snippet', () => {
      const emptyRes = verify('', sampleRawText);
      expect(emptyRes.status).toBe('UNVERIFIED');
      expect(emptyRes.isVerified).toBe(false);

      const nullRes = verify(null, sampleRawText);
      expect(nullRes.status).toBe('UNVERIFIED');
      expect(nullRes.isVerified).toBe(false);
    });

    it('returns UNVERIFIED (isVerified=false) for completely rewritten or hallucinated text', () => {
      const result = verify('The entire payment gateway crashed and took down servers', sampleRawText);
      expect(result.status).toBe('UNVERIFIED');
      expect(result.isVerified).toBe(false);
      expect(result.badgeLabel).toBe('Unverified / Rewritten');
      expect(result.diagnosticMatch).toBe(false);
    });
  });

  describe('TS-005b: Diagnostic Near-Match, Missing Feedback ID, and Attribution Boundary', () => {
    it('detects normalized near-match when lowercase, punctuation, and whitespace are normalized', () => {
      const norm1 = normalizeForDiagnostic('Exporting, invoice fails: with 504!   gateway  timeout');
      const norm2 = normalizeForDiagnostic(sampleRawText);
      expect(norm2).toContain(norm1);

      const result = verify('exporting, invoice fails: with 504!   gateway', sampleRawText);
      expect(result.status).toBe('NEAR_MATCH');
      expect(result.isVerified).toBe(false);
      expect(result.badgeLabel).toBe('Near Match / Normalized — Not Verbatim Verified');
      // Crucial requirement: must never use 'Verified' alone or green badge
      expect(result.badgeLabel).not.toBe('Verified');
      expect(result.badgeLabel).not.toBe('Verified Quote');
    });

    it('handles missing Feedback ID or unmapped row with SOURCE_NOT_FOUND', () => {
      const missingRowRes = verify('Some snippet', undefined);
      expect(missingRowRes.status).toBe('SOURCE_NOT_FOUND');
      expect(missingRowRes.isVerified).toBe(false);
      expect(missingRowRes.badgeLabel).toBe('Source row not found');
      expect(missingRowRes.sourceFound).toBe(false);

      const nullRowRes = verify('Some snippet', null);
      expect(nullRowRes.status).toBe('SOURCE_NOT_FOUND');
      expect(nullRowRes.isVerified).toBe(false);
      expect(nullRowRes.badgeLabel).toBe('Source row not found');
    });

    it('verifyQuoteAgainstRows correctly maps rows by Feedback ID', () => {
      const rows: ProcessedFeedbackRow[] = [
        {
          text: 'Exact verbatim customer text from ticket 101',
          identity: {
            feedbackId: 'FB-101',
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
      ];

      // Exact match
      const r1 = verifyQuoteAgainstRows('FB-101', 'Exact verbatim customer text', rows);
      expect(r1.status).toBe('VERIFIED');
      expect(r1.isVerified).toBe(true);

      // Near match (casing difference)
      const r2 = verifyQuoteAgainstRows('FB-101', 'exact verbatim customer text', rows);
      expect(r2.status).toBe('NEAR_MATCH');
      expect(r2.isVerified).toBe(false);

      // Rewritten
      const r3 = verifyQuoteAgainstRows('FB-101', 'Totally different text', rows);
      expect(r3.status).toBe('UNVERIFIED');
      expect(r3.isVerified).toBe(false);

      // Missing Feedback ID
      const r4 = verifyQuoteAgainstRows('FB-999', 'Exact verbatim customer text', rows);
      expect(r4.status).toBe('SOURCE_NOT_FOUND');
      expect(r4.isVerified).toBe(false);
      expect(r4.badgeLabel).toBe('Source row not found');
    });
  });

  describe('DeepDiveDrawer Quotes Rendering & Action Output Invariant (M4-C UI)', () => {
    const mockRows: ProcessedFeedbackRow[] = [
      {
        text: 'Exporting invoice fails with 504 gateway timeout every time.',
        identity: { feedbackId: 'FB-001', accountId: 'ACC-001' },
        tierResolution: {
          canonicalTier: 'Enterprise',
          weight: 3.0,
          weightLabel: 'Tier-Weighted',
          isUnrecognized: false,
        },
        rawRow: {},
        rowIndex: 1,
      },
      {
        text: 'The billing screen takes 30 seconds to render invoices.',
        identity: { feedbackId: 'FB-002', accountId: 'ACC-002' },
        tierResolution: {
          canonicalTier: 'Pro / Mid-Market',
          weight: 2.0,
          weightLabel: 'Tier-Weighted',
          isUnrecognized: false,
        },
        rawRow: {},
        rowIndex: 2,
      },
    ];

    const testCluster: ScoredCluster = {
      cluster_id: 'CLUST-01',
      cluster_title: 'Invoice PDF Export Timeout',
      canonical_category: 'Billing',
      problem_summary: 'Large exports fail with 504 gateway timeout.',
      root_cause_hypothesis: 'Unpaginated query execution in worker thread.',
      severity_rating: 3,
      member_feedback_ids: ['FB-001', 'FB-002', 'FB-999'],
      quotes: [
        // 1. Exact match -> VERIFIED
        { feedback_id: 'FB-001', quote_snippet: 'Exporting invoice fails with 504 gateway timeout' },
        // 2. Near match -> NEAR_MATCH (differing casing)
        { feedback_id: 'FB-002', quote_snippet: 'the billing screen takes 30 seconds' },
        // 3. Rewritten -> UNVERIFIED
        { feedback_id: 'FB-002', quote_snippet: 'Completely made up summary statement' },
        // 4. Missing Feedback ID -> SOURCE_NOT_FOUND
        { feedback_id: 'FB-999', quote_snippet: 'Some orphaned quote' },
      ],
      rank: 1,
      priority_score: 85.0,
      coordinates: { x: 0.8, y: 0.8 },
      normalized: { I_n: 0.8, F_n: 0.8, S_n: 1.0 },
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
        normalizedMetrics: { I_n: 0.8, F_n: 0.8, S_n: 1.0 },
        weights: { wArr: 0.4, wVol: 0.4, wSev: 0.2 },
        rawWeightedSum: 0.85,
        unroundedScore: 85.0,
        priorityScore: 85.0,
        formulaDisplay: 'P_c = 85.0',
        impactLabel: 'Impact',
      },
    };

    it('renders all 4 verification badges correctly and offers raw row reveal for non-exact rows', () => {
      const html = renderToString(
        React.createElement(DeepDiveDrawer, {
          cluster: testCluster,
          isOpen: true,
          onClose: () => {},
          allRows: mockRows,
        })
      );

      // 1. Exact match badge: green '✓ Verified Quote'
      expect(html).toContain('✓ Verified Quote');
      expect(html).toContain('badge-verified');

      // 2. Near match badge: non-green 'Near Match / Normalized — Not Verbatim Verified'
      expect(html).toContain('Near Match / Normalized — Not Verbatim Verified');
      expect(html).toContain('badge-near-match');

      // 3. Unverified badge: yellow '⚠️ Unverified / Rewritten'
      expect(html).toContain('⚠️ Unverified / Rewritten');
      expect(html).toContain('badge-unverified');

      // 4. Missing Feedback ID badge: gray 'Source row not found'
      expect(html).toContain('Source row not found');
      expect(html).toContain('badge-source-not-found');

      // 5. Raw Row Reveal Buttons exist for non-exact items where source row was found
      expect(html).toContain('id="btn-reveal-raw-1"');
      expect(html).toContain('id="btn-reveal-raw-2"');
      expect(html).toContain('Reveal Full Raw Row');
    });

    it('guarantees that ONLY verified quotes are included as verbatim evidence in copy outputs', () => {
      // Test the logic directly against testCluster quotes
      const verifiedQuotes = testCluster.quotes.filter(
        (q) => verifyQuoteAgainstRows(q.feedback_id, q.quote_snippet, mockRows).isVerified
      );

      // Only FB-001 is verified
      expect(verifiedQuotes.length).toBe(1);
      expect(verifiedQuotes[0].feedback_id).toBe('FB-001');
      expect(verifiedQuotes[0].quote_snippet).toBe('Exporting invoice fails with 504 gateway timeout');

      // FB-002 near-match, FB-002 rewritten, FB-999 missing are strictly excluded
      const unverifiedFeedbackIds = testCluster.quotes
        .filter((q) => !verifyQuoteAgainstRows(q.feedback_id, q.quote_snippet, mockRows).isVerified)
        .map((q) => q.quote_snippet);

      expect(unverifiedFeedbackIds).toContain('the billing screen takes 30 seconds');
      expect(unverifiedFeedbackIds).toContain('Completely made up summary statement');
      expect(unverifiedFeedbackIds).toContain('Some orphaned quote');
    });
  });
});
