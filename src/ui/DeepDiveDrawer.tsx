/**
 * DeepDiveDrawer.tsx — Slide-out Deep-Dive Drawer (600px desktop, full-screen mobile)
 * Governed by PRD REQ-010, REQ-011, REQ-012, §8.3; MDD §2.4, §2.7, §3.6, §4.2; IC-001, IC-002, IC-013.
 *
 * Rules:
 * 1. 600px right-hand slide-out drawer on desktop, full-screen sheet on mobile.
 * 2. Opens upon clicking matrix dot or ranked card.
 * 3. Shows Observation (problem_summary), quotes with exact verification badges,
 *    hypothesis (labeled 'Root-Cause Hypothesis' with MDD §3.6 boundary notice),
 *    full mathematical score breakdown, and action buttons (PM, Eng only in P0).
 * 4. Esc closes; focus trap; focus returns to trigger; aria-live polite for score updates;
 *    background click closes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ScoredCluster } from '../types/scoring';
import { ProcessedFeedbackRow } from '../types/identity';
import { verifyQuoteAgainstRows } from '../verify';
import {
  generateStrategicTradeoffRationale,
  generateEngineeringSpecification,
} from '../outputs';

interface DeepDiveDrawerProps {
  cluster: ScoredCluster | null;
  isOpen: boolean;
  onClose: () => void;
  allRows?: ProcessedFeedbackRow[];
}

export const DeepDiveDrawer: React.FC<DeepDiveDrawerProps> = ({
  cluster,
  isOpen,
  onClose,
  allRows = [],
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [fallbackCopyText, setFallbackCopyText] = useState<string | null>(null);
  const [revealedRawRows, setRevealedRawRows] = useState<Record<number, boolean>>({});

  const toggleRawRow = (idx: number) => {
    setRevealedRawRows((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Capture trigger element on open and restore focus on close
  useEffect(() => {
    if (isOpen) {
      const active = document.activeElement as HTMLElement | null;
      triggerElementRef.current = (active && active !== document.body)
        ? active
        : (cluster ? document.querySelector<HTMLElement>(`#btn-card-details-${cluster.cluster_id}, #ranked-card-${cluster.cluster_id}`) : null);
      // Focus close button or first interactive element inside drawer
      const timer = setTimeout(() => {
        const closeBtn = drawerRef.current?.querySelector<HTMLElement>('#btn-close-drawer');
        if (closeBtn) {
          closeBtn.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
        triggerElementRef.current = null;
      } else if (cluster) {
        const fallbackTarget = document.querySelector<HTMLElement>(`#btn-card-details-${cluster.cluster_id}, #ranked-card-${cluster.cluster_id}`);
        if (fallbackTarget && typeof fallbackTarget.focus === 'function') {
          fallbackTarget.focus();
        }
      }
    }
  }, [isOpen, cluster]);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap for Tab key
      if (e.key === 'Tab' && drawerRef.current) {
        const focusableEls = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableEls.length === 0) return;

        const firstEl = focusableEls[0];
        const lastEl = focusableEls[focusableEls.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clear copy toast after 2.5s
  useEffect(() => {
    if (copyToast) {
      const timer = setTimeout(() => setCopyToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [copyToast]);

  if (!isOpen || !cluster) {
    return null;
  }

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

  const ic014Label = isHighImpact && isHighFreq
    ? 'High Revenue Risk / High Volume'
    : isHighImpact && !isHighFreq
    ? 'Enterprise Risk / Low Volume'
    : !isHighImpact && isHighFreq
    ? 'Mass Friction / Low ARR'
    : 'Low Priority';

  // Copy helpers
  const handleCopyRationale = async () => {
    const text = generateStrategicTradeoffRationale(cluster, allRows);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        setCopyToast('Strategic Rationale copied to clipboard!');
        setFallbackCopyText(null);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      setFallbackCopyText(text);
      setCopyToast('Clipboard unavailable — copy from text box below');
    }
  };

  const handleCopyEngineeringSpec = async () => {
    const text = generateEngineeringSpecification(cluster, allRows);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        setCopyToast('Engineering Spec copied to clipboard!');
        setFallbackCopyText(null);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      setFallbackCopyText(text);
      setCopyToast('Clipboard unavailable — copy from text box below');
    }
  };

  return (
    <div
      id="drawer-backdrop"
      className="drawer-backdrop"
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(28, 25, 23, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        ref={drawerRef}
        id="deep-dive-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-cluster-title"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        style={{
          width: '600px',
          maxWidth: '100vw',
          height: '100vh',
          backgroundColor: 'var(--bg-app)',
          borderLeft: '2px solid var(--border-strong)',
          boxShadow: '-8px 0 32px rgba(28, 25, 23, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1001,
          overflowY: 'auto',
          animation: 'drawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Screen-reader Live Announcer for Score Updates */}
        <div
          id="drawer-live-announcer"
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
          {`Drawer open for cluster #${cluster.rank} ${cluster.cluster_title}. Priority Score: ${cluster.priority_score.toFixed(1)}, Tier-Weighted Impact: ${cluster.metrics.I_c.toFixed(1)}.`}
        </div>

        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span
                id="drawer-cluster-rank"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  backgroundColor: '#1C1917',
                  color: '#FAF8F5',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '3px',
                }}
              >
                #{cluster.rank}
              </span>
              <span
                id="drawer-cluster-category"
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  backgroundColor: '#F5F2EB',
                  color: '#44403C',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '3px',
                  border: '1px solid #D6CEBE',
                }}
              >
                {cluster.canonical_category}
              </span>
              <span
                id="drawer-quadrant-badge"
                data-ic014={ic014Label}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: isHighImpact ? 'rgba(180, 83, 9, 0.08)' : 'rgba(120, 113, 108, 0.08)',
                  color: isHighImpact ? '#B45309' : '#78716C',
                  border: isHighImpact ? '1px solid rgba(180, 83, 9, 0.25)' : '1px solid rgba(120, 113, 108, 0.2)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '3px',
                }}
              >
                {quadrantName} ({ic014Label})
              </span>
            </div>
            <h2
              id="drawer-cluster-title"
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#1C1917',
                fontFamily: 'var(--font-serif)',
                margin: 0,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
              }}
            >
              {cluster.cluster_title}
            </h2>
          </div>

          <button
            id="btn-close-drawer"
            type="button"
            onClick={onClose}
            aria-label="Close deep-dive drawer"
            style={{
              backgroundColor: '#F5F2EB',
              border: '1px solid #D6CEBE',
              borderRadius: '4px',
              color: '#44403C',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Copy Toast Feedback */}
        {copyToast && (
          <div
            id="drawer-copy-toast"
            role="status"
            aria-live="polite"
            style={{
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              borderBottom: '1px solid #A7F3D0',
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            ✓ {copyToast}
          </div>
        )}

        {/* Drawer Body Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Key Metrics Grid */}
          <div
            id="drawer-metrics-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-surface)',
              padding: '1.25rem',
              borderRadius: '4px',
              border: '1px solid var(--border-main)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#78716C' }}>Priority Score (P_c):</span>
              <div id="drawer-priority-score" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1C1917', fontFamily: 'var(--font-mono)' }}>
                {cluster.priority_score.toFixed(1)} <span style={{ fontSize: '0.8rem', color: '#78716C', fontFamily: 'var(--font-sans)' }}>/ 100</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#78716C' }}>Tier-Weighted Impact:</span>
              <div id="drawer-tier-weighted-impact" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#854D0E', fontFamily: 'var(--font-mono)' }}>
                {cluster.metrics.I_c.toFixed(1)}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#78716C' }}>Relative weight proxy (no $)</span>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#78716C' }}>Unique Accounts:</span>
              <div id="drawer-unique-accounts" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1C1917', fontFamily: 'var(--font-mono)' }}>
                {cluster.metrics.U_c}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#78716C' }}>
                Confirmed: {cluster.metrics.confirmedAccountsCount} | Estimated: {cluster.metrics.estimatedAccountsCount}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#78716C' }}>Incident Volume & Severity:</span>
              <div id="drawer-incident-volume" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1C1917', fontFamily: 'var(--font-mono)' }}>
                {cluster.metrics.N_c} rows
              </div>
              <span style={{ fontSize: '0.7rem', color: cluster.severity_rating === 3 ? '#991B1B' : '#78716C' }}>
                Level {cluster.severity_rating}/3 {cluster.flags.isCriticalBlocker ? '(Critical Blocker)' : ''}
              </span>
            </div>
          </div>

          {/* 1. Observation Section */}
          <div
            id="drawer-observation-section"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '4px',
              padding: '1.15rem 1.25rem',
            }}
          >
            <h3
              id="drawer-observation-heading"
              style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#57534E', margin: '0 0 0.5rem 0' }}
            >
              Observation
            </h3>
            <p
              id="drawer-observation-text"
              style={{ fontSize: '0.9rem', color: '#292524', lineHeight: 1.6, margin: 0 }}
            >
              {cluster.problem_summary}
            </p>
          </div>

          {/* 2. Customer Quotes & Verbatim Verification Receipts (IC-001 / REQ-011) */}
          <div
            id="drawer-quotes-section"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '4px',
              padding: '1.15rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-serif)', color: '#1C1917', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <rect x="2" y="2" width="16" height="16" rx="2" stroke="#1C1917" strokeWidth="1.25"/>
                  <circle cx="10" cy="10" r="4.5" fill="#ECFDF5" stroke="#059669" strokeWidth="1"/>
                  <path d="M8.5 10L9.5 11L12 8.5" stroke="#059669" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Customer Quotes & Feedback Receipts ({cluster.quotes?.length || 0})
              </h3>
              <span style={{ fontSize: '0.7rem', color: '#78716C' }}>
                Exact Substring Receipts (IC-001)
              </span>
            </div>

            {(!cluster.quotes || cluster.quotes.length === 0) ? (
              <p style={{ fontSize: '0.8rem', color: '#78716C', fontStyle: 'italic', margin: 0 }}>
                No verbatim quotes extracted for this cluster.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cluster.quotes.map((quote, idx) => {
                  const check = verifyQuoteAgainstRows(quote.feedback_id, quote.quote_snippet, allRows);
                  return (
                    <div
                      key={`${quote.feedback_id}-${idx}`}
                      id={`drawer-quote-card-${idx}`}
                      style={{
                        backgroundColor: '#FAF8F5',
                        border: '1px solid #E5DFD5',
                        borderLeft: '3px solid #292524',
                        borderRadius: '3px',
                        padding: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#44403C' }}>
                          Feedback ID: {quote.feedback_id}
                        </span>
                        {check.status === 'VERIFIED' ? (
                          <span
                            id={`quote-badge-${idx}`}
                            className="badge-verified"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              backgroundColor: '#ECFDF5',
                              color: '#065F46',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '3px',
                              border: '1px solid #A7F3D0',
                            }}
                          >
                            ✓ Verified Quote
                          </span>
                        ) : check.status === 'NEAR_MATCH' ? (
                          <span
                            id={`quote-badge-${idx}`}
                            className="badge-near-match"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              backgroundColor: '#FAF5FF',
                              color: '#6B21A8',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '3px',
                              border: '1px solid #E9D5FF',
                            }}
                          >
                            Near Match / Normalized — Not Verbatim Verified
                          </span>
                        ) : check.status === 'SOURCE_NOT_FOUND' ? (
                          <span
                            id={`quote-badge-${idx}`}
                            className="badge-source-not-found"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              backgroundColor: '#F3F4F6',
                              color: '#4B5563',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '3px',
                              border: '1px solid #E5E7EB',
                            }}
                          >
                            Source row not found
                          </span>
                        ) : (
                          <span
                            id={`quote-badge-${idx}`}
                            className="badge-unverified"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '3px',
                              border: '1px solid #FDE68A',
                            }}
                          >
                            ⚠️ Unverified / Rewritten
                          </span>
                        )}
                      </div>

                      <blockquote
                        style={{
                          margin: 0,
                          fontSize: '0.85rem',
                          color: '#292524',
                          fontStyle: 'italic',
                          lineHeight: 1.5,
                          borderLeft: '2px solid #A8A29E',
                          paddingLeft: '0.75rem',
                        }}
                      >
                        "{quote.quote_snippet}"
                      </blockquote>

                      {/* Reveal Full Raw Row Controls for non-exact rows (REQ-011 / M4-C) */}
                      {check.status !== 'VERIFIED' && check.sourceFound && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                          <button
                            id={`btn-reveal-raw-${idx}`}
                            className="btn-reveal-raw-row"
                            onClick={() => toggleRawRow(idx)}
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #D6CEBE',
                              color: '#57534E',
                              borderRadius: '3px',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <span>{revealedRawRows[idx] ? '▲ Hide Full Raw Row' : '▼ Reveal Full Raw Row'}</span>
                          </button>
                        </div>
                      )}

                      {/* Expandable full raw row display */}
                      {revealedRawRows[idx] && check.rawText && (
                        <div
                          id={`raw-row-container-${idx}`}
                          style={{
                            marginTop: '0.35rem',
                            padding: '0.5rem 0.65rem',
                            backgroundColor: '#F5F2EB',
                            border: '1px dashed #A8A29E',
                            borderRadius: '3px',
                            fontSize: '0.75rem',
                          }}
                        >
                          <div style={{ color: '#57534E', fontSize: '0.68rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                            Full Raw CSV Row ({quote.feedback_id}):
                          </div>
                          <div
                            id={`raw-row-text-${idx}`}
                            style={{
                              color: '#1C1917',
                              fontFamily: 'var(--font-mono)',
                              lineHeight: 1.4,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {check.rawText}
                          </div>
                        </div>
                      )}

                      {/* Explicit notification if source record was not found */}
                      {check.status === 'SOURCE_NOT_FOUND' && (
                        <div style={{ fontSize: '0.72rem', color: '#78716C', fontStyle: 'italic', marginTop: '0.15rem' }}>
                          Source row not found
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Root-Cause Hypothesis Section (MDD §3.6) */}
          <div
            id="drawer-root-cause-section"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '4px',
              padding: '1.15rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>🔬</span>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-serif)', color: '#1C1917', margin: 0 }}>
                Root-Cause Hypothesis
              </h3>
            </div>

            <p
              id="drawer-hypothesis-text"
              style={{ fontSize: '0.9rem', color: '#292524', lineHeight: 1.6, margin: '0 0 0.85rem 0' }}
            >
              {cluster.root_cause_hypothesis || 'AI hypothesis pending verification from quote patterns.'}
            </p>

            {/* Mandatory MDD §3.6 Boundary Notice */}
            <div
              id="drawer-boundary-notice"
              style={{
                backgroundColor: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: '4px',
                padding: '0.65rem 0.85rem',
                fontSize: '0.75rem',
                color: '#92400E',
                lineHeight: 1.5,
              }}
            >
              <strong>Notice:</strong> Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.
            </div>
          </div>

          {/* 4. Full Mathematical Score Breakdown Section */}
          <div
            id="drawer-score-breakdown"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '4px',
              padding: '1.15rem 1.25rem',
            }}
          >
            <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#57534E', margin: '0 0 0.65rem 0' }}>
              Mathematical Score Breakdown (Explainable Scoring)
            </h3>

            <div
              id="drawer-formula-display"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                backgroundColor: '#FAF8F5',
                border: '1px solid var(--border-main)',
                borderRadius: '4px',
                padding: '0.65rem 0.85rem',
                color: '#1C1917',
                marginBottom: '0.85rem',
                wordBreak: 'break-all',
              }}
            >
              {cluster.breakdown.formulaDisplay}
            </div>

            {cluster.breakdown?.weights && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.72rem' }}>
              <div style={{ backgroundColor: '#FAF8F5', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-main)' }}>
                <span style={{ color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Impact Weight (W_ARR):</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#854D0E', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(cluster.breakdown.weights.wArr * 100)}%
                </div>
                <div style={{ color: '#78716C', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>I_n: {cluster.normalized.I_n.toFixed(4)}</div>
              </div>

              <div style={{ backgroundColor: '#FAF8F5', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-main)' }}>
                <span style={{ color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Frequency Weight (W_Vol):</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1C1917', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(cluster.breakdown.weights.wVol * 100)}%
                </div>
                <div style={{ color: '#78716C', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>F_n: {cluster.normalized.F_n.toFixed(4)}</div>
              </div>

              <div style={{ backgroundColor: '#FAF8F5', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border-main)' }}>
                <span style={{ color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Severity Weight (W_Sev):</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#991B1B', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(cluster.breakdown.weights.wSev * 100)}%
                </div>
                <div style={{ color: '#78716C', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>S_n: {cluster.normalized.S_n.toFixed(4)}</div>
              </div>
            </div>
            )}
          </div>

          {/* 5. Role-Tailored Action Output Generators (REQ-012: PM, Eng only in P0 per IC-013) */}
          <div
            id="drawer-actions-section"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '4px',
              padding: '1.15rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#57534E', margin: 0 }}>
                Action Output Generators (REQ-012)
              </h3>
              <span style={{ fontSize: '0.7rem', color: '#78716C' }}>
                P0: PM & Dev Only (IC-013)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                id="btn-copy-strategic-rationale"
                onClick={handleCopyRationale}
                style={{
                  backgroundColor: '#1C1917',
                  color: '#FAF8F5',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #1C1917',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'background-color 0.15s ease',
                }}
              >
                📋 Copy Strategic Rationale
              </button>

              <button
                type="button"
                id="btn-copy-engineering-spec"
                onClick={handleCopyEngineeringSpec}
                style={{
                  backgroundColor: '#FAF8F5',
                  color: '#1C1917',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #D6CEBE',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'background-color 0.15s ease',
                }}
              >
                ⚙️ Copy Engineering Spec
              </button>
            </div>

            {/* Copy Toast Feedback */}
            {copyToast && (
              <div
                id="copy-toast"
                role="status"
                aria-live="polite"
                style={{
                  marginTop: '0.75rem',
                  backgroundColor: '#ECFDF5',
                  color: '#065F46',
                  border: '1px solid #A7F3D0',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>✓</span> {copyToast}
              </div>
            )}

            {/* Clipboard Error Fallback Text Box (REQ-012) */}
            {fallbackCopyText && (
              <div id="copy-fallback-container" style={{ marginTop: '0.75rem' }}>
                <label
                  htmlFor="copy-fallback-textbox"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: '#57534E',
                    marginBottom: '0.35rem',
                    fontWeight: 600,
                  }}
                >
                  Clipboard unavailable — select and copy text below:
                </label>
                <textarea
                  id="copy-fallback-textbox"
                  readOnly
                  value={fallbackCopyText}
                  onFocus={(e) => e.currentTarget.select()}
                  rows={8}
                  style={{
                    width: '100%',
                    backgroundColor: '#FAF8F5',
                    color: '#1C1917',
                    border: '1px solid #D6CEBE',
                    borderRadius: '4px',
                    padding: '0.5rem 0.65rem',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1.4,
                    resize: 'vertical',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
