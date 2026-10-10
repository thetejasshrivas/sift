/**
 * DeepDiveDrawer.tsx — Slide-out Deep-Dive Drawer (600px)
 * Governed by PRD REQ-010, REQ-011, REQ-012, §8.3; MDD §3.6, §4.2; IC-001, IC-002.
 *
 * Rules:
 * 1. 600px right-hand slide-out drawer on desktop (100% on mobile).
 * 2. Opens upon clicking matrix dot or ranked card.
 * 3. Displays Root-Cause Hypothesis with mandatory MDD §3.6 boundary notice.
 * 4. Displays Tier-Weighted Impact without dollar signs (IC-002).
 * 5. Displays quote receipts and action output triggers.
 */

import React, { useEffect } from 'react';
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
  allRows: _allRows = [],
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8' }}>
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
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
                {cluster.metrics.U_c}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                Confirmed: {cluster.metrics.confirmedAccountsCount} | Estimated: {cluster.metrics.estimatedAccountsCount}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Incident Volume & Severity:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>
                {cluster.metrics.N_c} rows
              </div>
              <span style={{ fontSize: '0.7rem', color: cluster.severity_rating === 3 ? '#EF4444' : '#94A3B8' }}>
                Level {cluster.severity_rating}/3 {cluster.flags.isCriticalBlocker ? '(Critical Blocker)' : ''}
              </span>
            </div>
          </div>

          {/* Root-Cause Hypothesis Section (MDD §3.6) */}
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

            <p style={{ fontSize: '0.88rem', color: '#E2E8F0', lineHeight: 1.5, margin: '0 0 0.85rem 0' }}>
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

          {/* Problem Summary */}
          <div
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
            }}
          >
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.5rem' }}>
              Synthesized Problem Summary
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.5, margin: 0 }}>
              {cluster.problem_summary}
            </p>
          </div>

          {/* Customer Quotes & Evidence Receipts (IC-001) */}
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
                Verbatim Substrings (IC-001)
              </span>
            </div>

            {(!cluster.quotes || cluster.quotes.length === 0) ? (
              <p style={{ fontSize: '0.8rem', color: '#64748B', fontStyle: 'italic', margin: 0 }}>
                No verbatim quotes extracted for this cluster.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {cluster.quotes.map((quote, idx) => (
                  <div
                    key={`${quote.feedback_id}-${idx}`}
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
                        ID: {quote.feedback_id}
                      </span>
                      <span
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
                ))}
              </div>
            )}
          </div>

          {/* Action Outputs Preview (REQ-012) */}
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
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94A3B8', margin: 0 }}>
              Action Output Generators (REQ-012)
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                id="btn-copy-strategic-rationale"
                onClick={() => {
                  navigator.clipboard?.writeText?.(
                    `# Strategic Rationale: ${cluster.cluster_title}\nPriority Score: ${cluster.priority_score.toFixed(1)}\nQuadrant: ${quadrantName}\nProblem: ${cluster.problem_summary}\nRoot Cause Hypothesis: ${cluster.root_cause_hypothesis}`
                  );
                }}
                style={{
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                📋 Copy Strategic Rationale
              </button>

              <button
                type="button"
                id="btn-copy-engineering-spec"
                onClick={() => {
                  navigator.clipboard?.writeText?.(
                    `# Engineering Spec: ${cluster.cluster_title}\nSeverity: Level ${cluster.severity_rating}/3\nProblem: ${cluster.problem_summary}\nHypothesis: ${cluster.root_cause_hypothesis}`
                  );
                }}
                style={{
                  backgroundColor: '#334155',
                  color: '#F8FAFC',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #475569',
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
