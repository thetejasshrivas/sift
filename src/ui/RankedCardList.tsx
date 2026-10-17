/**
 * RankedCardList.tsx — Ranked Insight Card List with Badges, Filters & Breakdown Tooltips
 * Governed by PRD REQ-009, REQ-010, §8.2–8.4; MDD §2.4, §2.7, §4.2; GAP-02, GAP-04, GAP-15; IC-002.
 *
 * Rules:
 * 1. Cards sorted dynamically by priority score (P_c) with strict tie-breaks.
 * 2. Displays: title, rank badge (#1, #2, ...), score badge with math tooltip,
 *    unique accounts (U_c), incident count (N_c), Tier-Weighted Impact (I_c, no $).
 * 3. Color-Coded Badges:
 *    - Gold: 'High Tier-Weighted Impact' (I_n >= 0.5, GAP-15)
 *    - Blue: 'High Volume' (F_n >= 0.5)
 *    - Red: 'Critical Blocker' (S_c=3, suffix '(Low Frequency)' when U_c < 3)
 *    - Gray: 'Small Sample (Low Confidence)' (U_c < 3)
 *    - Amber: 'Uncertain Cluster — Review Recommended'
 *    - Indigo: 'Account IDs Unmapped — Frequency Estimated'
 * 4. Minimal search box + badge toggle filters (GAP-04).
 * 5. Screen-reader live updates with aria-live="polite".
 * 6. Bi-directional dot<->card hover and selection highlighting.
 */

import React, { useState, useMemo } from 'react';
import { ScoredCluster } from '../types/scoring';
import { BreakdownTooltip } from './BreakdownTooltip';

export type BadgeFilterType =
  | 'ALL'
  | 'HIGH_IMPACT'
  | 'HIGH_VOLUME'
  | 'CRITICAL_BLOCKER'
  | 'SMALL_SAMPLE'
  | 'UNCERTAIN';

export interface RankedCardListProps {
  clusters: ScoredCluster[];
  selectedClusterId?: string | null;
  hoveredClusterId?: string | null;
  onSelectCluster?: (clusterId: string) => void;
  onHoverCluster?: (clusterId: string | null) => void;
  onOpenDrawer?: (clusterId: string) => void;
  isAccountIdsUnmapped?: boolean;
  className?: string;
}

