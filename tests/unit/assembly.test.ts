/**
 * tests/unit/assembly.test.ts — Pass 1 Assembly, ID Integrity, and Duplicate Resolution Test Suite
 * Validates PRD REQ-006, §5.4–5.6; GAP-11, GAP-13; IC-001, IC-003, IC-015; Gate G-M2C.
 */

import { describe, it, expect } from 'vitest';
import { assemblePass1Clusters, verifyIdIntegrity } from '../../src/ai/assembly';
import { ClusterResponseItem } from '../../src/types/ai';

describe('Pass 1 Assembly & ID Integrity Enforcement (GAP-11, GAP-13)', () => {
  describe('Strict ID Integrity Invariant Verification (verifyIdIntegrity)', () => {
    it('returns isValid: true when every input ID appears in exactly one cluster', () => {
      const inputIds = ['FB-001', 'FB-002', 'FB-003'];
      const clusters = [
        { cluster_id: 'CLUST-01', member_feedback_ids: ['FB-001', 'FB-002'] },
        { cluster_id: 'CLUST-02', member_feedback_ids: ['FB-003'] },
      ];

      const result = verifyIdIntegrity(inputIds, clusters, 'Test Stage');
      expect(result.isValid).toBe(true);
      expect(result.missingIds).toHaveLength(0);
      expect(result.duplicateIds).toHaveLength(0);
      expect(result.unknownIds).toHaveLength(0);
      expect(result.totalAssignedIds).toBe(3);
    });

    it('detects missing feedback IDs and reports isValid: false', () => {
      const inputIds = ['FB-001', 'FB-002', 'FB-003'];
      const clusters = [{ cluster_id: 'CLUST-01', member_feedback_ids: ['FB-001'] }];

      const result = verifyIdIntegrity(inputIds, clusters, 'Test Stage');
      expect(result.isValid).toBe(false);
      expect(result.missingIds).toEqual(['FB-002', 'FB-003']);
      expect(result.errorMessage).toContain('2 missing');
    });

    it('detects duplicate feedback ID assignments and reports isValid: false', () => {
      const inputIds = ['FB-001', 'FB-002'];
      const clusters = [
        { cluster_id: 'CLUST-01', member_feedback_ids: ['FB-001', 'FB-002'] },
        { cluster_id: 'CLUST-02', member_feedback_ids: ['FB-002'] },
      ];

      const result = verifyIdIntegrity(inputIds, clusters, 'Test Stage');
      expect(result.isValid).toBe(false);
      expect(result.duplicateIds).toEqual(['FB-002']);
      expect(result.errorMessage).toContain('1 duplicate');
    });

    it('detects unknown fabricated IDs not in the input set', () => {
      const inputIds = ['FB-001'];
      const clusters = [
        { cluster_id: 'CLUST-01', member_feedback_ids: ['FB-001', 'FB-FABRICATED'] },
      ];

      const result = verifyIdIntegrity(inputIds, clusters, 'Test Stage');
      expect(result.isValid).toBe(false);
      expect(result.unknownIds).toEqual(['FB-FABRICATED']);
      expect(result.errorMessage).toContain('1 unknown IDs');
    });
  });

  describe('Dropping Unknown Fabricated IDs', () => {
    it('drops unknown IDs returned by model, strips unknown quotes, and records them in diagnostics', () => {
      const inputIds = ['FB-001', 'FB-002'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Export Latency',
          canonical_category: 'Performance',
          problem_summary: 'Exports take too long.',
          root_cause_hypothesis: 'Unpaginated query.',
          severity_rating: 2,
          member_feedback_ids: ['FB-001', 'FB-UNKNOWN-999'],
          quotes: [
            { feedback_id: 'FB-001', quote_snippet: 'Exports take too long' },
            { feedback_id: 'FB-UNKNOWN-999', quote_snippet: 'Fabricated quote' },
          ],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Billing Invoice Error',
          canonical_category: 'Billing',
          problem_summary: 'Invoices missing PDF.',
          root_cause_hypothesis: 'PDF service 500.',
          severity_rating: 1,
          member_feedback_ids: ['FB-002'],
          quotes: [{ feedback_id: 'FB-002', quote_snippet: 'Invoices missing' }],
        },
      ];

      const assembled = assemblePass1Clusters(inputIds, rawClusters);

      // Verify unknown ID was dropped from members and quotes
      expect(assembled.clusters[0].member_feedback_ids).toEqual(['FB-001']);
      expect(assembled.clusters[0].quotes).toEqual([
        { feedback_id: 'FB-001', quote_snippet: 'Exports take too long' },
      ]);

      // Verify diagnostics tracked the dropped unknown ID
      expect(assembled.diagnostics.droppedUnknownCount).toBe(1);
      expect(assembled.diagnostics.droppedUnknownIds).toEqual(['FB-UNKNOWN-999']);

      // Invariant holds
      expect(assembled.integrity.isValid).toBe(true);
    });

    it('completely removes any cluster whose members were 100% fabricated unknown IDs', () => {
      const inputIds = ['FB-001'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Real Cluster',
          canonical_category: 'Performance',
          problem_summary: 'Real problem.',
          root_cause_hypothesis: 'Real cause.',
          severity_rating: 3,
          member_feedback_ids: ['FB-001'],
          quotes: [],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Hallucinated Cluster',
          canonical_category: 'Hallucination',
          problem_summary: 'Phantom problem.',
          root_cause_hypothesis: 'Phantom cause.',
          severity_rating: 1,
          member_feedback_ids: ['FB-PHANTOM-1', 'FB-PHANTOM-2'],
          quotes: [],
        },
      ];

      const assembled = assemblePass1Clusters(inputIds, rawClusters);
      expect(assembled.clusters).toHaveLength(1);
      expect(assembled.clusters[0].cluster_id).toBe('CLUST-01');
      expect(assembled.diagnostics.droppedUnknownCount).toBe(2);
      expect(assembled.integrity.isValid).toBe(true);
    });
  });

  describe('GAP-13 Tie-Breaking Duplicate Membership Resolution', () => {
    it('resolves duplicate assignment by Highest Severity (GAP-13 Priority 1)', () => {
      const inputIds = ['FB-001', 'FB-002'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Low Severity Issue',
          canonical_category: 'UI',
          problem_summary: 'Button alignment off.',
          root_cause_hypothesis: 'CSS margin.',
          severity_rating: 1, // S=1
          member_feedback_ids: ['FB-001'],
          quotes: [{ feedback_id: 'FB-001', quote_snippet: 'button off' }],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'High Severity Crash',
          canonical_category: 'Stability',
          problem_summary: 'Crash on submit.',
          root_cause_hypothesis: 'Null pointer exception.',
          severity_rating: 3, // S=3 -> Winner
          member_feedback_ids: ['FB-001', 'FB-002'],
          quotes: [],
        },
      ];

      const assembled = assemblePass1Clusters(inputIds, rawClusters);

      // CLUST-02 (severity 3) wins FB-001 over CLUST-01 (severity 1)
      const c2 = assembled.clusters.find((c) => c.cluster_id === 'CLUST-02');
      expect(c2?.member_feedback_ids).toContain('FB-001');
      expect(c2?.member_feedback_ids).toContain('FB-002');

      // CLUST-01 stripped of FB-001; since FB-001 was its only member, CLUST-01 is removed
      expect(assembled.clusters.find((c) => c.cluster_id === 'CLUST-01')).toBeUndefined();

      // Quote for FB-001 from CLUST-01 preserved in winning cluster
      expect(c2?.quotes.some((q) => q.feedback_id === 'FB-001')).toBe(true);

      // Diagnostics recorded resolution
      expect(assembled.diagnostics.duplicateAssignmentsResolvedCount).toBe(1);
      expect(assembled.diagnostics.duplicatesResolvedDetails[0].keptInClusterId).toBe('CLUST-02');
      expect(assembled.diagnostics.duplicatesResolvedDetails[0].strippedFromClusterIds).toEqual(['CLUST-01']);

      // Invariant holds
      expect(assembled.integrity.isValid).toBe(true);
    });

    it('resolves duplicate assignment by Largest Membership when severity is tied (GAP-13 Priority 2)', () => {
      const inputIds = ['FB-001', 'FB-002', 'FB-003', 'FB-004'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Small Cluster',
          canonical_category: 'Export',
          problem_summary: 'Small export issue.',
          root_cause_hypothesis: 'Buffer limit.',
          severity_rating: 2, // Severity tied
          member_feedback_ids: ['FB-001', 'FB-002'], // 2 initial members
          quotes: [],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Large Cluster',
          canonical_category: 'Export',
          problem_summary: 'Widespread export issue.',
          root_cause_hypothesis: 'Gateway timeout.',
          severity_rating: 2, // Severity tied
          member_feedback_ids: ['FB-002', 'FB-003', 'FB-004'], // 3 initial members -> Winner for FB-002
          quotes: [],
        },
      ];

      const assembled = assemblePass1Clusters(inputIds, rawClusters);

      const c1 = assembled.clusters.find((c) => c.cluster_id === 'CLUST-01');
      const c2 = assembled.clusters.find((c) => c.cluster_id === 'CLUST-02');

      // FB-002 kept in CLUST-02 (larger initial membership: 3 vs 2)
      expect(c2?.member_feedback_ids).toEqual(['FB-002', 'FB-003', 'FB-004']);
      expect(c1?.member_feedback_ids).toEqual(['FB-001']);

      expect(assembled.diagnostics.duplicateAssignmentsResolvedCount).toBe(1);
      expect(assembled.diagnostics.duplicatesResolvedDetails[0].keptInClusterId).toBe('CLUST-02');

      expect(assembled.integrity.isValid).toBe(true);
    });

    it('resolves duplicate assignment by Lowest Cluster ID when severity and membership are tied (GAP-13 Priority 3)', () => {
      const inputIds = ['FB-001', 'FB-002', 'FB-003'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01', // Lower ID -> Winner
          cluster_title: 'Cluster Alpha',
          canonical_category: 'Auth',
          problem_summary: 'Login issue.',
          root_cause_hypothesis: 'OAuth token.',
          severity_rating: 2, // Tied S=2
          member_feedback_ids: ['FB-001', 'FB-002'], // Tied size: 2
          quotes: [],
        },
        {
          cluster_id: 'CLUST-02',
          cluster_title: 'Cluster Beta',
          canonical_category: 'Auth',
          problem_summary: 'SSO issue.',
          root_cause_hypothesis: 'SAML token.',
          severity_rating: 2, // Tied S=2
          member_feedback_ids: ['FB-002', 'FB-003'], // Tied size: 2
          quotes: [],
        },
      ];

      const assembled = assemblePass1Clusters(inputIds, rawClusters);

      const c1 = assembled.clusters.find((c) => c.cluster_id === 'CLUST-01');
      const c2 = assembled.clusters.find((c) => c.cluster_id === 'CLUST-02');

      // CLUST-01 wins FB-002 (lowest cluster ID)
      expect(c1?.member_feedback_ids).toEqual(['FB-001', 'FB-002']);
      expect(c2?.member_feedback_ids).toEqual(['FB-003']);

      expect(assembled.diagnostics.duplicateAssignmentsResolvedCount).toBe(1);
      expect(assembled.diagnostics.duplicatesResolvedDetails[0].keptInClusterId).toBe('CLUST-01');

      expect(assembled.integrity.isValid).toBe(true);
    });
  });

  describe('Unclustered Fallback Bucket (GAP-11)', () => {
    it('routes unassigned input Feedback IDs to CLUST-UNC with S=1, P=0 (GAP-11)', () => {
      const inputIds = ['FB-001', 'FB-002', 'FB-003', 'FB-004'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'Export Latency',
          canonical_category: 'Performance',
          problem_summary: 'Slow exports.',
          root_cause_hypothesis: 'Database index missing.',
          severity_rating: 3,
          member_feedback_ids: ['FB-001', 'FB-002'],
          quotes: [],
        },
      ];

      const assembled = assemblePass1Clusters(inputIds, rawClusters);

      expect(assembled.clusters).toHaveLength(1);
      expect(assembled.clustUnc).not.toBeNull();
      expect(assembled.clustUnc?.cluster_id).toBe('CLUST-UNC');
      expect(assembled.clustUnc?.cluster_title).toBe('Unclustered Feedback');
      expect(assembled.clustUnc?.severity_rating).toBe(1); // S=1 per GAP-11
      expect(assembled.clustUnc?.priority_score).toBe(0); // P=0 per GAP-11
      expect(assembled.clustUnc?.isUnclustered).toBe(true);
      expect(assembled.clustUnc?.member_feedback_ids).toEqual(['FB-003', 'FB-004']);

      expect(assembled.diagnostics.unclusteredIdsCount).toBe(2);
      expect(assembled.diagnostics.unclusteredFeedbackIds).toEqual(['FB-003', 'FB-004']);

      // Invariant holds: every input ID appears in exactly one cluster (or CLUST-UNC)
      expect(assembled.integrity.isValid).toBe(true);
    });

    it('returns clustUnc: null when 100% of input IDs are cleanly assigned to clusters', () => {
      const inputIds = ['FB-001', 'FB-002'];
      const rawClusters: ClusterResponseItem[] = [
        {
          cluster_id: 'CLUST-01',
          cluster_title: 'All Ingested',
          canonical_category: 'General',
          problem_summary: 'Full coverage.',
          root_cause_hypothesis: 'Clean grouping.',
          severity_rating: 2,
          member_feedback_ids: ['FB-001', 'FB-002'],
          quotes: [],
        },
      ];

      const assembled = assemblePass1Clusters(inputIds, rawClusters);
      expect(assembled.clustUnc).toBeNull();
      expect(assembled.diagnostics.unclusteredIdsCount).toBe(0);
      expect(assembled.integrity.isValid).toBe(true);
    });
  });
});
