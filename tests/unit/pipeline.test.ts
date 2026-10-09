/**
 * tests/unit/pipeline.test.ts — Client AI Pipeline, Batching, Pacing, and Retries Test Suite (M2-B)
 * Validates TS-009, TS-012, TS-031, TS-033, TS-034; PRD REQ-005, §5.2, §5.8; IC-004, IC-008, IC-015; DEC-PROVIDER.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  chunkFeedbackRows,
  calculatePreFlightEstimate,
  runPass1BatchPipeline,
  calculateBackoffDelay,
} from '../../src/ai';
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

function createSampleRows(count: number): ProcessedFeedbackRow[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `FB-${String(i + 1).padStart(3, '0')}`;
    return createMockRow(id, `Feedback message regarding export performance row ${i + 1}`);
  });
}

const MOCK_CLUSTERS = [
  {
    cluster_id: 'CLUST-01',
    cluster_title: 'Export Performance Bottlenecks',
    canonical_category: 'Performance',
    problem_summary: 'Users experience slow exports.',
    root_cause_hypothesis: 'Unoptimized synchronous query.',
    severity_rating: 3,
    member_feedback_ids: ['FB-001', 'FB-002'],
    quotes: [
      {
        feedback_id: 'FB-001',
        quote_snippet: 'export performance',
      },
    ],
  },
];

describe('Pass-1 Client AI Pipeline: Batching, Retries, Pacing & Pacing (M2-B)', () => {
  describe('Row Chunking (PRD §5.2 & REQ-005)', () => {
    it('chunks rows into discrete batches of <= 50 rows', () => {
      const rows = createSampleRows(125);
      const batches = chunkFeedbackRows(rows, 50);

      expect(batches).toHaveLength(3);
      expect(batches[0].items).toHaveLength(50);
      expect(batches[0].batchIndex).toBe(0);
      expect(batches[0].totalBatches).toBe(3);

      expect(batches[1].items).toHaveLength(50);
      expect(batches[1].batchIndex).toBe(1);

      expect(batches[2].items).toHaveLength(25);
      expect(batches[2].batchIndex).toBe(2);
      expect(batches[2].totalBatches).toBe(3);

      // Verify row text and IDs are preserved verbatim
      expect(batches[0].items[0].feedback_id).toBe('FB-001');
      expect(batches[0].items[0].text).toBe(rows[0].text);
      expect(batches[0].sourceRows[0]).toBe(rows[0]);
    });

    it('returns empty array when rows input is empty', () => {
      expect(chunkFeedbackRows([])).toEqual([]);
    });
  });

  describe('Pre-Flight Capacity & Duration Estimation (TS-034 & DEC-PROVIDER)', () => {
    it('computes correct Pass-1 calls, Pass-2 consolidation calls, and estimated minutes across key scenarios (TS-034)', () => {
      // Scenario 1: 50 rows (Single batch, 0 Pass-2 calls)
      const est50 = calculatePreFlightEstimate(50);
      expect(est50.pass1Calls).toBe(1);
      expect(est50.pass2CallsUpperBound).toBe(0);
      expect(est50.totalCalls).toBe(1);
      expect(est50.estimatedMinutes).toBe(1); // ~32s -> 1 min

      // Scenario 2: 300 rows (P0 MVP Baseline target)
      const est300 = calculatePreFlightEstimate(300);
      expect(est300.pass1Calls).toBe(6);
      expect(est300.pass2CallsUpperBound).toBe(5);
      expect(est300.totalCalls).toBe(11);
      // (6 * 32) + (5 * 20) + (10 * 6) = 192 + 100 + 60 = 352s -> 6 min (~5 min benchmark in COST_LOG)
      expect(est300.estimatedMinutes).toBeGreaterThanOrEqual(4);
      expect(est300.estimatedMinutes).toBeLessThanOrEqual(6);

      // Scenario 3: 1,000 rows (Mid-tier dataset)
      const est1000 = calculatePreFlightEstimate(1000);
      expect(est1000.pass1Calls).toBe(20);
      expect(est1000.pass2CallsUpperBound).toBe(5);
      expect(est1000.totalCalls).toBe(25);
      expect(est1000.estimatedMinutes).toBeGreaterThanOrEqual(13);
      expect(est1000.estimatedMinutes).toBeLessThanOrEqual(16);

      // Scenario 4: 2,000 rows (PRD Maximum Ceiling)
      const est2000 = calculatePreFlightEstimate(2000);
      expect(est2000.pass1Calls).toBe(40);
      expect(est2000.pass2CallsUpperBound).toBe(5);
      expect(est2000.totalCalls).toBe(45);
      expect(est2000.estimatedMinutes).toBeGreaterThanOrEqual(25);
      expect(est2000.estimatedMinutes).toBeLessThanOrEqual(30);

      // Scenario 5: 0 rows
      const est0 = calculatePreFlightEstimate(0);
      expect(est0.totalCalls).toBe(0);
      expect(est0.estimatedMinutes).toBe(0);
    });
  });

  describe('Malformed LLM Response Recovery & Unclustered Routing (TS-009 & PRD §5.8)', () => {
    it('retries malformed JSON response up to 3 times and routes permanently failed items to unclustered (TS-009)', async () => {
      const rows = createSampleRows(10);
      let callCount = 0;

      // Mock fetcher that permanently returns malformed JSON
      const mockFetcher = vi.fn().mockImplementation(async () => {
        callCount++;
        return new Response('Invalid non-json syntax { [ corrupted ...', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await runPass1BatchPipeline(rows, {
        pacingMs: 0,
        maxRetries: 3,
        backoffBaseMs: 5,
        fetcher: mockFetcher,
      });

      // 1 initial attempt + 3 retries = 4 total attempts made
      expect(callCount).toBe(4);
      expect(result.batchResults).toHaveLength(1);
      expect(result.batchResults[0].status).toBe('FAILED');
      expect(result.batchResults[0].attemptsMade).toBe(4);
      expect(result.batchResults[0].errorCode).toBe('MALFORMED_JSON_RESPONSE');

      // Failed IDs routed to unclustered collection for M2-C
      expect(result.failedFeedbackIds).toHaveLength(10);
      expect(result.failedFeedbackIds).toEqual(rows.map((r) => r.identity.feedbackId));
      expect(result.hasPartialFailures).toBe(true);
      expect(result.allClusters).toHaveLength(0);

      // Source rows remain completely preserved and unmutated in memory (IC-001)
      expect(rows[0].text).toBe('Feedback message regarding export performance row 1');
      expect(rows).toHaveLength(10);
    });

    it('recovers cleanly when an initial malformed JSON is followed by a valid response', async () => {
      const rows = createSampleRows(5);
      let attempt = 0;

      const mockFetcher = vi.fn().mockImplementation(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response('Corrupted JSON', { status: 200 });
        }
        return new Response(JSON.stringify({ clusters: MOCK_CLUSTERS }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await runPass1BatchPipeline(rows, {
        pacingMs: 0,
        maxRetries: 3,
        backoffBaseMs: 5,
        fetcher: mockFetcher,
      });

      expect(attempt).toBe(2);
      expect(result.batchResults[0].status).toBe('SUCCESS');
      expect(result.batchResults[0].attemptsMade).toBe(2);
      expect(result.allClusters).toHaveLength(1);
      expect(result.failedFeedbackIds).toHaveLength(0);
      expect(result.hasPartialFailures).toBe(false);
    });
  });

  describe('Rate Limiting (429) & Exponential Backoff (TS-012 & PRD §5.8)', () => {
    it('triggers exponential backoff on HTTP 429, honors Retry-After, and succeeds on retry (TS-012)', async () => {
      const rows = createSampleRows(5);
      let callCount = 0;

      const mockFetcher = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return new Response(JSON.stringify({ error: 'Rate limit reached', code: 'RATE_LIMIT_EXCEEDED' }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '0', // 0s in fast test
            },
          });
        }
        return new Response(JSON.stringify({ clusters: MOCK_CLUSTERS }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await runPass1BatchPipeline(rows, {
        pacingMs: 0,
        maxRetries: 3,
        backoffBaseMs: 5,
        fetcher: mockFetcher,
      });

      // Required 3 calls (2 retries + 1 success)
      expect(callCount).toBe(3);
      expect(result.batchResults[0].status).toBe('SUCCESS');
      expect(result.batchResults[0].attemptsMade).toBe(3);
      expect(result.allClusters).toHaveLength(1);
      expect(result.failedFeedbackIds).toHaveLength(0);
      expect(result.hasPartialFailures).toBe(false);
    });

    it('flags partial status and routes failed IDs to unclustered when 429 retries are exhausted (TS-012)', async () => {
      const rows = createSampleRows(8);
      let callCount = 0;

      const mockFetcher = vi.fn().mockImplementation(async () => {
        callCount++;
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'Retry-After': '0' },
        });
      });

      const result = await runPass1BatchPipeline(rows, {
        pacingMs: 0,
        maxRetries: 3,
        backoffBaseMs: 5,
        fetcher: mockFetcher,
      });

      expect(callCount).toBe(4);
      expect(result.batchResults[0].status).toBe('FAILED');
      expect(result.batchResults[0].errorCode).toBe('RATE_LIMIT_429');
      expect(result.hasPartialFailures).toBe(true);
      expect(result.failedFeedbackIds).toHaveLength(8);
      expect(result.allClusters).toHaveLength(0);
    });

    it('computes backoff delays honoring exponential formula and Retry-After', () => {
      // Without Retry-After: 2^attempt * 1000 + [0-400] jitter
      const delay0 = calculateBackoffDelay(0, null);
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThan(1500);

      const delay1 = calculateBackoffDelay(1, null);
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThan(2500);

      const delay2 = calculateBackoffDelay(2, null);
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThan(4500);

      // With Retry-After header: 5 seconds -> 5000 + jitter
      const delayRetryAfter = calculateBackoffDelay(0, '5');
      expect(delayRetryAfter).toBeGreaterThanOrEqual(5000);
      expect(delayRetryAfter).toBeLessThan(5500);
    });
  });

  describe('Pacing & Sequential Batching (TS-031 & DEC-PROVIDER)', () => {
    it('executes batches strictly sequentially with minimum spacing enforced (TS-031)', async () => {
      const rows = createSampleRows(75); // 2 batches (50 + 25)
      const callTimestamps: number[] = [];
      let inFlightCount = 0;
      let maxConcurrency = 0;

      const mockFetcher = vi.fn().mockImplementation(async () => {
        inFlightCount++;
        maxConcurrency = Math.max(maxConcurrency, inFlightCount);
        callTimestamps.push(Date.now());
        // Small async pause to test concurrency
        await new Promise((r) => setTimeout(r, 20));
        inFlightCount--;
        return new Response(JSON.stringify({ clusters: MOCK_CLUSTERS }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const testPacingMs = 50; // Use 50ms pacing for fast test execution
      const result = await runPass1BatchPipeline(rows, {
        pacingMs: testPacingMs,
        fetcher: mockFetcher,
      });

      expect(result.batchResults).toHaveLength(2);
      expect(result.batchResults[0].status).toBe('SUCCESS');
      expect(result.batchResults[1].status).toBe('SUCCESS');

      // Concurrency must strictly be 1 (strictly sequential)
      expect(maxConcurrency).toBe(1);

      // Spacing between start of batch 1 and start of batch 2 must be >= pacingMs
      expect(callTimestamps).toHaveLength(2);
      const elapsedBetweenCalls = callTimestamps[1] - callTimestamps[0];
      expect(elapsedBetweenCalls).toBeGreaterThanOrEqual(testPacingMs);
    });
  });

  describe('Pipeline Cancellation via AbortController (TS-033)', () => {
    it('cancels analysis immediately, preserves finished batches, and marks remaining as CANCELLED (TS-033)', async () => {
      const rows = createSampleRows(100); // 2 batches (50 + 50)
      const abortController = new AbortController();
      let callCount = 0;

      const mockFetcher = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Batch 1 succeeds, then user clicks Cancel
          abortController.abort();
          return new Response(JSON.stringify({ clusters: MOCK_CLUSTERS }), { status: 200 });
        }
        return new Response(JSON.stringify({ clusters: MOCK_CLUSTERS }), { status: 200 });
      });

      const result = await runPass1BatchPipeline(rows, {
        pacingMs: 10,
        signal: abortController.signal,
        fetcher: mockFetcher,
      });

      expect(result.isCancelled).toBe(true);
      expect(result.batchResults).toHaveLength(2);

      // Batch 1 succeeded and was preserved
      expect(result.batchResults[0].status).toBe('SUCCESS');
      expect(result.batchResults[0].clusters).toHaveLength(1);

      // Batch 2 was cancelled
      expect(result.batchResults[1].status).toBe('CANCELLED');

      // Second batch's rows (50 items) routed to unclustered
      expect(result.failedFeedbackIds).toHaveLength(50);
      expect(result.succeededFeedbackIds).toHaveLength(50);

      // Raw rows remain completely untouched
      expect(rows).toHaveLength(100);
    });
  });

  describe('Progress Reporting & Non-Retryable Error Handling', () => {
    it('reports progress updates with "Batch i/N" format and percentages', async () => {
      const rows = createSampleRows(60); // 2 batches
      const progressUpdates: string[] = [];

      const mockFetcher = vi.fn().mockImplementation(
        () => new Response(JSON.stringify({ clusters: MOCK_CLUSTERS }), { status: 200 })
      );

      await runPass1BatchPipeline(rows, {
        pacingMs: 0,
        fetcher: mockFetcher,
        onProgress: (p) => {
          progressUpdates.push(p.progressText);
        },
      });

      expect(progressUpdates.some((t) => t.includes('Batch 1/2'))).toBe(true);
      expect(progressUpdates.some((t) => t.includes('Batch 2/2'))).toBe(true);
      expect(progressUpdates[progressUpdates.length - 1]).toContain('Analysis complete');
    });

    it('fails fast on non-retryable 403 Forbidden without retrying', async () => {
      const rows = createSampleRows(10);
      let callCount = 0;

      const mockFetcher = vi.fn().mockImplementation(async () => {
        callCount++;
        return new Response(JSON.stringify({ error: 'Origin not allowed', code: 'ORIGIN_FORBIDDEN' }), {
          status: 403,
        });
      });

      const result = await runPass1BatchPipeline(rows, {
        pacingMs: 0,
        maxRetries: 3,
        fetcher: mockFetcher,
      });

      // Does not waste retries on 403
      expect(callCount).toBe(1);
      expect(result.batchResults[0].status).toBe('FAILED');
      expect(result.batchResults[0].attemptsMade).toBe(1);
    });
  });
});
