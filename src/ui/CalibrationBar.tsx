/**
 * CalibrationBar.tsx — Interactive Weight Calibration Sliders
 * Governed by PRD REQ-009, §6.2, §8.3, TS-006; MDD §2.4, §4.3; IC-002; GAP-03.
 *
 * Rules:
 * 1. Three sliders labeled strictly 'Impact', 'Frequency', 'Severity'.
 *    (ARR and Volume labels are replaced per IC-002).
 * 2. Displays normalized % beside each slider (summing to 100%).
 * 3. 'Reset to 40/40/20' button restores baseline weights (GAP-03).
 * 4. State updates are dispatched via requestAnimationFrame batching for 60 FPS fluidity.
 */

import React, { useRef, useEffect, useState } from 'react';
import { SliderWeights, NormalizedWeights } from '../types/scoring';
import { DEFAULT_SLIDER_WEIGHTS, normalizeSliderWeights } from '../scoring';

interface CalibrationBarProps {
  weights: SliderWeights;
  onWeightsChange: (weights: SliderWeights) => void;
  className?: string;
}

export const CalibrationBar: React.FC<CalibrationBarProps> = ({
  weights,
  onWeightsChange,
  className,
}) => {
  // Local immediate state for smooth slider thumb response
  const [localWeights, setLocalWeights] = useState<SliderWeights>(weights);

  // Synchronize local weights if external weights change (e.g. external reset)
  useEffect(() => {
    setLocalWeights(weights);
  }, [weights]);

  // Derived normalized weights for display percentage
  const normalized: NormalizedWeights = normalizeSliderWeights(localWeights);

  // Ref to hold pending animation frame ID for batching
  const rafIdRef = useRef<number | null>(null);
  const pendingWeightsRef = useRef<SliderWeights>(localWeights);

  // Clean up any pending animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Dispatch slider adjustment via requestAnimationFrame batching
  const handleSliderInput = (key: keyof SliderWeights, value: number) => {
    const updated: SliderWeights = { ...localWeights, [key]: value };
    setLocalWeights(updated);
    pendingWeightsRef.current = updated;

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        onWeightsChange(pendingWeightsRef.current);
      });
    }
  };

  // One-click reset to default 40/40/20 baseline weights (GAP-03)
  const handleReset = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const reset = { ...DEFAULT_SLIDER_WEIGHTS };
    setLocalWeights(reset);
    pendingWeightsRef.current = reset;
    onWeightsChange(reset);
  };

  const isAtDefault =
    localWeights.arr === DEFAULT_SLIDER_WEIGHTS.arr &&
    localWeights.vol === DEFAULT_SLIDER_WEIGHTS.vol &&
    localWeights.sev === DEFAULT_SLIDER_WEIGHTS.sev;

  const pctImpact = Math.round(normalized.wArr * 100);
  const pctFreq = Math.round(normalized.wVol * 100);
  const pctSev = Math.round(normalized.wSev * 100);

  return (
    <section
      aria-label="Calibration Controls"
      className={className}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '3px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 2px 8px rgba(28, 25, 23, 0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            PARAMETER TUNING
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.15rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.015em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: 0,
            }}
          >
            <span>Priority Calibration (Live 60-FPS Re-ranking)</span>
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Adjust trade-off balance across Impact, Frequency, and Severity. Normalized dynamically to 100%.
          </p>
        </div>

        {/* Reset to 40/40/20 Button per GAP-03 */}
        <button
          id="btn-reset-sliders"
          type="button"
          onClick={handleReset}
          disabled={isAtDefault}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.35rem 0.85rem',
            borderRadius: '2px',
            backgroundColor: isAtDefault ? 'transparent' : 'var(--bg-subtle)',
            color: isAtDefault ? 'var(--text-muted)' : 'var(--text-primary)',
            border: `1px solid ${isAtDefault ? 'var(--border-subtle)' : 'var(--border-strong)'}`,
            cursor: isAtDefault ? 'default' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
          title="Reset weights to default 40% Impact, 40% Frequency, 20% Severity"
        >
          <span aria-hidden="true">↺</span>
          <span>Reset to 40/40/20</span>
        </button>
      </div>

      {/* Sliders Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* 1. Impact Slider (IC-002: Labeled strictly 'Impact', replacing ARR) */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: '0.9rem 1.15rem',
            borderRadius: '2px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <label
              htmlFor="slider-impact"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)' }}
            >
              Impact
            </label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span
                id="pct-impact"
                style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {pctImpact}%
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                (raw: {localWeights.arr})
              </span>
            </div>
          </div>
          <input
            id="slider-impact"
            type="range"
            min="0"
            max="100"
            step="1"
            value={localWeights.arr}
            onChange={(e) => handleSliderInput('arr', Number(e.target.value))}
            aria-label="Impact weight slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={localWeights.arr}
            aria-valuetext={`${pctImpact} percent Impact weight`}
            style={{
              width: '100%',
              accentColor: '#292524',
              cursor: 'pointer',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            <span>0 (Ignore)</span>
            <span>Customer Tier Proxy</span>
            <span>100</span>
          </div>
        </div>

        {/* 2. Frequency Slider (IC-002: Labeled strictly 'Frequency', replacing Volume) */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: '0.9rem 1.15rem',
            borderRadius: '2px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <label
              htmlFor="slider-frequency"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)' }}
            >
              Frequency
            </label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span
                id="pct-frequency"
                style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {pctFreq}%
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                (raw: {localWeights.vol})
              </span>
            </div>
          </div>
          <input
            id="slider-frequency"
            type="range"
            min="0"
            max="100"
            step="1"
            value={localWeights.vol}
            onChange={(e) => handleSliderInput('vol', Number(e.target.value))}
            aria-label="Frequency weight slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={localWeights.vol}
            aria-valuetext={`${pctFreq} percent Frequency weight`}
            style={{
              width: '100%',
              accentColor: '#292524',
              cursor: 'pointer',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            <span>0 (Ignore)</span>
            <span>Account Reach</span>
            <span>100</span>
          </div>
        </div>

        {/* 3. Severity Slider */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: '0.9rem 1.15rem',
            borderRadius: '2px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <label
              htmlFor="slider-severity"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)' }}
            >
              Severity
            </label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span
                id="pct-severity"
                style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {pctSev}%
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                (raw: {localWeights.sev})
              </span>
            </div>
          </div>
          <input
            id="slider-severity"
            type="range"
            min="0"
            max="100"
            step="1"
            value={localWeights.sev}
            onChange={(e) => handleSliderInput('sev', Number(e.target.value))}
            aria-label="Severity weight slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={localWeights.sev}
            aria-valuetext={`${pctSev} percent Severity weight`}
            style={{
              width: '100%',
              accentColor: '#292524',
              cursor: 'pointer',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            <span>0 (Ignore)</span>
            <span>Workflow Criticality</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </section>
  );
};
