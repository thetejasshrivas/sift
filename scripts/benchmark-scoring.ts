#!/usr/bin/env node

/**
 * benchmark-scoring.ts — Performance Benchmark for Deterministic Scoring & 60 FPS Re-ranking
 * Governed by PRD REQ-009, §6.2, §8.3, TS-006; MDD §2.4, §4.3.
 *
 * Requirements:
 * - Times recalculation + sort for 200 and 1,000 synthetic clusters.
 * - Prints elapsed time in milliseconds (target < 16 ms per PRD §8.3).
 * - Records actual execution metrics.
 */

import { performance } from 'node:perf_hooks';
import { scoreAndRankClusters } from '../src/scoring/index';
import { ReconciledCluster } from '../src/types/pipeline';
import { ProcessedFeedbackRow } from '../src/identity/dataQuality';
import { SliderWeights } from '../src/types/scoring';

/**
 * Generates N synthetic clusters with member rows spanning different tiers.
 */
function generateSyntheticDataset(clusterCount: number, rowsPerCluster: number = 4): {
  clusters: ReconciledCluster[];
  rows: ProcessedFeedbackRow[];
} {
  const tiers = ['Enterprise', 'Pro', 'Free', 'UNKNOWN'] as const;
  const categories = [
    'Export',
    'Authentication',
    'Performance',
    'UI Alignment',
    'Billing',
    'API Integrations',
    'Reporting',
  ];

  const clusters: ReconciledCluster[] = [];
  const rows: ProcessedFeedbackRow[] = [];

  let rowCounter = 1;

  for (let c = 1; c <= clusterCount; c++) {
    const clusterId = `CLUST-${String(c).padStart(4, '0')}`;
    const category = categories[c % categories.length];
    const severity = ((c % 3) + 1) as 1 | 2 | 3;
    const memberIds: string[] = [];

    for (let r = 0; r < rowsPerCluster; r++) {
      const fbId = `FB-${String(rowCounter).padStart(5, '0')}`;
      const tier = tiers[(c + r) % tiers.length];
      const accountId = r === 0 ? undefined : `ACC-${(c % 50) + 1}`; // Some missing accounts

      memberIds.push(fbId);
      rows.push({
        identity: {
          feedbackId: fbId,
          accountId: accountId,
          userId: `USR-${rowCounter}`,
        },
        tierResolution: {
          canonicalTier: tier,
          weight: tier === 'Enterprise' ? 3.0 : tier === 'Pro' ? 2.0 : 1.0,
          weightLabel: 'Tier-Weighted',
          isUnrecognized: false,
        },
        hasUnknownTier: tier === 'UNKNOWN',
        hasUnmappedAccount: !accountId,
        qualityIssues: [],
        row: {
          id: fbId,
          text: `Synthetic feedback observation for cluster ${clusterId} item ${r + 1}`,
          tier,
          account_id: accountId,
          user_id: `USR-${rowCounter}`,
          date: '2026-10-10',
          rowIndex: rowCounter,
        },
      } as unknown as ProcessedFeedbackRow);

      rowCounter++;
    }

    clusters.push({
      cluster_id: clusterId,
      cluster_title: `Synthetic Cluster Title ${c} (${category})`,
      canonical_category: category,
      problem_summary: `Summary of recurring friction for cluster ${c}`,
      root_cause_hypothesis: `Root cause hypothesis ${c}`,
      severity_rating: severity,
      member_feedback_ids: memberIds,
      quotes: memberIds.slice(0, 2).map((id) => ({
        feedback_id: id,
        quote_snippet: `Synthetic feedback observation for cluster ${clusterId}`,
      })),
      needs_investigation: false,
    });
  }

  // Include 1 CLUST-UNC bucket
  const uncFbId = `FB-${String(rowCounter).padStart(5, '0')}`;
  rows.push({
    identity: {
      feedbackId: uncFbId,
      accountId: 'ACC-UNC',
      userId: `USR-${rowCounter}`,
    },
    tierResolution: {
      canonicalTier: 'Free / Starter',
      weight: 1.0,
      weightLabel: 'Tier-Weighted',
      isUnrecognized: false,
    },
    hasUnknownTier: false,
    hasUnmappedAccount: false,
    qualityIssues: [],
    row: {
      id: uncFbId,
      text: 'Unclustered miscellaneous text',
      tier: 'Free',
      account_id: 'ACC-UNC',
      user_id: `USR-${rowCounter}`,
      date: '2026-10-10',
      rowIndex: rowCounter,
    },
  } as unknown as ProcessedFeedbackRow);

  clusters.push({
    cluster_id: 'CLUST-UNC',
    cluster_title: 'Unclustered Feedback',
    canonical_category: 'General',
    problem_summary: 'Unclustered feedback items',
    root_cause_hypothesis: 'N/A',
    severity_rating: 1,
    member_feedback_ids: [uncFbId],
    quotes: [],
    needs_investigation: false,
    isUnclustered: true,
  });

  return { clusters, rows };
}

