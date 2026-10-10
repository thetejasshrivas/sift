/**
 * ai/reconciliation.ts — Pass 2 Cross-Batch Theme Reconciliation Pipeline
 * Governed by PRD REQ-006, §5.4–5.6; TS-019, TS-026; IC-003, IC-015; DEC-PROVIDER.
 *
 * Rules:
 * 1. Group Pass-1 candidate clusters by exact canonical_category strings.
 * 2. For categories with >1 cluster: make AT MOST ONE consolidation request per group
 *    (cluster summaries + quote IDs only, no raw text).
 * 3. The Pass-2 contract returns decisions per cluster set:
 *    - MERGE: union member IDs, S=max, preserve all quotes and unique-ID invariants.
 *    - UNCERTAIN: both stay separate, each flagged "Uncertain Cluster — Review Recommended" with plain-language rationale visible.
 *    - KEEP_SEPARATE: clusters remain unchanged.
 * 4. Strict rule: Do NOT compute or display numeric similarity and do NOT use 0.60/0.85 thresholds
 *    unless a later approved decision defines and validates a similarity signal (IC-003).
 * 5. If Pass 2 fails or returns invalid output: keep Pass-1 clusters + advisory banner.
 * 6. Invariant checked after every stage: every input Feedback ID appears in exactly one cluster (or CLUST-UNC).
 */

import {
  ReconciledCluster,
  ClusterAssemblyResult,
  Pass2ReconcileOptions,
  Pass2ReconciliationResult,
  ReconciliationDecision,
  ReconcileCategoryRequestPayload,
  ReconcileResponsePayload,
  TwoPassPipelineResult,
  BatchPipelineOptions,
} from '../types/ai';
import { ProcessedFeedbackRow } from '../types/identity';
import { verifyIdIntegrity, assemblePass1Clusters } from './assembly';
import { runPass1BatchPipeline } from './clientPipeline';
import { enrichClusterWithRootCauseHypothesis } from '../verify/missingContext';

/**
 * Executes the Pass 2 Cross-Batch Theme Reconciliation.
 */
