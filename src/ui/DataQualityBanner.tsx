/**
 * ui/DataQualityBanner.tsx — Data Quality Metrics Summary & Collapsible Alert Banner
 * Governed by PRD REQ-004, §4.5, §4.6, TS-002, TS-017, TS-024; IC-002, IC-012
 */

import React, { useState } from 'react';
import {
  AccountCountMetrics,
  DataQualityMetrics,
  QualityAlertBanner
} from '../types/identity';
import { formatPercentage } from '../identity/dataQuality';

export interface DataQualityBannerProps {
  metrics: DataQualityMetrics;
  banner: QualityAlertBanner;
  accountCounts: AccountCountMetrics;
}

export const DataQualityBanner: React.FC<DataQualityBannerProps> = ({
  metrics,
  banner,
  accountCounts
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* 1. Collapsible Warning Banner if > 5% metadata missing */}
      {banner.triggered && (
        <div
          role="region"
          aria-label="Data Quality Alert"
          style={{
            backgroundColor: 'var(--color-amber-bg)',
            border: '1px solid var(--color-amber-border)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            color: 'var(--color-amber-text)',
            fontSize: '0.875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden="true">
                ⚠️
              </span>
              <div>
                {isCollapsed ? (
                  <span style={{ fontWeight: 600 }}>{banner.collapsedText}</span>
                ) : (
                  <p style={{ lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    {banner.message}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  padding: '0.25rem 0.625rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: 'var(--color-amber-text)',
                  border: '1px solid var(--color-amber-border)',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                {showDetails ? 'Hide Quality Details' : 'View Quality Details'}
              </button>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? 'Expand banner' : 'Collapse banner'}
                style={{
                  padding: '0.25rem 0.5rem',
                  color: 'var(--color-amber-text)',
                  fontSize: '0.75rem',
                  opacity: 0.8
                }}
              >
                {isCollapsed ? 'Expand ▼' : 'Collapse ▲'}
              </button>
            </div>
          </div>

          {/* Detailed Breakdown Drawer */}
          {showDetails && (
            <div
              style={{
                marginTop: '0.5rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.8rem',
                lineHeight: 1.6,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem'
              }}
            >
              <div>
                <strong>Missing Customer Tiers:</strong> {metrics.unknownTierCount} / {metrics.totalRows} rows (
                {formatPercentage(metrics.unknownTierPercentage)})
                <br />
                <em>Defaulted to UNKNOWN (1.0x Tier-Weighted proxy).</em>
              </div>
              <div>
                <strong>Missing Account IDs:</strong> {metrics.missingAccountIdCount} / {metrics.totalRows} rows (
                {formatPercentage(metrics.missingAccountIdPercentage)})
                <br />
                <em>Evaluated provisionally as 1 account per row.</em>
              </div>
              <div>
                <strong>Distinct-Row Union Issues:</strong> {metrics.rowsWithIssuesCount} / {metrics.totalRows} rows (
                {formatPercentage(metrics.rowsWithIssuesPercentage)})
                <br />
                <em>Overlapping issues deduplicated per IC-012.</em>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Three Data-Quality Numbers Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-surface)',
          padding: '0.875rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Unknown Tier %
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: metrics.unknownTierPercentage > 5 ? '#FBBF24' : 'var(--text-primary)' }}>
            {formatPercentage(metrics.unknownTierPercentage)}
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
              ({metrics.unknownTierCount} rows)
            </span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Missing Account ID %
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: metrics.missingAccountIdPercentage > 5 ? '#FBBF24' : 'var(--text-primary)' }}>
            {formatPercentage(metrics.missingAccountIdPercentage)}
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
              ({metrics.missingAccountIdCount} rows)
            </span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Rows with ≥1 Issue %
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: metrics.rowsWithIssuesPercentage > 5 ? 'var(--color-amber)' : 'var(--text-primary)' }}>
            {formatPercentage(metrics.rowsWithIssuesPercentage)}
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
              (Union: {metrics.rowsWithIssuesCount})
            </span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Account Coverage
          </span>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.125rem' }}>
            {accountCounts.confirmedUniqueAccounts} Confirmed / {accountCounts.estimatedAccountCoverage} Est.
          </div>
          {accountCounts.isAccountUnmappedWarning && (
            <span
              style={{
                display: 'inline-block',
                marginTop: '0.25rem',
                fontSize: '0.7rem',
                color: '#FBBF24',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                padding: '0.125rem 0.375rem',
                borderRadius: '4px'
              }}
            >
              ⚠️ {accountCounts.warningPillText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
