/**
 * ui/ProgressBar.tsx — Batch Analysis Progress Bar & Cancellation Controls
 * Governed by PRD §3.1 Step 9, §5.2, §5.8; DEC-PROVIDER.
 */

import React from 'react';
import { BatchPipelineProgress } from '../types/ai';

export interface ProgressBarProps {
  progress: BatchPipelineProgress;
  onCancel: () => void;
  isCancelling?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  onCancel,
  isCancelling = false,
}) => {
  const percent = Math.min(100, Math.max(0, progress.progressPercent));

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
      }}
      aria-live="polite"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor:
                progress.phase === 'cancelled'
                  ? 'var(--accent-red)'
                  : progress.phase === 'completed'
                  ? 'var(--accent-green)'
                  : 'var(--accent-blue)',
            }}
          />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {progress.progressText}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {percent}%
          </span>
          {progress.phase !== 'completed' && progress.phase !== 'cancelled' && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              style={{
                padding: '0.35rem 0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--accent-red)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isCancelling ? 'not-allowed' : 'pointer',
              }}
            >
              {isCancelling ? 'Cancelling...' : '✕ Cancel Analysis'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            backgroundColor:
              progress.phase === 'cancelled'
                ? 'var(--accent-red)'
                : progress.phase === 'completed'
                ? 'var(--accent-green)'
                : 'var(--accent-blue)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>
          Batch {progress.batchIndex + 1} of {progress.totalBatches}
        </span>
        <span>
          {progress.completedBatches} succeeded • {progress.failedBatches} failed
        </span>
      </div>
    </div>
  );
};
