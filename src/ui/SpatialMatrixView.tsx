/**
 * SpatialMatrixView.tsx — Interactive 2x2 Spatial Priority Matrix (SVG Scatter Plot)
 * Governed by PRD REQ-009, REQ-010, §8.3, TS-006; MDD §4.2; IC-014; GAP-15.
 *
 * Rules:
 * 1. SVG Scatter Plot: X = F_n (Frequency Axis), Y = I_n (Impact Axis).
 * 2. Four quadrant labels (exact strings):
 *    - Top-Right:    "High Impact / High Frequency"
 *    - Top-Left:     "High Impact / Low Frequency"
 *    - Bottom-Right: "Low Impact / High Frequency"
 *    - Bottom-Left:  "Low Impact / Low Frequency"
 * 3. Midpoint 0.5 on both axes shown in legend as 'split at 0.5 of normalized scale' (GAP-15).
 * 4. Hover tooltip: title, unique accounts (Confirmed/Estimated), incident count, Tier-Weighted Impact (strictly no $).
 * 5. Click dot → opens deep-dive drawer.
 * 6. Dot↔card bi-directional highlight support.
 * 7. CLUST-UNC is strictly excluded from matrix plot (GAP-11).
 */

import React, { useState } from 'react';
import { ScoredCluster } from '../types/scoring';

export interface SpatialMatrixViewProps {
  clusters: ScoredCluster[];
  selectedClusterId?: string | null;
  hoveredClusterId?: string | null;
  onSelectCluster?: (clusterId: string) => void;
  onHoverCluster?: (clusterId: string | null) => void;
  onOpenDrawer?: (clusterId: string) => void;
  className?: string;
}

