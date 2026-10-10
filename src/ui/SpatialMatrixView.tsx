/**
 * SpatialMatrixView.tsx — Interactive 2x2 Spatial Priority Matrix
 * Governed by PRD REQ-009, REQ-010, §8.3, TS-006; MDD §4.2; IC-014.
 *
 * Rules:
 * 1. Matrix coordinates are derived ONLY from physical metrics (F_n on X, I_n on Y) and NEVER from weights.
 * 2. Four quadrant labels (IC-014 verbatim):
 *    - Top-Right: "High Revenue Risk / High Volume"
 *    - Top-Left:  "Enterprise Risk / Low Volume"
 *    - Bottom-Right: "Mass Friction / Low ARR"
 *    - Bottom-Left:  "Low Priority"
 * 3. Moving sliders must keep matrix dot coordinates completely stationary.
 */

import React, { useState } from 'react';
import { ScoredCluster } from '../types/scoring';

interface SpatialMatrixViewProps {
  clusters: ScoredCluster[];
  selectedClusterId?: string | null;
  onSelectCluster?: (clusterId: string) => void;
  className?: string;
}

export const SpatialMatrixView: React.FC<SpatialMatrixViewProps> = ({
  clusters,
  selectedClusterId,
  onSelectCluster,
  className,
}) => {
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);

  // Exclude unclustered bucket from matrix plot (GAP-11)
  const plottableClusters = clusters.filter(
    (c) => c.cluster_id !== 'CLUST-UNC' && !c.flags.isUnclusteredBucket
  );

  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            2×2 Priority Matrix (Spatial Discovery)
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Physical axes: Y = Impact (I_n), X = Frequency (F_n). Plot coordinates remain fixed during slider calibration.
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
          Plotted: <strong style={{ color: '#38BDF8' }}>{plottableClusters.length}</strong> clusters
        </div>
      </div>

      {/* The 2x2 Grid Area */}
      <div
        id="matrix-grid-container"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          maxHeight: '440px',
          backgroundColor: '#0B1120',
          border: '1px solid #334155',
          borderRadius: '8px',
          overflow: 'hidden',
          margin: '0 auto',
        }}
      >
        {/* Quadrant Background Watermarks (Verbatim IC-014 labels) */}
        {/* Top-Left Quadrant */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '50%',
            height: '50%',
            padding: '0.5rem',
            borderRight: '1px dashed #334155',
            borderBottom: '1px dashed #334155',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
          <span
            id="quadrant-label-top-left"
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#D97706',
              backgroundColor: 'rgba(217, 119, 6, 0.12)',
              padding: '0.2rem 0.4rem',
              borderRadius: '4px',
              border: '1px solid rgba(217, 119, 6, 0.25)',
            }}
          >
            Enterprise Risk / Low Volume
          </span>
        </div>

        {/* Top-Right Quadrant */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            width: '50%',
            height: '50%',
            padding: '0.5rem',
            borderBottom: '1px dashed #334155',
            boxSizing: 'border-box',
            textAlign: 'right',
            pointerEvents: 'none',
          }}
        >
          <span
            id="quadrant-label-top-right"
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#EF4444',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              padding: '0.2rem 0.4rem',
              borderRadius: '4px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            High Revenue Risk / High Volume
          </span>
        </div>

        {/* Bottom-Left Quadrant */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: '50%',
            height: '50%',
            padding: '0.5rem',
            borderRight: '1px dashed #334155',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'flex-end',
            pointerEvents: 'none',
          }}
        >
          <span
            id="quadrant-label-bottom-left"
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#64748B',
              backgroundColor: 'rgba(100, 116, 139, 0.12)',
              padding: '0.2rem 0.4rem',
              borderRadius: '4px',
              border: '1px solid rgba(100, 116, 139, 0.25)',
            }}
          >
            Low Priority
          </span>
        </div>

        {/* Bottom-Right Quadrant */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '50%',
            height: '50%',
            padding: '0.5rem',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            pointerEvents: 'none',
          }}
        >
          <span
            id="quadrant-label-bottom-right"
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              padding: '0.2rem 0.4rem',
              borderRadius: '4px',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            Mass Friction / Low ARR
          </span>
        </div>

        {/* Center Grid Reference Lines */}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', backgroundColor: '#334155' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: '#334155' }} />

        {/* Interactive Cluster Dots */}
        {plottableClusters.map((cluster) => {
          // Normalised coordinates strictly: x = F_n, y = I_n
          const fn = cluster.coordinates.x;
          const inScore = cluster.coordinates.y;

          // Invert Y for screen display (bottom: 0%, top: 100%)
          // Inset slightly by 8% to prevent edge clipping
          const leftPct = 8 + fn * 84;
          const bottomPct = 8 + inScore * 84;

          const isHovered = hoveredClusterId === cluster.cluster_id;
          const isSelected = selectedClusterId === cluster.cluster_id;

          // Color by severity rating or critical blocker
          const dotColor = cluster.flags.isCriticalBlocker
            ? '#EF4444'
            : inScore >= 0.7
            ? '#D97706'
            : fn >= 0.7
            ? '#38BDF8'
            : '#94A3B8';

          return (
            <button
              key={cluster.cluster_id}
              type="button"
              id={`matrix-dot-${cluster.cluster_id}`}
              data-testid={`matrix-dot-${cluster.cluster_id}`}
              data-cluster-id={cluster.cluster_id}
              data-fn={fn.toFixed(4)}
              data-in={inScore.toFixed(4)}
              data-rank={cluster.rank}
              data-score={cluster.priority_score.toFixed(1)}
              onClick={() => onSelectCluster && onSelectCluster(cluster.cluster_id)}
              onMouseEnter={() => setHoveredClusterId(cluster.cluster_id)}
              onMouseLeave={() => setHoveredClusterId(null)}
              onFocus={() => setHoveredClusterId(cluster.cluster_id)}
              onBlur={() => setHoveredClusterId(null)}
              aria-label={`Cluster ${cluster.cluster_id}: ${cluster.cluster_title}. Priority Score: ${cluster.priority_score.toFixed(1)}. Matrix coordinates: Frequency ${fn.toFixed(2)}, Impact ${inScore.toFixed(2)}.`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                bottom: `${bottomPct}%`,
                transform: 'translate(-50%, 50%)',
                width: isHovered || isSelected ? '24px' : '16px',
                height: isHovered || isSelected ? '24px' : '16px',
                borderRadius: '50%',
                backgroundColor: dotColor,
                border: isSelected ? '3px solid #FFFFFF' : '2px solid #0F172A',
                boxShadow: isHovered || isSelected ? `0 0 12px ${dotColor}` : '0 2px 4px rgba(0,0,0,0.5)',
                cursor: 'pointer',
                zIndex: isHovered || isSelected ? 40 : 20,
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                outline: 'none',
              }}
            >
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0F172A' }}>
                {cluster.rank}
              </span>
            </button>
          );
        })}

        {/* Hover Readout Overlay Box */}
        {hoveredClusterId && (() => {
          const hovered = plottableClusters.find((c) => c.cluster_id === hoveredClusterId);
          if (!hovered) return null;
          return (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                right: '10px',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid #38BDF8',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                color: '#F8FAFC',
                zIndex: 50,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <div>
                <strong style={{ color: '#38BDF8' }}>#{hovered.rank} {hovered.cluster_title}</strong>
                <div style={{ color: '#94A3B8', fontSize: '0.7rem' }}>
                  {hovered.canonical_category} • {hovered.metrics.U_c} Accounts • {hovered.metrics.N_c} Rows
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: '#F8FAFC' }}>
                  Score: {hovered.priority_score.toFixed(1)}
                </div>
                <div id="dot-coordinate-readout" style={{ fontSize: '0.7rem', color: '#38BDF8', fontWeight: 600 }}>
                  (F_n: {hovered.coordinates.x.toFixed(2)}, I_n: {hovered.coordinates.y.toFixed(2)})
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Axis Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.5rem' }}>
        <span>← Low Frequency (0.0)</span>
        <span style={{ fontWeight: 700, color: '#CBD5E1' }}>Frequency Axis (F_n) →</span>
        <span>High Frequency (1.0) →</span>
      </div>
    </div>
  );
};
