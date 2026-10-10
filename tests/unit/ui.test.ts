/**
 * tests/unit/ui.test.ts — SIFT UI Logic and Pre-Flight Computation Suite
 * Governed by PRD §3.1 (Steps 1–8), §5.2, §5.4, §8.2; DEC-PROVIDER
 */

import { describe, it, expect } from 'vitest';
import { autoDetectSchema } from '../../src/ingest';
import { createQualityAlertBanner } from '../../src/identity';

describe('Pre-Flight Cloud Call Estimation Math (PRD §5.2, §5.4, IC-008)', () => {
  function computeCallEstimates(rowCount: number) {
    const pass1Calls = Math.ceil(rowCount / 50);
    const pass2UpperBound = Math.min(8, Math.max(3, Math.ceil(pass1Calls * 0.8)));
    return {
      pass1Calls,
      pass2UpperBound,
      totalEstimate: pass1Calls + pass2UpperBound
    };
  }

  it('calculates correct pass-1 batches and pass-2 consolidation calls for 50 rows (1 batch)', () => {
    const est = computeCallEstimates(50);
    expect(est.pass1Calls).toBe(1);
    expect(est.pass2UpperBound).toBe(3); // min bound
    expect(est.totalEstimate).toBe(4);
  });

  it('calculates correct batches for 300 rows baseline (6 batches)', () => {
    const est = computeCallEstimates(300);
    expect(est.pass1Calls).toBe(6);
    expect(est.pass2UpperBound).toBe(5); // ceil(6 * 0.8) = 5
    expect(est.totalEstimate).toBe(11); // exactly matches DEC-PROVIDER 11 nominal calls!
  });

  it('calculates correct batches for 2,000 rows max ceiling (40 batches)', () => {
    const est = computeCallEstimates(2000);
    expect(est.pass1Calls).toBe(40);
    expect(est.pass2UpperBound).toBe(8); // capped at 8 max categories
    expect(est.totalEstimate).toBe(48);
  });
});

describe('Schema Mapping Selection & Raw Feedback Validation (PRD §3.1 Step 6)', () => {
  it('identifies when raw feedback text is missing and throws IngestError', () => {
    const headers = ['tier', 'account_id', 'author'];
    expect(() => autoDetectSchema(headers)).toThrow('Raw Feedback Text is mandatory');
  });

  it('enables analysis when raw feedback text column is mapped', () => {
    const headers = ['feedback_id', 'review_notes', 'tier'];
    const detected = autoDetectSchema(headers);

    expect(detected.text).toBe('review_notes');
    const isTextMapped = Boolean(detected.text && detected.text.trim().length > 0);
    expect(isTextMapped).toBe(true);
  });
});

describe('Data Quality Banner Formatter (PRD §4.6, REQ-004)', () => {
  it('formats exact warning banner text for 12% missing metadata', () => {
    const dummyMetrics = {
      totalRows: 100,
      unknownTierCount: 12,
      unknownTierPercentage: 12,
      isTierColumnMapped: true,
      missingAccountIdCount: 0,
      missingAccountIdPercentage: 0,
      isAccountColumnMapped: true,
      rowsWithIssuesCount: 12,
      rowsWithIssuesPercentage: 12
    };

    const banner = createQualityAlertBanner(dummyMetrics);
    expect(banner.triggered).toBe(true);
    expect(banner.message).toBe(
      'Data Quality Warning: 12% of records lack customer tier or account metadata and are evaluated provisionally (1.0x weight). Priority scores may reflect submission volume rather than verified account revenue.'
    );
    expect(banner.collapsedText).toBe('Data Quality Alert (12% metadata missing)');
  });
});

