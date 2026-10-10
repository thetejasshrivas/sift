/**
 * ai/assembly.ts — Pass 1 Cluster Assembly & ID Integrity Enforcement
 * Governed by PRD REQ-006, §5.4–5.6; GAP-11, GAP-13; IC-003, IC-015.
 *
 * Rules:
 * 1. Collect clusters across all Pass-1 batches.
 * 2. Drop unknown IDs returned by model (not present in inputFeedbackIds) and count them for diagnostics.
 * 3. Resolve duplicate membership (GAP-13 tie-breaking):
 *    Keep in cluster with:
 *      highest severity_rating (3 > 2 > 1)
 *      → then largest initial membership
 *      → then lowest cluster_id (alphabetical)
 *    Strip from all other clusters.
 * 4. Fallback for unclustered IDs (GAP-11):
 *    Any input Feedback ID in no cluster → CLUST-UNC (S=1, P=0, excluded from matrix and max-normalization).
 * 5. Invariant check after assembly:
 *    Every input Feedback ID appears in exactly one cluster (or CLUST-UNC).
 */

import {
  ClusterResponseItem,
  ReconciledCluster,
  ClusterAssemblyResult,
  AssemblyDiagnostics,
  IdIntegrityCheckResult,
  DuplicateResolutionDetail,
} from '../types/ai';
import {
  enrichClusterWithRootCauseHypothesis,
  INVESTIGATION_PLACEHOLDER,
} from '../verify/missingContext';

/**
 * Checks the strict ID integrity invariant across clusters.
 * Every input Feedback ID must appear in exactly one cluster (or CLUST-UNC).
 */
export function verifyIdIntegrity(
  inputFeedbackIds: string[],
  clusters: Array<{ cluster_id: string; member_feedback_ids: string[] }>,
  stage = 'Stage'
): IdIntegrityCheckResult {
  const inputSet = new Set(inputFeedbackIds);
  const seenMap = new Map<string, string[]>(); // feedback_id -> cluster_ids

  for (const cluster of clusters) {
    for (const id of cluster.member_feedback_ids) {
      const list = seenMap.get(id) || [];
      list.push(cluster.cluster_id);
      seenMap.set(id, list);
    }
  }

  const missingIds: string[] = [];
  const duplicateIds: string[] = [];
  const unknownIds: string[] = [];

  for (const inputId of inputFeedbackIds) {
    const assigned = seenMap.get(inputId);
    if (!assigned || assigned.length === 0) {
      missingIds.push(inputId);
    } else if (assigned.length > 1) {
      duplicateIds.push(inputId);
    }
  }

  for (const [id] of seenMap.entries()) {
    if (!inputSet.has(id)) {
      unknownIds.push(id);
    }
  }

  const totalAssignedIds = Array.from(seenMap.keys()).length;
  const isValid =
    missingIds.length === 0 &&
    duplicateIds.length === 0 &&
    unknownIds.length === 0 &&
    totalAssignedIds === inputFeedbackIds.length;

  let errorMessage: string | undefined;
  if (!isValid) {
    errorMessage = `[${stage}] ID integrity violation: ${missingIds.length} missing, ${duplicateIds.length} duplicate, ${unknownIds.length} unknown IDs.`;
  }

  return {
    isValid,
    stage,
    totalInputIds: inputFeedbackIds.length,
    totalAssignedIds,
    missingIds,
    duplicateIds,
    unknownIds,
    errorMessage,
  };
}

/**
 * Assembles preliminary Pass-1 batch clusters into unified candidate clusters,
 * resolves duplicate assignments using GAP-13, drops unknown IDs, isolates unclustered IDs
 * into CLUST-UNC (GAP-11), and verifies the ID integrity invariant.
 */
