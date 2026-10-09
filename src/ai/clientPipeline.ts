/**
 * ai/clientPipeline.ts — Pass-1 Batch Clustering Client Pipeline
 * Governed by PRD REQ-005, §5.2, §5.8, TS-009, TS-012, TS-031, TS-033, TS-034;
 * IC-004, IC-008, IC-015; DEC-PROVIDER.
 *
 * Capabilities:
 * 1. Chunks rows into discrete batches of <= 50.
 * 2. Sequential execution (concurrency 1) with minimum pacing spacing (default 6,000 ms per DEC-PROVIDER).
 * 3. Progress reporting: "Batch i/N" with progress percentage and active attempt count.
 * 4. Exponential backoff retries on 429 / 503 / network timeout / malformed JSON up to 3 retries.
 *    Honors upstream Retry-After headers when present.
 * 5. Full cancellation support via AbortSignal.
 * 6. Individual batch outcome tracking (SUCCESS, FAILED, CANCELLED).
 * 7. Failed batch IDs collected for downstream unclustered routing (M2-C). Raw rows preserved in memory.
 */

import { ProcessedFeedbackRow } from '../types/identity';
import {
  BatchPipelineOptions,
  BatchPipelineResult,
  BatchExecutionResult,
  ClusterResponseItem,
} from '../types/ai';
import { chunkFeedbackRows } from './batching';
import { DEFAULT_PACING_MS, DEFAULT_MAX_RETRIES, calculateBackoffDelay, sleep } from './pacing';

/**
 * Executes the Pass-1 batch clustering client pipeline.
 */
