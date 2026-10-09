/**
 * ai/batching.ts — Feedback Row Chunking & Pre-Flight Capacity Estimation
 * Governed by PRD §5.2, §5.4, §9.3; IC-008; DEC-PROVIDER; docs/COST_LOG.md.
 */

import { ProcessedFeedbackRow } from '../types/identity';
import { FeedbackBatch, PreFlightEstimate } from '../types/ai';

export const DEFAULT_BATCH_SIZE = 50; // PRD §5.2 cap

/**
 * Chunks processed feedback rows into discrete batches of <= 50 rows.
 * Preserves verbatim raw texts, assigned feedback IDs, and source rows in memory.
 */
export function chunkFeedbackRows(
  rows: ProcessedFeedbackRow[],
  batchSize: number = DEFAULT_BATCH_SIZE
): FeedbackBatch[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  const effectiveBatchSize = Math.max(1, Math.min(50, batchSize));
  const totalBatches = Math.ceil(rows.length / effectiveBatchSize);
  const batches: FeedbackBatch[] = [];

  for (let i = 0; i < totalBatches; i++) {
    const start = i * effectiveBatchSize;
    const end = Math.min(rows.length, start + effectiveBatchSize);
    const slice = rows.slice(start, end);

    batches.push({
      batchIndex: i,
      totalBatches,
      items: slice.map((row) => ({
        feedback_id: row.identity.feedbackId,
        text: row.text,
        tier: row.tierResolution.canonicalTier,
      })),
      sourceRows: slice,
    });
  }

  return batches;
}

/**
 * Calculates pre-flight operational metrics shown to user prior to analysis.
 * Governed by DEC-PROVIDER capacity qualification benchmarks:
 * - Pass 1 calls = ceil(rows / 50)
 * - Pass 2 consolidation calls <= canonical categories with >1 cluster
 * - Runtime pacing: 6s spacing (10 RPM proxy limit) + ~30s inference latency
 */
export function calculatePreFlightEstimate(rowCount: number): PreFlightEstimate {
  if (rowCount <= 0) {
    return {
      rowCount: 0,
      pass1Calls: 0,
      pass2CallsUpperBound: 0,
      totalCalls: 0,
      estimatedMinutes: 0,
      pacingSeconds: 6,
    };
  }

  const pass1Calls = Math.ceil(rowCount / DEFAULT_BATCH_SIZE);

  // For a single batch (<=50 rows), no cross-batch consolidation call is needed
  // For multi-batch runs, Pass 2 consolidates across canonical categories (up to 5 in benchmark scenarios)
  const pass2CallsUpperBound = pass1Calls <= 1 ? 0 : Math.min(20, Math.max(2, Math.min(pass1Calls, 5)));
  const totalCalls = pass1Calls + pass2CallsUpperBound;

  // Latency model from DEC-PROVIDER: ~32s per Pass-1 batch, ~20s per Pass-2 call, plus 6s inter-call spacing
  const estimatedSeconds =
    pass1Calls * 32 +
    pass2CallsUpperBound * 20 +
    Math.max(0, totalCalls - 1) * 6;

  const estimatedMinutes = Math.max(1, Math.ceil(estimatedSeconds / 60));

  return {
    rowCount,
    pass1Calls,
    pass2CallsUpperBound,
    totalCalls,
    estimatedMinutes,
    pacingSeconds: 6,
  };
}
