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
          gap: '0.35rem',
          padding: '0.25rem 0.65rem',
          borderRadius: '9999px',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          color: '#38BDF8',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'help',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
      >
        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Score:</span>
        <span style={{ fontSize: '0.95rem' }}>{priorityScore.toFixed(1)}</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>/100</span>
        <span aria-hidden="true" style={{ fontSize: '0.75rem', opacity: 0.8 }}>ℹ️</span>
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
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '1rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
            zIndex: 100,
            fontSize: '0.8rem',
            color: '#F8FAFC',
            lineHeight: 1.4,
            pointerEvents: 'none',
          }}
        >
          {/* Header */}
          <div style={{ borderBottom: '1px solid #1E293B', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700, color: '#38BDF8', fontSize: '0.85rem' }}>
              Score Formula Breakdown
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.15rem' }}>
              Deterministic Hybrid Priority Score (MDD §3.12)
            </div>
          </div>

          {/* Component Contributions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Impact Component */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#E2E8F0', fontWeight: 600 }}>{impactLabel}:</div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  100 × {weights.wArr.toFixed(2)} × {normalizedMetrics.I_n.toFixed(2)} (Raw I_c: {rawMetrics.I_c.toFixed(1)})
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#38BDF8', whiteSpace: 'nowrap' }}>
                + {impactContribution.toFixed(1)}
              </div>
            </div>

            {/* Frequency Component */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#E2E8F0', fontWeight: 600 }}>Frequency Component:</div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  100 × {weights.wVol.toFixed(2)} × {normalizedMetrics.F_n.toFixed(2)} ({rawMetrics.U_c} accts, {rawMetrics.N_c} rows)
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#60A5FA', whiteSpace: 'nowrap' }}>
                + {freqContribution.toFixed(1)}
              </div>
            </div>

            {/* Severity Component */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#E2E8F0', fontWeight: 600 }}>Severity Component:</div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  100 × {weights.wSev.toFixed(2)} × {normalizedMetrics.S_n.toFixed(2)} (Rating: Level {rawMetrics.S_c}/3)
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#F87171', whiteSpace: 'nowrap' }}>
                + {sevContribution.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #1E293B', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#F8FAFC' }}>Final Priority Score:</span>
              <span style={{ fontWeight: 800, color: '#38BDF8', fontSize: '1rem' }}>
                {priorityScore.toFixed(1)} / 100
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.35rem', fontStyle: 'italic', wordBreak: 'break-all' }}>
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
              borderTop: '6px solid #0F172A',
            }}
          />
        </div>
      )}
    </div>
  );
};