export async function reconcilePass2Clusters(
  pass1Result: ClusterAssemblyResult,
  inputFeedbackIds: string[],
  options: Pass2ReconcileOptions = {},
  rawRowMap?: Map<string, string>
): Promise<Pass2ReconciliationResult> {
  const proxyUrl = options.proxyUrl ?? '/api/reconcile';
  const fetcher = options.fetcher ?? fetch;
  const signal = options.signal;
  const onProgress = options.onProgress;

  const preliminaryClusters = pass1Result.clusters;
  const clustUnc = pass1Result.clustUnc;

  // 1. Group preliminary clusters by exact canonical_category strings
  const categoryMap = new Map<string, ReconciledCluster[]>();
  for (const cluster of preliminaryClusters) {
    const cat = cluster.canonical_category || 'General';
    const list = categoryMap.get(cat) || [];
    list.push(cluster);
    categoryMap.set(cat, list);
  }

  const allDecisions: ReconciliationDecision[] = [];
  const reconciledClusters: ReconciledCluster[] = [];
  let hasFailures = false;
  let failureReason = '';

  const categories = Array.from(categoryMap.entries());
  const categoriesRequiringPass2 = categories.filter(([, cl]) => cl.length > 1);

  onProgress?.({
    batchIndex: 0,
    totalBatches: 1,
    progressPercent: 90,
    progressText: `Pass 2 Reconciliation: Evaluating ${categoriesRequiringPass2.length} multi-cluster categories...`,
    activeAttempt: 1,
    completedBatches: 1,
    failedBatches: 0,
    phase: 'analyzing',
  });

  // Process categories
  for (let idx = 0; idx < categories.length; idx++) {
    const [categoryName, clustersInCategory] = categories[idx];

    // If category has only 1 cluster, zero requests are made (PRD §5.4)
    if (clustersInCategory.length <= 1) {
      reconciledClusters.push(...clustersInCategory);
      continue;
    }

    if (signal?.aborted) {
      hasFailures = true;
      failureReason = 'Reconciliation cancelled by user.';
      reconciledClusters.push(...clustersInCategory);
      continue;
    }

    onProgress?.({
      batchIndex: idx,
      totalBatches: categories.length,
      progressPercent: Math.round(90 + (idx / categories.length) * 10),
      progressText: `Pass 2 Reconciling: "${categoryName}" (${clustersInCategory.length} candidate clusters)...`,
      activeAttempt: 1,
      completedBatches: 1,
      failedBatches: 0,
      phase: 'analyzing',
    });

    // Prepare at most ONE consolidation request for this category group
    // Cluster summaries + quote IDs only; strictly NO raw feedback text (PRD §5.4 / §9.2)
    const requestPayload: ReconcileCategoryRequestPayload = {
      canonical_category: categoryName,
      clusters: clustersInCategory.map((c) => ({
        cluster_id: c.cluster_id,
        cluster_title: c.cluster_title,
        problem_summary: c.problem_summary,
        root_cause_hypothesis: c.root_cause_hypothesis,
        severity_rating: c.severity_rating,
        member_feedback_ids: c.member_feedback_ids,
        quote_feedback_ids: c.quotes?.map((q) => q.feedback_id) || [],
      })),
    };

    let groupSuccess = false;
    let groupDecisions: ReconciliationDecision[] = [];

    try {
      const response = await fetcher(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal,
      });

      if (response.ok) {
        const data: ReconcileResponsePayload = await response.json();
        if (data && Array.isArray(data.decisions)) {
          groupDecisions = data.decisions;
          groupSuccess = true;
          allDecisions.push(...groupDecisions);
        } else {
          hasFailures = true;
          failureReason = 'Invalid reconciliation response schema from proxy.';
        }
      } else {
        hasFailures = true;
        failureReason = `Proxy returned HTTP ${response.status} during category reconciliation.`;
      }
    } catch (err: unknown) {
      hasFailures = true;
      const msg = err instanceof Error ? err.message : String(err);
      failureReason = `Network failure during reconciliation: ${msg}`;
    }

    // If Pass 2 failed for this category group → keep Pass-1 clusters unchanged (PRD REQ-006)
    if (!groupSuccess || groupDecisions.length === 0) {
      reconciledClusters.push(...clustersInCategory);
      continue;
    }

    // Apply Pass-2 decisions
    const processedClusterIds = new Set<string>();
    const clustersById = new Map<string, ReconciledCluster>();
    for (const c of clustersInCategory) {
      clustersById.set(c.cluster_id, c);
    }

    for (const decision of groupDecisions) {
      const targets = decision.cluster_ids
        .map((id) => clustersById.get(id))
        .filter((c): c is ReconciledCluster => Boolean(c));

      if (targets.length === 0) continue;

      if (decision.action === 'MERGE') {
        // Union member feedback IDs without duplicates (PRD REQ-006 / IC-003)
        const combinedMemberIds = Array.from(new Set(targets.flatMap((c) => c.member_feedback_ids)));

        // S_c = max(S_i)
        const maxSeverity = Math.max(...targets.map((c) => c.severity_rating));

        // Preserve all source quotes without duplicate snippets
        const combinedQuotes = targets.flatMap((c) => c.quotes || []);
        const quoteSnippetSet = new Set<string>();
        const uniqueQuotes = combinedQuotes.filter((q) => {
          const key = `${q.feedback_id}::${q.quote_snippet}`;
          if (quoteSnippetSet.has(key)) return false;
          quoteSnippetSet.add(key);
          return true;
        });

        // Lowest cluster_id preserved
        const sortedIds = targets.map((c) => c.cluster_id).sort();
        const primaryId = sortedIds[0];
        const primaryCluster = targets.find((c) => c.cluster_id === primaryId) || targets[0];

        const anyNeedsInvestigation = targets.some((c) => c.needs_investigation);
        const mergedCluster: ReconciledCluster = {
          cluster_id: primaryId,
          cluster_title: decision.merged_cluster_title || primaryCluster.cluster_title,
          canonical_category: categoryName,
          problem_summary: decision.merged_problem_summary || primaryCluster.problem_summary,
          root_cause_hypothesis: decision.merged_root_cause_hypothesis || primaryCluster.root_cause_hypothesis,
          severity_rating: maxSeverity,
          member_feedback_ids: combinedMemberIds,
          quotes: uniqueQuotes,
        };

        const memberTexts = rawRowMap
          ? combinedMemberIds.map((id) => rawRowMap.get(id) || '').filter(Boolean)
          : [];
        const enrichment = enrichClusterWithRootCauseHypothesis(mergedCluster, memberTexts);
        mergedCluster.needs_investigation = enrichment.needs_investigation || anyNeedsInvestigation;
        mergedCluster.root_cause_hypothesis = enrichment.root_cause_hypothesis;
        mergedCluster.investigation_placeholder = mergedCluster.needs_investigation
          ? enrichment.investigation_placeholder
          : undefined;

        reconciledClusters.push(mergedCluster);
        targets.forEach((c) => processedClusterIds.add(c.cluster_id));
      } else if (decision.action === 'UNCERTAIN') {
        // UNCERTAIN → both stay separate, each flagged "Uncertain Cluster — Review Recommended"
        // with the rationale visible (TS-019 / PRD §5.6 / IC-003)
        for (const cluster of targets) {
          reconciledClusters.push({
            ...cluster,
            isUncertain: true,
            reviewFlag: 'Uncertain Cluster — Review Recommended',
            uncertainRationale: decision.rationale,
          });
          processedClusterIds.add(cluster.cluster_id);
        }
      } else if (decision.action === 'KEEP_SEPARATE') {
        // KEEP_SEPARATE → clusters remain unchanged (PRD §5.4 / IC-003)
        for (const cluster of targets) {
          reconciledClusters.push({
            ...cluster,
          });
          processedClusterIds.add(cluster.cluster_id);
        }
      }
    }

    // Any clusters in this category that were not part of an evaluated decision remain unchanged
    for (const cluster of clustersInCategory) {
      if (!processedClusterIds.has(cluster.cluster_id)) {
        reconciledClusters.push(cluster);
      }
    }
  }

  // 4. Verify invariant after Pass 2 reconciliation
  // Invariant checked after every stage: every input Feedback ID appears in exactly one cluster (or CLUST-UNC)
  const allFinalClusters = clustUnc ? [...reconciledClusters, clustUnc] : reconciledClusters;
  const integrity = verifyIdIntegrity(inputFeedbackIds, allFinalClusters, 'Pass 2 Reconciliation');

  // If integrity failed due to bad reconciliation output → fallback to Pass 1 clusters
  let finalClustersToReturn = reconciledClusters;
  let finalIntegrity = integrity;
  let advisoryBannerMessage: string | undefined;

  if (!integrity.isValid) {
    hasFailures = true;
    finalClustersToReturn = pass1Result.clusters;
    advisoryBannerMessage =
      'Pass 2 reconciliation failed ID integrity check. Retaining preliminary batch clusters.';
    finalIntegrity = verifyIdIntegrity(
      inputFeedbackIds,
      clustUnc ? [...finalClustersToReturn, clustUnc] : finalClustersToReturn,
      'Pass 2 Fallback to Pass 1'
    );
  } else if (hasFailures) {
    advisoryBannerMessage =
      categoriesRequiringPass2.length > 0
        ? `Pass 2 theme reconciliation degraded (${failureReason || 'operational failure'}). Retaining preliminary batch clusters.`
        : undefined;
  }

  onProgress?.({
    batchIndex: categories.length - 1,
    totalBatches: categories.length,
    progressPercent: 100,
    progressText: 'Pass 2 reconciliation completed.',
    activeAttempt: 1,
    completedBatches: categories.length,
    failedBatches: 0,
    phase: 'completed',
  });

  return {
    clusters: finalClustersToReturn,
    clustUnc,
    decisions: allDecisions,
    hasFailures,
    advisoryBannerMessage,
    diagnostics: pass1Result.diagnostics,
    integrity: finalIntegrity,
  };
}

