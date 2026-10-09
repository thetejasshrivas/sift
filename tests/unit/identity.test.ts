/**
 * tests/unit/identity.test.ts — SIFT Identity, Tier Normalization, and Data Quality Test Suite
 * Validates TS-002, TS-017, TS-024; PRD REQ-003, REQ-004, §4.3–4.6; MDD §3.2; IC-002, IC-012; GAP-10.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCustomerTier,
  isNumericArrValue,
  createFeedbackIdentity,
  processFeedbackRow,
  processFeedbackRows,
  computeAccountCounts,
  calculateDataQualityMetrics,
  createQualityAlertBanner,
  formatPercentage,
  TIER_WEIGHTS,
  TIER_WEIGHT_LABEL,
  ProcessedFeedbackRow
} from '../../src/identity';
import { RawFeedbackRow } from '../../src/types/ingest';

describe('Tier Mapping & Normalization (REQ-003, MDD §3.2, IC-002)', () => {
  it('maps Enterprise tier aliases to 3.0 weight with Tier-Weighted label', () => {
    const inputs = ['Enterprise', 'enterprise', 'ENTERPRISE', ' enterprise '];
    for (const input of inputs) {
      const res = resolveCustomerTier(input);
      expect(res.canonicalTier).toBe('Enterprise');
      expect(res.weight).toBe(3.0);
      expect(res.weightLabel).toBe('Tier-Weighted');
      expect(res.isUnrecognized).toBe(false);
      expect(res.rawTier).toBe(input);
    }
  });

  it('maps Pro / Mid-Market tier aliases to 2.0 weight with Tier-Weighted label', () => {
    const aliases = [
      'Pro',
      'pro',
      'mid-market',
      'mid market',
      'midmarket',
      'pro / mid-market',
      'pro/mid-market',
      'mid_market',
      'PRO',
      ' Mid-Market '
    ];
    for (const alias of aliases) {
      const res = resolveCustomerTier(alias);
      expect(res.canonicalTier).toBe('Pro / Mid-Market');
      expect(res.weight).toBe(2.0);
      expect(res.weightLabel).toBe('Tier-Weighted');
      expect(res.isUnrecognized).toBe(false);
      expect(res.rawTier).toBe(alias);
    }
  });

  it('maps Free / Starter tier aliases to 1.0 weight with Tier-Weighted label', () => {
    const aliases = ['Free', 'free', 'starter', 'Starter', 'free / starter', 'free/starter', 'FREE'];
    for (const alias of aliases) {
      const res = resolveCustomerTier(alias);
      expect(res.canonicalTier).toBe('Free / Starter');
      expect(res.weight).toBe(1.0);
      expect(res.weightLabel).toBe('Tier-Weighted');
      expect(res.isUnrecognized).toBe(false);
      expect(res.rawTier).toBe(alias);
    }
  });

  it('maps blank, null, undefined, N/A, and standard missing representations to UNKNOWN (1.0 weight)', () => {
    const missingInputs = [null, undefined, '', '   ', 'N/A', 'n/a', 'na', 'none', 'unknown', 'UNKNOWN', '-', '--'];
    for (const input of missingInputs) {
      const res = resolveCustomerTier(input);
      expect(res.canonicalTier).toBe('UNKNOWN');
      expect(res.weight).toBe(1.0);
      expect(res.weightLabel).toBe('Tier-Weighted');
      expect(res.isUnrecognized).toBe(false);
      expect(res.informationalPill).toBeUndefined();
    }
  });

  it('maps non-standard unrecognized tier strings to UNKNOWN with informational pill and preserves raw string', () => {
    const nonStandard = ['Custom Gold', 'VIP Customer', 'Platinum Plus', 'Tier 4'];
    for (const input of nonStandard) {
      const res = resolveCustomerTier(input);
      expect(res.canonicalTier).toBe('UNKNOWN');
      expect(res.weight).toBe(1.0);
      expect(res.weightLabel).toBe('Tier-Weighted');
      expect(res.isUnrecognized).toBe(true);
      expect(res.isNumericArrNotice).toBe(false);
      expect(res.rawTier).toBe(input); // Raw dataset value never modified
      expect(res.informationalPill).toContain('Non-standard tier:');
      expect(res.informationalPill).toContain(input);
      expect(res.informationalPill).toContain('1.0x Tier-Weighted');
    }
  });

  it('detects numeric ARR/MRR values, does NOT convert to tiers in P0 (GAP-10), sets UNKNOWN and emits notice', () => {
    const numericInputs = ['$50,000', '12000', '$50k', '50k', '$1,200/mo', '100000/yr', '€500', '£1,000', '120.50'];
    for (const input of numericInputs) {
      expect(isNumericArrValue(input)).toBe(true);
      const res = resolveCustomerTier(input);
      expect(res.canonicalTier).toBe('UNKNOWN');
      expect(res.weight).toBe(1.0);
      expect(res.weightLabel).toBe('Tier-Weighted');
      expect(res.isUnrecognized).toBe(true);
      expect(res.isNumericArrNotice).toBe(true);
      expect(res.noticeText).toContain('Numeric ARR values are not converted to tiers in P0 (GAP-10)');
      expect(res.informationalPill).toContain('Numeric ARR:');
      expect(res.rawTier).toBe(input); // Raw value unmodified
    }
  });

  it('never labels tier weights as actual ARR or currency dollars (IC-002)', () => {
    for (const [tier, weight] of Object.entries(TIER_WEIGHTS)) {
      expect(tier).toBeDefined();
      expect(typeof weight).toBe('number');
      expect(TIER_WEIGHT_LABEL).toBe('Tier-Weighted');
      expect(TIER_WEIGHT_LABEL).not.toContain('$');
      expect(TIER_WEIGHT_LABEL).not.toContain('ARR');
    }
  });
});

describe('Four-Tier Identity Isolation (PRD §4.3)', () => {
  it('strictly isolates Feedback ID, User ID, Account ID, and Cluster ID', () => {
    const identity = createFeedbackIdentity('FB-001', {
      userId: 'usr_123',
      accountId: 'org_456',
      clusterId: 'CLUST-01'
    });

    expect(identity.feedbackId).toBe('FB-001');
    expect(identity.userId).toBe('usr_123');
    expect(identity.accountId).toBe('org_456');
    expect(identity.clusterId).toBe('CLUST-01');
  });

  it('normalizes empty strings to null for optional identity tiers', () => {
    const identity = createFeedbackIdentity('  FB-002  ', {
      userId: '   ',
      accountId: '',
      clusterId: undefined
    });

    expect(identity.feedbackId).toBe('FB-002');
    expect(identity.userId).toBeNull();
    expect(identity.accountId).toBeNull();
    expect(identity.clusterId).toBeNull();
  });

  it('transforms RawFeedbackRow into ProcessedFeedbackRow preserving verbatim text (IC-001)', () => {
    const rawRow: RawFeedbackRow = {
      feedback_id: 'FB-001',
      text: '   Leading spaces and trailing spaces   \nWith newline and "quotes"   ',
      tier: 'Enterprise',
      user_id: 'usr_99',
      account_id: '  Acme Corp  ',
      rawRow: { feedback: 'raw', tier: 'Enterprise' },
      rowIndex: 1
    };

    const processed = processFeedbackRow(rawRow);

    expect(processed.identity.feedbackId).toBe('FB-001');
    expect(processed.identity.userId).toBe('usr_99');
    expect(processed.identity.accountId).toBe('Acme Corp');
    // Verbatim text preserved exactly per IC-001
    expect(processed.text).toBe('   Leading spaces and trailing spaces   \nWith newline and "quotes"   ');
    expect(processed.tierResolution.canonicalTier).toBe('Enterprise');
    expect(processed.tierResolution.weight).toBe(3.0);
    expect(processed.rowIndex).toBe(1);
    expect(processed.rawRow).toEqual(rawRow.rawRow);
  });
});

describe('Dual-Reporting Account Counting (PRD §4.5, TS-017, IC-012)', () => {
  it('deduplicates multiple submissions from the same account (IC-012)', () => {
    const rows = [
      { accountId: 'Acme Corp' },
      { accountId: 'Acme Corp ' },
      { accountId: 'acme corp' }, // distinct casing preserved as distinct ID
      { accountId: 'Beta Inc' }
    ];

    const metrics = computeAccountCounts(rows);
    // 'Acme Corp', 'acme corp', 'Beta Inc'
    expect(metrics.confirmedUniqueAccounts).toBe(3);
    expect(metrics.missingAccountIdRows).toBe(0);
    expect(metrics.estimatedAccountCoverage).toBe(3);
    expect(metrics.isAccountUnmappedWarning).toBe(false);
  });

  it('provisionally counts rows lacking Account ID as one account each (U = N)', () => {
    const rows = [
      { accountId: 'Acme Corp' },
      { accountId: 'Acme Corp' },
      { accountId: '' }, // missing
      { accountId: null }, // missing
      { accountId: '  ' } // missing
    ];

    const metrics = computeAccountCounts(rows);
    expect(metrics.confirmedUniqueAccounts).toBe(1); // 'Acme Corp'
    expect(metrics.missingAccountIdRows).toBe(3);
    expect(metrics.estimatedAccountCoverage).toBe(4); // 1 confirmed + 3 provisional
    expect(metrics.isAccountUnmappedWarning).toBe(true);
    expect(metrics.warningPillText).toBe('Account IDs Unmapped — Frequency Estimated');
  });

  // TS-017 SPECIFIC TEST
  it('TS-017: handles dataset with missing Account IDs (Confirmed: 0, Estimated: N, warning pill visible)', () => {
    const rows = [
      { accountId: null },
      { accountId: '' },
      { accountId: undefined },
      { accountId: '   ' }
    ];

    const metrics = computeAccountCounts(rows);
    expect(metrics.confirmedUniqueAccounts).toBe(0);
    expect(metrics.missingAccountIdRows).toBe(4);
    expect(metrics.estimatedAccountCoverage).toBe(4);
    expect(metrics.isAccountUnmappedWarning).toBe(true);
    expect(metrics.warningPillText).toBe('Account IDs Unmapped — Frequency Estimated');
  });

  it('TS-017: handles completely unmapped Account ID column (isAccountColumnMapped: false)', () => {
    const rows = [{ accountId: 'ignored' }, { accountId: 'ignored' }, { accountId: 'ignored' }];
    const metrics = computeAccountCounts(rows, { isAccountColumnMapped: false });

    expect(metrics.confirmedUniqueAccounts).toBe(0);
    expect(metrics.missingAccountIdRows).toBe(3);
    expect(metrics.estimatedAccountCoverage).toBe(3);
    expect(metrics.isAccountUnmappedWarning).toBe(true);
    expect(metrics.warningPillText).toBe('Account IDs Unmapped — Frequency Estimated');
  });
});

describe('Data Quality Metrics & Distinct-Row Union Deduplication (PRD REQ-004, §4.6, TS-024, IC-012)', () => {
  function makeMockRow(tier: string | null, accountId: string | null, idx: number): ProcessedFeedbackRow {
    const rawRow: RawFeedbackRow = {
      feedback_id: `FB-${idx.toString().padStart(3, '0')}`,
      text: `Feedback text ${idx}`,
      tier: tier ?? undefined,
      account_id: accountId ?? undefined,
      rawRow: {},
      rowIndex: idx
    };
    return processFeedbackRow(rawRow);
  }

  it('computes 0% issues when dataset has all tiers and accounts populated', () => {
    const rows = [
      makeMockRow('Enterprise', 'Acme', 1),
      makeMockRow('Pro', 'Beta', 2),
      makeMockRow('Free', 'Gamma', 3)
    ];

    const metrics = calculateDataQualityMetrics(rows);
    expect(metrics.totalRows).toBe(3);
    expect(metrics.unknownTierCount).toBe(0);
    expect(metrics.unknownTierPercentage).toBe(0);
    expect(metrics.missingAccountIdCount).toBe(0);
    expect(metrics.missingAccountIdPercentage).toBe(0);
    expect(metrics.rowsWithIssuesCount).toBe(0);
    expect(metrics.rowsWithIssuesPercentage).toBe(0);

    const banner = createQualityAlertBanner(metrics);
    expect(banner.triggered).toBe(false);
  });

  it('TS-024: correctly deduplicates distinct-row union when rows have overlapping issues (IC-012)', () => {
    // 10 total rows:
    // Row 1: Unknown tier only (1 issue)
    // Row 2: Missing account only (1 issue)
    // Row 3: BOTH Unknown tier AND Missing account (1 row with >= 1 issue)
    // Rows 4-10: Valid tier and valid account (7 rows with 0 issues)
    const rows = [
      makeMockRow(null, 'Acme Corp', 1),     // Tier issue only
      makeMockRow('Enterprise', null, 2),    // Account issue only
      makeMockRow(null, null, 3),             // Both issues on the same row!
      makeMockRow('Enterprise', 'Org A', 4),
      makeMockRow('Pro', 'Org B', 5),
      makeMockRow('Free', 'Org C', 6),
      makeMockRow('Enterprise', 'Org D', 7),
      makeMockRow('Pro', 'Org E', 8),
      makeMockRow('Free', 'Org F', 9),
      makeMockRow('Enterprise', 'Org G', 10)
    ];

    const metrics = calculateDataQualityMetrics(rows);

    expect(metrics.totalRows).toBe(10);
    // Unknown tier count: Row 1 and Row 3 = 2 (20%)
    expect(metrics.unknownTierCount).toBe(2);
    expect(metrics.unknownTierPercentage).toBe(20);
    // Missing account count: Row 2 and Row 3 = 2 (20%)
    expect(metrics.missingAccountIdCount).toBe(2);
    expect(metrics.missingAccountIdPercentage).toBe(20);
    // Rows with >= 1 issue (union): Row 1, Row 2, Row 3 = 3 distinct rows (30%)
    // Row 3 is NOT double counted! (2 + 2 = 4, but union is 3)
    expect(metrics.rowsWithIssuesCount).toBe(3);
    expect(metrics.rowsWithIssuesPercentage).toBe(30);

    const banner = createQualityAlertBanner(metrics);
    expect(banner.triggered).toBe(true);
    expect(banner.issuePercentage).toBe(30);
    expect(banner.message).toBe(
      'Data Quality Warning: 30% of records lack customer tier or account metadata and are evaluated provisionally (1.0x weight). Priority scores may reflect submission volume rather than verified account revenue.'
    );
  });

  it('evaluates unmapped column as 100% missing metadata', () => {
    const rows = [
      makeMockRow('Enterprise', 'Acme', 1),
      makeMockRow('Pro', 'Beta', 2)
    ];

    // Unmapped tier column
    const metricsUnmappedTier = calculateDataQualityMetrics(rows, { isTierColumnMapped: false });
    expect(metricsUnmappedTier.isTierColumnMapped).toBe(false);
    expect(metricsUnmappedTier.unknownTierPercentage).toBe(100);
    expect(metricsUnmappedTier.rowsWithIssuesPercentage).toBe(100);

    // Unmapped account column
    const metricsUnmappedAccount = calculateDataQualityMetrics(rows, { isAccountColumnMapped: false });
    expect(metricsUnmappedAccount.isAccountColumnMapped).toBe(false);
    expect(metricsUnmappedAccount.missingAccountIdPercentage).toBe(100);
    expect(metricsUnmappedAccount.rowsWithIssuesPercentage).toBe(100);
  });

  it('triggers warning banner strictly when Rows with >= 1 issue % exceeds 5.0%', () => {
    // Exactly 5% (1 out of 20 rows): should NOT trigger banner (>5% requirement)
    const twentyRows = Array.from({ length: 20 }, (_, i) =>
      makeMockRow(i === 0 ? null : 'Enterprise', 'Acme', i + 1)
    );
    const metrics5Pct = calculateDataQualityMetrics(twentyRows);
    expect(metrics5Pct.rowsWithIssuesPercentage).toBe(5);
    const banner5Pct = createQualityAlertBanner(metrics5Pct);
    expect(banner5Pct.triggered).toBe(false);

    // 5.5% (e.g. 6 out of 100 rows): SHOULD trigger banner
    const hundredRows = Array.from({ length: 100 }, (_, i) =>
      makeMockRow(i < 6 ? null : 'Enterprise', 'Acme', i + 1)
    );
    const metrics6Pct = calculateDataQualityMetrics(hundredRows);
    expect(metrics6Pct.rowsWithIssuesPercentage).toBe(6);
    const banner6Pct = createQualityAlertBanner(metrics6Pct);
    expect(banner6Pct.triggered).toBe(true);
    expect(banner6Pct.message).toBe(
      'Data Quality Warning: 6% of records lack customer tier or account metadata and are evaluated provisionally (1.0x weight). Priority scores may reflect submission volume rather than verified account revenue.'
    );
    expect(banner6Pct.collapsedText).toBe('Data Quality Alert (6% metadata missing)');
  });
});

describe('TS-002: Missing Tier Column Scenario', () => {
  it('sets all tiers to UNKNOWN (1.0x weight) and renders quality warning banner when tier column is missing', () => {
    // Simulated CSV where no customer tier column exists
    const rawRows: RawFeedbackRow[] = [
      { feedback_id: 'FB-001', text: 'Checkout fails on mobile', account_id: 'Acme', rawRow: {}, rowIndex: 1 },
      { feedback_id: 'FB-002', text: 'Export button broken', account_id: 'Beta', rawRow: {}, rowIndex: 2 },
      { feedback_id: 'FB-003', text: 'Search is very slow', account_id: 'Gamma', rawRow: {}, rowIndex: 3 }
    ];

    const processed = processFeedbackRows(rawRows);

    // 1. All rows have tier UNKNOWN with 1.0 weight
    for (const row of processed) {
      expect(row.tierResolution.canonicalTier).toBe('UNKNOWN');
      expect(row.tierResolution.weight).toBe(1.0);
      expect(row.tierResolution.weightLabel).toBe('Tier-Weighted');
    }

    // 2. Data quality metrics when tier column is unmapped
    const qualityMetrics = calculateDataQualityMetrics(processed, { isTierColumnMapped: false });
    expect(qualityMetrics.unknownTierPercentage).toBe(100);
    expect(qualityMetrics.rowsWithIssuesPercentage).toBe(100);

    // 3. Quality warning banner triggers (>5%)
    const banner = createQualityAlertBanner(qualityMetrics);
    expect(banner.triggered).toBe(true);
    expect(banner.message).toBe(
      'Data Quality Warning: 100% of records lack customer tier or account metadata and are evaluated provisionally (1.0x weight). Priority scores may reflect submission volume rather than verified account revenue.'
    );
  });
});

describe('Percentage Formatting Utilities', () => {
  it('formats whole numbers without decimals and fractional numbers to 1 decimal place', () => {
    expect(formatPercentage(12)).toBe('12%');
    expect(formatPercentage(100)).toBe('100%');
    expect(formatPercentage(0)).toBe('0%');
    expect(formatPercentage(5.5)).toBe('5.5%');
    expect(formatPercentage(5.555)).toBe('5.6%');
    expect(formatPercentage(12.0)).toBe('12%');
  });
});
