/**
 * mockClusters.ts — Realistic Synthetic Clusters Generator for Offline Verification & Benchmarks
 * Governed by PRD §5.2, §6.6; MDD §4.2; IC-002, IC-014.
 */

import { ProcessedFeedbackRow } from '../types/identity';
import { TwoPassPipelineResult, ReconciledCluster } from '../types/ai';

export function createBenchmarkClusters(rows: ProcessedFeedbackRow[]): TwoPassPipelineResult {
  const rowIds = rows.map((r) => r.identity.feedbackId);

  // Group row IDs across 5 representative thematic clusters + 1 CLUST-UNC
  const c1Ids = rowIds.slice(0, 12);  // CSV Export Timeout (Sev 3)
  const c2Ids = rowIds.slice(12, 28); // Dark Mode / UI (Sev 1, high volume)
  const c3Ids = rowIds.slice(28, 36); // SAML SSO Auth (Sev 3)
  const c4Ids = rowIds.slice(36, 44); // Chart Lag (Sev 2)
  const c5Ids = rowIds.slice(44, 46); // Invoice PDF (Sev 1, small sample)
  const uncIds = rowIds.slice(46);    // Remaining in CLUST-UNC

  const clusters: ReconciledCluster[] = [
    {
      cluster_id: 'CLUST-01',
      cluster_title: 'Silent API Timeout during CSV Export',
      canonical_category: 'Export',
      problem_summary: 'Large exports (>10,000 rows) fail silently with HTTP 504 Gateway Timeout.',
      root_cause_hypothesis: '504 API Gateway Timeout due to unpaginated query execution in worker thread.',
      severity_rating: 3,
      member_feedback_ids: c1Ids,
      quotes: [
        // 1. Exact verbatim snippet -> VERIFIED
        {
          feedback_id: c1Ids[0] || 'FB-001',
          quote_snippet: rows.find((r) => r.identity.feedbackId === (c1Ids[0] || 'FB-001'))?.text.slice(0, 45) || 'CSV export hangs indefinitely on large files',
        },
        // 2. Near-match (lowercased) -> NEAR_MATCH (Diagnostic only)
        {
          feedback_id: c1Ids[1] || 'FB-002',
          quote_snippet: (rows.find((r) => r.identity.feedbackId === (c1Ids[1] || 'FB-002'))?.text.slice(0, 45) || 'export hangs indefinitely on large files').toLowerCase(),
        },
        // 3. Rewritten / Summarized -> UNVERIFIED
        {
          feedback_id: c1Ids[2] || 'FB-003',
          quote_snippet: 'Rewritten summary: user states invoice PDF export crashes with server error.',
        },
        // 4. Missing Feedback ID -> SOURCE_NOT_FOUND
        {
          feedback_id: 'FB-MISSING-999',
          quote_snippet: 'Orphaned feedback snippet with unmapped ID.',
        },
      ],
      needs_investigation: false,
    },
    {
      cluster_id: 'CLUST-02',
      cluster_title: 'Dark Mode Alignment Inconsistencies',
      canonical_category: 'UI Alignment',
      problem_summary: 'Navigation dropdown text is unreadable in high-contrast dark theme.',
      root_cause_hypothesis: 'CSS specificity conflict between dark theme variables and legacy layout classes.',
      severity_rating: 1,
      member_feedback_ids: c2Ids,
      quotes: c2Ids.slice(0, 3).map((id) => {
        const r = rows.find((row) => row.identity.feedbackId === id);
        return {
          feedback_id: id,
          quote_snippet: r?.text ? r.text.slice(0, 60) : 'Text is invisible in dark mode navigation',
        };
      }),
      needs_investigation: false,
    },
    {
      cluster_id: 'CLUST-03',
      cluster_title: 'SAML SSO Okta Login Failure',
      canonical_category: 'Authentication',
      problem_summary: 'Enterprise users encounter looping authentication redirects with Okta IdP.',
      root_cause_hypothesis: 'Clock skew tolerance mismatch (>180s) on SAML assertion timestamp verification.',
      severity_rating: 3,
      member_feedback_ids: c3Ids,
      quotes: c3Ids.slice(0, 2).map((id) => {
        const r = rows.find((row) => row.identity.feedbackId === id);
        return {
          feedback_id: id,
          quote_snippet: r?.text ? r.text.slice(0, 60) : 'SAML login fails repeatedly for our team',
        };
      }),
      needs_investigation: false,
    },
    {
      cluster_id: 'CLUST-04',
      cluster_title: 'Chart Rendering Lag on Large Datasets',
      canonical_category: 'Performance',
      problem_summary: 'Dashboard freezing for 3-5 seconds when rendering multi-series timeseries graphs.',
      root_cause_hypothesis: 'Unmemoized SVG canvas re-renders on window resize and filter changes.',
      severity_rating: 2,
      member_feedback_ids: c4Ids,
      quotes: c4Ids.slice(0, 2).map((id) => {
        const r = rows.find((row) => row.identity.feedbackId === id);
        return {
          feedback_id: id,
          quote_snippet: r?.text ? r.text.slice(0, 60) : 'Charts lag significantly when scrolling',
        };
      }),
      needs_investigation: false,
    },
    {
      cluster_id: 'CLUST-05',
      cluster_title: 'Invoice PDF Font Clipping',
      canonical_category: 'Billing',
      problem_summary: 'Generated invoice PDFs clip the rightmost total column on European currencies.',
      root_cause_hypothesis: 'Hardcoded table column width (120px) in headless PDF generator.',
      severity_rating: 1,
      member_feedback_ids: c5Ids,
      quotes: c5Ids.slice(0, 2).map((id) => {
        const r = rows.find((row) => row.identity.feedbackId === id);
        return {
          feedback_id: id,
          quote_snippet: r?.text ? r.text.slice(0, 60) : 'Invoice PDF totals are truncated',
        };
      }),
      needs_investigation: false,
      isUncertain: true,
      reviewFlag: 'Uncertain Cluster — Review Recommended',
      isFrequencyEstimated: true,
    },
  ];

  const clustUnc: ReconciledCluster = {
    cluster_id: 'CLUST-UNC',
    cluster_title: 'Unclustered Feedback',
    canonical_category: 'General',
    problem_summary: 'Miscellaneous feedback rows with low thematic cohesion.',
    root_cause_hypothesis: 'Isolated user observations requiring individual review.',
    severity_rating: 1,
    member_feedback_ids: uncIds,
    quotes: [],
    needs_investigation: false,
    isUnclustered: true,
  };

  const diagnostics = {
    totalInputIds: rows.length,
    totalClusteredIds: rows.length - uncIds.length,
    unclusteredIdsCount: uncIds.length,
    unclusteredFeedbackIds: uncIds,
    droppedUnknownIds: [],
    droppedUnknownCount: 0,
    duplicateAssignmentsResolvedCount: 0,
    duplicatesResolvedDetails: [],
  };

  const integrity = {
    isValid: true,
    stage: 'Pass2',
    totalInputIds: rows.length,
    totalAssignedIds: rows.length,
    missingIds: [],
    duplicateIds: [],
    unknownIds: [],
  };

  return {
    pass1Pipeline: {
      allClusters: clusters,
      batchResults: [],
      failedFeedbackIds: [],
      succeededFeedbackIds: rowIds,
      failedBatchIndices: [],
      hasPartialFailures: false,
      isFullyFailed: false,
      isCancelled: false,
      totalDurationMs: 120,
    },
    pass1Assembly: {
      clusters,
      clustUnc,
      diagnostics,
      integrity,
    },
    pass2Reconciliation: {
      clusters,
      clustUnc,
      decisions: [],
      hasFailures: false,
      diagnostics,
      integrity,
    },
    finalClusters: clusters,
    clustUnc,
    diagnostics,
    failedBatchIndices: [],
    isFullyFailed: false,
    isCancelled: false,
    totalDurationMs: 120,
  };
}
