/**
 * ui/ReconciliationDiagnostics.tsx — Reconciliation Diagnostics Panel & Uncertainty Badges
 * Governed by PRD REQ-006, §5.4–5.6, TS-019, TS-026; GAP-11, GAP-13; IC-003, IC-015.
 */

import React, { useState } from 'react';
import { AssemblyDiagnostics, ReconciledCluster, IdIntegrityCheckResult } from '../types/ai';
import {
  ROOT_CAUSE_LABEL,
  BOUNDARY_NOTICE_TEXT,
  INVESTIGATION_PLACEHOLDER,
} from '../verify/missingContext';

export interface ReconciliationDiagnosticsProps {
  diagnostics: AssemblyDiagnostics;
  clusters: ReconciledCluster[];
  clustUnc: ReconciledCluster | null;
  integrity: IdIntegrityCheckResult;
  advisoryBannerMessage?: string;
  isFullyFailed?: boolean;
  failedBatchIndices?: number[];
  onRetryFailedBatches?: () => void;
  isRetrying?: boolean;
}

export const ReconciliationDiagnostics: React.FC<ReconciliationDiagnosticsProps> = ({
  diagnostics,
  clusters,
  clustUnc,
  integrity,
  advisoryBannerMessage,
  isFullyFailed,
  failedBatchIndices,
  onRetryFailedBatches,
  isRetrying,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const totalInputIds = diagnostics.totalInputIds;
  const totalClustered = diagnostics.totalClusteredIds;
  const unclusteredCount = diagnostics.unclusteredIdsCount;
  const droppedUnknownCount = diagnostics.droppedUnknownCount;
  const duplicatesResolvedCount = diagnostics.duplicateAssignmentsResolvedCount;

  const uncertainClusters = clusters.filter((c) => c.isUncertain);

  return (
    <div
      id="reconciliation-diagnostics-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        marginTop: '1.5rem',
      }}
    >
      {/* 1. Pass 2 Advisory Degradation Banner (if applicable) */}
      {advisoryBannerMessage && (
        <div
          id="pass2-advisory-banner"
          role="alert"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden="true">
            ⚠️
          </span>
          <div style={{ flex: 1, fontSize: '0.875rem', color: '#FBBF24', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
              Reconciliation Advisory:
            </strong>
            {advisoryBannerMessage}
          </div>
        </div>
      )}

      {/* Degraded / Partial-Analysis State Banner (REQ-007, TS-037) */}
      {(isFullyFailed || (failedBatchIndices && failedBatchIndices.length > 0)) && (
        <div
          id="partial-analysis-warning-banner"
          role="alert"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden="true">
              ⚠️
            </span>
            <div style={{ fontSize: '0.875rem', color: '#F87171', lineHeight: 1.5 }}>
              <strong style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                Partial Analysis / Provider Degraded:
              </strong>
              {advisoryBannerMessage ||
                'Persistent failure or quota exhaustion encountered. All unprocessed feedback has been routed to Unclustered Feedback (CLUST-UNC).'}
            </div>
          </div>
          {onRetryFailedBatches && (
            <button
              id="btn-retry-failed-batches"
              onClick={onRetryFailedBatches}
              disabled={isRetrying}
              style={{
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: 'none',
                cursor: isRetrying ? 'not-allowed' : 'pointer',
                opacity: isRetrying ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isRetrying ? 'Retrying failed batches...' : 'Retry failed batches'}
            </button>
          )}
        </div>
      )}

      {/* 2. Core Diagnostics Summary Bar */}
      <div
        id="diagnostics-summary-panel"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }} aria-hidden="true">
              🔬
            </span>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              Pipeline ID Integrity & Diagnostics Panel
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {integrity.isValid ? (
              <span
                id="id-integrity-pass-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34D399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '9999px',
                  padding: '0.25rem 0.65rem',
                }}
              >
                ✓ 1:1 Feedback ID Invariant Satisfied
              </span>
            ) : (
              <span
                id="id-integrity-fail-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#F87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '9999px',
                  padding: '0.25rem 0.65rem',
                }}
              >
                ✕ ID Integrity Check Failed
              </span>
            )}

            <button
              id="btn-toggle-diagnostics-details"
              onClick={() => setShowDetails(!showDetails)}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              {showDetails ? 'Hide Audit Log' : 'Show Audit Log'}
            </button>
          </div>
        </div>

        {/* Diagnostic Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              Input Feedback IDs
            </span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{totalInputIds}</strong>
          </div>

          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              Thematic Clusters
            </span>
            <strong style={{ fontSize: '1.25rem', color: '#38BDF8' }}>{clusters.length}</strong>
          </div>

          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              Clustered Feedback IDs
            </span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{totalClustered}</strong>
          </div>

          <div
            id="metric-duplicates-resolved"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              GAP-13 Duplicates Resolved
            </span>
            <strong
              style={{
                fontSize: '1.25rem',
                color: duplicatesResolvedCount > 0 ? '#FBBF24' : 'var(--text-secondary)',
              }}
            >
              {duplicatesResolvedCount}
            </strong>
          </div>

          <div
            id="metric-dropped-unknown-ids"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              Dropped Unknown IDs
            </span>
            <strong
              style={{
                fontSize: '1.25rem',
                color: droppedUnknownCount > 0 ? '#F87171' : 'var(--text-secondary)',
              }}
            >
              {droppedUnknownCount}
            </strong>
          </div>

          <div
            id="metric-unclustered-fallback"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              CLUST-UNC Fallback
            </span>
            <strong
              style={{
                fontSize: '1.25rem',
                color: unclusteredCount > 0 ? '#FBBF24' : 'var(--text-secondary)',
              }}
            >
              {unclusteredCount}
            </strong>
          </div>
        </div>

        {/* Collapsible Details */}
        {showDetails && (
          <div
            id="diagnostics-audit-details"
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: '1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div>
              <strong>Dropped Unknown IDs ({droppedUnknownCount}):</strong>{' '}
              {droppedUnknownCount > 0 ? (
                <code style={{ color: '#F87171' }}>{diagnostics.droppedUnknownIds.join(', ')}</code>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>None (Zero unknown IDs returned by AI)</span>
              )}
            </div>

            <div>
              <strong>GAP-13 Tie-Breaker Resolutions ({duplicatesResolvedCount}):</strong>
              {duplicatesResolvedCount > 0 ? (
                <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                  {diagnostics.duplicatesResolvedDetails.map((d) => (
                    <li key={d.feedbackId}>
                      <code>{d.feedbackId}</code>: Retained in <strong>{d.keptInClusterId}</strong> (stripped from{' '}
                      {d.strippedFromClusterIds.join(', ')})
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}> None (All memberships were unique)</span>
              )}
            </div>

            {unclusteredCount > 0 && (
              <div>
                <strong>CLUST-UNC Member IDs ({unclusteredCount}):</strong>{' '}
                <code style={{ color: '#FBBF24' }}>{diagnostics.unclusteredFeedbackIds.join(', ')}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Reconciled Clusters Overview */}
      <div
        id="reconciled-clusters-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Reconciled Clusters ({clusters.length + (clustUnc ? 1 : 0)})
          </h3>
          {uncertainClusters.length > 0 && (
            <span
              id="uncertain-clusters-summary-pill"
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#FBBF24',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontWeight: 600,
              }}
            >
              ⚠️ {uncertainClusters.length} Uncertain Cluster{uncertainClusters.length > 1 ? 's' : ''} Flagged for Review
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {clusters.map((cluster) => {
            const isUncertain = Boolean(cluster.isUncertain);
            const severityLabel =
              cluster.severity_rating === 3
                ? 'High (Blocker)'
                : cluster.severity_rating === 2
                ? 'Medium (Major)'
                : 'Low (Minor)';
            const severityColor =
              cluster.severity_rating === 3 ? '#F87171' : cluster.severity_rating === 2 ? '#FBBF24' : '#34D399';

            return (
              <div
                key={cluster.cluster_id}
                id={`cluster-card-${cluster.cluster_id}`}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: isUncertain
                    ? '1px solid rgba(245, 158, 11, 0.5)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {cluster.cluster_id}
                    </span>
                    <h4
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                      }}
                    >
                      {cluster.cluster_title}
                    </h4>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      {cluster.canonical_category}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: severityColor,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${severityColor}40`,
                      }}
                    >
                      Severity: {severityLabel}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {cluster.member_feedback_ids.length} item{cluster.member_feedback_ids.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {cluster.problem_summary}
                </p>

                {/* Root-Cause Hypothesis & Boundary Notice (MDD §3.6) */}
                <div
                  id={`root-cause-section-${cluster.cluster_id}`}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-accent, #60A5FA)',
                      }}
                    >
                      {ROOT_CAUSE_LABEL}
                    </span>
                    {cluster.needs_investigation && (
                      <span
                        id={`needs-investigation-badge-${cluster.cluster_id}`}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#FBBF24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '4px',
                          padding: '0.1rem 0.4rem',
                        }}
                      >
                        {cluster.investigation_placeholder || INVESTIGATION_PLACEHOLDER}
                      </span>
                    )}
                  </div>
                  <p
                    id={`hypothesis-text-${cluster.cluster_id}`}
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {cluster.root_cause_hypothesis}
                  </p>
                  <div
                    id={`boundary-notice-${cluster.cluster_id}`}
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      lineHeight: 1.3,
                    }}
                  >
                    ⚠️ {BOUNDARY_NOTICE_TEXT}
                  </div>
                </div>

                {/* TS-019: Uncertain Cluster Flag & Plain-Language Rationale */}
                {isUncertain && (
                  <div
                    id={`uncertain-banner-${cluster.cluster_id}`}
                    style={{
                      marginTop: '0.25rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span aria-hidden="true">⚠️</span>
                      <strong style={{ fontSize: '0.75rem', color: '#FBBF24' }}>
                        {cluster.reviewFlag || 'Uncertain Cluster — Review Recommended'}
                      </strong>
                    </div>
                    {cluster.uncertainRationale && (
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: '#FDE68A',
                          margin: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        <em>Rationale:</em> {cluster.uncertainRationale}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* CLUST-UNC Fallback Card (GAP-11) */}
          {clustUnc && (
            <div
              id="cluster-card-CLUST-UNC"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                border: '1px dashed rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-card)',
                      color: '#FBBF24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    CLUST-UNC
                  </span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FBBF24', margin: 0 }}>
                    Unclustered Feedback
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    (S=1, P=0 — Excluded from matrix and max-normalization per GAP-11)
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {clustUnc.member_feedback_ids.length} item{clustUnc.member_feedback_ids.length > 1 ? 's' : ''}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {clustUnc.problem_summary}
              </p>

              {/* Root-Cause Hypothesis for CLUST-UNC */}
              <div
                id="root-cause-section-CLUST-UNC"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  marginTop: '0.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-accent, #60A5FA)',
                    }}
                  >
                    {ROOT_CAUSE_LABEL}
                  </span>
                  <span
                    id="needs-investigation-badge-CLUST-UNC"
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      color: '#FBBF24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '4px',
                      padding: '0.1rem 0.4rem',
                    }}
                  >
                    {INVESTIGATION_PLACEHOLDER}
                  </span>
                </div>
                <p
                  id="hypothesis-text-CLUST-UNC"
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {clustUnc.root_cause_hypothesis}
                </p>
                <div
                  id="boundary-notice-CLUST-UNC"
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    lineHeight: 1.3,
                  }}
                >
                  ⚠️ {BOUNDARY_NOTICE_TEXT}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
