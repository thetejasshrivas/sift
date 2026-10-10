/**
 * tests/unit/missingContext.test.ts — Hypotheses, Missing Context, Fallbacks & Partial Analysis
 * Governed by PRD REQ-005, REQ-007, REQ-012, §5.8, §14.3; MDD §3.6, §3.10; IC-001, IC-015; Gate G-M2D.
 *
 * Covers:
 * - TS-013(logic): Technical context present -> needs_investigation=false; missing -> needs_investigation=true.
 * - TS-007: Profane/angry feedback preserved and processed without throwing error.
 * - TS-009: Malformed AI response retries up to 3x, then falls back to Unclustered gracefully.
 * - TS-037: Persistent failure/quota exhaustion degrades gracefully with explanatory message and retry button.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  detectTechnicalContext,
  isNonTechnicalCluster,
  enrichClusterWithRootCauseHypothesis,
  ROOT_CAUSE_LABEL,
  BOUNDARY_NOTICE_TEXT,
  INVESTIGATION_PLACEHOLDER,
} from '../../src/verify/missingContext';
import { runTwoPassClusteringPipeline } from '../../src/ai/reconciliation';
import { ProcessedFeedbackRow } from '../../src/types/identity';
import { ClusterResponseItem } from '../../src/types/ai';

// Helper to create valid mock ProcessedFeedbackRows
function createMockRows(
  items: Array<{ id: string; text: string; tier?: string }>
): ProcessedFeedbackRow[] {
  return items.map((item, index) => ({
    identity: {
      feedbackId: item.id,
      userId: `user-${item.id}`,
      accountId: `acc-${item.id}`,
      clusterId: null,
    },
    text: item.text,
    tierResolution: {
      canonicalTier: (item.tier as any) || 'Enterprise',
      weight: 3.0,
      weightLabel: 'Tier-Weighted' as const,
      isUnrecognized: false,
    },
    rawRow: {
      feedback_id: item.id,
      text: item.text,
      tier: item.tier || 'Enterprise',
    },
    rowIndex: index + 1,
  }));
}

describe('M2-D Specification 1: Root-Cause Label & Boundary Notice (MDD §3.6)', () => {
  it('exposes the mandatory label verbatim: "Root-Cause Hypothesis"', () => {
    expect(ROOT_CAUSE_LABEL).toBe('Root-Cause Hypothesis');
  });

  it('exposes the mandatory boundary notice text verbatim (MDD §3.6)', () => {
    expect(BOUNDARY_NOTICE_TEXT).toBe(
      'Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.'
    );
  });

  it('exposes the mandatory investigation placeholder verbatim', () => {
    expect(INVESTIGATION_PLACEHOLDER).toBe(
      '[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]'
    );
  });
});

describe('M2-D Specification 2 & TS-013(logic): Deterministic Missing-Context Detector', () => {
  describe('Technical Environment Regex Scanner Patterns', () => {
    it('detects Browser context signals accurately', () => {
      const tests = [
        'Browser crashes whenever I open the modal',
        'Fails on Google Chrome version 120',
        'Safari renders a blank screen',
        'Firefox tab freezes on upload',
        'Issue reproducible on Microsoft Edge',
        'Opera browser also hangs',
      ];
      for (const text of tests) {
        const result = detectTechnicalContext([text]);
        expect(result.needs_investigation).toBe(false);
        expect(result.signals.hasBrowser).toBe(true);
        expect(result.signals.matchedSignals).toContain('browser');
      }
    });

    it('detects OS context signals accurately', () => {
      const tests = [
        'Fails on Windows 11 desktop',
        'Mac client fails to start',
        'Issue happens on macOS Sonoma',
        'Mobile iOS crash on launch',
        'Android build crashes on resume',
        'Linux server drops connection',
        'Reproduced on Ubuntu 22.04 LTS',
      ];
      for (const text of tests) {
        const result = detectTechnicalContext([text]);
        expect(result.needs_investigation).toBe(false);
        expect(result.signals.hasOs).toBe(true);
        expect(result.signals.matchedSignals).toContain('os');
      }
    });

    it('detects Version / Error Code signals accurately', () => {
      const tests = [
        'Version v2.4 broken after latest patch',
        'Client release 1.0.4 throws error',
        'Encountered error code 4096 on startup',
        'Fatal err encountered in worker thread',
      ];
      for (const text of tests) {
        const result = detectTechnicalContext([text]);
        expect(result.needs_investigation).toBe(false);
        expect(result.signals.hasVersionCode).toBe(true);
        expect(result.signals.matchedSignals).toContain('version/code');
      }
    });

    it('detects HTTP / Status Code signals accurately', () => {
      const tests = [
        'Server returned 500 internal server error',
        'Request failed with 404 not found',
        'API returns 429 rate limit exceeded',
        'Encountered 504 gateway timeout',
        'Proxy returns 502 bad gateway',
        'Call timed out after 30 seconds (timeout)',
        'Gateway dropped the websocket connection',
      ];
      for (const text of tests) {
        const result = detectTechnicalContext([text]);
        expect(result.needs_investigation).toBe(false);
        expect(result.signals.hasHttpStatus).toBe(true);
        expect(result.signals.matchedSignals).toContain('http/status');
      }
    });

    it('detects Payload / Data Size signals accurately', () => {
      const tests = [
        'Failed when uploading file larger than 50 mb',
        'Crashes when processing 100 kb payload',
        'Exporting 500 rows times out',
        'Fails for datasets with over 1000 items',
        'Batch export with 250 records freezes',
        'Dataset of 2000 entries fails to render',
        'Syncing 50 files corrupts state',
      ];
      for (const text of tests) {
        const result = detectTechnicalContext([text]);
        expect(result.needs_investigation).toBe(false);
        expect(result.signals.hasPayloadSize).toBe(true);
        expect(result.signals.matchedSignals).toContain('payload/size');
      }
    });
  });

  describe('TS-013(logic): Technical signals present -> needs_investigation=false; missing -> needs_investigation=true', () => {
    it('sets needs_investigation=false when ANY technical context is present across member texts or quotes', () => {
      const texts = [
        'Export fails intermittently',
        'We get a 504 gateway timeout every morning',
      ];
      const result = detectTechnicalContext(texts);
      expect(result.needs_investigation).toBe(false);
      expect(result.signals.anySignalPresent).toBe(true);

      const cluster = {
        canonical_category: 'Export & Download',
        cluster_title: 'Export Gateway Timeouts',
        root_cause_hypothesis: 'Database connection pool exhaustion during large exports.',
        quotes: [{ quote_snippet: 'We get a 504 gateway timeout every morning' }],
      };

      const enriched = enrichClusterWithRootCauseHypothesis(cluster, texts);
      expect(enriched.needs_investigation).toBe(false);
      expect(enriched.investigation_placeholder).toBeUndefined();
      expect(enriched.root_cause_hypothesis).not.toContain(INVESTIGATION_PLACEHOLDER);
    });

    it('sets needs_investigation=true and injects placeholder when ALL technical signals are absent', () => {
      const texts = [
        'The export is slow',
        'I do not like how exports work here',
      ];
      const result = detectTechnicalContext(texts);
      expect(result.needs_investigation).toBe(true);
      expect(result.signals.anySignalPresent).toBe(false);

      const cluster = {
        canonical_category: 'Performance',
        cluster_title: 'Slow Exports',
        root_cause_hypothesis: 'Underlying query performance degradation.',
        quotes: [{ quote_snippet: 'The export is slow' }],
      };

      const enriched = enrichClusterWithRootCauseHypothesis(cluster, texts);
      expect(enriched.needs_investigation).toBe(true);
      expect(enriched.investigation_placeholder).toBe(INVESTIGATION_PLACEHOLDER);
      expect(enriched.root_cause_hypothesis).toContain(INVESTIGATION_PLACEHOLDER);
    });

    it('handles non-technical complaints (cosmetic/billing/workflow) by defaulting hypothesis to workflow friction with placeholder', () => {
      const texts = [
        'The invoice line items are misaligned and the font is ugly',
        'The checkout billing button is hard to find',
      ];
      expect(isNonTechnicalCluster('Billing', 'Misaligned invoice items')).toBe(true);

      const cluster = {
        canonical_category: 'Billing',
        cluster_title: 'Misaligned Invoice Items',
        root_cause_hypothesis: '',
        quotes: [{ quote_snippet: 'The invoice line items are misaligned' }],
      };

      const enriched = enrichClusterWithRootCauseHypothesis(cluster, texts);
      expect(enriched.needs_investigation).toBe(true);
      expect(enriched.investigation_placeholder).toBe(INVESTIGATION_PLACEHOLDER);
      expect(enriched.root_cause_hypothesis).toContain('Workflow friction');
      expect(enriched.root_cause_hypothesis).toContain(INVESTIGATION_PLACEHOLDER);
    });
  });
});

describe('M2-D & TS-007: Adversarial / Profane Feedback Handling', () => {
  it('preserves profane/angry feedback verbatim and processes it without throwing unhandled error (TS-007)', async () => {
    const profaneFeedback = 'Your app is trash, export fails with 504 timeout! Fix this fucking bug now!';
    const rows = createMockRows([
      { id: 'FB-ANGRY-01', text: profaneFeedback },
      { id: 'FB-002', text: 'Billing page UI styling is terrible and confusing.' },
    ]);

    // Mock AI batch cluster response that successfully groups the functional issue
    const mockClusters: ClusterResponseItem[] = [
      {
        cluster_id: 'CLUST-01',
        cluster_title: 'Export Gateway Timeouts',
        canonical_category: 'Export',
        problem_summary: 'Users report export operation failures with HTTP 504 gateway timeout.',
        root_cause_hypothesis: 'Upstream gateway termination before async export completion.',
        severity_rating: 3,
        member_feedback_ids: ['FB-ANGRY-01'],
        quotes: [
          {
            feedback_id: 'FB-ANGRY-01',
            quote_snippet: 'export fails with 504 timeout',
          },
        ],
      },
      {
        cluster_id: 'CLUST-02',
        cluster_title: 'Billing Page Ergonomics',
        canonical_category: 'Billing',
        problem_summary: 'Users express frustration with billing UI ergonomics.',
        root_cause_hypothesis: '',
        severity_rating: 1,
        member_feedback_ids: ['FB-002'],
        quotes: [
          {
            feedback_id: 'FB-002',
            quote_snippet: 'Billing page UI styling is terrible',
          },
        ],
      },
    ];

    const mockFetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/reconcile')) {
        return new Response(JSON.stringify({ decisions: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ clusters: mockClusters }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    // Run two-pass clustering pipeline on profane feedback
    let pipelineResult: any;
    expect(async () => {
      pipelineResult = await runTwoPassClusteringPipeline(rows, {
        pacingMs: 0,
        fetcher: mockFetcher,
      });
    }).not.toThrow();

    pipelineResult = await runTwoPassClusteringPipeline(rows, {
      pacingMs: 0,
      fetcher: mockFetcher,
    });

    // 1. Raw row is strictly preserved and not censored or modified in memory (IC-001)
    expect(rows[0].text).toBe(profaneFeedback);
    expect(rows[0].rawRow.text).toBe(profaneFeedback);

    // 2. Cluster 1 contains the functional failure
    const exportCluster = pipelineResult.finalClusters.find((c: any) => c.cluster_id === 'CLUST-01');
    expect(exportCluster).toBeDefined();
    expect(exportCluster.member_feedback_ids).toContain('FB-ANGRY-01');
    // Technical signal "504 timeout" detected in profane feedback -> needs_investigation = false
    expect(exportCluster.needs_investigation).toBe(false);

    // 3. Cluster 2 has non-technical complaint -> needs_investigation = true + workflow friction
    const billingCluster = pipelineResult.finalClusters.find((c: any) => c.cluster_id === 'CLUST-02');
    expect(billingCluster).toBeDefined();
    expect(billingCluster.needs_investigation).toBe(true);
    expect(billingCluster.root_cause_hypothesis).toContain('Workflow friction');
    expect(billingCluster.root_cause_hypothesis).toContain(INVESTIGATION_PLACEHOLDER);
  });
});

describe('M2-D & TS-009: Malformed AI Response Recovery & Graceful Fallback', () => {
  it('retries malformed AI response up to 3x, then falls back to Unclustered gracefully (TS-009)', async () => {
    const rows = createMockRows([
      { id: 'FB-001', text: 'Cannot download invoice pdf' },
      { id: 'FB-002', text: 'Table view is broken on mobile' },
    ]);

    let attemptCount = 0;
    const mockFetcher = vi.fn().mockImplementation(async () => {
      attemptCount++;
      return new Response('<<< MALFORMED NON-JSON RESPONSE >>>', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await runTwoPassClusteringPipeline(rows, {
      pacingMs: 0,
      maxRetries: 3,
      backoffBaseMs: 1,
      fetcher: mockFetcher,
    });

    // 1. 1 initial attempt + 3 retries = 4 total attempts made
    expect(attemptCount).toBe(4);
    expect(result.pass1Pipeline.batchResults[0].status).toBe('FAILED');
    expect(result.pass1Pipeline.batchResults[0].attemptsMade).toBe(4);

    // 2. All items routed to CLUST-UNC with S=1, P=0 per GAP-11
    expect(result.finalClusters).toHaveLength(0);
    expect(result.clustUnc).not.toBeNull();
    expect(result.clustUnc?.cluster_id).toBe('CLUST-UNC');
    expect(result.clustUnc?.severity_rating).toBe(1);
    expect(result.clustUnc?.priority_score).toBe(0);
    expect(result.clustUnc?.member_feedback_ids).toEqual(['FB-001', 'FB-002']);

    // 3. Root-cause hypothesis on CLUST-UNC includes investigation placeholder
    expect(result.clustUnc?.needs_investigation).toBe(true);
    expect(result.clustUnc?.investigation_placeholder).toBe(INVESTIGATION_PLACEHOLDER);

    // 4. Invariant preserved: 1:1 ID integrity holds
    expect(result.diagnostics.totalInputIds).toBe(2);
    expect(result.diagnostics.unclusteredIdsCount).toBe(2);
    expect(result.pass2Reconciliation.integrity.isValid).toBe(true);

    // 5. Raw rows remain 100% intact and unmutated in memory (IC-001)
    expect(rows[0].text).toBe('Cannot download invoice pdf');
    expect(rows[1].text).toBe('Table view is broken on mobile');
  });
});

describe('M2-D & TS-037: Persistent Failure / Quota Exhaustion Degradation & Retry Support', () => {
  it('degrades gracefully to CLUST-UNC with explanatory message and supports retrying only failed batches (TS-037)', async () => {
    // 2 batches of feedback rows
    const rows = createMockRows(
      Array.from({ length: 60 }, (_, i) => ({
        id: `FB-${String(i + 1).padStart(3, '0')}`,
        text: `Feedback item number ${i + 1} regarding table rendering`,
      }))
    );

    let attemptsByBatch = new Map<number, number>();

    // Mock fetcher that permanently returns HTTP 429 quota exhaustion
    const mockQuotaExhaustedFetcher = vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body as string);
      const batchIdx = body.batch_index ?? 0;
      attemptsByBatch.set(batchIdx, (attemptsByBatch.get(batchIdx) || 0) + 1);

      return new Response(
        JSON.stringify({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Upstream rate limit quota exhausted.',
          },
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    const result = await runTwoPassClusteringPipeline(rows, {
      pacingMs: 0,
      maxRetries: 3,
      backoffBaseMs: 1,
      fetcher: mockQuotaExhaustedFetcher,
    });

    // 1. Fully failed state detected and reported
    expect(result.isFullyFailed).toBe(true);
    expect(result.failedBatchIndices).toEqual([0, 1]);
    expect(result.advisoryBannerMessage).toContain('AI analysis degraded: all batches failed');

    // 2. All 60 rows routed to CLUST-UNC (S=1, P=0)
    expect(result.finalClusters).toHaveLength(0);
    expect(result.clustUnc).not.toBeNull();
    expect(result.clustUnc?.cluster_id).toBe('CLUST-UNC');
    expect(result.clustUnc?.severity_rating).toBe(1);
    expect(result.clustUnc?.priority_score).toBe(0);
    expect(result.clustUnc?.member_feedback_ids).toHaveLength(60);

    // 3. ID integrity invariant holds (GAP-11)
    expect(result.pass2Reconciliation.integrity.isValid).toBe(true);

    // 4. IC-015 Enforcement: Strictly zero local semantic models or fake keyword clustering used
    // Cluster title and category are transparently Unclustered
    expect(result.clustUnc?.canonical_category).toBe('Unclustered');
    expect(result.clustUnc?.cluster_title).toBe('Unclustered Feedback');

    // 5. Retry failed batches: Run retry only on failed batches
    const mockRecoveredFetcher = vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          clusters: [
            {
              cluster_id: `CLUST-RETRY-${body.batch_index}`,
              cluster_title: `Recovered Batch ${body.batch_index}`,
              canonical_category: 'Rendering',
              problem_summary: `Resolved items from batch ${body.batch_index}`,
              root_cause_hypothesis: 'CSS layout reflow performance.',
              severity_rating: 2,
              member_feedback_ids: body.items.map((it: any) => it.feedback_id),
              quotes: [],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    // Retry only batch 0
    const retryResult = await runTwoPassClusteringPipeline(rows, {
      pacingMs: 0,
      retryBatchIndices: [0],
      fetcher: mockRecoveredFetcher,
    });

    // Batch 0 succeeded and formed a cluster; batch 1 was skipped and routed to CLUST-UNC
    expect(retryResult.isFullyFailed).toBe(false);
    expect(retryResult.failedBatchIndices).toHaveLength(0);
    expect(retryResult.finalClusters.length).toBeGreaterThanOrEqual(1);
    expect(retryResult.pass2Reconciliation.integrity.isValid).toBe(true);
  });
});