/**
 * End-to-end two-pass pipeline:
 * 1. Runs Pass 1 batch clustering.
 * 2. Assembles candidate clusters, resolves duplicate memberships (GAP-13), drops unknown IDs,
 *    and isolates unclustered items into CLUST-UNC (GAP-11).
 * 3. Enforces ID integrity invariant after Pass 1.
 * 4. Executes Pass 2 category grouping & consolidation (MERGE | KEEP_SEPARATE | UNCERTAIN).
 * 5. Enforces ID integrity invariant after Pass 2.
 */
export async function runTwoPassClusteringPipeline(
  rows: ProcessedFeedbackRow[],
  options: BatchPipelineOptions & Pass2ReconcileOptions = {}
): Promise<TwoPassPipelineResult> {
  const startTime = Date.now();
  const inputFeedbackIds = rows.map((r) => r.identity.feedbackId);
  const rawRowMap = new Map<string, string>(rows.map((r) => [r.identity.feedbackId, r.text]));

  // 1. Pass 1 Batch Pipeline
  const pass1Pipeline = await runPass1BatchPipeline(rows, options);

  // 2. Pass 1 Cluster Assembly & ID Integrity
  const pass1Assembly = assemblePass1Clusters(inputFeedbackIds, pass1Pipeline.allClusters, rawRowMap);

  // 3. Pass 2 Reconciliation
  const pass2Reconciliation = await reconcilePass2Clusters(pass1Assembly, inputFeedbackIds, options, rawRowMap);

  const advisoryBannerMessage = pass1Pipeline.isFullyFailed
    ? 'AI analysis degraded: all batches failed. Feedback routed to Unclustered Feedback. You can retry failed batches.'
    : pass2Reconciliation.advisoryBannerMessage;

  return {
    pass1Pipeline,
    pass1Assembly,
    pass2Reconciliation,
    finalClusters: pass2Reconciliation.clusters,
    clustUnc: pass2Reconciliation.clustUnc,
    diagnostics: pass2Reconciliation.diagnostics,
    advisoryBannerMessage,
    failedBatchIndices: pass1Pipeline.failedBatchIndices,
    isFullyFailed: pass1Pipeline.isFullyFailed,
    isCancelled: pass1Pipeline.isCancelled,
    totalDurationMs: Date.now() - startTime,
  };
}
