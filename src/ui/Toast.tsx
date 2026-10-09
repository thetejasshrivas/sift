/**
 * ui/Toast.tsx — Accessible Toast Notification Component
 * Governed by PRD §3.1 Step 3, §8.4 (WCAG 2.1 AA)
 */

import React from 'react';

export interface ToastProps {
  type: 'error' | 'warning' | 'info';
  message: string;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type, message, onDismiss }) => {
  const getStyles = () => {
    switch (type) {
      case 'error':
        return {
          bg: 'var(--color-red-bg)',
          border: 'var(--color-red)',
          text: '#FECACA',
          icon: '⚠️'
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.2)',
          border: 'var(--color-amber)',
          text: '#FEF3C7',
          icon: '⚡'
        };
      default:
        return {
          bg: 'var(--color-blue-bg)',
          border: 'var(--color-blue)',
          text: '#BFDBFE',
          icon: 'ℹ️'
        };
    }
  };

  const style = getStyles();

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 2000,
        maxWidth: '460px',
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '8px',
        padding: '0.875rem 1.25rem',
        color: style.text,
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        fontSize: '0.925rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span aria-hidden="true">{style.icon}</span>
        <span>{message}</span>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          color: style.text,
          fontSize: '1.25rem',
          lineHeight: '1',
          padding: '0 0.25rem',
          opacity: 0.8
        }}
      >
        ×
      </button>
    </div>
  );
};
