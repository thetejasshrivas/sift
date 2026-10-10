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
  retryBatchIndices?: number[]; // Only execute these specific batch indices (retrying failed batches)
  existingClusters?: ClusterResponseItem[]; // Existing clusters to preserve when retrying failed batches
}

export interface BatchPipelineResult {
  batchResults: BatchExecutionResult[];
  allClusters: ClusterResponseItem[];
  failedFeedbackIds: string[];
  succeededFeedbackIds: string[];
  failedBatchIndices: number[];
  isFullyFailed: boolean;
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

// --- M2-C: Pass 1 Assembly, ID Integrity, and Pass 2 Reconciliation Types ---

export interface ReconciledCluster {
  cluster_id: string;
  cluster_title: string;
  canonical_category: string;
  problem_summary: string;
  root_cause_hypothesis: string;
  severity_rating: number; // 1, 2, or 3
  member_feedback_ids: string[];
  quotes: ClusterQuote[];
  isUnclustered?: boolean; // true for CLUST-UNC
  priority_score?: number; // 0 for CLUST-UNC
  isUncertain?: boolean;
  reviewFlag?: string; // 'Uncertain Cluster — Review Recommended'
  uncertainRationale?: string;
  needs_investigation?: boolean;
  investigation_placeholder?: string;
}


export interface DuplicateResolutionDetail {
  feedbackId: string;
  keptInClusterId: string;
  strippedFromClusterIds: string[];
}

export interface AssemblyDiagnostics {
  totalInputIds: number;
  totalClusteredIds: number;
  unclusteredIdsCount: number;
  unclusteredFeedbackIds: string[];
  droppedUnknownIds: string[];
  droppedUnknownCount: number;
  duplicateAssignmentsResolvedCount: number;
  duplicatesResolvedDetails: DuplicateResolutionDetail[];
}

export interface IdIntegrityCheckResult {
  isValid: boolean;
  stage: string;
  totalInputIds: number;
  totalAssignedIds: number;
  missingIds: string[];
  duplicateIds: string[];
  unknownIds: string[];
  errorMessage?: string;
}

export interface ClusterAssemblyResult {
  clusters: ReconciledCluster[];
  clustUnc: ReconciledCluster | null;
  diagnostics: AssemblyDiagnostics;
  integrity: IdIntegrityCheckResult;
}

export type ReconciliationAction = 'MERGE' | 'KEEP_SEPARATE' | 'UNCERTAIN';

export interface ReconciliationDecision {
  cluster_ids: string[];
  action: ReconciliationAction;
  rationale: string;
  merged_cluster_title?: string;
  merged_problem_summary?: string;
  merged_root_cause_hypothesis?: string;
}

export interface ClusterReconcileSummary {
  cluster_id: string;
  cluster_title: string;
  problem_summary: string;
  root_cause_hypothesis: string;
  severity_rating: number;
  member_feedback_ids: string[];
  quote_feedback_ids: string[]; // only quote IDs, NO raw text
}

export interface ReconcileCategoryRequestPayload {
  canonical_category: string;
  clusters: ClusterReconcileSummary[];
}

export interface ReconcileResponsePayload {
  decisions: ReconciliationDecision[];
}

export interface Pass2ReconcileOptions {
  proxyUrl?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  onProgress?: (progress: BatchPipelineProgress) => void;
}


export interface Pass2ReconciliationResult {
  clusters: ReconciledCluster[];
  clustUnc: ReconciledCluster | null;
  decisions: ReconciliationDecision[];
  hasFailures: boolean;
  advisoryBannerMessage?: string;
  diagnostics: AssemblyDiagnostics;
  integrity: IdIntegrityCheckResult;
}

export interface TwoPassPipelineResult {
  pass1Pipeline: BatchPipelineResult;
  pass1Assembly: ClusterAssemblyResult;
  pass2Reconciliation: Pass2ReconciliationResult;
  finalClusters: ReconciledCluster[];
  clustUnc: ReconciledCluster | null;
  diagnostics: AssemblyDiagnostics;
  advisoryBannerMessage?: string;
  failedBatchIndices: number[];
  isFullyFailed: boolean;
  isCancelled: boolean;
  totalDurationMs: number;
}

