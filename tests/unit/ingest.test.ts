/**
 * tests/unit/ingest.test.ts — CSV Ingestion & Smart Schema Mapping Unit Tests
 * Covers PRD REQ-001, REQ-002, §4.1–4.2, TS-001, TS-010, IC-001.
 * Evaluates Gate G-M1A.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCsvText,
  validateFileName,
  validateFileSize,
  autoDetectSchema,
  stripBOM,
  detectDelimiter,
  IngestError,
  IngestErrorCode,
  MAX_FILE_SIZE_BYTES
} from '../../src/ingest';

describe('CSV Ingestion & Validation (REQ-001)', () => {
  it('accepts valid .csv file extensions (case-insensitive)', () => {
    expect(() => validateFileName('feedback.csv')).not.toThrow();
    expect(() => validateFileName('EXPORT_DATA.CSV')).not.toThrow();
    expect(() => validateFileName('my.dataset.2026.csv')).not.toThrow();
  });

  it('rejects unsupported file extensions with typed INVALID_FILE_TYPE error', () => {
    const invalidFiles = [
      'feedback.xlsx',
      'report.pdf',
      'data.json',
      'notes.txt',
      'archive.zip',
      'data'
    ];

    for (const fileName of invalidFiles) {
      expect(() => validateFileName(fileName)).toThrowError(IngestError);
      try {
        validateFileName(fileName);
      } catch (err) {
        expect(err).toBeInstanceOf(IngestError);
        expect((err as IngestError).code).toBe(IngestErrorCode.INVALID_FILE_TYPE);
      }
    }
  });

  it('enforces 10 MB maximum file size limit with typed FILE_TOO_LARGE error', () => {
    const tenMb = MAX_FILE_SIZE_BYTES;
    expect(() => validateFileSize(tenMb)).not.toThrow();
    expect(() => validateFileSize(tenMb - 1)).not.toThrow();

    expect(() => validateFileSize(tenMb + 1)).toThrowError(IngestError);
    try {
      validateFileSize(tenMb + 1);
    } catch (err) {
      expect((err as IngestError).code).toBe(IngestErrorCode.FILE_TOO_LARGE);
    }
  });

  it('enforces 2,000 maximum row limit with typed ROW_LIMIT_EXCEEDED error', () => {
    // Generate CSV with 2,001 data rows
    let bigCsv = 'feedback\n';
    for (let i = 1; i <= 2001; i++) {
      bigCsv += `Issue row ${i}\n`;
    }

    expect(() => parseCsvText(bigCsv)).toThrowError(IngestError);
    try {
      parseCsvText(bigCsv);
    } catch (err) {
      expect((err as IngestError).code).toBe(IngestErrorCode.ROW_LIMIT_EXCEEDED);
    }
  });

  it('rejects empty CSV with typed EMPTY_FILE error', () => {
    expect(() => parseCsvText('')).toThrowError(IngestError);
    expect(() => parseCsvText('   \n\n  ')).toThrowError(IngestError);
    try {
      parseCsvText('');
    } catch (err) {
      expect((err as IngestError).code).toBe(IngestErrorCode.EMPTY_FILE);
    }
  });
});

describe('Delimiter Auto-Detection & Manual Override (REQ-001)', () => {
  it('auto-detects standard comma delimiter', () => {
    const csv = 'feedback,tier\n"Slow export",Enterprise';
    const result = parseCsvText(csv);
    expect(result.delimiter).toBe(',');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('Slow export');
  });

  it('auto-detects tab delimiter', () => {
    const tsv = 'feedback\ttier\taccount_id\n"Slow export"\tPro\tACC-1';
    const result = parseCsvText(tsv);
    expect(result.delimiter).toBe('\t');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('Slow export');
    expect(result.rows[0].tier).toBe('Pro');
  });

  it('auto-detects semicolon delimiter', () => {
    const ssv = 'feedback;tier;account_id\n"Export failed";Enterprise;ACC-2';
    const result = parseCsvText(ssv);
    expect(result.delimiter).toBe(';');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('Export failed');
  });

  it('detects delimiters directly using detectDelimiter utility', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('honors manual delimiter override hook', () => {
    const csv = 'feedback|tier\n"Broken export"|Enterprise';
    const result = parseCsvText(csv, { delimiter: '|' });
    expect(result.delimiter).toBe('|');
    expect(result.rows[0].text).toBe('Broken export');
  });
});

describe('Encoding & BOM Handling (REQ-001)', () => {
  it('strips UTF-8 BOM directly using stripBOM utility', () => {
    expect(stripBOM('\uFEFFhello')).toBe('hello');
    expect(stripBOM('hello')).toBe('hello');
  });

  it('strips UTF-8 BOM without corrupting first header matching', () => {
    const bomCsv = '\uFEFFfeedback,tier\n"Export failed",Enterprise';
    const result = parseCsvText(bomCsv);
    expect(result.headers[0]).toBe('feedback');
    expect(result.mapping.text).toBe('feedback');
    expect(result.rows[0].text).toBe('Export failed');
  });
});

describe('Smart Schema Mapping Engine (REQ-002 & PRD §4.2)', () => {
  it('maps all standard PRD §4.2 aliases correctly', () => {
    const testCases: Array<{ header: string; expectedField: string }> = [
      { header: 'feedback', expectedField: 'text' },
      { header: 'Comment', expectedField: 'text' },
      { header: 'notes', expectedField: 'text' },
      { header: 'issue_description', expectedField: 'text' },
      { header: 'CUSTOMER_TIER', expectedField: 'tier' },
      { header: 'plan', expectedField: 'tier' },
      { header: 'arr', expectedField: 'tier' },
      { header: 'ticket_id', expectedField: 'feedback_id' },
      { header: 'UUID', expectedField: 'feedback_id' },
      { header: 'Author_ID', expectedField: 'user_id' },
      { header: 'email', expectedField: 'user_id' },
      { header: 'Company', expectedField: 'account_id' },
      { header: 'domain', expectedField: 'account_id' }
    ];

    for (const { header, expectedField } of testCases) {
      const headers = [header];
      if (expectedField !== 'text') headers.push('feedback'); // text is mandatory
      const mapping = autoDetectSchema(headers);
      expect(mapping[expectedField as keyof typeof mapping]).toBe(header);
    }
  });

  it('throws MISSING_MANDATORY_COLUMN when Raw Feedback Text column is missing', () => {
    const headers = ['user_id', 'tier', 'account_id'];
    expect(() => autoDetectSchema(headers)).toThrowError(IngestError);
    try {
      autoDetectSchema(headers);
    } catch (err) {
      expect((err as IngestError).code).toBe(IngestErrorCode.MISSING_MANDATORY_COLUMN);
    }
  });

  it('allows manual mapping object override', () => {
    const headers = ['custom_col_1', 'custom_col_2'];
    const mapping = autoDetectSchema(headers, {
      text: 'custom_col_1',
      tier: 'custom_col_2'
    });
    expect(mapping.text).toBe('custom_col_1');
    expect(mapping.tier).toBe('custom_col_2');
  });
});

describe('ID Generation & Duplicate Handling (TS-010)', () => {
  it('auto-generates stable sequential FB-001... IDs when ID column is absent', () => {
    const csv = `feedback,tier
Row one text,Enterprise
Row two text,Pro
Row three text,Free`;

    const result = parseCsvText(csv);
    expect(result.rows[0].feedback_id).toBe('FB-001');
    expect(result.rows[1].feedback_id).toBe('FB-002');
    expect(result.rows[2].feedback_id).toBe('FB-003');
  });

  it('appends _row2 style suffix to duplicate IDs so all IDs are globally unique (TS-010)', () => {
    const csv = `feedback_id,feedback
FB-001,First issue
FB-001,Duplicate issue second row
FB-001,Duplicate issue third row
FB-002,Distinct issue
FB-002,Duplicate of distinct issue`;

    const result = parseCsvText(csv);
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0].feedback_id).toBe('FB-001');
    expect(result.rows[1].feedback_id).toBe('FB-001_row2');
    expect(result.rows[2].feedback_id).toBe('FB-001_row3');
    expect(result.rows[3].feedback_id).toBe('FB-002');
    expect(result.rows[4].feedback_id).toBe('FB-002_row2');

    // Confirm 100% uniqueness across dataset
    const idSet = new Set(result.rows.map(r => r.feedback_id));
    expect(idSet.size).toBe(5);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Verbatim Cell Storage (IC-001)', () => {
  it('stores feedback text cell EXACTLY as parsed without trimming or mutation', () => {
    const verbatimText = '   Export fails with "error code 500"!  \n  Check accents: café, naïve.   ';
    const csv = `id,feedback,tier
FB-100,"${verbatimText}",Enterprise`;

    const result = parseCsvText(csv);
    expect(result.rows[0].text).toBe(verbatimText);
  });
});

describe('300-Row Baseline Ingestion Benchmark (TS-001)', () => {
  it('parses valid 300-row CSV in under 5 seconds (<5s requirement)', () => {
    // Generate valid 300-row CSV
    let csv = 'feedback_id,feedback,tier,account_id,user_id\n';
    for (let i = 1; i <= 300; i++) {
      csv += `TICK-${i},"Feedback message number ${i} regarding dashboard performance.",Enterprise,ACC-${i % 20},USR-${i}\n`;
    }

    const start = performance.now();
    const result = parseCsvText(csv);
    const duration = performance.now() - start;

    expect(result.rows).toHaveLength(300);
    expect(result.mapping.text).toBe('feedback');
    expect(result.mapping.tier).toBe('tier');
    expect(result.mapping.feedback_id).toBe('feedback_id');
    expect(duration).toBeLessThan(5000); // PRD TS-001: <5 seconds
    console.log(`[BENCHMARK] 300 rows parsed and mapped in ${duration.toFixed(2)} ms.`);
  });
});