export const SpatialMatrixView: React.FC<SpatialMatrixViewProps> = ({
  clusters,
  selectedClusterId,
  hoveredClusterId: externalHoveredId,
  onSelectCluster,
  onHoverCluster,
  onOpenDrawer,
  className,
}) => {
  // Local hover state with external sync
  const [internalHoveredId, setInternalHoveredId] = useState<string | null>(null);
  const activeHoveredId = externalHoveredId !== undefined ? externalHoveredId : internalHoveredId;

  const handleHover = (id: string | null) => {
    setInternalHoveredId(id);
    if (onHoverCluster) {
      onHoverCluster(id);
    }
  };

  const handleDotClick = (clusterId: string) => {
    if (onSelectCluster) {
      onSelectCluster(clusterId);
    }
    if (onOpenDrawer) {
      onOpenDrawer(clusterId);
    }
  };

  // Exclude unclustered bucket from matrix plot (GAP-11)
  const plottableClusters = clusters.filter(
    (c) => c.cluster_id !== 'CLUST-UNC' && !c.flags.isUnclusteredBucket
  );

  // SVG coordinate dimensions
  const svgWidth = 500;
  const svgHeight = 500;
  const plotMargin = 50;
  const plotWidth = svgWidth - plotMargin * 2;   // 400
  const plotHeight = svgHeight - plotMargin * 2; // 400
  const midX = plotMargin + plotWidth / 2;       // 250
  const midY = plotMargin + plotHeight / 2;      // 250

  const hoveredCluster = activeHoveredId
    ? plottableClusters.find((c) => c.cluster_id === activeHoveredId)
    : null;

  return (
    <div
      className={className}
      id="spatial-matrix-view-panel"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '4px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(28, 25, 23, 0.03)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            STRATEGIC SYNTHESIS
          </span>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', margin: 0 }}>
            2×2 Priority Matrix
          </h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            Physical scatter: X = Frequency (F_n), Y = Impact (I_n). Coordinates invariant to slider weights.
          </p>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Plotted: <strong style={{ color: 'var(--text-primary)' }}>{plottableClusters.length}</strong> clusters
        </div>
      </div>

      {/* SVG Scatter Plot Container */}
      <div
        id="matrix-grid-container"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          maxHeight: '460px',
          backgroundColor: '#FAF8F5',
          border: '1px solid var(--border-strong)',
          borderRadius: '2px',
          overflow: 'hidden',
          margin: '0 auto',
        }}
      >
        <svg
          id="matrix-svg-scatter"
          role="graphics-document"
          aria-label="2x2 Priority Matrix Scatter Plot"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Quadrant Background Zones */}
          {/* Top-Left: High Impact / Low Frequency */}
          <rect
            x={plotMargin}
            y={plotMargin}
            width={plotWidth / 2}
            height={plotHeight / 2}
            fill="rgba(217, 119, 6, 0.05)"
          />

          {/* Top-Right: High Impact / High Frequency */}
          <rect
            x={midX}
            y={plotMargin}
            width={plotWidth / 2}
            height={plotHeight / 2}
            fill="rgba(239, 68, 68, 0.05)"
          />

          {/* Bottom-Left: Low Impact / Low Frequency */}
          <rect
            x={plotMargin}
            y={midY}
            width={plotWidth / 2}
            height={plotHeight / 2}
            fill="rgba(100, 116, 139, 0.05)"
          />

          {/* Bottom-Right: Low Impact / High Frequency */}
          <rect
            x={midX}
            y={midY}
            width={plotWidth / 2}
            height={plotHeight / 2}
            fill="rgba(59, 130, 246, 0.05)"
          />

          {/* Center Dividing Reference Lines (Midpoint 0.5 on both axes per GAP-15) */}
          <line
            x1={midX}
            y1={plotMargin}
            x2={midX}
            y2={svgHeight - plotMargin}
            stroke="#A8A29E"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1={plotMargin}
            y1={midY}
            x2={svgWidth - plotMargin}
            y2={midY}
            stroke="#A8A29E"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Outer Plot Boundary Box */}
          <rect
            x={plotMargin}
            y={plotMargin}
            width={plotWidth}
            height={plotHeight}
            fill="none"
            stroke="#292524"
            strokeWidth="1"
          />

          {/* Cartographic Corner Registers (Swiss Surveying Accents) */}
          <path
            d={`M${plotMargin - 4} ${plotMargin + 8} L${plotMargin - 4} ${plotMargin - 4} L${plotMargin + 8} ${plotMargin - 4}`}
            stroke="#292524"
            strokeWidth="1.25"
            fill="none"
          />
          <path
            d={`M${plotMargin + plotWidth + 4} ${plotMargin + 8} L${plotMargin + plotWidth + 4} ${plotMargin - 4} L${plotMargin + plotWidth - 8} ${plotMargin - 4}`}
            stroke="#292524"
            strokeWidth="1.25"
            fill="none"
          />
          <path
            d={`M${plotMargin - 4} ${plotMargin + plotHeight - 8} L${plotMargin - 4} ${plotMargin + plotHeight + 4} L${plotMargin + 8} ${plotMargin + plotHeight + 4}`}
            stroke="#292524"
            strokeWidth="1.25"
            fill="none"
          />
          <path
            d={`M${plotMargin + plotWidth + 4} ${plotMargin + plotHeight - 8} L${plotMargin + plotWidth + 4} ${plotMargin + plotHeight + 4} L${plotMargin + plotWidth - 8} ${plotMargin + plotHeight + 4}`}
            stroke="#292524"
            strokeWidth="1.25"
            fill="none"
          />

          {/* Quadrant SVG Watermark Labels (Exact M4-A Strings) */}
          {/* Top-Left: High Impact / Low Frequency */}
          <text
            x={plotMargin + 10}
            y={plotMargin + 20}
            fill="#B45309"
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            letterSpacing="0.04em"
            pointerEvents="none"
            opacity="0.85"
          >
            HIGH IMPACT / LOW FREQUENCY
          </text>

          {/* Top-Right: High Impact / High Frequency */}
          <text
            x={svgWidth - plotMargin - 10}
            y={plotMargin + 20}
            fill="#991B1B"
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            textAnchor="end"
            letterSpacing="0.04em"
            pointerEvents="none"
            opacity="0.85"
          >
            HIGH IMPACT / HIGH FREQUENCY
          </text>

          {/* Bottom-Left: Low Impact / Low Frequency */}
          <text
            x={plotMargin + 10}
            y={svgHeight - plotMargin - 12}
            fill="#78716C"
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            letterSpacing="0.04em"
            pointerEvents="none"
            opacity="0.85"
          >
            LOW IMPACT / LOW FREQUENCY
          </text>

          {/* Bottom-Right: Low Impact / High Frequency */}
          <text
            x={svgWidth - plotMargin - 10}
            y={svgHeight - plotMargin - 12}
            fill="#475569"
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            textAnchor="end"
            letterSpacing="0.04em"
            pointerEvents="none"
            opacity="0.85"
          >
            LOW IMPACT / HIGH FREQUENCY
          </text>

          {/* Axes Scale Ticks & Labels */}
          <text x={plotMargin} y={svgHeight - plotMargin + 18} fill="#78716C" fontFamily="var(--font-mono)" fontSize="9" textAnchor="middle">0.0</text>
          <text x={midX} y={svgHeight - plotMargin + 18} fill="#78716C" fontFamily="var(--font-mono)" fontSize="9" textAnchor="middle">0.5</text>
          <text x={svgWidth - plotMargin} y={svgHeight - plotMargin + 18} fill="#78716C" fontFamily="var(--font-mono)" fontSize="9" textAnchor="middle">1.0</text>
          <text x={midX} y={svgHeight - 12} fill="#57534E" fontFamily="var(--font-mono)" fontSize="9.5" fontWeight="600" textAnchor="middle">
            Frequency Axis (F_n) →
          </text>

          <text x={plotMargin - 8} y={svgHeight - plotMargin} fill="#78716C" fontFamily="var(--font-mono)" fontSize="9" textAnchor="end" dominantBaseline="middle">0.0</text>
          <text x={plotMargin - 8} y={midY} fill="#78716C" fontFamily="var(--font-mono)" fontSize="9" textAnchor="end" dominantBaseline="middle">0.5</text>
          <text x={plotMargin - 8} y={plotMargin} fill="#78716C" fontFamily="var(--font-mono)" fontSize="9" textAnchor="end" dominantBaseline="middle">1.0</text>
          <text
            x={16}
            y={midY}
            fill="#57534E"
            fontFamily="var(--font-mono)"
            fontSize="9.5"
            fontWeight="600"
            textAnchor="middle"
            transform={`rotate(-90, 16, ${midY})`}
          >
            Impact Axis (I_n) →
          </text>

          {/* Plottable Cluster Scatter Dots */}
          {plottableClusters.map((cluster) => {
            const fn = cluster.coordinates.x;
            const inScore = cluster.coordinates.y;

            const cx = plotMargin + fn * plotWidth;
            const cy = plotMargin + (1 - inScore) * plotHeight;

            const isHovered = activeHoveredId === cluster.cluster_id;
            const isSelected = selectedClusterId === cluster.cluster_id;

            // Concept C Editorial Dot Fill
            const dotFill = cluster.flags.isCriticalBlocker
              ? '#991B1B'
              : inScore >= 0.5 && fn >= 0.5
              ? '#991B1B'
              : inScore >= 0.5
              ? '#B45309'
              : fn >= 0.5
              ? '#475569'
              : '#1C1917';

            const dotRadius = isHovered || isSelected ? 12 : 8;

            return (
              <g
                key={cluster.cluster_id}
                id={`matrix-dot-${cluster.cluster_id}`}
                data-testid={`matrix-dot-${cluster.cluster_id}`}
                data-cluster-id={cluster.cluster_id}
                data-fn={fn.toFixed(4)}
                data-in={inScore.toFixed(4)}
                data-rank={cluster.rank}
                data-score={cluster.priority_score.toFixed(1)}
                data-highlighted={isHovered || isSelected ? 'true' : 'false'}
                tabIndex={0}
                role="button"
                aria-label={`Cluster #${cluster.rank} ${cluster.cluster_id}: ${cluster.cluster_title}. Priority Score: ${cluster.priority_score.toFixed(1)}. Matrix coordinates: Frequency ${fn.toFixed(2)}, Impact ${inScore.toFixed(2)}.`}
                onClick={() => handleDotClick(cluster.cluster_id)}
                onPointerDown={() => handleDotClick(cluster.cluster_id)}
                onMouseEnter={() => handleHover(cluster.cluster_id)}
                onMouseOver={() => handleHover(cluster.cluster_id)}
                onPointerEnter={() => handleHover(cluster.cluster_id)}
                onMouseLeave={() => handleHover(null)}
                onPointerLeave={() => handleHover(null)}
                onFocus={() => handleHover(cluster.cluster_id)}
                onBlur={() => handleHover(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDotClick(cluster.cluster_id);
                  }
                }}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {/* Glowing Aura Ring for Active / Hovered Dot */}
                {(isHovered || isSelected) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={20}
                    fill="none"
                    stroke={isSelected ? '#1C1917' : '#991B1B'}
                    strokeWidth={1.5}
                    strokeDasharray={isSelected ? 'none' : '3 3'}
                    opacity={0.85}
                  >
                    <animate
                      attributeName="r"
                      values="16;22;16"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.9;0.4;0.9"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Main Scatter Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={dotRadius}
                  fill={dotFill}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 3 : 2}
                  onClick={() => handleDotClick(cluster.cluster_id)}
                  onPointerDown={() => handleDotClick(cluster.cluster_id)}
                  onMouseEnter={() => handleHover(cluster.cluster_id)}
                  onMouseOver={() => handleHover(cluster.cluster_id)}
                  onPointerEnter={() => handleHover(cluster.cluster_id)}
                  style={{
                    filter: isHovered || isSelected ? 'drop-shadow(0px 2px 4px rgba(28, 25, 23, 0.25))' : 'none',
                    transition: 'r 0.15s ease',
                  }}
                />

                {/* Rank Number Inside Dot */}
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  fontSize={isHovered || isSelected ? '10' : '8'}
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                  pointerEvents="none"
                >
                  {cluster.rank}
                </text>
              </g>
            );
          })}
        </svg>

        {/* DOM-Accessible Quadrant Watermarks (for string audits & screen-readers) */}
        <div style={{ position: 'absolute', top: 8, right: 8, pointerEvents: 'none', textAlign: 'right' }}>
          <span
            id="quadrant-label-top-right"
            data-ic014="High Revenue Risk / High Volume"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', padding: '0.2rem 0.5rem', borderRadius: '2px', display: 'inline-block' }}
          >
            High Impact / High Frequency
            <span style={{ display: 'block', fontSize: '0.6rem', color: '#B91C1C', opacity: 0.9 }}>High Revenue Risk / High Volume</span>
          </span>
        </div>

        <div style={{ position: 'absolute', top: 8, left: 55, pointerEvents: 'none' }}>
          <span
            id="quadrant-label-top-left"
            data-ic014="Enterprise Risk / Low Volume"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, color: '#B45309', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '0.2rem 0.5rem', borderRadius: '2px', display: 'inline-block' }}
          >
            High Impact / Low Frequency
            <span style={{ display: 'block', fontSize: '0.6rem', color: '#92400E', opacity: 0.9 }}>Enterprise Risk / Low Volume</span>
          </span>
        </div>

        <div style={{ position: 'absolute', bottom: 35, right: 8, pointerEvents: 'none', textAlign: 'right' }}>
          <span
            id="quadrant-label-bottom-right"
            data-ic014="Mass Friction / Low ARR"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, color: '#475569', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', padding: '0.2rem 0.5rem', borderRadius: '2px', display: 'inline-block' }}
          >
            Low Impact / High Frequency
            <span style={{ display: 'block', fontSize: '0.6rem', color: '#334155', opacity: 0.9 }}>Mass Friction / Low ARR</span>
          </span>
        </div>

        <div style={{ position: 'absolute', bottom: 35, left: 55, pointerEvents: 'none' }}>
          <span
            id="quadrant-label-bottom-left"
            data-ic014="Low Priority"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, color: '#78716C', backgroundColor: '#F5F2EB', border: '1px solid #E5DFD5', padding: '0.2rem 0.5rem', borderRadius: '2px', display: 'inline-block' }}
          >
            Low Impact / Low Frequency
            <span style={{ display: 'block', fontSize: '0.6rem', color: '#57534E', opacity: 0.9 }}>Low Priority</span>
          </span>
        </div>

        {/* Hover Tooltip (REQ-010 & Gate G-M4A specification) */}
        {hoveredCluster && (
          <div
            id="matrix-hover-tooltip"
            role="tooltip"
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #292524',
              borderRadius: '2px',
              padding: '0.85rem 1.15rem',
              boxShadow: '0 8px 24px rgba(28, 25, 23, 0.12)',
              zIndex: 50,
              pointerEvents: 'none',
              animation: 'tooltipFade 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.45rem' }}>
              <div>
                <strong style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', fontWeight: 600, color: '#1C1917' }}>
                  #{hoveredCluster.rank} {hoveredCluster.cluster_title}
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#78716C', marginTop: '2px' }}>
                  {hoveredCluster.canonical_category}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 600, color: '#1C1917' }}>
                  Score: {hoveredCluster.priority_score.toFixed(1)}
                </span>
                <div id="dot-coordinate-readout" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#78716C' }}>
                  (F_n: {hoveredCluster.coordinates.x.toFixed(4)}, I_n: {hoveredCluster.coordinates.y.toFixed(4)})
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.75rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #E5DFD5' }}>
              {/* Unique Accounts (Confirmed / Estimated) */}
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#78716C', fontSize: '0.68rem', textTransform: 'uppercase' }}>Unique Accounts: </span>
                <strong style={{ color: '#1C1917', display: 'block', fontSize: '0.85rem' }}>{hoveredCluster.metrics.U_c}</strong>
                <div style={{ color: '#57534E', fontSize: '0.68rem' }}>
                  {`(Confirmed: ${hoveredCluster.metrics.confirmedAccountsCount}, Estimated: ${hoveredCluster.metrics.estimatedAccountsCount})`}
                </div>
              </div>

              {/* Incident Count */}
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#78716C', fontSize: '0.68rem', textTransform: 'uppercase' }}>Incident Count: </span>
                <strong style={{ color: '#1C1917', display: 'block', fontSize: '0.85rem' }}>{hoveredCluster.metrics.N_c}</strong>
                <div style={{ color: '#57534E', fontSize: '0.68rem' }}>
                  raw complaints
                </div>
              </div>

              {/* Tier-Weighted Impact (STRICTLY NO DOLLAR SIGN per IC-002) */}
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#78716C', fontSize: '0.68rem', textTransform: 'uppercase' }}>Tier-Weighted Impact: </span>
                <strong style={{ color: '#B45309', display: 'block', fontSize: '0.85rem' }}>{hoveredCluster.metrics.I_c.toFixed(1)}</strong>
                <div style={{ color: '#57534E', fontSize: '0.68rem' }}>
                  relative priority
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Midpoint Legend (GAP-15 implementation choice) */}
      <div
        id="matrix-legend-midpoint"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <span>ℹ️ Quadrants </span>
          <strong style={{ color: 'var(--text-primary)' }}>split at 0.5 of normalized scale</strong>
          <span> (GAP-15)</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Click dot to open deep-dive drawer
        </div>
      </div>
    </div>
  );
};
