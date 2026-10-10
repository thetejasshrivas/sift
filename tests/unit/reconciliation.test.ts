/**
 * tests/unit/reconciliation.test.ts — Pass 2 Reconciliation, TS-019, TS-026, and Proxy Endpoint Suite
 * Validates PRD REQ-006, §5.4–5.6, TS-019, TS-026; IC-003, IC-004, IC-010, IC-011, IC-015; Gate G-M2C.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  reconcilePass2Clusters,
  runTwoPassClusteringPipeline,
} from '../../src/ai/reconciliation';
import { assemblePass1Clusters } from '../../src/ai/assembly';
import { handleReconcileRequest } from '../../api/reconcile';
import { ClusterResponseItem } from '../../src/types/ai';



import { ProcessedFeedbackRow } from '../../src/types/identity';

function createMockRow(id: string, text: string, tier: 'Enterprise' | 'Pro / Mid-Market' | 'Free / Starter' | 'UNKNOWN' = 'Enterprise'): ProcessedFeedbackRow {
  return {
    identity: {
      feedbackId: id,
      userId: `user-${id}`,
      accountId: `acc-${id}`,
    },
    text,
    tierResolution: {
      canonicalTier: tier,
      weight: tier === 'Enterprise' ? 3.0 : tier === 'Pro / Mid-Market' ? 2.0 : 1.0,
      weightLabel: 'Tier-Weighted',
      isUnrecognized: tier === 'UNKNOWN',
    },
    rawRow: { feedback: text, tier },
    rowIndex: 1,
  };
}

describe('Pass 2 Cross-Batch Theme Reconciliation Pipeline (REQ-006, TS-019, TS-026)', () => {
  describe('Canonical Category Grouping & Request Caps (PRD §5.4)', () => {
    it('makes zero network requests for categories with only 1 cluster, and at most 1 request for categories with >1 cluster', async () => {
      const inputIds = ['FB-001', 'FB-002', 'FB-003'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Export Lag 1',
          canonical_category: 'Export', // Group 1 (count: 2)
          problem_summary: 'Slow exports.',
          root_cause_hypothesis: 'Query index.',
          severity_rating: 2,
          member_feedback_ids: ['FB-001'],
          quotes: [{ feedback_id: 'FB-001', quote_snippet: 'slow exports' }],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Export Lag 2',
          canonical_category: 'Export', // Group 1 (count: 2)
          problem_summary: 'CSV export delay.',
          root_cause_hypothesis: 'CSV serializer.',
          severity_rating: 3,
          member_feedback_ids: ['FB-002'],
          quotes: [{ feedback_id: 'FB-002', quote_snippet: 'export delay' }],
        },
        {
          cluster_id: 'CLUST-03',
          cluster_title: 'Login Bug',
          canonical_category: 'Authentication', // Group 2 (count: 1) -> 0 requests!
          problem_summary: 'SSO failure.',
          root_cause_hypothesis: 'SAML expiration.',
          severity_rating: 3,
          member_feedback_ids: ['FB-003'],
          quotes: [],
        },
      ];

      const pass1Result = assemblePass1Clusters(inputIds, rawClusters);
      const callPayloads: any[] = [];

      const mockFetcher = vi.fn().mockImplementation(async (_url: string, init: any) => {
        const body = JSON.parse(init.body);
        callPayloads.push(body);
        return new Response(
          JSON.stringify({
            decisions: [
              {
                cluster_ids: ['CLUST-01', 'CLUST-02'],
                action: 'MERGE',
                rationale: 'Both describe unoptimized export pipeline latencies.',
                merged_cluster_title: 'Unified Export Performance Issues',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const result = await reconcilePass2Clusters(pass1Result, inputIds, {
        fetcher: mockFetcher,
      });

      // Exactly 1 network request made (for Export category), 0 for Authentication
      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(callPayloads[0].canonical_category).toBe('Export');
      expect(callPayloads[0].clusters).toHaveLength(2);

      // Verify request payload contains cluster summaries + quote IDs only, strictly NO raw text (PRD §5.4 / §9.2)
      expect(callPayloads[0].clusters[0].quote_feedback_ids).toEqual(['FB-001']);
      expect(callPayloads[0].clusters[0].raw_text).toBeUndefined();
      expect(callPayloads[0].clusters[0].text).toBeUndefined();

      // Invariant holds
      expect(result.integrity.isValid).toBe(true);
      expect(result.clusters).toHaveLength(2); // CLUST-01 & CLUST-02 merged into 1 + CLUST-03 = 2
    });
  });

  describe('Pass-2 MERGE Decision (PRD REQ-006 & IC-003)', () => {
    it('unions member feedback IDs, sets S=max(S_i), preserves all source quotes, and maintains unique-ID invariant', async () => {
      const inputIds = ['FB-001', 'FB-002', 'FB-003'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Export Timeout A',
          canonical_category: 'Performance',
          problem_summary: 'Exports timeout after 30s.',
          root_cause_hypothesis: 'Lack of pagination.',
          severity_rating: 2,
          member_feedback_ids: ['FB-001', 'FB-002'],
          quotes: [{ feedback_id: 'FB-001', quote_snippet: 'timeout after 30s' }],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Export Timeout B',
          canonical_category: 'Performance',
          problem_summary: '504 gateway timeout on reports.',
          root_cause_hypothesis: 'Synchronous blocking handler.',
          severity_rating: 3, // S=3
          member_feedback_ids: ['FB-003'],
          quotes: [{ feedback_id: 'FB-003', quote_snippet: '504 gateway timeout' }],
        },
      ];

      const pass1Result = assemblePass1Clusters(inputIds, rawClusters);

      const mockFetcher = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            decisions: [
              {
                cluster_ids: ['CLUST-01', 'CLUST-02'],
                action: 'MERGE',
                rationale: 'Identical backend query timeout bottlenecks on large datasets.',
                merged_cluster_title: 'Consolidated Export Timeout Bottlenecks',
                merged_problem_summary: 'Exports trigger 30s timeout and 504 gateway errors.',
                merged_root_cause_hypothesis: 'Unpaginated database queries in synchronous worker.',
              },
            ],
          }),
          { status: 200 }
        );
      });

      const result = await reconcilePass2Clusters(pass1Result, inputIds, { fetcher: mockFetcher });

      expect(result.clusters).toHaveLength(1);
      const merged = result.clusters[0];

      // 1. Lowest cluster ID retained
      expect(merged.cluster_id).toBe('CLUST-01');
      expect(merged.cluster_title).toBe('Consolidated Export Timeout Bottlenecks');

      // 2. Union member IDs without duplicates
      expect(merged.member_feedback_ids.sort()).toEqual(['FB-001', 'FB-002', 'FB-003']);

      // 3. S_c = max(S_1, S_2) = max(2, 3) = 3
      expect(merged.severity_rating).toBe(3);

      // 4. All quotes preserved
      expect(merged.quotes).toHaveLength(2);
      expect(merged.quotes.map((q) => q.feedback_id).sort()).toEqual(['FB-001', 'FB-003']);

      // 5. Invariant verified
      expect(result.integrity.isValid).toBe(true);
      expect(result.integrity.totalAssignedIds).toBe(3);
    });
  });

  describe('Pass-2 UNCERTAIN Decision & Review Badging (TS-019 & PRD §5.6)', () => {
    it('flags ambiguous cross-batch match as "Uncertain Cluster — Review Recommended", keeps clusters separate, and exposes rationale (TS-019)', async () => {
      const inputIds = ['FB-001', 'FB-002'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Session Expiration During Editing',
          canonical_category: 'Authentication',
          problem_summary: 'Users logged out while writing long drafts.',
          root_cause_hypothesis: 'JWT token 15-minute expiration without refresh.',
          severity_rating: 2,
          member_feedback_ids: ['FB-001'],
          quotes: [{ feedback_id: 'FB-001', quote_snippet: 'logged out while writing' }],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Unexpected Logout on Tab Switch',
          canonical_category: 'Authentication',
          problem_summary: 'Switching browser tabs clears active authentication state.',
          root_cause_hypothesis: 'Local storage broadcast channel race condition.',
          severity_rating: 2,
          member_feedback_ids: ['FB-002'],
          quotes: [{ feedback_id: 'FB-002', quote_snippet: 'clears active authentication' }],
        },
      ];

      const pass1Result = assemblePass1Clusters(inputIds, rawClusters);

      const mockFetcher = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            decisions: [
              {
                cluster_ids: ['CLUST-01', 'CLUST-02'],
                action: 'UNCERTAIN',
                rationale:
                  'Both issues describe sudden logouts, but one appears related to token lifetime while the other is triggered by tab switching. Ambiguous root cause.',
              },
            ],
          }),
          { status: 200 }
        );
      });

      const result = await reconcilePass2Clusters(pass1Result, inputIds, { fetcher: mockFetcher });

      // UNCERTAIN: Clusters must remain SEPARATE (not merged)
      expect(result.clusters).toHaveLength(2);

      const c1 = result.clusters.find((c) => c.cluster_id === 'CLUST-01');
      const c2 = result.clusters.find((c) => c.cluster_id === 'CLUST-02');

      // Both clusters must carry the explicit review badge (TS-019 / PRD §5.6)
      expect(c1?.isUncertain).toBe(true);
      expect(c1?.reviewFlag).toBe('Uncertain Cluster — Review Recommended');
      expect(c1?.uncertainRationale).toContain('Both issues describe sudden logouts');

      expect(c2?.isUncertain).toBe(true);
      expect(c2?.reviewFlag).toBe('Uncertain Cluster — Review Recommended');
      expect(c2?.uncertainRationale).toContain('Both issues describe sudden logouts');

      // Member IDs remain separate
      expect(c1?.member_feedback_ids).toEqual(['FB-001']);
      expect(c2?.member_feedback_ids).toEqual(['FB-002']);

      // Invariant holds
      expect(result.integrity.isValid).toBe(true);
    });
  });

  describe('Pass-2 KEEP_SEPARATE Decision (PRD §5.4 & IC-003)', () => {
    it('leaves distinct clusters separate and unmodified when KEEP_SEPARATE is decided', async () => {
      const inputIds = ['FB-001', 'FB-002'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'SAML SSO Config Error',
          canonical_category: 'Authentication',
          problem_summary: 'Metadata XML rejected.',
          root_cause_hypothesis: 'Certificate format validation.',
          severity_rating: 3,
          member_feedback_ids: ['FB-001'],
          quotes: [],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Password Reset Link Expired',
          canonical_category: 'Authentication',
          problem_summary: 'Emails delivered after 2 hours.',
          root_cause_hypothesis: 'SMTP queue delay.',
          severity_rating: 2,
          member_feedback_ids: ['FB-002'],
          quotes: [],
        },
      ];

      const pass1Result = assemblePass1Clusters(inputIds, rawClusters);

      const mockFetcher = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            decisions: [
              {
                cluster_ids: ['CLUST-01', 'CLUST-02'],
                action: 'KEEP_SEPARATE',
                rationale: 'SAML metadata parsing is an enterprise identity issue, whereas password reset email latency is an infrastructure mail delivery issue.',
              },
            ],
          }),
          { status: 200 }
        );
      });

      const result = await reconcilePass2Clusters(pass1Result, inputIds, { fetcher: mockFetcher });

      expect(result.clusters).toHaveLength(2);
      expect(result.clusters[0].isUncertain).toBeFalsy();
      expect(result.clusters[1].isUncertain).toBeFalsy();
      expect(result.integrity.isValid).toBe(true);
    });
  });

  describe('Pass-2 Degradation Recovery & Failure Fallback (REQ-006 & IC-015)', () => {
    it('preserves Pass-1 clusters 100% intact with an advisory banner when Pass 2 encounters an operational error', async () => {
      const inputIds = ['FB-001', 'FB-002'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Batch 1 Cluster',
          canonical_category: 'Export',
          problem_summary: 'Summary 1.',
          root_cause_hypothesis: 'Cause 1.',
          severity_rating: 2,
          member_feedback_ids: ['FB-001'],
          quotes: [],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Batch 2 Cluster',
          canonical_category: 'Export',
          problem_summary: 'Summary 2.',
          root_cause_hypothesis: 'Cause 2.',
          severity_rating: 3,
          member_feedback_ids: ['FB-002'],
          quotes: [],
        },
      ];

      const pass1Result = assemblePass1Clusters(inputIds, rawClusters);

      // Mock fetcher that throws a network failure
      const mockFetcher = vi.fn().mockRejectedValue(new Error('503 Service Unavailable / Gateway Timeout'));

      const result = await reconcilePass2Clusters(pass1Result, inputIds, { fetcher: mockFetcher });

      // Pass-1 clusters preserved 100% intact
      expect(result.clusters).toHaveLength(2);
      expect(result.clusters[0].cluster_id).toBe('CLUST-01');
      expect(result.clusters[1].cluster_id).toBe('CLUST-02');

      // Failure flagged and advisory banner message set
      expect(result.hasFailures).toBe(true);
      expect(result.advisoryBannerMessage).toContain('Pass 2 theme reconciliation degraded');

      // Invariant holds
      expect(result.integrity.isValid).toBe(true);
    });

    it('falls back to Pass-1 clusters if Pass 2 output violates the ID integrity invariant', async () => {
      const inputIds = ['FB-001', 'FB-002'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Batch 1',
          canonical_category: 'General',
          problem_summary: 'Sum 1',
          root_cause_hypothesis: 'Cause 1',
          severity_rating: 1,
          member_feedback_ids: ['FB-001'],
          quotes: [],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Batch 2',
          canonical_category: 'General',
          problem_summary: 'Sum 2',
          root_cause_hypothesis: 'Cause 2',
          severity_rating: 1,
          member_feedback_ids: ['FB-002'],
          quotes: [],
        },
      ];

      const pass1Result = assemblePass1Clusters(inputIds, rawClusters);

      // Return decision referencing non-existent cluster
      const mockFetcher = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            decisions: [
              {
                cluster_ids: ['NON_EXISTENT_1', 'NON_EXISTENT_2'],
                action: 'MERGE',
                rationale: 'Phantom merge.',
              },
            ],
          }),
          { status: 200 }
        )
      );

      const result = await reconcilePass2Clusters(pass1Result, inputIds, { fetcher: mockFetcher });

      // Cleanly preserved preliminary batch clusters
      expect(result.clusters).toHaveLength(2);
      expect(result.integrity.isValid).toBe(true);
    });
  });

  describe('End-to-End Two-Pass Pipeline & TS-026 Integration', () => {
    it('executes full pipeline: batching → assembly → GAP-13 deduplication → CLUST-UNC → Pass-2 reconciliation (TS-026)', async () => {
      const rows = [
        createMockRow('FB-001', 'Export latency on big datasets'),
        createMockRow('FB-002', 'Export progress bar freezing'),
        createMockRow('FB-003', 'SSO authentication login loop'),
        createMockRow('FB-004', 'Raw unclustered edge case'),
      ];

      let callIndex = 0;
      const mockFetcher = vi.fn().mockImplementation(async (url: string) => {
        callIndex++;
        if (url.includes('/api/cluster')) {
          // Pass 1 batch response: returns 3 clusters, omitting FB-004 to test CLUST-UNC
          // Also duplicates FB-002 in CLUST-01 and CLUST-02 to test GAP-13
          return new Response(
            JSON.stringify({
              clusters: [
                {
                  cluster_id: 'CLUST-01',
                  cluster_title: 'Export Latency',
                  canonical_category: 'Export',
                  problem_summary: 'Slow exports.',
                  root_cause_hypothesis: 'Unindexed query.',
                  severity_rating: 2,
                  member_feedback_ids: ['FB-001', 'FB-002'],
                  quotes: [{ feedback_id: 'FB-001', quote_snippet: 'Export latency on big datasets' }],
                },
                {
                  cluster_id: 'CLUST-02',
                  cluster_title: 'Export Freezing',
                  canonical_category: 'Export',
                  problem_summary: 'UI freeze.',
                  root_cause_hypothesis: 'Main thread blocked.',
                  severity_rating: 3, // S=3 -> Wins FB-002 per GAP-13
                  member_feedback_ids: ['FB-002'],
                  quotes: [{ feedback_id: 'FB-002', quote_snippet: 'Export progress bar freezing' }],
                },
                {
                  cluster_id: 'CLUST-03',
                  cluster_title: 'SSO Login Loop',
                  canonical_category: 'Authentication',
                  problem_summary: 'Login redirect loop.',
                  root_cause_hypothesis: 'Cookie domain mismatch.',
                  severity_rating: 3,
                  member_feedback_ids: ['FB-003'],
                  quotes: [{ feedback_id: 'FB-003', quote_snippet: 'SSO authentication login loop' }],
                },
              ],
            }),
            { status: 200 }
          );
        } else if (url.includes('/api/reconcile')) {
          // Pass 2 reconciliation response: merges Export clusters
          return new Response(
            JSON.stringify({
              decisions: [
                {
                  cluster_ids: ['CLUST-01', 'CLUST-02'],
                  action: 'MERGE',
                  rationale: 'Both are symptoms of synchronous export processing bottlenecks.',
                  merged_cluster_title: 'Consolidated Export Pipeline Failures',
                  merged_problem_summary: 'Exports freeze browser and exhibit high latency.',
                  merged_root_cause_hypothesis: 'Synchronous CSV rendering on main thread.',
                },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 404 });
      });

      const pipelineResult = await runTwoPassClusteringPipeline(rows, {
        pacingMs: 0,
        fetcher: mockFetcher,
      });

      // 1. GAP-13 Duplicate Resolution was executed during Pass-1 assembly
      expect(pipelineResult.diagnostics.duplicateAssignmentsResolvedCount).toBe(1);
      expect(pipelineResult.diagnostics.duplicatesResolvedDetails[0].feedbackId).toBe('FB-002');
      expect(pipelineResult.diagnostics.duplicatesResolvedDetails[0].keptInClusterId).toBe('CLUST-02');

      // 2. GAP-11 Unclustered fallback isolated FB-004 into CLUST-UNC
      expect(pipelineResult.clustUnc).not.toBeNull();
      expect(pipelineResult.clustUnc?.cluster_id).toBe('CLUST-UNC');
      expect(pipelineResult.clustUnc?.member_feedback_ids).toEqual(['FB-004']);
      expect(pipelineResult.clustUnc?.severity_rating).toBe(1);
      expect(pipelineResult.clustUnc?.priority_score).toBe(0);

      // 3. Pass 2 merged CLUST-01 and CLUST-02 into a single cluster
      expect(pipelineResult.finalClusters).toHaveLength(2); // Merged Export + SSO
      const mergedExport = pipelineResult.finalClusters.find((c) => c.cluster_title.includes('Consolidated Export'));
      expect(mergedExport).toBeDefined();
      expect(mergedExport?.member_feedback_ids.sort()).toEqual(['FB-001', 'FB-002']);
      expect(mergedExport?.severity_rating).toBe(3); // max(2, 3) = 3
      expect(mergedExport?.quotes).toHaveLength(2);

      // 4. Strict 1:1 ID integrity holds across every input row
      expect(pipelineResult.pass2Reconciliation.integrity.isValid).toBe(true);
      expect(pipelineResult.pass2Reconciliation.integrity.totalInputIds).toBe(4);
      expect(pipelineResult.pass2Reconciliation.integrity.totalAssignedIds).toBe(4);
      expect(pipelineResult.pass2Reconciliation.integrity.missingIds).toHaveLength(0);
      expect(pipelineResult.pass2Reconciliation.integrity.duplicateIds).toHaveLength(0);
    });
  });

  describe('Serverless Proxy Endpoint: POST /api/reconcile', () => {
    const validPayload = {
      canonical_category: 'Export',
      clusters: [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Title 1',
          problem_summary: 'Summary 1',
          severity_rating: 2,
          quote_feedback_ids: ['FB-001'],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Title 2',
          problem_summary: 'Summary 2',
          severity_rating: 3,
          quote_feedback_ids: ['FB-002'],
        },
      ],
    };

    it('rejects non-POST HTTP methods with 405 Method Not Allowed', async () => {
      const req = new Request('http://localhost:5173/api/reconcile', { method: 'GET' });
      const res = await handleReconcileRequest(req);
      expect(res.status).toBe(405);
      const data = await res.json();
      expect(data.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects unsupported Content-Type with 415 Unsupported Media Type', async () => {
      const req = new Request('http://localhost:5173/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text',
      });
      const res = await handleReconcileRequest(req);
      expect(res.status).toBe(415);
      const data = await res.json();
      expect(data.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects unauthorized Origin header with 403 Forbidden (IC-010)', async () => {
      const req = new Request('http://localhost:5173/api/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://malicious-website.com',
        },
        body: JSON.stringify(validPayload),
      });
      const res = await handleReconcileRequest(req, { ALLOWED_ORIGIN: 'http://localhost:5173' });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('ORIGIN_FORBIDDEN');
    });

    it('rejects payload missing canonical_category or with < 2 clusters with 400 Bad Request', async () => {
      const req = new Request('http://localhost:5173/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonical_category: 'Export', clusters: [validPayload.clusters[0]] }),
      });
      const res = await handleReconcileRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe('SCHEMA_VALIDATION_FAILED');
    });

    it('returns 500 sanitized error when AI_API_KEY is unconfigured on server (TS-023)', async () => {
      const req = new Request('http://localhost:5173/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });
      const res = await handleReconcileRequest(req, { AI_API_KEY: '' });
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.code).toBe('API_KEY_UNCONFIGURED');
    });

    it('forwards to upstream AI provider and returns 200 with validated decisions on valid response', async () => {
      const req = new Request('http://localhost:5173/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      const mockUpstreamFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        decisions: [
                          {
                            cluster_ids: ['CLUST-01', 'CLUST-02'],
                            action: 'MERGE',
                            rationale: 'Identical export bottlenecks.',
                            merged_cluster_title: 'Consolidated Export',
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        )
      );

      const res = await handleReconcileRequest(
        req,
        { AI_API_KEY: 'test-key', AI_MODEL: 'gemini-3.5-flash' },
        mockUpstreamFetch
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.decisions).toHaveLength(1);
      expect(data.decisions[0].action).toBe('MERGE');

      // Verify key was never echoed in headers or body (TS-023)
      expect(res.headers.get('authorization')).toBeNull();
      expect(JSON.stringify(data)).not.toContain('test-key');
    });
  });
});
