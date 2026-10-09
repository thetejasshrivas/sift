/**
 * api/cluster.ts — Secure Serverless Clustering Proxy Endpoint (POST /api/cluster)
 * Governed by PRD REQ-013, §5.3, §9.2–9.3, TS-004, TS-016, IC-004, IC-010, IC-011, and DEC-PROVIDER.
 *
 * Security Controls:
 * 1. Method & Content-Type validation (POST only, application/json only).
 * 2. PRD §9.2 Request Schema validation via Ajv.
 * 3. Caps: Max 50 items/batch, per-item text cap (4,000 chars), total payload ≤ 2 MB (HTTP 413).
 * 4. Browser-Origin Hygiene: ALLOWED_ORIGIN env check against Origin header (HTTP 403).
 *    NOTE: This is browser-origin hygiene only — CORS is NOT authentication; scripts can forge headers.
 * 5. Rate Limiting: Platform-native binding check at ₹0, falling back to instance-local throttling (10 RPM).
 *    NOTE: Instance-local counters are per serverless instance and not globally synchronized.
 * 6. Model Locking: AI_MODEL read exclusively from server env, never from request payload.
 * 7. Key Protection: AI_API_KEY read exclusively from server env.
 * 8. Upstream structured-output forward & PRD §5.3 response schema validation.
 * 9. Sanitized errors: zero stack traces, zero keys, zero raw upstream payloads.
 * 10. Zero-Payload Logging: logs only status, batch_index, item count, latency; never feedback or PII.
 * 11. Zero Key Echo: response body and response headers never leak keys or auth headers.
 */

import {
  MAX_PAYLOAD_BYTES,
  MAX_ITEMS_PER_BATCH,
  PER_ITEM_TEXT_CAP,
  ClusterRequestPayload,
  validateClusterRequest,
  validateClusterResponse,
  GEMINI_RESPONSE_SCHEMA,
} from './schemas';
import { checkRateLimit } from './rateLimiter';
import { logProxyAudit } from './logger';

export interface ProxyErrorResponse {
  error: string;
  code: string;
}

/**
 * Builds a standardized JSON response with secure headers.
 * Never echoes API keys or authorization headers.
 */
function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string> = {},
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

/**
 * Handles incoming requests for POST /api/cluster.
 */
