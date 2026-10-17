/**
 * BreakdownTooltip.tsx — Formula Breakdown Tooltip Component
 * Governed by PRD REQ-008, §6.1, §6.6; MDD §3.12; IC-002.
 * 
 * Rules:
 * 1. Exposes exact mathematical formula and component values (I_n, F_n, S_n).
 * 2. Labels Impact strictly as 'Impact Score / Tier-Weighted Impact', never ARR or $.
 * 3. Shows raw and normalized metrics, slider weights, and final rounded score P_c.
 */

import React, { useState } from 'react';
import { ScoringBreakdown } from '../types/scoring';

interface BreakdownTooltipProps {
  breakdown: ScoringBreakdown;
  priorityScore: number;
  rank?: number;
  className?: string;
}

export const BreakdownTooltip: React.FC<BreakdownTooltipProps> = ({
  breakdown,
  priorityScore,
  rank,
  className
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const { rawMetrics, normalizedMetrics, weights, impactLabel, formulaDisplay } = breakdown;

  const impactContribution = 100 * weights.wArr * normalizedMetrics.I_n;
  const freqContribution = 100 * weights.wVol * normalizedMetrics.F_n;
  const sevContribution = 100 * weights.wSev * normalizedMetrics.S_n;

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      className={className}
    >
      {/* Interactive Trigger Badge */}
      <button
        type="button"
        aria-label={`Priority Score ${priorityScore.toFixed(1)} out of 100. Hover or focus to view mathematical breakdown.`}
        aria-haspopup="dialog"
        aria-expanded={isVisible}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.65rem',
          borderRadius: '2px',
          backgroundColor: 'var(--bg-subtle)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'help',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score:</span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{priorityScore.toFixed(1)}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>/100</span>
        <span aria-hidden="true" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ℹ️</span>
      </button>

      {/* Floating Tooltip Panel */}
      {isVisible && (
        <div
          role="tooltip"
          id={`breakdown-tooltip-${rank ?? 'score'}`}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '320px',
            maxWidth: '90vw',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-strong)',
            borderRadius: '2px',
            padding: '1rem',
            boxShadow: '0 8px 24px rgba(28, 25, 23, 0.12)',
            zIndex: 100,
            fontSize: '0.8rem',
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            pointerEvents: 'none',
          }}
        >
          {/* Header */}
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              Score Formula Breakdown
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Deterministic Hybrid Priority Score (MDD §3.12)
            </div>
          </div>

          {/* Component Contributions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Impact Component */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.75rem' }}>{impactLabel}:</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  100 × {weights.wArr.toFixed(2)} × {normalizedMetrics.I_n.toFixed(2)} (Raw I_c: {rawMetrics.I_c.toFixed(1)})
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#B45309', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                + {impactContribution.toFixed(1)}
              </div>
            </div>

            {/* Frequency Component */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.75rem' }}>Frequency Component:</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  100 × {weights.wVol.toFixed(2)} × {normalizedMetrics.F_n.toFixed(2)} ({rawMetrics.U_c} accts, {rawMetrics.N_c} rows)
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                + {freqContribution.toFixed(1)}
              </div>
            </div>

            {/* Severity Component */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.75rem' }}>Severity Component:</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  100 × {weights.wSev.toFixed(2)} × {normalizedMetrics.S_n.toFixed(2)} (Rating: Level {rawMetrics.S_c}/3)
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#991B1B', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                + {sevContribution.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--text-primary)' }}>Final Priority Score:</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.15rem' }}>
                {priorityScore.toFixed(1)} / 100
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontStyle: 'italic', wordBreak: 'break-all' }}>
              {formulaDisplay}
            </div>
          </div>

          {/* Little arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--border-strong)',
            }}
          />
        </div>
      )}
    </div>
  );
};
