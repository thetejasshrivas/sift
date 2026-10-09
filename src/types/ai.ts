/**
 * types/ai.ts — Client AI Pipeline, Batching, and Pacing Types
 * Governed by PRD REQ-005, §5.2, §5.8, TS-009, TS-012, TS-031, TS-033, TS-034;
 * IC-004, IC-008, IC-015; DEC-PROVIDER.
 */

import { ProcessedFeedbackRow } from './identity';

export interface BatchItemPayload {
  feedback_id: string;
  text: string;
  tier?: string;
}

export interface FeedbackBatch {
  batchIndex: number;
  totalBatches: number;
  items: BatchItemPayload[];
  sourceRows: ProcessedFeedbackRow[];
}

export interface ClusterQuote {
  feedback_id: string;
  quote_snippet: string;
}

export interface ClusterResponseItem {
  cluster_id: string;
  cluster_title: string;
  canonical_category: string;
  problem_summary: string;
  root_cause_hypothesis: string;
  severity_rating: number; // 1, 2, or 3
  member_feedback_ids: string[];
  quotes: ClusterQuote[];
}

export type BatchOutcomeStatus = 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface BatchExecutionResult {
  batchIndex: number;
  totalBatches: number;
  status: BatchOutcomeStatus;
  attemptsMade: number;
  clusters: ClusterResponseItem[];
  feedbackIds: string[];
  errorMessage?: string;
  errorCode?: string;
  durationMs: number;
}

export interface BatchPipelineProgress {
  batchIndex: number;
  totalBatches: number;
  progressPercent: number;
  progressText: string; // e.g. "Batch 1/6 (Attempt 1)"
  activeAttempt: number;
  completedBatches: number;
  failedBatches: number;
  phase: 'idle' | 'analyzing' | 'pacing' | 'retrying' | 'completed' | 'cancelled';
}

export interface BatchPipelineOptions {
  proxyUrl?: string;
  pacingMs?: number; // Minimum spacing between requests (default: 6,000 ms per DEC-PROVIDER / PRD §9.3)
  maxRetries?: number; // Maximum retry attempts on 429/503/errors (default: 3 per PRD §5.8)
  backoffBaseMs?: number; // Base milliseconds for exponential backoff (default: 1,000 ms)
  signal?: AbortSignal;
  onProgress?: (progress: BatchPipelineProgress) => void;
  fetcher?: typeof fetch;
}

export interface BatchPipelineResult {
  batchResults: BatchExecutionResult[];
  allClusters: ClusterResponseItem[];
  failedFeedbackIds: string[];
  succeededFeedbackIds: string[];
  isCancelled: boolean;
  hasPartialFailures: boolean;
  totalDurationMs: number;
}

export interface PreFlightEstimate {
  rowCount: number;
  pass1Calls: number;
  pass2CallsUpperBound: number;
  totalCalls: number;
  estimatedMinutes: number;
  pacingSeconds: number;
}
