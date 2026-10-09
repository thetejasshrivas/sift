/**
 * ui/PrivacyModal.tsx — Privacy Disclosure & Ephemeral Memory Modal
 * Governed by PRD §3.1 Step 2, §11.3, DEC-PROVIDER, DEC-007, IC-011, GAP-22
 */

import React, { useEffect } from 'react';

export interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 id="privacy-modal-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Data Privacy & Ephemeral Security
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              color: 'var(--text-muted)',
              fontSize: '1.5rem',
              lineHeight: 1,
              padding: '0.25rem 0.5rem',
              borderRadius: '4px'
            }}
          >
            ×
          </button>
        </div>

        <section style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38BDF8', marginBottom: '0.5rem' }}>
            1. Ephemeral Client Memory Model (GAP-22)
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            SIFT processes feedback files locally in browser memory using standard Web APIs.
            Your customer data is <strong>never stored</strong> in a persistent database, and SIFT does not write
            feedback rows to <code style={{ color: '#F1F5F9' }}>localStorage</code>,{' '}
            <code style={{ color: '#F1F5F9' }}>sessionStorage</code>, or{' '}
            <code style={{ color: '#F1F5F9' }}>IndexedDB</code>. Refreshing the browser or clicking &ldquo;Start New Analysis&rdquo;
            immediately purges all data from browser memory.
          </p>
        </section>

        <section style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px', borderLeft: '4px solid var(--color-blue)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#93C5FD', marginBottom: '0.5rem' }}>
            2. Mandatory Cloud AI Transmission Disclosure (DEC-PROVIDER)
          </h3>
          <blockquote style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
            &ldquo;Selected feedback text is sent through Sift&apos;s server proxy to a third-party cloud AI provider for analysis.
            Do not upload data you are not allowed to share. Sift&apos;s code does not intentionally log feedback text.&rdquo;
          </blockquote>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            3. Serverless Proxy & Zero Payload Logging (IC-011)
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            AI clustering calls are routed through a stateless serverless proxy. The proxy holds private credentials securely and
            enforces <strong>zero payload logging</strong> on intermediate proxy logs.
            External AI processing is serviced by Google AI Studio (<code style={{ color: '#F1F5F9' }}>gemini-3.5-flash</code>).
            Provider-side retention and terms are governed by the provider&apos;s{' '}
            <a
              href="https://ai.google.dev/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#38BDF8', textDecoration: 'underline' }}
            >
              Google AI Studio Terms of Service
            </a>.
          </p>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: 'var(--color-blue)',
              color: '#FFFFFF',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '0.875rem'
            }}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