describe('ReconciliationDiagnostics UI Component (M2-C, TS-019, GAP-11)', () => {
  it('renders invariant satisfied badge, uncertain cluster badge with rationale, CLUST-UNC card, and advisory banner', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { ReconciliationDiagnostics } = await import('../../src/ui');

    const html = renderToString(
      React.createElement(ReconciliationDiagnostics, {
        diagnostics: {
          totalInputIds: 5,
          totalClusteredIds: 4,
          unclusteredIdsCount: 1,
          unclusteredFeedbackIds: ['FB-005'],
          droppedUnknownIds: ['FB-FABRICATED'],
          droppedUnknownCount: 1,
          duplicateAssignmentsResolvedCount: 1,
          duplicatesResolvedDetails: [
            {
              feedbackId: 'FB-002',
              keptInClusterId: 'CLUST-02',
              strippedFromClusterIds: ['CLUST-01'],
            },
          ],
        },
        clusters: [
          {
            cluster_id: 'CLUST-01',
            cluster_title: 'Uncertain Export Theme',
            canonical_category: 'Export',
            problem_summary: 'Slow export reports.',
            root_cause_hypothesis: 'Unindexed query.',
            severity_rating: 2,
            member_feedback_ids: ['FB-001'],
            quotes: [],
            isUncertain: true,
            reviewFlag: 'Uncertain Cluster — Review Recommended',
            uncertainRationale: 'Thematic overlap with cluster CLUST-02 requires PM review.',
          },
          {
            cluster_id: 'CLUST-02',
            cluster_title: 'Resolved Login Issue',
            canonical_category: 'Auth',
            problem_summary: 'SSO cookie timeout.',
            root_cause_hypothesis: 'Cookie domain.',
            severity_rating: 3,
            member_feedback_ids: ['FB-002', 'FB-003', 'FB-004'],
            quotes: [],
          },
        ],
        clustUnc: {
          cluster_id: 'CLUST-UNC',
          cluster_title: 'Unclustered Feedback',
          canonical_category: 'Unclustered',
          problem_summary: 'Items omitted from batch clusters.',
          root_cause_hypothesis: 'Provisional isolation without AI hypothesis.',
          severity_rating: 1,
          priority_score: 0,
          isUnclustered: true,
          member_feedback_ids: ['FB-005'],
          quotes: [],
        },
        integrity: {
          isValid: true,
          stage: 'Pass 2 Reconciliation',
          totalInputIds: 5,
          totalAssignedIds: 5,
          missingIds: [],
          duplicateIds: [],
          unknownIds: [],
        },
        advisoryBannerMessage: 'Pass 2 theme reconciliation degraded. Retaining preliminary batch clusters.',
      })
    );

    // 1. Invariant satisfied badge
    expect(html).toContain('1:1 Feedback ID Invariant Satisfied');

    // 2. Advisory banner
    expect(html).toContain('pass2-advisory-banner');
    expect(html).toContain('Pass 2 theme reconciliation degraded');

    // 3. TS-019: Uncertain review badge & rationale
    expect(html).toContain('Uncertain Cluster — Review Recommended');
    expect(html).toContain('Thematic overlap with cluster CLUST-02 requires PM review');

    // 4. GAP-11: CLUST-UNC with S=1, P=0 explanation
    expect(html).toContain('CLUST-UNC');
    expect(html).toContain('S=1, P=0');

    // 5. Diagnostics metrics
    expect(html).toContain('GAP-13 Duplicates Resolved');
    expect(html).toContain('Dropped Unknown IDs');
  });

  it('renders Root-Cause Hypothesis, Boundary Notice, Needs Investigation badge, and Partial-Analysis banner with Retry button (M2-D, MDD §3.6, TS-037)', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { ReconciliationDiagnostics } = await import('../../src/ui');

    const html = renderToString(
      React.createElement(ReconciliationDiagnostics, {
        diagnostics: {
          totalInputIds: 10,
          totalClusteredIds: 0,
          unclusteredIdsCount: 10,
          unclusteredFeedbackIds: ['FB-001', 'FB-002'],
          droppedUnknownIds: [],
          droppedUnknownCount: 0,
          duplicateAssignmentsResolvedCount: 0,
          duplicatesResolvedDetails: [],
        },
        clusters: [
          {
            cluster_id: 'CLUST-01',
            cluster_title: 'UI Alignment',
            canonical_category: 'Cosmetic',
            problem_summary: 'Buttons are misaligned.',
            root_cause_hypothesis: 'Workflow friction. [NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]',
            severity_rating: 1,
            member_feedback_ids: ['FB-001'],
            quotes: [],
            needs_investigation: true,
            investigation_placeholder: '[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]',
          },
        ],
        clustUnc: {
          cluster_id: 'CLUST-UNC',
          cluster_title: 'Unclustered Feedback',
          canonical_category: 'Unclustered',
          problem_summary: 'All batches degraded due to rate limit.',
          root_cause_hypothesis: 'Provisional isolation without AI hypothesis.',
          severity_rating: 1,
          priority_score: 0,
          isUnclustered: true,
          needs_investigation: true,
          investigation_placeholder: '[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]',
          member_feedback_ids: ['FB-002'],
          quotes: [],
        },
        integrity: {
          isValid: true,
          stage: 'Pass 1 Assembly',
          totalInputIds: 2,
          totalAssignedIds: 2,
          missingIds: [],
          duplicateIds: [],
          unknownIds: [],
        },
        isFullyFailed: true,
        failedBatchIndices: [0, 1],
        onRetryFailedBatches: () => {},
        advisoryBannerMessage: 'AI analysis degraded: all batches failed. Feedback routed to Unclustered Feedback. You can retry failed batches.',
      })
    );

    // 1. Mandatory Root-Cause Label & Boundary Notice (MDD §3.6)
    expect(html).toContain('Root-Cause Hypothesis');
    expect(html).toContain(
      'Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.'
    );

    // 2. Needs Investigation badge (TS-013)
    expect(html).toContain('[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]');
    expect(html).toContain('needs-investigation-badge-CLUST-01');
    expect(html).toContain('needs-investigation-badge-CLUST-UNC');

    // 3. Partial Analysis warning banner & Retry button (TS-037)
    expect(html).toContain('partial-analysis-warning-banner');
    expect(html).toContain('Partial Analysis / Provider Degraded');
    expect(html).toContain('btn-retry-failed-batches');
    expect(html).toContain('Retry failed batches');
  });
});


