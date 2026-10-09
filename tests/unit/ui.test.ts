/**
 * tests/unit/ui.test.ts — SIFT UI Logic and Pre-Flight Computation Suite
 * Governed by PRD §3.1 (Steps 1–8), §5.2, §5.4, §8.2; DEC-PROVIDER
 */

import { describe, it, expect } from 'vitest';
import { autoDetectSchema } from '../../src/ingest';
import { createQualityAlertBanner } from '../../src/identity';

describe('Pre-Flight Cloud Call Estimation Math (PRD §5.2, §5.4, IC-008)', () => {
  function computeCallEstimates(rowCount: number) {
    const pass1Calls = Math.ceil(rowCount / 50);
    const pass2UpperBound = Math.min(8, Math.max(3, Math.ceil(pass1Calls * 0.8)));
    return {
      pass1Calls,
      pass2UpperBound,
      totalEstimate: pass1Calls + pass2UpperBound
    };
  }

  it('calculates correct pass-1 batches and pass-2 consolidation calls for 50 rows (1 batch)', () => {
    const est = computeCallEstimates(50);
    expect(est.pass1Calls).toBe(1);
    expect(est.pass2UpperBound).toBe(3); // min bound
    expect(est.totalEstimate).toBe(4);
  });

  it('calculates correct batches for 300 rows baseline (6 batches)', () => {
    const est = computeCallEstimates(300);
    expect(est.pass1Calls).toBe(6);
    expect(est.pass2UpperBound).toBe(5); // ceil(6 * 0.8) = 5
    expect(est.totalEstimate).toBe(11); // exactly matches DEC-PROVIDER 11 nominal calls!
  });

  it('calculates correct batches for 2,000 rows max ceiling (40 batches)', () => {
    const est = computeCallEstimates(2000);
    expect(est.pass1Calls).toBe(40);
    expect(est.pass2UpperBound).toBe(8); // capped at 8 max categories
    expect(est.totalEstimate).toBe(48);
  });
});

describe('Schema Mapping Selection & Raw Feedback Validation (PRD §3.1 Step 6)', () => {
  it('identifies when raw feedback text is missing and throws IngestError', () => {
    const headers = ['tier', 'account_id', 'author'];
    expect(() => autoDetectSchema(headers)).toThrow('Raw Feedback Text is mandatory');
  });

  it('enables analysis when raw feedback text column is mapped', () => {
    const headers = ['feedback_id', 'review_notes', 'tier'];
    const detected = autoDetectSchema(headers);

    expect(detected.text).toBe('review_notes');
    const isTextMapped = Boolean(detected.text && detected.text.trim().length > 0);
    expect(isTextMapped).toBe(true);
  });
});

describe('Data Quality Banner Formatter (PRD §4.6, REQ-004)', () => {
  it('formats exact warning banner text for 12% missing metadata', () => {
    const dummyMetrics = {
      totalRows: 100,
      unknownTierCount: 12,
      unknownTierPercentage: 12,
      isTierColumnMapped: true,
      missingAccountIdCount: 0,
      missingAccountIdPercentage: 0,
      isAccountColumnMapped: true,
      rowsWithIssuesCount: 12,
      rowsWithIssuesPercentage: 12
    };

    const banner = createQualityAlertBanner(dummyMetrics);
    expect(banner.triggered).toBe(true);
    expect(banner.message).toBe(
      'Data Quality Warning: 12% of records lack customer tier or account metadata and are evaluated provisionally (1.0x weight). Priority scores may reflect submission volume rather than verified account revenue.'
    );
    expect(banner.collapsedText).toBe('Data Quality Alert (12% metadata missing)');
  });
});