export async function handleClusterRequest(
  request: Request,
  env?: Record<string, any>,
  customFetch: typeof fetch = fetch
): Promise<Response> {
  const startTime = Date.now();
  let batchIndex = -1;
  let itemCount = 0;

  // 1. Browser-Origin Hygiene check against ALLOWED_ORIGIN env (IC-010)
  // NOTE: This is browser-origin hygiene only — CORS is NOT authentication; scripts can forge headers.
  const origin = request.headers.get('origin');
  const allowedOriginEnv = env?.ALLOWED_ORIGIN ?? process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173';
  const allowedOrigins = allowedOriginEnv
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean);

  let corsHeaders: Record<string, string> = {};

  if (origin) {
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    if (!isAllowed) {
      logProxyAudit({ statusCode: 403, batchIndex, itemCount, durationMs: Date.now() - startTime });
      return jsonResponse(
        { error: 'Forbidden: Origin not allowed', code: 'ORIGIN_FORBIDDEN' },
        403
      );
    }
    corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
    };
  }

  // Handle CORS preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 2. Validate HTTP Method (POST only)
  if (request.method !== 'POST') {
    logProxyAudit({ statusCode: 405, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Method Not Allowed. Only POST requests are supported.', code: 'METHOD_NOT_ALLOWED' },
      405,
      corsHeaders,
      { Allow: 'POST' }
    );
  }

  // 3. Validate Content-Type (application/json only)
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    logProxyAudit({ statusCode: 415, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Unsupported Media Type. Content-Type must be application/json.', code: 'UNSUPPORTED_MEDIA_TYPE' },
      415,
      corsHeaders
    );
  }

  // 4. Validate Payload Size Limit (Total Payload ≤ 2 MB → HTTP 413 Payload Too Large; TS-016)
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const parsedLength = parseInt(contentLengthHeader, 10);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_PAYLOAD_BYTES) {
      logProxyAudit({ statusCode: 413, batchIndex, itemCount, durationMs: Date.now() - startTime });
      return jsonResponse(
        { error: 'Payload Too Large. Maximum allowed request size is 2 MB.', code: 'PAYLOAD_TOO_LARGE' },
        413,
        corsHeaders
      );
    }
  }

  // Read raw body text and verify byte length
  let rawBodyText: string;
  try {
    rawBodyText = await request.text();
  } catch {
    logProxyAudit({ statusCode: 400, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Failed to read request body.', code: 'INVALID_BODY' },
      400,
      corsHeaders
    );
  }

  const actualByteLength = new TextEncoder().encode(rawBodyText).length;
  if (actualByteLength > MAX_PAYLOAD_BYTES) {
    logProxyAudit({ statusCode: 413, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Payload Too Large. Maximum allowed request size is 2 MB.', code: 'PAYLOAD_TOO_LARGE' },
      413,
      corsHeaders
    );
  }

  // 5. Rate Limiting Check (PRD §9.3, IC-010)
  const rateLimitResult = await checkRateLimit(request, env);
  if (!rateLimitResult.allowed) {
    const retrySec = rateLimitResult.retryAfterSeconds ?? 60;
    logProxyAudit({ statusCode: 429, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: `Rate limit exceeded. Please retry after ${retrySec} seconds.`, code: 'RATE_LIMIT_EXCEEDED' },
      429,
      corsHeaders,
      { 'Retry-After': String(retrySec) }
    );
  }

  // 6. Parse JSON Payload
  let payload: ClusterRequestPayload;
  try {
    payload = JSON.parse(rawBodyText);
  } catch {
    logProxyAudit({ statusCode: 400, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Malformed JSON in request body.', code: 'MALFORMED_JSON' },
      400,
      corsHeaders
    );
  }

  // 7. Validate Body against PRD §9.2 Request Schema
  const isSchemaValid = validateClusterRequest(payload);
  if (!isSchemaValid) {
    const errorDetails = validateClusterRequest.errors
      ?.map((err) => `${err.instancePath || 'root'} ${err.message}`)
      .join('; ');
    logProxyAudit({ statusCode: 400, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: `Invalid request payload: ${errorDetails || 'Schema mismatch'}`, code: 'SCHEMA_VALIDATION_FAILED' },
      400,
      corsHeaders
    );
  }

  batchIndex = payload.batch_index;
  itemCount = payload.items.length;

  // 8. Validate Batch Size Cap (items ≤ 50)
  if (payload.items.length > MAX_ITEMS_PER_BATCH) {
    logProxyAudit({ statusCode: 400, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      {
        error: `Batch exceeds maximum cap of ${MAX_ITEMS_PER_BATCH} items. Received ${payload.items.length}.`,
        code: 'BATCH_SIZE_EXCEEDED',
      },
      400,
      corsHeaders
    );
  }

  // 9. Validate Per-Item Text Length Cap (≤ 4,000 characters per item text)
  const offendingItem = payload.items.find((item) => item.text && item.text.length > PER_ITEM_TEXT_CAP);
  if (offendingItem) {
    logProxyAudit({ statusCode: 400, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      {
        error: `Item text exceeds maximum cap of ${PER_ITEM_TEXT_CAP} characters (feedback_id: ${offendingItem.feedback_id}).`,
        code: 'ITEM_TEXT_LENGTH_EXCEEDED',
      },
      400,
      corsHeaders
    );
  }

  // 10. Model Locking & Secret Isolation (Model from AI_MODEL env ONLY; Key from AI_API_KEY env ONLY)
  // Strictly ignore any 'model' or 'key' parameter submitted in the client request body
  const modelId = env?.AI_MODEL ?? process.env.AI_MODEL ?? 'gemini-3.5-flash';
  const apiKey = env?.AI_API_KEY ?? process.env.AI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    logProxyAudit({ statusCode: 500, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'AI inference service is unconfigured on the server.', code: 'API_KEY_UNCONFIGURED' },
      500,
      corsHeaders
    );
  }

  // 11. Forward to AI Provider (Google AI Studio / Gemini generateContent)
  const systemPrompt = `You are Sift's executive customer feedback clustering engine.
Analyze the following batch of customer feedback items and group them into coherent thematic problem clusters.
Strict requirements:
1. Each cluster must have: cluster_id ("CLUST-01", etc.), cluster_title, canonical_category, problem_summary, root_cause_hypothesis, severity_rating (1: minor, 2: major, 3: blocker), member_feedback_ids (array of feedback_ids), and quotes.
2. Every quote must have: feedback_id and quote_snippet.
3. CRITICAL: quote_snippet MUST be an EXACT VERBATIM SUBSTRING of the source feedback row text. Do not rephrase, summarize, or alter even a single character.`;

  const userContent = JSON.stringify({
    batch_index: payload.batch_index,
    total_batches: payload.total_batches,
    items: payload.items.map((i) => ({
      feedback_id: i.feedback_id,
      text: i.text,
      tier: i.tier || 'UNKNOWN',
    })),
  });

  const geminiPayload = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nFEEDBACK DATA BATCH:\n${userContent}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  };

  const providerUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  let providerResponse: Response;
  try {
    providerResponse = await customFetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
    });
  } catch {
    logProxyAudit({ statusCode: 502, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Upstream connection failure while contacting AI provider.', code: 'UPSTREAM_NETWORK_FAILURE' },
      502,
      corsHeaders
    );
  }

  // Handle upstream HTTP rate limits (429) and server errors
  if (providerResponse.status === 429) {
    const upstreamRetryAfter = providerResponse.headers.get('retry-after') || '60';
    logProxyAudit({ statusCode: 429, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Upstream AI provider rate limit reached.', code: 'UPSTREAM_RATE_LIMIT' },
      429,
      corsHeaders,
      { 'Retry-After': upstreamRetryAfter }
    );
  }

  if (!providerResponse.ok) {
    logProxyAudit({
      statusCode: providerResponse.status >= 500 ? 502 : 500,
      batchIndex,
      itemCount,
      durationMs: Date.now() - startTime,
    });
    return jsonResponse(
      { error: 'Upstream AI provider returned an operational error.', code: 'UPSTREAM_ERROR' },
      providerResponse.status >= 500 ? 502 : 500,
      corsHeaders
    );
  }

  // Parse upstream candidate JSON
  let providerData: any;
  try {
    providerData = await providerResponse.json();
  } catch {
    logProxyAudit({ statusCode: 502, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Failed to parse upstream AI response as JSON.', code: 'UPSTREAM_PARSE_ERROR' },
      502,
      corsHeaders
    );
  }

  const candidateText = providerData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText || typeof candidateText !== 'string') {
    logProxyAudit({ statusCode: 502, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Upstream AI provider returned an empty or invalid content payload.', code: 'UPSTREAM_EMPTY_CONTENT' },
      502,
      corsHeaders
    );
  }

  let parsedOutput: any;
  try {
    parsedOutput = JSON.parse(candidateText);
  } catch {
    logProxyAudit({ statusCode: 502, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Upstream AI provider structured text could not be parsed as JSON.', code: 'UPSTREAM_MALFORMED_OUTPUT' },
      502,
      corsHeaders
    );
  }

  // 12. Validate Upstream Response against PRD §5.3 Schema
  const isOutputValid = validateClusterResponse(parsedOutput);
  if (!isOutputValid) {
    logProxyAudit({ statusCode: 502, batchIndex, itemCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Upstream AI provider output failed PRD §5.3 schema validation.', code: 'UPSTREAM_SCHEMA_VIOLATION' },
      502,
      corsHeaders
    );
  }

  // 13. Return Validated Clusters (Zero Key Echo, Sanitized Headers)
  logProxyAudit({ statusCode: 200, batchIndex, itemCount, durationMs: Date.now() - startTime });
  return jsonResponse(
    { clusters: parsedOutput.clusters },
    200,
    corsHeaders
  );
}