export function assemblePass1Clusters(
  inputFeedbackIds: string[],
  rawClusters: ClusterResponseItem[],
  rawRowMap?: Map<string, string>
): ClusterAssemblyResult {
  const inputSet = new Set(inputFeedbackIds);
  const droppedUnknownIdsSet = new Set<string>();

  // Deep clone clusters to prevent mutating caller references
  const candidateClusters: ReconciledCluster[] = rawClusters.map((c) => ({
    cluster_id: c.cluster_id,
    cluster_title: c.cluster_title,
    canonical_category: c.canonical_category,
    problem_summary: c.problem_summary,
    root_cause_hypothesis: c.root_cause_hypothesis,
    severity_rating: c.severity_rating,
    member_feedback_ids: [...c.member_feedback_ids],
    quotes: c.quotes ? c.quotes.map((q) => ({ ...q })) : [],
  }));

  // 1. Drop unknown IDs returned by the model
  for (const cluster of candidateClusters) {
    const validMembers: string[] = [];
    for (const memberId of cluster.member_feedback_ids) {
      if (inputSet.has(memberId)) {
        validMembers.push(memberId);
      } else {
        droppedUnknownIdsSet.add(memberId);
      }
    }
    cluster.member_feedback_ids = validMembers;

    // Filter quotes for unknown IDs
    if (cluster.quotes) {
      cluster.quotes = cluster.quotes.filter((q) => {
        if (inputSet.has(q.feedback_id)) {
          return true;
        }
        droppedUnknownIdsSet.add(q.feedback_id);
        return false;
      });
    }
  }

  // Remove any cluster that was emptied entirely by dropping unknown IDs
  const nonEmptiedClusters = candidateClusters.filter((c) => c.member_feedback_ids.length > 0);

  // Record initial cluster sizes for GAP-13 tie-breaking
  const initialClusterSizeMap = new Map<string, number>();
  for (const cluster of nonEmptiedClusters) {
    initialClusterSizeMap.set(cluster.cluster_id, cluster.member_feedback_ids.length);
  }

  // 2. Resolve duplicate membership (GAP-13 tie-breaking)
  // Tie-breaker priority:
  // a) Highest severity rating
  // b) Largest membership (initial cluster size)
  // c) Lowest cluster_id (alphabetical)
  // Strip from others.
  const duplicatesResolvedDetails: DuplicateResolutionDetail[] = [];
  const idToClustersMap = new Map<string, ReconciledCluster[]>();

  for (const cluster of nonEmptiedClusters) {
    for (const id of cluster.member_feedback_ids) {
      const list = idToClustersMap.get(id) || [];
      list.push(cluster);
      idToClustersMap.set(id, list);
    }
  }

  for (const [fbId, containingClusters] of idToClustersMap.entries()) {
    if (containingClusters.length > 1) {
      // Sort candidates according to GAP-13 tie-breaking rules
      containingClusters.sort((a, b) => {
        // Priority 1: Highest severity rating (descending)
        if (b.severity_rating !== a.severity_rating) {
          return b.severity_rating - a.severity_rating;
        }

        // Priority 2: Largest membership (initial size descending)
        const sizeA = initialClusterSizeMap.get(a.cluster_id) ?? a.member_feedback_ids.length;
        const sizeB = initialClusterSizeMap.get(b.cluster_id) ?? b.member_feedback_ids.length;
        if (sizeB !== sizeA) {
          return sizeB - sizeA;
        }

        // Priority 3: Lowest cluster_id (alphabetical ascending)
        return a.cluster_id.localeCompare(b.cluster_id);
      });

      const winner = containingClusters[0];
      const losers = containingClusters.slice(1);

      duplicatesResolvedDetails.push({
        feedbackId: fbId,
        keptInClusterId: winner.cluster_id,
        strippedFromClusterIds: losers.map((c) => c.cluster_id),
      });

      // Strip from loser clusters
      for (const loser of losers) {
        // Preserve any quotes in winner if winner lacks quotes for this ID
        const loserQuotesForId = loser.quotes?.filter((q) => q.feedback_id === fbId) || [];
        const winnerHasQuote = winner.quotes?.some((q) => q.feedback_id === fbId);
        if (!winnerHasQuote && loserQuotesForId.length > 0) {
          winner.quotes = winner.quotes || [];
          winner.quotes.push(...loserQuotesForId);
        }

        loser.member_feedback_ids = loser.member_feedback_ids.filter((id) => id !== fbId);
        loser.quotes = loser.quotes ? loser.quotes.filter((q) => q.feedback_id !== fbId) : [];
      }
    }
  }

  // Remove any cluster that ended up with 0 members after stripping duplicates
  const finalClusters = nonEmptiedClusters.filter((c) => c.member_feedback_ids.length > 0);

  // Enrich candidate clusters with deterministic missing context detection and root-cause hypothesis
  for (const cluster of finalClusters) {
    const memberTexts = cluster.member_feedback_ids
      .map((id) => rawRowMap?.get(id) || '')
      .filter(Boolean);
    const enrichment = enrichClusterWithRootCauseHypothesis(cluster, memberTexts);
    cluster.needs_investigation = enrichment.needs_investigation;
    cluster.root_cause_hypothesis = enrichment.root_cause_hypothesis;
    cluster.investigation_placeholder = enrichment.investigation_placeholder;
  }

  // 3. Fallback for unclustered Feedback IDs (GAP-11)
  const assignedSet = new Set<string>();
  for (const cluster of finalClusters) {
    for (const id of cluster.member_feedback_ids) {
      assignedSet.add(id);
    }
  }

  const unclusteredIds = inputFeedbackIds.filter((id) => !assignedSet.has(id));
  let clustUnc: ReconciledCluster | null = null;

  if (unclusteredIds.length > 0) {
    clustUnc = {
      cluster_id: 'CLUST-UNC',
      cluster_title: 'Unclustered Feedback',
      canonical_category: 'Unclustered',
      problem_summary:
        'Feedback items that were not assigned to any thematic cluster or where batch processing degraded.',
      root_cause_hypothesis:
        'Unclustered items provisionally isolated without AI root-cause hypothesis.',
      severity_rating: 1, // S=1 per GAP-11
      priority_score: 0, // P=0 per GAP-11 (excluded from matrix and max-normalization)
      isUnclustered: true,
      needs_investigation: true,
      investigation_placeholder: INVESTIGATION_PLACEHOLDER,
      member_feedback_ids: unclusteredIds,
      quotes: [],
    };
  }

  // 4. Invariant check after Pass 1 assembly
  const allResultClusters = clustUnc ? [...finalClusters, clustUnc] : finalClusters;
  const integrity = verifyIdIntegrity(inputFeedbackIds, allResultClusters, 'Pass 1 Assembly');

  const droppedUnknownIds = Array.from(droppedUnknownIdsSet);
  const diagnostics: AssemblyDiagnostics = {
    totalInputIds: inputFeedbackIds.length,
    totalClusteredIds: assignedSet.size,
    unclusteredIdsCount: unclusteredIds.length,
    unclusteredFeedbackIds: unclusteredIds,
    droppedUnknownIds,
    droppedUnknownCount: droppedUnknownIds.length,
    duplicateAssignmentsResolvedCount: duplicatesResolvedDetails.length,
    duplicatesResolvedDetails,
  };

  return {
    clusters: finalClusters,
    clustUnc,
    diagnostics,
    integrity,
  };
}