export async function runPass1BatchPipeline(
  rows: ProcessedFeedbackRow[],
  options: BatchPipelineOptions = {}
): Promise<BatchPipelineResult> {
  const startTime = Date.now();
  const proxyUrl = options.proxyUrl ?? '/api/cluster';
  const pacingMs = options.pacingMs ?? DEFAULT_PACING_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoffBaseMs = options.backoffBaseMs ?? 1000;
  const signal = options.signal;
  const onProgress = options.onProgress;
  const fetcher = options.fetcher ?? fetch;

  const batches = chunkFeedbackRows(rows, 50);
  const totalBatches = batches.length;

  const batchResults: BatchExecutionResult[] = [];
  const allClusters: ClusterResponseItem[] = [];
  const failedFeedbackIds: string[] = [];
  const succeededFeedbackIds: string[] = [];

  if (totalBatches === 0) {
    return {
      batchResults: [],
      allClusters: [],
      failedFeedbackIds: [],
      succeededFeedbackIds: [],
      isCancelled: false,
      hasPartialFailures: false,
      totalDurationMs: 0,
    };
  }

  // Initial progress update
  onProgress?.({
    batchIndex: 0,
    totalBatches,
    progressPercent: 0,
    progressText: `Batch 1/${totalBatches} (Starting...)`,
    activeAttempt: 1,
    completedBatches: 0,
    failedBatches: 0,
    phase: 'analyzing',
  });

  for (let b = 0; b < totalBatches; b++) {
    const batch = batches[b];
    const batchStartTime = Date.now();
    const batchFeedbackIds = batch.items.map((i) => i.feedback_id);

    // 1. Check for pipeline cancellation before starting batch
    if (signal?.aborted) {
      batchResults.push({
        batchIndex: batch.batchIndex,
        totalBatches,
        status: 'CANCELLED',
        attemptsMade: 0,
        clusters: [],
        feedbackIds: batchFeedbackIds,
        errorMessage: 'Analysis cancelled by user.',
        durationMs: 0,
      });
      failedFeedbackIds.push(...batchFeedbackIds);
      continue;
    }

    // 2. Sequential pacing delay between batches (PRD §9.3 & DEC-PROVIDER)
    if (b > 0 && pacingMs > 0) {
      onProgress?.({
        batchIndex: b,
        totalBatches,
        progressPercent: Math.round((b / totalBatches) * 100),
        progressText: `Pacing before Batch ${b + 1}/${totalBatches}...`,
        activeAttempt: 1,
        completedBatches: batchResults.filter((r) => r.status === 'SUCCESS').length,
        failedBatches: batchResults.filter((r) => r.status === 'FAILED').length,
        phase: 'pacing',
      });

      try {
        await sleep(pacingMs, signal);
      } catch {
        // Cancelled during pacing sleep
        batchResults.push({
          batchIndex: batch.batchIndex,
          totalBatches,
          status: 'CANCELLED',
          attemptsMade: 0,
          clusters: [],
          feedbackIds: batchFeedbackIds,
          errorMessage: 'Analysis cancelled by user during pacing.',
          durationMs: Date.now() - batchStartTime,
        });
        failedFeedbackIds.push(...batchFeedbackIds);
        continue;
      }
    }

    // 3. Execute batch with exponential backoff retries
    let attemptsMade = 0;
    let isBatchSuccess = false;
    let batchClusters: ClusterResponseItem[] = [];
    let lastErrorMessage = '';
    let lastErrorCode = '';

    while (attemptsMade <= maxRetries && !isBatchSuccess) {
      if (signal?.aborted) {
        break;
      }

      attemptsMade++;

      onProgress?.({
        batchIndex: b,
        totalBatches,
        progressPercent: Math.round(((b + (attemptsMade - 1) / (maxRetries + 1)) / totalBatches) * 100),
        progressText: `Batch ${b + 1}/${totalBatches}${attemptsMade > 1 ? ` (Retry ${attemptsMade - 1}/${maxRetries})` : ''}`,
        activeAttempt: attemptsMade,
        completedBatches: batchResults.filter((r) => r.status === 'SUCCESS').length,
        failedBatches: batchResults.filter((r) => r.status === 'FAILED').length,
        phase: attemptsMade === 1 ? 'analyzing' : 'retrying',
      });

      let retryAfterHeader: string | null = null;
      let isRetryableError = false;

      try {
        const response = await fetcher(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batch_index: batch.batchIndex,
            total_batches: batch.totalBatches,
            items: batch.items,
          }),
          signal,
        });

        if (response.status === 200) {
          let jsonBody: any;
          try {
            jsonBody = await response.json();
          } catch {
            isRetryableError = true;
            lastErrorMessage = 'Failed to parse response body as JSON.';
            lastErrorCode = 'MALFORMED_JSON_RESPONSE';
            throw new Error(lastErrorMessage);
          }

          if (jsonBody && Array.isArray(jsonBody.clusters)) {
            batchClusters = jsonBody.clusters;
            isBatchSuccess = true;
            break;
          } else {
            isRetryableError = true;
            lastErrorMessage = 'Response JSON did not contain expected clusters array.';
            lastErrorCode = 'INVALID_RESPONSE_SHAPE';
          }
        } else if (response.status === 429) {
          isRetryableError = true;
          retryAfterHeader = response.headers.get('retry-after');
          lastErrorMessage = 'Rate limit reached (HTTP 429).';
          lastErrorCode = 'RATE_LIMIT_429';
        } else if (response.status === 503 || response.status >= 500) {
          isRetryableError = true;
          retryAfterHeader = response.headers.get('retry-after');
          lastErrorMessage = `Server error (HTTP ${response.status}).`;
          lastErrorCode = `SERVER_ERROR_${response.status}`;
        } else {
          // Fatal client error (e.g. 400 Bad Request, 403 Forbidden, 413) -> do not retry
          const errText = await response.text().catch(() => '');
          lastErrorMessage = `Non-retryable proxy error (HTTP ${response.status}): ${errText}`;
          lastErrorCode = `CLIENT_ERROR_${response.status}`;
          break;
        }
      } catch (err: unknown) {
        if (signal?.aborted) {
          break;
        }
        isRetryableError = true;
        const msg = err instanceof Error ? err.message : String(err);
        lastErrorMessage = lastErrorMessage || `Network/fetch failure: ${msg}`;
        lastErrorCode = lastErrorCode || 'NETWORK_FAILURE';
      }

      // If retryable and retries remaining, wait with exponential backoff delay
      if (!isBatchSuccess && isRetryableError && attemptsMade <= maxRetries) {
        const backoffMs = calculateBackoffDelay(attemptsMade - 1, retryAfterHeader, backoffBaseMs);
        try {
          await sleep(backoffMs, signal);
        } catch {
          // Cancelled during backoff sleep
          break;
        }
      }
    }

    // 4. Record batch execution outcome
    const durationMs = Date.now() - batchStartTime;

    if (isBatchSuccess) {
      batchResults.push({
        batchIndex: batch.batchIndex,
        totalBatches,
        status: 'SUCCESS',
        attemptsMade,
        clusters: batchClusters,
        feedbackIds: batchFeedbackIds,
        durationMs,
      });
      allClusters.push(...batchClusters);
      succeededFeedbackIds.push(...batchFeedbackIds);
    } else if (signal?.aborted) {
      batchResults.push({
        batchIndex: batch.batchIndex,
        totalBatches,
        status: 'CANCELLED',
        attemptsMade,
        clusters: [],
        feedbackIds: batchFeedbackIds,
        errorMessage: 'Analysis cancelled by user.',
        durationMs,
      });
      failedFeedbackIds.push(...batchFeedbackIds);
    } else {
      batchResults.push({
        batchIndex: batch.batchIndex,
        totalBatches,
        status: 'FAILED',
        attemptsMade,
        clusters: [],
        feedbackIds: batchFeedbackIds,
        errorMessage: lastErrorMessage || 'Exhausted retry attempts without success.',
        errorCode: lastErrorCode || 'RETRY_EXHAUSTED',
        durationMs,
      });
      failedFeedbackIds.push(...batchFeedbackIds);
    }
  }

  const isCancelled = Boolean(signal?.aborted);
  const hasPartialFailures = failedFeedbackIds.length > 0;

  // Final progress notification
  onProgress?.({
    batchIndex: totalBatches - 1,
    totalBatches,
    progressPercent: 100,
    progressText: isCancelled
      ? 'Analysis cancelled by user'
      : hasPartialFailures
      ? `Analysis complete with partial failures (${failedFeedbackIds.length} items unclustered)`
      : 'Analysis complete (100% batches succeeded)',
    activeAttempt: 1,
    completedBatches: batchResults.filter((r) => r.status === 'SUCCESS').length,
    failedBatches: batchResults.filter((r) => r.status === 'FAILED').length,
    phase: isCancelled ? 'cancelled' : 'completed',
  });

  return {
    batchResults,
    allClusters,
    failedFeedbackIds,
    succeededFeedbackIds,
    isCancelled,
    hasPartialFailures,
    totalDurationMs: Date.now() - startTime,
  };
}
