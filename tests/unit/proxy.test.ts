/**
 * tests/unit/proxy.test.ts — Serverless Proxy Security & Validation Test Suite (M2-A)
 * Validates TS-016, TS-022, TS-023, REQ-013, PRD §5.3, §9.2, §9.3, IC-010, IC-011.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleClusterRequest } from '../../api/cluster';
import { resetRateLimiter } from '../../api/rateLimiter';
import { clearAuditLogBuffer, auditLogBuffer } from '../../api/logger';
import { PER_ITEM_TEXT_CAP } from '../../api/schemas';

// Mock sample cluster data matching PRD §5.3 schema
const VALID_UPSTREAM_CLUSTERS = {
  clusters: [
    {
      cluster_id: 'CLUST-01',
      cluster_title: 'CSV Ingestion Timeouts on High Row Volumes',
      canonical_category: 'Performance',
      problem_summary: 'Users experience timeouts when uploading large CSV files.',
      root_cause_hypothesis: 'Synchronous row parsing blocks main thread on large datasets.',
      severity_rating: 3,
      member_feedback_ids: ['FB-001', 'FB-002'],
      quotes: [
        {
          feedback_id: 'FB-001',
          quote_snippet: 'Export fails every time I upload more than 500 rows',
        },
        {
          feedback_id: 'FB-002',
          quote_snippet: 'App completely froze on a 10MB file',
        },
      ],
    },
  ],
};

function createMockGeminiFetch(options: {
  status?: number;
  body?: any;
  rawText?: string;
  headers?: Record<string, string>;
  shouldReject?: boolean;
} = {}) {
  return vi.fn().mockImplementation(async (_url: string, _init?: RequestInit) => {
    if (options.shouldReject) {
      throw new Error('Network failure connecting to Gemini');
    }

    const status = options.status ?? 200;
    const resHeaders = new Headers(options.headers ?? { 'Content-Type': 'application/json' });

    let responsePayload: any;
    if (options.rawText !== undefined) {
      responsePayload = {
        candidates: [
          {
            content: {
              parts: [{ text: options.rawText }],
            },
          },
        ],
      };
    } else if (options.body !== undefined) {
      responsePayload = options.body;
    } else {
      responsePayload = {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(VALID_UPSTREAM_CLUSTERS) }],
            },
          },
        ],
      };
    }

    return new Response(JSON.stringify(responsePayload), {
      status,
      headers: resHeaders,
    });
  });
}

const TEST_ENV = {
  AI_API_KEY: 'mock' + '-key-' + '12345',
  AI_MODEL: 'gemini-3.5-flash',
  ALLOWED_ORIGIN: 'http://localhost:5173,http://127.0.0.1:5173',
  RATE_LIMIT_RPM: '10',
};

function createValidRequest(overrides: {
  method?: string;
  origin?: string;
  contentType?: string;
  body?: any;
  headers?: Record<string, string>;
} = {}) {
  const method = overrides.method ?? 'POST';
  const headers: Record<string, string> = {
    'Content-Type': overrides.contentType ?? 'application/json',
    Origin: overrides.origin ?? 'http://localhost:5173',
    ...overrides.headers,
  };

  const bodyData = overrides.body ?? {
    batch_index: 0,
    total_batches: 1,
    items: [
      {
        feedback_id: 'FB-001',
        text: 'Export fails every time I upload more than 500 rows',
        tier: 'Enterprise',
      },
      {
        feedback_id: 'FB-002',
        text: 'App completely froze on a 10MB file',
        tier: 'Pro',
      },
    ],
  };

  return new Request('http://localhost/api/cluster', {
    method,
    headers,
    body: method !== 'GET' && method !== 'OPTIONS' ? JSON.stringify(bodyData) : undefined,
  });
}

describe('Serverless Proxy: Security & Protocol Validation (M2-A)', () => {
  beforeEach(() => {
    resetRateLimiter();
    clearAuditLogBuffer();
    vi.restoreAllMocks();
  });

  describe('Method & Content-Type Validation', () => {
    it('rejects non-POST HTTP methods with 405 Method Not Allowed and Allow header', async () => {
      const mockFetch = createMockGeminiFetch();
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const req = new Request('http://localhost/api/cluster', {
          method,
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost:5173',
          },
        });
        const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
        expect(res.status).toBe(405);
        expect(res.headers.get('Allow')).toBe('POST');
        const json = await res.json();
        expect(json.code).toBe('METHOD_NOT_ALLOWED');
      }
    });

    it('handles CORS OPTIONS preflight request with 204 No Content for allowed origin', async () => {
      const req = new Request('http://localhost/api/cluster', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
        },
      });
      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('rejects CORS OPTIONS preflight from unauthorized origin with 403 Forbidden', async () => {
      const req = new Request('http://localhost/api/cluster', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://malicious-site.example.com',
        },
      });
      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('ORIGIN_FORBIDDEN');
    });

    it('rejects unsupported Content-Type with 415 Unsupported Media Type', async () => {
      const req = new Request('http://localhost/api/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Origin: 'http://localhost:5173',
        },
        body: 'plain text payload',
      });
      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(415);
      const json = await res.json();
      expect(json.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('Browser-Origin Hygiene (ALLOWED_ORIGIN / IC-010)', () => {
    it('accepts request from allowed origin and attaches CORS response header', async () => {
      const mockFetch = createMockGeminiFetch();
      const req = createValidRequest({ origin: 'http://localhost:5173' });
      const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });

    it('rejects request with unauthorized Origin header with 403 Forbidden', async () => {
      const req = createValidRequest({ origin: 'http://evil-attacker.com' });
      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('ORIGIN_FORBIDDEN');
    });
  });

  describe('Payload Size Limit (TS-016 & REQ-013)', () => {
    it('rejects 5MB POST payload with HTTP 413 Payload Too Large (TS-016)', async () => {
      const fiveMegabytes = 5 * 1024 * 1024;
      const largeText = 'A'.repeat(fiveMegabytes);

      const req = new Request('http://localhost/api/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(fiveMegabytes),
          Origin: 'http://localhost:5173',
        },
        body: largeText,
      });

      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects payload exceeding 2MB even when Content-Length header is omitted or manipulated', async () => {
      const twoPointOneMb = 2.1 * 1024 * 1024;
      const largePayload = JSON.stringify({
        batch_index: 0,
        total_batches: 1,
        items: [{ feedback_id: 'FB-001', text: 'X'.repeat(twoPointOneMb) }],
      });

      const req = new Request('http://localhost/api/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: largePayload,
      });

      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('accepts payloads within the 2MB ceiling limit', async () => {
      const mockFetch = createMockGeminiFetch();
      const validPayload = JSON.stringify({
        batch_index: 0,
        total_batches: 1,
        items: [{ feedback_id: 'FB-001', text: 'Valid sized text' }],
      });

      const req = new Request('http://localhost/api/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(validPayload.length),
          Origin: 'http://localhost:5173',
        },
        body: validPayload,
      });

      const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
      expect(res.status).toBe(200);
    });
  });

  describe('Request Schema & Batch Caps Validation (PRD §9.2)', () => {
    it('rejects malformed JSON with 400 Bad Request', async () => {
      const req = new Request('http://localhost/api/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: '{ malformed: json ...',
      });
      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('MALFORMED_JSON');
    });

    it('rejects request missing required fields (batch_index, total_batches, items) with 400', async () => {
      const invalidBodies = [
        { total_batches: 1, items: [] }, // missing batch_index
        { batch_index: 0, items: [] }, // missing total_batches
        { batch_index: 0, total_batches: 1 }, // missing items
        { batch_index: -1, total_batches: 1, items: [] }, // negative batch_index
        { batch_index: 0, total_batches: 0, items: [] }, // total_batches < 1
      ];

      for (const body of invalidBodies) {
        const req = createValidRequest({ body });
        const res = await handleClusterRequest(req, TEST_ENV);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.code).toBe('SCHEMA_VALIDATION_FAILED');
      }
    });

    it('rejects items missing feedback_id or text with 400', async () => {
      const badItemsPayload = {
        batch_index: 0,
        total_batches: 1,
        items: [{ text: 'Missing feedback_id' }],
      };
      const req = createValidRequest({ body: badItemsPayload });
      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('SCHEMA_VALIDATION_FAILED');
    });

    it('rejects batches exceeding the 50 items cap with 400 Bad Request', async () => {
      const fiftyOneItems = Array.from({ length: 51 }, (_, i) => ({
        feedback_id: `FB-${i + 1}`,
        text: `Feedback row text number ${i + 1}`,
      }));

      const req = createValidRequest({
        body: {
          batch_index: 0,
          total_batches: 1,
          items: fiftyOneItems,
        },
      });

      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('BATCH_SIZE_EXCEEDED');
      expect(json.error).toContain('50 items');
    });

    it('rejects item text exceeding 4,000 characters cap with 400 Bad Request', async () => {
      const oversizedText = 'Z'.repeat(PER_ITEM_TEXT_CAP + 1);
      const req = createValidRequest({
        body: {
          batch_index: 0,
          total_batches: 1,
          items: [{ feedback_id: 'FB-OVERSIZED', text: oversizedText }],
        },
      });

      const res = await handleClusterRequest(req, TEST_ENV);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('ITEM_TEXT_LENGTH_EXCEEDED');
      expect(json.error).toContain('4000 characters');
    });
  });

  describe('Rate Limiting (PRD §9.3 & IC-010)', () => {
    it('uses platform-native rate limiter binding when available (Cloudflare Workers at ₹0)', async () => {
      const nativeLimiter = {
        limit: vi.fn().mockResolvedValue({ success: false }),
      };
      const envWithNative = {
        ...TEST_ENV,
        RATE_LIMITER: nativeLimiter,
      };

      const req = createValidRequest();
      const res = await handleClusterRequest(req, envWithNative);
      expect(nativeLimiter.limit).toHaveBeenCalled();
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
      const json = await res.json();
      expect(json.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('falls back to instance-local throttling (10 RPM) and returns 429 with Retry-After on 11th request', async () => {
      const mockFetch = createMockGeminiFetch();

      // Send 10 allowed requests
      for (let i = 0; i < 10; i++) {
        const req = createValidRequest({ headers: { 'cf-connecting-ip': '203.0.113.195' } });
        const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
        expect(res.status).toBe(200);
      }

      // 11th request from the same IP within the 60s window must be throttled
      const req11 = createValidRequest({ headers: { 'cf-connecting-ip': '203.0.113.195' } });
      const res11 = await handleClusterRequest(req11, TEST_ENV, mockFetch);
      expect(res11.status).toBe(429);
      expect(res11.headers.get('Retry-After')).toBeTruthy();
      const json11 = await res11.json();
      expect(json11.code).toBe('RATE_LIMIT_EXCEEDED');

      // Request from a different IP is not blocked
      const differentIpReq = createValidRequest({ headers: { 'cf-connecting-ip': '198.51.100.42' } });
      const diffRes = await handleClusterRequest(differentIpReq, TEST_ENV, mockFetch);
      expect(diffRes.status).toBe(200);
    });
  });

  describe('Model Locking & Secrets Isolation (TS-023)', () => {
    it('enforces model locking: strictly ignores client model request and uses AI_MODEL env', async () => {
      let calledUrl = '';
      let calledBody: any = null;

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        calledUrl = url;
        calledBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(VALID_UPSTREAM_CLUSTERS) }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      // Client attempts to override model with expensive/rogue model
      const req = createValidRequest({
        body: {
          batch_index: 0,
          total_batches: 1,
          model: 'claude-3-opus-expensive-override',
          items: [{ feedback_id: 'FB-001', text: 'Some feedback' }],
        },
      });

      const res = await handleClusterRequest(
        req,
        { ...TEST_ENV, AI_MODEL: 'gemini-3.5-flash' },
        mockFetch
      );
      expect(res.status).toBe(200);

      // Verify the URL invoked the locked model gemini-3.5-flash
      expect(calledUrl).toContain('models/gemini-3.5-flash:generateContent');
      expect(calledUrl).not.toContain('claude-3-opus');
      expect(calledBody).toBeDefined();
    });

    it('returns 500 sanitized error when AI_API_KEY is not configured on server', async () => {
      const envWithoutKey = { ...TEST_ENV, AI_API_KEY: '' };
      const req = createValidRequest();
      const res = await handleClusterRequest(req, envWithoutKey);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.code).toBe('API_KEY_UNCONFIGURED');
      expect(json.error).toBe('AI inference service is unconfigured on the server.');
    });

    it('never echoes the API key or authorization headers in response body or headers (TS-023)', async () => {
      const testKey = ['super', 'test', 'no', 'echo', '776655'].join('-');
      const mockFetch = createMockGeminiFetch();

      const req = createValidRequest();
      const res = await handleClusterRequest(
        req,
        { ...TEST_ENV, AI_API_KEY: testKey },
        mockFetch
      );

      expect(res.status).toBe(200);

      // Check response body
      const rawBody = await res.text();
      expect(rawBody).not.toContain(testKey);
      expect(rawBody).not.toContain('key=');

      // Check all response headers
      for (const [headerName, headerValue] of res.headers.entries()) {
        expect(headerValue).not.toContain(testKey);
        expect(headerName.toLowerCase()).not.toContain('authorization');
      }
    });
  });

  describe('Zero-Payload Logging & Sentinel String Test (TS-022 / IC-011)', () => {
    it('verifies that confidential sentinel strings in feedback text NEVER appear in captured logs (TS-022)', async () => {
      const mockFetch = createMockGeminiFetch();

      // Spy on console methods
      const consoleLogSpy = vi.spyOn(console, 'log');
      const consoleInfoSpy = vi.spyOn(console, 'info');
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const consoleErrorSpy = vi.spyOn(console, 'error');

      const SENTINEL_FEEDBACK = 'CONFIDENTIAL_CUSTOMER_SSN_999-88-7777_SECRET_SENTINEL_TOKEN_ALPHA';
      const SENTINEL_ID = 'FB-SENTINEL-12345';

      const req = createValidRequest({
        body: {
          batch_index: 0,
          total_batches: 1,
          items: [{ feedback_id: SENTINEL_ID, text: SENTINEL_FEEDBACK }],
        },
      });

      const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
      expect(res.status).toBe(200);

      // Gather all captured log calls
      const allCapturedLines: string[] = [
        ...auditLogBuffer,
        ...consoleLogSpy.mock.calls.flat().map(String),
        ...consoleInfoSpy.mock.calls.flat().map(String),
        ...consoleWarnSpy.mock.calls.flat().map(String),
        ...consoleErrorSpy.mock.calls.flat().map(String),
      ];

      // Verify that sentinel string NEVER appears in captured logs
      for (const logLine of allCapturedLines) {
        expect(logLine).not.toContain(SENTINEL_FEEDBACK);
        expect(logLine).not.toContain(SENTINEL_ID);
      }

      // Verify audit log records strictly status code, batch_index, itemCount, and latencyMs
      expect(auditLogBuffer.length).toBeGreaterThan(0);
      const auditEntry = auditLogBuffer[0];
      expect(auditEntry).toContain('[PROXY AUDIT]');
      expect(auditEntry).toContain('status=200');
      expect(auditEntry).toContain('batch=0');
      expect(auditEntry).toContain('items=1');
      expect(auditEntry).toContain('duration=');
    });
  });

  describe('Upstream Schema Validation & Error Sanitization (PRD §5.3)', () => {
    it('returns 200 with validated clusters when upstream AI output matches PRD §5.3 schema', async () => {
      const mockFetch = createMockGeminiFetch();
      const req = createValidRequest();
      const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.clusters).toHaveLength(1);
      expect(json.clusters[0].cluster_id).toBe('CLUST-01');
      expect(json.clusters[0].severity_rating).toBe(3);
    });

    it('returns 502 when upstream AI output violates PRD §5.3 schema (e.g. missing severity or quotes)', async () => {
      const invalidClusters = {
        clusters: [
          {
            cluster_id: 'CLUST-BAD',
            cluster_title: 'Title',
            canonical_category: 'Perf',
            problem_summary: 'Summary',
            root_cause_hypothesis: 'Cause',
            // missing severity_rating
            // missing member_feedback_ids
            quotes: [],
          },
        ],
      };
      const mockFetch = createMockGeminiFetch({ rawText: JSON.stringify(invalidClusters) });

      const req = createValidRequest();
      const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.code).toBe('UPSTREAM_SCHEMA_VIOLATION');
    });

    it('returns 502 when upstream AI output is not valid JSON', async () => {
      const mockFetch = createMockGeminiFetch({ rawText: 'Here are the clusters: { invalid json ...' });
      const req = createValidRequest();
      const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.code).toBe('UPSTREAM_MALFORMED_OUTPUT');
    });

    it('returns sanitized 429 when upstream AI provider rate limits the request', async () => {
      const mockFetch = createMockGeminiFetch({
        status: 429,
        headers: { 'retry-after': '30' },
        body: { error: { message: 'Resource has been exhausted (quota exceeded)' } },
      });
      const req = createValidRequest();
      const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('30');
      const json = await res.json();
      expect(json.code).toBe('UPSTREAM_RATE_LIMIT');
      expect(json.error).toBe('Upstream AI provider rate limit reached.');
    });

    it('returns sanitized 502 on upstream connection failures without leaking stack traces', async () => {
      const mockFetch = createMockGeminiFetch({ shouldReject: true });
      const req = createValidRequest();
      const res = await handleClusterRequest(req, TEST_ENV, mockFetch);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.code).toBe('UPSTREAM_NETWORK_FAILURE');
      expect(json.stack).toBeUndefined();
    });
  });
});
