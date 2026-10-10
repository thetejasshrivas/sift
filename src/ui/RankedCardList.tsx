/**
 * RankedCardList.tsx — Ranked Insight Card List with Breakdown Tooltips
 * Governed by PRD REQ-009, REQ-010, §8.3, TS-006; MDD §4.2; IC-002, GAP-02.
 *
 * Rules:
 * 1. Cards re-sort dynamically based on priority score (P_c).
 * 2. Displays rank badge (#1, #2, ...), title, category, and verbatim metrics.
 * 3. Incorporates BreakdownTooltip for math explainability (MDD §3.12).
 * 4. Displays physical matrix coordinates (F_n, I_n) to prove coordinate stability.
 * 5. Bi-directional dot↔card hover and selection highlighting.
 * 6. Clicking card opens deep-dive drawer.
 */

import React from 'react';
import { ScoredCluster } from '../types/scoring';
import { BreakdownTooltip } from './BreakdownTooltip';

export interface RankedCardListProps {
  clusters: ScoredCluster[];
  selectedClusterId?: string | null;
  hoveredClusterId?: string | null;
  onSelectCluster?: (clusterId: string) => void;
  onHoverCluster?: (clusterId: string | null) => void;
  onOpenDrawer?: (clusterId: string) => void;
  className?: string;
}

export const RankedCardList: React.FC<RankedCardListProps> = ({
  clusters,
  selectedClusterId,
  hoveredClusterId,
  onSelectCluster,
  onHoverCluster,
  onOpenDrawer,
  className,
}) => {
  const handleCardClick = (clusterId: string) => {
    if (onSelectCluster) {
      onSelectCluster(clusterId);
    }
    if (onOpenDrawer) {
      onOpenDrawer(clusterId);
    }
  };

  return (
    <div
      className={className}
      id="ranked-card-list-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
          Ranked Insight Cards ({clusters.length})
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Sorted by Priority Score (P_c)
        </span>
      </div>

      <div
        id="ranked-cards-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          maxHeight: '620px',
          overflowY: 'auto',
          paddingRight: '0.25rem',
        }}
      >
        {clusters.map((cluster) => {
          const isSelected = selectedClusterId === cluster.cluster_id;
          const isHovered = hoveredClusterId === cluster.cluster_id;
          const isUnclustered = cluster.cluster_id === 'CLUST-UNC' || cluster.flags.isUnclusteredBucket;

          // Determine quadrant name
          const isHighImpact = cluster.normalized.I_n >= 0.5;
          const isHighFreq = cluster.normalized.F_n >= 0.5;
          const quadrantName = isHighImpact && isHighFreq
            ? 'High Impact / High Frequency'
            : isHighImpact && !isHighFreq
            ? 'High Impact / Low Frequency'
            : !isHighImpact && isHighFreq
            ? 'Low Impact / High Frequency'
            : 'Low Impact / Low Frequency';

          return (
            <div
              key={cluster.cluster_id}
              id={`ranked-card-${cluster.cluster_id}`}
              data-testid={`ranked-card-${cluster.cluster_id}`}
              data-cluster-id={cluster.cluster_id}
              data-rank={cluster.rank}
              data-score={cluster.priority_score.toFixed(1)}
              data-fn={cluster.coordinates.x.toFixed(4)}
              data-in={cluster.coordinates.y.toFixed(4)}
              data-highlighted={isHovered || isSelected ? 'true' : 'false'}
              onClick={() => handleCardClick(cluster.cluster_id)}
              onMouseEnter={() => onHoverCluster && onHoverCluster(cluster.cluster_id)}
              onMouseLeave={() => onHoverCluster && onHoverCluster(null)}
              style={{
                backgroundColor: isSelected
                  ? 'var(--bg-card)'
                  : isHovered
                  ? 'rgba(30, 41, 59, 0.95)'
                  : 'var(--bg-surface)',
                border: isSelected
                  ? '2px solid #38BDF8'
                  : isHovered
                  ? '2px solid rgba(56, 189, 248, 0.6)'
                  : isUnclustered
                  ? '1px dashed var(--border-subtle)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1rem',
                boxShadow: isSelected
                  ? '0 0 15px rgba(56, 189, 248, 0.25)'
                  : isHovered
                  ? '0 0 12px rgba(56, 189, 248, 0.15)'
                  : '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                transform: isHovered ? 'translateY(-1px)' : 'none',
              }}
            >
              {/* Card Header: Rank, Title, Score Tooltip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                  <span
                    id={`card-rank-${cluster.cluster_id}`}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: isUnclustered ? '#334155' : 'var(--color-blue)',
                      color: '#FFFFFF',
                      minWidth: '28px',
                      textAlign: 'center',
                    }}
                  >
                    #{cluster.rank}
                  </span>
                  <div>
                    <h4
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                        margin: 0,
                      }}
                    >
                      {cluster.cluster_title}
                    </h4>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.15rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                        {cluster.canonical_category}
                      </span>
                      {!isUnclustered && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: isHighImpact ? '#F87171' : '#64748B',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '3px',
                          }}
                        >
                          {quadrantName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score Badge with Breakdown Tooltip */}
                <div id={`card-score-wrapper-${cluster.cluster_id}`}>
                  <BreakdownTooltip
                    breakdown={cluster.breakdown}
                    priorityScore={cluster.priority_score}
                    rank={cluster.rank}
                  />
                </div>
              </div>

              {/* Status Badges Row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.65rem' }}>
                {/* Critical Blocker Badge */}
                {cluster.flags.isCriticalBlocker && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#EF4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    🚨 {cluster.flags.criticalBlockerBadge}
                  </span>
                )}

                {/* Small Sample Badge */}
                {cluster.flags.isSmallSample && !isUnclustered && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(148, 163, 184, 0.12)',
                      color: '#94A3B8',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                    }}
                  >
                    ⚠️ {cluster.flags.smallSampleBadge}
                  </span>
                )}

                {/* High Impact / Enterprise Risk Badge */}
                {cluster.normalized.I_n >= 0.7 && !isUnclustered && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(217, 119, 6, 0.15)',
                      color: '#F59E0B',
                      border: '1px solid rgba(217, 119, 6, 0.3)',
                    }}
                  >
                    👑 Enterprise Revenue Risk
                  </span>
                )}

                {/* Fixed Matrix Coordinates Pill for Invariance Verification */}
                <span
                  id={`card-coords-${cluster.cluster_id}`}
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    color: '#38BDF8',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                  }}
                  title="Matrix scatter coordinates (F_n, I_n) derived strictly from physical metrics. Remain stationary as sliders move."
                >
                  Coords: (F_n: {cluster.coordinates.x.toFixed(2)}, I_n: {cluster.coordinates.y.toFixed(2)})
                </span>
              </div>

              {/* Problem Summary snippet */}
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  margin: '0 0 0.65rem 0',
                }}
              >
                {cluster.problem_summary}
              </p>

              {/* Metrics Footer & Expand Prompt */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: '#94A3B8',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.5rem',
                }}
              >
                <div>
                  <span>Impact: </span>
                  <strong style={{ color: '#E2E8F0' }}>{cluster.metrics.I_c.toFixed(1)}</strong>
                  <span> • Accounts: </span>
                  <strong style={{ color: '#E2E8F0' }}>{cluster.metrics.U_c}</strong>
                  <span> • Incidents: </span>
                  <strong style={{ color: '#E2E8F0' }}>{cluster.metrics.N_c}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#38BDF8', fontSize: '0.7rem', fontWeight: 600 }}>
                    Deep Dive →
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