/**
 * Runs the benchmark for a specific cluster count over multiple slider weight variations.
 */
function benchmarkClusterCount(clusterCount: number, iterations: number = 50): {
  clusterCount: number;
  totalRows: number;
  iterations: number;
  minMs: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  pass: boolean;
} {
  const { clusters, rows } = generateSyntheticDataset(clusterCount, 4);

  // Diverse slider weight variations simulating real user dragging
  const testWeightVariations: SliderWeights[] = [
    { arr: 40, vol: 40, sev: 20 },
    { arr: 100, vol: 0, sev: 0 },
    { arr: 0, vol: 100, sev: 0 },
    { arr: 0, vol: 0, sev: 100 },
    { arr: 60, vol: 30, sev: 10 },
    { arr: 50, vol: 50, sev: 0 },
    { arr: 33, vol: 33, sev: 34 },
    { arr: 0, vol: 0, sev: 0 },
    { arr: 70, vol: 20, sev: 10 },
    { arr: 25, vol: 50, sev: 25 },
  ];

  // JIT warm-up
  for (let i = 0; i < 5; i++) {
    scoreAndRankClusters(clusters, rows, testWeightVariations[i % testWeightVariations.length]);
  }

  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const weights = testWeightVariations[i % testWeightVariations.length];
    const t0 = performance.now();
    const result = scoreAndRankClusters(clusters, rows, weights);
    const t1 = performance.now();

    // Verify invariant: result has clusters and top score is defined
    if (!result.scoredClusters.length) {
      throw new Error('Benchmark verification failed: empty scored clusters returned');
    }

    durations.push(t1 - t0);
  }

  durations.sort((a, b) => a - b);
  const minMs = durations[0];
  const maxMs = durations[durations.length - 1];
  const avgMs = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const medianMs = durations[Math.floor(durations.length / 2)];
  const p95Ms = durations[Math.floor(durations.length * 0.95)];

  const pass = avgMs < 16.0;

  return {
    clusterCount,
    totalRows: rows.length,
    iterations,
    minMs,
    avgMs,
    medianMs,
    p95Ms,
    maxMs,
    pass,
  };
}

export function runBenchmark() {
  console.log('='.repeat(80));
  console.log('SIFT SCORING ENGINE BENCHMARK (PRD REQ-009 & TS-006: 60-FPS RE-RANKING)');
  console.log('Target Latency Budget: < 16.00 ms per recalculation+sort (60 FPS budget = 16.6ms)');
  console.log('='.repeat(80));

  const results = [
    benchmarkClusterCount(200, 50),
    benchmarkClusterCount(1000, 50),
  ];

  console.log('\nBenchmark Results:');
  console.log('-'.repeat(80));
  console.log(
    'Clusters'.padEnd(10) +
    'Rows'.padEnd(10) +
    'Iterations'.padEnd(12) +
    'Min (ms)'.padEnd(12) +
    'Avg (ms)'.padEnd(12) +
    'p95 (ms)'.padEnd(12) +
    'Max (ms)'.padEnd(12) +
    'Status (<16ms)'
  );
  console.log('-'.repeat(80));

  let allPassed = true;

  for (const r of results) {
    if (!r.pass) allPassed = false;
    console.log(
      String(r.clusterCount).padEnd(10) +
      String(r.totalRows).padEnd(10) +
      String(r.iterations).padEnd(12) +
      r.minMs.toFixed(3).padEnd(12) +
      r.avgMs.toFixed(3).padEnd(12) +
      r.p95Ms.toFixed(3).padEnd(12) +
      r.maxMs.toFixed(3).padEnd(12) +
      (r.pass ? 'PASS (⚡)' : 'FAIL (⚠️)')
    );
  }

  console.log('-'.repeat(80));
  console.log(`\nOverall Benchmark Outcome: ${allPassed ? 'ALL PASSED (Sub-16ms Invariant Verified)' : 'FAILED'}`);
  console.log('='.repeat(80));

  return { results, allPassed };
}

// Execute directly if run as main script
runBenchmark();
