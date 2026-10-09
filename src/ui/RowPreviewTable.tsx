/**
 * ui/RowPreviewTable.tsx — Verbatim Row Preview Table with Tier Badges
 * Governed by PRD §3.1 Step 7, §4.3–4.6; IC-001, IC-002, GAP-10
 */

import React from 'react';
import { CustomerTier, ProcessedFeedbackRow } from '../types/identity';

export interface RowPreviewTableProps {
  rows: ProcessedFeedbackRow[];
  totalRowCount: number;
}

export const RowPreviewTable: React.FC<RowPreviewTableProps> = ({ rows, totalRowCount }) => {
  const previewRows = rows.slice(0, 10);

  const getTierBadgeStyle = (tier: CustomerTier) => {
    switch (tier) {
      case 'Enterprise':
        return {
          bg: 'var(--color-gold-bg)',
          color: '#FBBF24',
          border: '1px solid rgba(217, 119, 6, 0.4)'
        };
      case 'Pro / Mid-Market':
        return {
          bg: 'var(--color-blue-bg)',
          color: '#60A5FA',
          border: '1px solid rgba(37, 99, 235, 0.4)'
        };
      case 'Free / Starter':
        return {
          bg: 'var(--color-green-bg)',
          color: '#34D399',
          border: '1px solid rgba(5, 150, 105, 0.4)'
        };
      case 'UNKNOWN':
      default:
        return {
          bg: 'var(--bg-card)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-strong)'
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Ingested Data Preview (First {previewRows.length} of {totalRowCount} rows)
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Verbatim text preserved in browser memory
        </span>
      </div>

      <div
        style={{
          overflowX: 'auto',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.85rem'
          }}
        >
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, width: '100px' }}>
                ID
              </th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Verbatim Feedback Text (IC-001)
              </th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, width: '180px' }}>
                Tier (Tier-Weighted)
              </th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, width: '130px' }}>
                Account ID
              </th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, width: '110px' }}>
                User ID
              </th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row) => {
              const badgeStyle = getTierBadgeStyle(row.tierResolution.canonicalTier);

              return (
                <tr
                  key={row.identity.feedbackId}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background-color 0.1s ease'
                  }}
                >
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#38BDF8', whiteSpace: 'nowrap' }}>
                    {row.identity.feedbackId}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', maxWidth: '420px', lineHeight: 1.5 }}>
                    {row.text}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: badgeStyle.border,
                          width: 'fit-content'
                        }}
                      >
                        {row.tierResolution.canonicalTier} ({row.tierResolution.weight.toFixed(1)}x)
                      </span>
                      {row.tierResolution.informationalPill && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#FBBF24',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '4px',
                            width: 'fit-content'
                          }}
                        >
                          ℹ️ {row.tierResolution.informationalPill}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: row.identity.accountId ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {row.identity.accountId ? (
                      <span style={{ fontFamily: 'monospace' }}>{row.identity.accountId}</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        -- unmapped --
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: row.identity.userId ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {row.identity.userId ? (
                      <span style={{ fontFamily: 'monospace' }}>{row.identity.userId}</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        --
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
