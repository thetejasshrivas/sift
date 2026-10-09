/**
 * ui/PreFlightNotice.tsx — Pre-Flight Cloud AI Notice & Pipeline Trigger Controls
 * Governed by PRD §3.1 Step 8, §5.2, §5.4, §10.3; DEC-PROVIDER
 */

import React from 'react';

export interface PreFlightNoticeProps {
  rowCount: number;
  isTextMapped: boolean;
  onAnalyze: () => void;
  onStartNew: () => void;
  isAnalyzing?: boolean;
}

export const PreFlightNotice: React.FC<PreFlightNoticeProps> = ({
  rowCount,
  isTextMapped,
  onAnalyze,
  onStartNew,
  isAnalyzing
}) => {
  // Capacity estimation math per PRD §5.2, §5.4, IC-008
  const pass1Calls = Math.ceil(rowCount / 50);
  const pass2UpperBound = Math.min(8, Math.max(3, Math.ceil(pass1Calls * 0.8)));
  const totalCallsEstimate = pass1Calls + pass2UpperBound;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden="true">
          ☁️
        </span>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Pre-Flight Cloud AI Transmission Notice (DEC-PROVIDER)
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Analyzing this dataset ({rowCount} records) will require approximately{' '}
            <strong style={{ color: '#38BDF8' }}>{totalCallsEstimate} cloud AI calls</strong> ({pass1Calls} Pass-1 50-row
            batches + ~{pass2UpperBound} Pass-2 theme consolidation calls) via serverless proxy to Google AI Studio.
            Sift enforces zero payload logging on proxy infrastructure.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)'
        }}
      >
        <button
          onClick={onStartNew}
          style={{
            padding: '0.625rem 1rem',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          ↺ Start New Analysis
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isTextMapped && (
            <span style={{ fontSize: '0.8rem', color: '#FCA5A5', fontWeight: 500 }}>
              ⚠️ Raw Feedback Text must be mapped
            </span>
          )}

          <button
            onClick={onAnalyze}
            disabled={!isTextMapped || isAnalyzing}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: 600,
              backgroundColor: !isTextMapped
                ? 'var(--color-red)'
                : 'var(--color-blue)',
              color: '#FFFFFF',
              boxShadow: !isTextMapped
                ? '0 0 0 2px rgba(220, 38, 38, 0.4)'
                : '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
              transition: 'background-color 0.15s ease, transform 0.1s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {isAnalyzing ? (
              <>⏳ Analyzing...</>
            ) : !isTextMapped ? (
              <>🚫 Analyze Data (Mapping Incomplete)</>
            ) : (
              <>✨ Analyze Data ({rowCount} Rows)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