export const RankedCardList: React.FC<RankedCardListProps> = ({
  clusters,
  selectedClusterId,
  hoveredClusterId,
  onSelectCluster,
  onHoverCluster,
  onOpenDrawer,
  isAccountIdsUnmapped = false,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBadgeFilter, setActiveBadgeFilter] = useState<BadgeFilterType>('ALL');

  // Filter clusters by search query and active badge filter
  const filteredClusters = useMemo(() => {
    let result = clusters;

    // 1. Text Search Filter (title, problem summary, category, cluster ID)
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.cluster_title.toLowerCase().includes(q) ||
          c.problem_summary.toLowerCase().includes(q) ||
          c.canonical_category.toLowerCase().includes(q) ||
          c.cluster_id.toLowerCase().includes(q)
      );
    }

    // 2. Badge Toggle Filter
    if (activeBadgeFilter !== 'ALL') {
      result = result.filter((c) => {
        const isUnclustered = c.cluster_id === 'CLUST-UNC' || c.flags.isUnclusteredBucket;
        if (isUnclustered) return false;

        switch (activeBadgeFilter) {
          case 'HIGH_IMPACT':
            return c.normalized.I_n >= 0.5;
          case 'HIGH_VOLUME':
            return c.normalized.F_n >= 0.5;
          case 'CRITICAL_BLOCKER':
            return c.severity_rating === 3 || c.flags.isCriticalBlocker;
          case 'SMALL_SAMPLE':
            return c.metrics.U_c < 3 || c.flags.isSmallSample;
          case 'UNCERTAIN':
            return Boolean(c.flags.isUncertain);
          default:
            return true;
        }
      });
    }

    return result;
  }, [clusters, searchQuery, activeBadgeFilter]);

  const handleCardClick = (clusterId: string) => {
    if (onSelectCluster) {
      onSelectCluster(clusterId);
    }
    if (onOpenDrawer) {
      onOpenDrawer(clusterId);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setActiveBadgeFilter('ALL');
  };

  return (
    <div
      className={className}
      id="ranked-card-list-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Panel Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            RANKED SYNTHESIS
          </span>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', margin: 0 }}>
            Ranked Insight Cards ({clusters.length})
          </h3>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Sorted dynamically by Priority Score (P_c)
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredClusters.length}</strong> of {clusters.length}
        </div>
      </div>

      {/* Screen-reader Live Announcer (aria-live="polite") */}
      <div
        id="cards-live-announcer"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {`Filtered to ${filteredClusters.length} clusters. Top ranked: #${filteredClusters[0]?.rank || 0} ${filteredClusters[0]?.cluster_title || 'none'}.`}
      </div>

      {/* Search Box + Badge Toggle Filters (GAP-04) */}
      <div
        id="card-filter-toolbar"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '3px',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        {/* Minimal Search Input */}
        <div style={{ position: 'relative' }}>
          <input
            id="input-card-search"
            type="search"
            placeholder="Search clusters by title, problem summary, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search ranked clusters"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '2px',
              color: 'var(--text-primary)',
              padding: '0.5rem 0.75rem',
              fontSize: '0.82rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
        </div>

        {/* Badge Toggle Filter Pills */}
        <div
          id="badge-toggle-filters"
          role="toolbar"
          aria-label="Filter cards by badge type"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.45rem',
            alignItems: 'center',
          }}
        >
          <button
            id="filter-btn-all"
            type="button"
            onClick={() => setActiveBadgeFilter('ALL')}
            aria-pressed={activeBadgeFilter === 'ALL'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.25rem 0.6rem',
              borderRadius: '2px',
              backgroundColor: activeBadgeFilter === 'ALL' ? '#292524' : '#FFFFFF',
              color: activeBadgeFilter === 'ALL' ? '#FFFFFF' : '#57534E',
              border: activeBadgeFilter === 'ALL' ? '1px solid #292524' : '1px solid #E5DFD5',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All ({clusters.length})
          </button>

          <button
            id="filter-btn-high-impact"
            type="button"
            onClick={() => setActiveBadgeFilter(activeBadgeFilter === 'HIGH_IMPACT' ? 'ALL' : 'HIGH_IMPACT')}
            aria-pressed={activeBadgeFilter === 'HIGH_IMPACT'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.25rem 0.6rem',
              borderRadius: '2px',
              backgroundColor: activeBadgeFilter === 'HIGH_IMPACT' ? '#B45309' : '#FFFBEB',
              color: activeBadgeFilter === 'HIGH_IMPACT' ? '#FFFFFF' : '#B45309',
              border: '1px solid #FDE68A',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            👑 High Impact
          </button>

          <button
            id="filter-btn-high-volume"
            type="button"
            onClick={() => setActiveBadgeFilter(activeBadgeFilter === 'HIGH_VOLUME' ? 'ALL' : 'HIGH_VOLUME')}
            aria-pressed={activeBadgeFilter === 'HIGH_VOLUME'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.25rem 0.6rem',
              borderRadius: '2px',
              backgroundColor: activeBadgeFilter === 'HIGH_VOLUME' ? '#475569' : '#F1F5F9',
              color: activeBadgeFilter === 'HIGH_VOLUME' ? '#FFFFFF' : '#475569',
              border: '1px solid #CBD5E1',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            📊 High Volume
          </button>

          <button
            id="filter-btn-critical-blocker"
            type="button"
            onClick={() => setActiveBadgeFilter(activeBadgeFilter === 'CRITICAL_BLOCKER' ? 'ALL' : 'CRITICAL_BLOCKER')}
            aria-pressed={activeBadgeFilter === 'CRITICAL_BLOCKER'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.25rem 0.6rem',
              borderRadius: '2px',
              backgroundColor: activeBadgeFilter === 'CRITICAL_BLOCKER' ? '#991B1B' : '#FEF2F2',
              color: activeBadgeFilter === 'CRITICAL_BLOCKER' ? '#FFFFFF' : '#991B1B',
              border: '1px solid #FECACA',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🚨 Critical Blocker
          </button>

          <button
            id="filter-btn-small-sample"
            type="button"
            onClick={() => setActiveBadgeFilter(activeBadgeFilter === 'SMALL_SAMPLE' ? 'ALL' : 'SMALL_SAMPLE')}
            aria-pressed={activeBadgeFilter === 'SMALL_SAMPLE'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.25rem 0.6rem',
              borderRadius: '2px',
              backgroundColor: activeBadgeFilter === 'SMALL_SAMPLE' ? '#78716C' : '#F5F2EB',
              color: activeBadgeFilter === 'SMALL_SAMPLE' ? '#FFFFFF' : '#78716C',
              border: '1px solid #E5DFD5',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ⚠️ Small Sample
          </button>

          <button
            id="filter-btn-uncertain"
            type="button"
            onClick={() => setActiveBadgeFilter(activeBadgeFilter === 'UNCERTAIN' ? 'ALL' : 'UNCERTAIN')}
            aria-pressed={activeBadgeFilter === 'UNCERTAIN'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.25rem 0.6rem',
              borderRadius: '2px',
              backgroundColor: activeBadgeFilter === 'UNCERTAIN' ? '#B45309' : '#FFFBEB',
              color: activeBadgeFilter === 'UNCERTAIN' ? '#FFFFFF' : '#B45309',
              border: '1px solid #FDE68A',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ⚠️ Uncertain
          </button>

          {(searchQuery || activeBadgeFilter !== 'ALL') && (
            <button
              id="btn-clear-card-filters"
              type="button"
              onClick={handleClearFilters}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
                marginLeft: 'auto',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Cards List Container */}
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
        {filteredClusters.length === 0 ? (
          <div
            id="card-list-empty-state"
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem 0' }}>No clusters match the active filters or search query.</p>
            <button
              type="button"
              id="btn-empty-clear-filters"
              onClick={handleClearFilters}
              style={{
                fontSize: '0.75rem',
                color: '#38BDF8',
                backgroundColor: 'transparent',
                border: '1px solid #38BDF8',
                borderRadius: '4px',
                padding: '0.3rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredClusters.map((cluster) => {
            const isSelected = selectedClusterId === cluster.cluster_id;
            const isHovered = hoveredClusterId === cluster.cluster_id;
            const isUnclustered = cluster.cluster_id === 'CLUST-UNC' || cluster.flags.isUnclusteredBucket;

            // Badges conditions:
            const isGoldHighImpact = cluster.normalized.I_n >= 0.5 && !isUnclustered;
            const isBlueHighVolume = cluster.normalized.F_n >= 0.5 && !isUnclustered;
            const isRedCriticalBlocker = cluster.severity_rating === 3 || cluster.flags.isCriticalBlocker;
            const isGraySmallSample = (cluster.metrics.U_c < 3 || cluster.flags.isSmallSample) && !isUnclustered;
            const isUncertainReview = Boolean(cluster.flags.isUncertain) && !isUnclustered;
            const isFrequencyEstimated = (isAccountIdsUnmapped || cluster.flags.isFrequencyEstimated || cluster.metrics.estimatedAccountsCount > 0) && !isUnclustered;

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
                tabIndex={0}
                role="button"
                aria-label={`Cluster #${cluster.rank} ${cluster.cluster_title}. Priority Score: ${cluster.priority_score.toFixed(1)}. Click to open deep-dive drawer.`}
                onClick={() => handleCardClick(cluster.cluster_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(cluster.cluster_id);
                  }
                }}
                onMouseEnter={() => onHoverCluster && onHoverCluster(cluster.cluster_id)}
                onMouseLeave={() => onHoverCluster && onHoverCluster(null)}
                style={{
                  backgroundColor: isSelected
                    ? '#FFFFFF'
                    : isHovered
                    ? 'var(--bg-subtle)'
                    : 'var(--bg-surface)',
                  border: isSelected
                    ? '2px solid var(--border-strong)'
                    : isHovered
                    ? '1px solid var(--border-strong)'
                    : isUnclustered
                    ? '1px dashed var(--border-subtle)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: '3px',
                  padding: '1.25rem',
                  boxShadow: isHovered ? '0 4px 16px rgba(28, 25, 23, 0.05)' : 'none',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                  outline: 'none',
                }}
              >
                {/* Card Header: Rank, Title, Category, Score Tooltip */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <span
                      id={`card-rank-${cluster.cluster_id}`}
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.35rem',
                        fontWeight: 600,
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                        minWidth: '32px',
                        textAlign: 'center',
                        lineHeight: 1,
                      }}
                    >
                      #{cluster.rank}
                    </span>
                    <div>
                      <h4
                        id={`card-title-${cluster.cluster_id}`}
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '1.05rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          lineHeight: 1.3,
                          margin: 0,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {cluster.cluster_title}
                      </h4>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {cluster.canonical_category}
                        </span>
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

                {/* Status Badges Row (M4-B Scope Exact Badge Strings) */}
                <div
                  id={`card-badges-${cluster.cluster_id}`}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.65rem' }}
                >
                  {/* 1. Gold: High Tier-Weighted Impact (I_n >= 0.5, GAP-15) */}
                  {isGoldHighImpact && (
                    <span
                      id={`badge-high-impact-${cluster.cluster_id}`}
                      className="badge-gold-impact"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '2px',
                        backgroundColor: '#FFFBEB',
                        color: '#B45309',
                        border: '1px solid #FDE68A',
                      }}
                    >
                      👑 High Tier-Weighted Impact
                    </span>
                  )}

                  {/* 2. Blue: High Volume (F_n >= 0.5) */}
                  {isBlueHighVolume && (
                    <span
                      id={`badge-high-volume-${cluster.cluster_id}`}
                      className="badge-blue-volume"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '2px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        border: '1px solid #CBD5E1',
                      }}
                    >
                      📊 High Volume
                    </span>
                  )}

                  {/* 3. Red: Critical Blocker (S_c=3, suffix '(Low Frequency)' when U_c < 3) */}
                  {isRedCriticalBlocker && (
                    <span
                      id={`badge-critical-blocker-${cluster.cluster_id}`}
                      className="badge-red-blocker"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '2px',
                        backgroundColor: '#FEF2F2',
                        color: '#991B1B',
                        border: '1px solid #FECACA',
                      }}
                    >
                      🚨 {cluster.metrics.U_c < 3 ? 'Critical Blocker (Low Frequency)' : 'Critical Blocker'}
                    </span>
                  )}

                  {/* 4. Gray: Small Sample (Low Confidence) (U_c < 3) */}
                  {isGraySmallSample && (
                    <span
                      id={`badge-small-sample-${cluster.cluster_id}`}
                      className="badge-gray-sample"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '2px',
                        backgroundColor: '#F5F2EB',
                        color: '#78716C',
                        border: '1px solid #E5DFD5',
                      }}
                    >
                      ⚠️ Small Sample (Low Confidence)
                    </span>
                  )}

                  {/* 5. Amber: Uncertain Cluster — Review Recommended */}
                  {isUncertainReview && (
                    <span
                      id={`badge-uncertain-${cluster.cluster_id}`}
                      className="badge-amber-uncertain"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '2px',
                        backgroundColor: '#FFFBEB',
                        color: '#B45309',
                        border: '1px solid #FDE68A',
                      }}
                    >
                      ⚠️ Uncertain Cluster — Review Recommended
                    </span>
                  )}

                  {/* 6. Indigo: Account IDs Unmapped — Frequency Estimated */}
                  {isFrequencyEstimated && (
                    <span
                      id={`badge-estimated-freq-${cluster.cluster_id}`}
                      className="badge-indigo-estimated"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '2px',
                        backgroundColor: '#EEF2FF',
                        color: '#4338CA',
                        border: '1px solid #C7D2FE',
                      }}
                    >
                      ℹ️ Account IDs Unmapped — Frequency Estimated
                    </span>
                  )}

                  {/* Fixed Matrix Coordinates Pill for Invariance Verification */}
                  <span
                    id={`card-coords-${cluster.cluster_id}`}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '2px',
                      backgroundColor: '#F4F1EA',
                      color: '#57534E',
                      border: '1px solid #E5DFD5',
                    }}
                    title="Matrix scatter coordinates (F_n, I_n) derived strictly from physical metrics. Remain stationary as sliders move."
                  >
                    Coords: (F_n: {cluster.coordinates.x.toFixed(2)}, I_n: {cluster.coordinates.y.toFixed(2)})
                  </span>
                </div>

                {/* Problem Summary snippet */}
                <p
                  id={`card-summary-${cluster.cluster_id}`}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                    margin: '0 0 0.75rem 0',
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
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.6rem',
                  }}
                >
                  <div id={`card-metrics-${cluster.cluster_id}`}>
                    <span>Tier-Weighted Impact: </span>
                    <strong id={`card-impact-${cluster.cluster_id}`} style={{ color: '#B45309' }}>
                      {cluster.metrics.I_c.toFixed(1)}
                    </strong>
                    <span> • Accounts: </span>
                    <strong id={`card-accounts-${cluster.cluster_id}`} style={{ color: 'var(--text-primary)' }}>
                      {cluster.metrics.U_c}
                    </strong>
                    <span> • Incidents: </span>
                    <strong id={`card-incidents-${cluster.cluster_id}`} style={{ color: 'var(--text-primary)' }}>
                      {cluster.metrics.N_c}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontSize: '0.72rem', fontWeight: 600 }}>
                      Inspect Dossier →
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
