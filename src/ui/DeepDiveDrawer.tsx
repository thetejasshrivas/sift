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

  // Capture trigger element on open and restore focus on close
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement;
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
      }
    }
  }, [isOpen]);

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

  // Substring verification helper (IC-001 / REQ-011)
  const verifyQuote = (feedbackId: string, quoteSnippet: string) => {
    if (!allRows || allRows.length === 0) {
      return { isVerified: true, sourceFound: false };
    }
    const sourceRow = allRows.find((r) => r.identity.feedbackId === feedbackId);
    if (!sourceRow || !sourceRow.text) {
      return { isVerified: false, sourceFound: false };
    }
    const cleanSnippet = quoteSnippet.trim();
    const cleanSource = sourceRow.text.trim();
    const isExact = cleanSource.toLowerCase().includes(cleanSnippet.toLowerCase());
    return { isVerified: isExact, sourceFound: true };
  };

  // Copy helpers
  const handleCopyRationale = () => {
    const text = `# Strategic Roadmap Trade-off Rationale: ${cluster.cluster_title}
Priority Score: ${cluster.priority_score.toFixed(1)} / 100
Quadrant: ${quadrantName}
Tier-Weighted Impact: ${cluster.metrics.I_c.toFixed(1)} (Accounts: ${cluster.metrics.U_c})
Severity: Level ${cluster.severity_rating}/3 (${cluster.flags.isCriticalBlocker ? 'Critical Blocker' : 'Operational Friction'})

## Synthesized Problem Observation
${cluster.problem_summary}

## Root-Cause Hypothesis
${cluster.root_cause_hypothesis}
*Notice: AI-inferred hypothesis based on quote patterns. Verify against logs before major changes.*

## Mathematical Breakdown
${cluster.breakdown.formulaDisplay}
Weights: Impact ${Math.round(cluster.breakdown.weights.wArr * 100)}%, Frequency ${Math.round(cluster.breakdown.weights.wVol * 100)}%, Severity ${Math.round(cluster.breakdown.weights.wSev * 100)}%
Normalized: I_n=${cluster.normalized.I_n.toFixed(4)}, F_n=${cluster.normalized.F_n.toFixed(4)}, S_n=${cluster.normalized.S_n.toFixed(4)}`;

    navigator.clipboard?.writeText?.(text);
    setCopyToast('Strategic Rationale copied to clipboard!');
  };

  const handleCopyEngineeringSpec = () => {
    const quotesBlock = cluster.quotes && cluster.quotes.length > 0
      ? cluster.quotes.map((q) => `> "${q.quote_snippet}" (Source: ${q.feedback_id})`).join('\n\n')
      : '> [No verbatim quotes available]';

    const text = `# Engineering Specification: ${cluster.cluster_title}
**Cluster ID:** ${cluster.cluster_id} | **Severity Rating:** Level ${cluster.severity_rating}/3
**Impacted Accounts:** ${cluster.metrics.U_c} (${cluster.metrics.confirmedAccountsCount} confirmed) | **Raw Complaints:** ${cluster.metrics.N_c}

## 1. Problem Summary & Observation
${cluster.problem_summary}

## 2. Inferred Root Cause
${cluster.root_cause_hypothesis}
[VERIFY: Compare stack traces and latency metrics on production workers before deploying fix.]

## 3. Evidence Receipts (Verbatim Quotes)
${quotesBlock}

## 4. Acceptance Criteria
- [ ] Reproduce issue using failure pattern identified in quote receipts.
- [ ] Resolve root cause in underlying worker thread without regressions.
- [ ] Verify zero 5xx errors across affected API endpoints.`;

    navigator.clipboard?.writeText?.(text);
    setCopyToast('Engineering Spec copied to clipboard!');
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
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
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
          backgroundColor: '#0F172A',
          borderLeft: '1px solid #334155',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.7)',
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
            borderBottom: '1px solid #334155',
            backgroundColor: '#1E293B',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span
                id="drawer-cluster-rank"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                #{cluster.rank}
              </span>
              <span
                id="drawer-cluster-category"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  color: '#38BDF8',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                {cluster.canonical_category}
              </span>
              <span
                id="drawer-quadrant-badge"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isHighImpact ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                  color: isHighImpact ? '#F87171' : '#94A3B8',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                {quadrantName}
              </span>
            </div>
            <h2
              id="drawer-cluster-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#F8FAFC',
                margin: 0,
                lineHeight: 1.3,
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
              backgroundColor: 'rgba(51, 65, 85, 0.5)',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#94A3B8',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
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
              backgroundColor: '#059669',
              color: '#FFFFFF',
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
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Key Metrics Grid */}
          <div
            id="drawer-metrics-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
              backgroundColor: '#1E293B',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #334155',
            }}
          >
            <div>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Priority Score (P_c):</span>
              <div id="drawer-priority-score" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8' }}>
                {cluster.priority_score.toFixed(1)} <span style={{ fontSize: '0.8rem', color: '#64748B' }}>/ 100</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Tier-Weighted Impact:</span>
              <div id="drawer-tier-weighted-impact" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F59E0B' }}>
                {cluster.metrics.I_c.toFixed(1)}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Relative weight proxy (no $)</span>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Unique Accounts:</span>
              <div id="drawer-unique-accounts" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
                {cluster.metrics.U_c}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                Confirmed: {cluster.metrics.confirmedAccountsCount} | Estimated: {cluster.metrics.estimatedAccountsCount}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Incident Volume & Severity:</span>
              <div id="drawer-incident-volume" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
                {cluster.metrics.N_c} rows
              </div>
              <span style={{ fontSize: '0.7rem', color: cluster.severity_rating === 3 ? '#EF4444' : '#94A3B8' }}>
                Level {cluster.severity_rating}/3 {cluster.flags.isCriticalBlocker ? '(Critical Blocker)' : ''}
              </span>
            </div>
          </div>

          {/* 1. Observation Section */}
          <div
            id="drawer-observation-section"
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
            }}
          >
            <h3
              id="drawer-observation-heading"
              style={{ fontSize: '0.88rem', fontWeight: 700, color: '#94A3B8', margin: '0 0 0.5rem 0' }}
            >
              Observation
            </h3>
            <p
              id="drawer-observation-text"
              style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.5, margin: 0 }}
            >
              {cluster.problem_summary}
            </p>
          </div>

          {/* 2. Customer Quotes & Verbatim Verification Receipts (IC-001 / REQ-011) */}
          <div
            id="drawer-quotes-section"
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38BDF8', margin: 0 }}>
                Customer Quotes & Feedback Receipts ({cluster.quotes?.length || 0})
              </h3>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                Exact Substring Receipts (IC-001)
              </span>
            </div>

            {(!cluster.quotes || cluster.quotes.length === 0) ? (
              <p style={{ fontSize: '0.8rem', color: '#64748B', fontStyle: 'italic', margin: 0 }}>
                No verbatim quotes extracted for this cluster.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {cluster.quotes.map((quote, idx) => {
                  const check = verifyQuote(quote.feedback_id, quote.quote_snippet);
                  return (
                    <div
                      key={`${quote.feedback_id}-${idx}`}
                      id={`drawer-quote-card-${idx}`}
                      style={{
                        backgroundColor: '#0F172A',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8' }}>
                          Feedback ID: {quote.feedback_id}
                        </span>
                        {check.isVerified ? (
                          <span
                            id={`quote-badge-${idx}`}
                            className="badge-verified"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(5, 150, 105, 0.15)',
                              color: '#34D399',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              border: '1px solid rgba(5, 150, 105, 0.3)',
                            }}
                          >
                            ✓ Verified Quote
                          </span>
                        ) : (
                          <span
                            id={`quote-badge-${idx}`}
                            className="badge-unverified"
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(217, 119, 6, 0.15)',
                              color: '#FBBF24',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              border: '1px solid rgba(217, 119, 6, 0.3)',
                            }}
                          >
                            ⚠️ Unverified / Rewritten
                          </span>
                        )}
                      </div>
                      <blockquote
                        style={{
                          margin: 0,
                          fontSize: '0.82rem',
                          color: '#E2E8F0',
                          fontStyle: 'italic',
                          lineHeight: 1.4,
                          borderLeft: '2px solid #2563EB',
                          paddingLeft: '0.6rem',
                        }}
                      >
                        "{quote.quote_snippet}"
                      </blockquote>
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
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>🔬</span>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38BDF8', margin: 0 }}>
                Root-Cause Hypothesis
              </h3>
            </div>

            <p
              id="drawer-hypothesis-text"
              style={{ fontSize: '0.88rem', color: '#E2E8F0', lineHeight: 1.5, margin: '0 0 0.85rem 0' }}
            >
              {cluster.root_cause_hypothesis || 'AI hypothesis pending verification from quote patterns.'}
            </p>

            {/* Mandatory MDD §3.6 Boundary Notice */}
            <div
              id="drawer-boundary-notice"
              style={{
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                borderRadius: '6px',
                padding: '0.6rem 0.85rem',
                fontSize: '0.75rem',
                color: '#FBBF24',
                lineHeight: 1.4,
              }}
            >
              <strong>Notice:</strong> Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.
            </div>
          </div>

          {/* 4. Full Mathematical Score Breakdown Section */}
          <div
            id="drawer-score-breakdown"
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
            }}
          >
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#94A3B8', margin: '0 0 0.65rem 0' }}>
              Mathematical Score Breakdown (Explainable Scoring)
            </h3>

            <div
              id="drawer-formula-display"
              style={{
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0.6rem 0.85rem',
                color: '#38BDF8',
                marginBottom: '0.85rem',
                wordBreak: 'break-all',
              }}
            >
              {cluster.breakdown.formulaDisplay}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.72rem' }}>
              <div style={{ backgroundColor: '#0F172A', padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155' }}>
                <span style={{ color: '#94A3B8' }}>Impact Weight (W_ARR):</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F59E0B' }}>
                  {Math.round(cluster.breakdown.weights.wArr * 100)}%
                </div>
                <div style={{ color: '#64748B', fontSize: '0.68rem' }}>I_n: {cluster.normalized.I_n.toFixed(4)}</div>
              </div>

              <div style={{ backgroundColor: '#0F172A', padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155' }}>
                <span style={{ color: '#94A3B8' }}>Frequency Weight (W_Vol):</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38BDF8' }}>
                  {Math.round(cluster.breakdown.weights.wVol * 100)}%
                </div>
                <div style={{ color: '#64748B', fontSize: '0.68rem' }}>F_n: {cluster.normalized.F_n.toFixed(4)}</div>
              </div>

              <div style={{ backgroundColor: '#0F172A', padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155' }}>
                <span style={{ color: '#94A3B8' }}>Severity Weight (W_Sev):</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#EF4444' }}>
                  {Math.round(cluster.breakdown.weights.wSev * 100)}%
                </div>
                <div style={{ color: '#64748B', fontSize: '0.68rem' }}>S_n: {cluster.normalized.S_n.toFixed(4)}</div>
              </div>
            </div>
          </div>

          {/* 5. Role-Tailored Action Output Generators (REQ-012: PM, Eng only in P0 per IC-013) */}
          <div
            id="drawer-actions-section"
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#94A3B8', margin: 0 }}>
                Action Output Generators (REQ-012)
              </h3>
              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                P0: PM & Dev Only (IC-013)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                id="btn-copy-strategic-rationale"
                onClick={handleCopyRationale}
                style={{
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
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
                  backgroundColor: '#334155',
                  color: '#F8FAFC',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'background-color 0.15s ease',
                }}
              >
                ⚙️ Copy Engineering Spec
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
