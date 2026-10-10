/**
 * api/reconcile.ts — Secure Serverless Theme Reconciliation Proxy Endpoint (POST /api/reconcile)
 * Governed by PRD REQ-006, §5.4–5.6, REQ-013, IC-003, IC-004, IC-010, IC-011; DEC-PROVIDER.
 *
 * Security & Reliability Controls:
 * 1. Method & Content-Type validation (POST only, application/json only).
 * 2. Origin hygiene check against ALLOWED_ORIGIN (IC-010).
 * 3. Rate limiting: platform-native binding with 10 RPM instance-local fallback (PRD §9.3).
 * 4. Payload size limit: total payload ≤ 2 MB (HTTP 413).
 * 5. Request schema validation via Ajv using literal Draft-07 URI (IC-004).
 * 6. Model locking: AI_MODEL read exclusively from server env (TS-023).
 * 7. Secret isolation: AI_API_KEY read exclusively from server env, never echoed (TS-023).
 * 8. Zero-Payload Logging: logs only status code, cluster count, duration; never summaries (TS-022 / IC-011).
 * 9. Upstream response validation against RECONCILE_RESPONSE_SCHEMA (Draft-07, IC-003).
 */

import {
  MAX_PAYLOAD_BYTES,
  ReconcileRequestPayload,
  validateReconcileRequest,
  validateReconcileResponse,
  GEMINI_RECONCILE_RESPONSE_SCHEMA,
} from './schemas';
import { checkRateLimit } from './rateLimiter';
import { logProxyAudit } from './logger';

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
 * Handles incoming requests for POST /api/reconcile.
 */
export async function handleReconcileRequest(
  request: Request,
  env?: Record<string, any>,
  customFetch: typeof fetch = fetch
): Promise<Response> {
  const startTime = Date.now();
  let clusterCount = 0;

  // 1. Browser-Origin Hygiene check against ALLOWED_ORIGIN env (IC-010)
  const origin = request.headers.get('origin');
  const allowedOriginEnv =
    env?.ALLOWED_ORIGIN ?? process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173';
  const allowedOrigins = allowedOriginEnv
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean);

  let corsHeaders: Record<string, string> = {};

  if (origin) {
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    if (!isAllowed) {
      logProxyAudit({ statusCode: 403, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
      return jsonResponse({ error: 'Forbidden: Origin not allowed', code: 'ORIGIN_FORBIDDEN' }, 403);
    }
    corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
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
    logProxyAudit({ statusCode: 405, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
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
    logProxyAudit({ statusCode: 415, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Unsupported Media Type. Content-Type must be application/json.', code: 'UNSUPPORTED_MEDIA_TYPE' },
      415,
      corsHeaders
    );
  }

  // 4. Validate Payload Size Limit (≤ 2 MB)
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const parsedLength = parseInt(contentLengthHeader, 10);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_PAYLOAD_BYTES) {
      logProxyAudit({ statusCode: 413, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
      return jsonResponse(
        { error: 'Payload Too Large. Maximum allowed request size is 2 MB.', code: 'PAYLOAD_TOO_LARGE' },
        413,
        corsHeaders
      );
    }
  }

  let rawBodyText: string;
  try {
    rawBodyText = await request.text();
  } catch {
    logProxyAudit({ statusCode: 400, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
    return jsonResponse({ error: 'Failed to read request body.', code: 'INVALID_BODY' }, 400, corsHeaders);
  }

  const actualByteLength = new TextEncoder().encode(rawBodyText).length;
  if (actualByteLength > MAX_PAYLOAD_BYTES) {
    logProxyAudit({ statusCode: 413, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
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
    logProxyAudit({ statusCode: 429, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: `Rate limit exceeded. Please retry after ${retrySec} seconds.`, code: 'RATE_LIMIT_EXCEEDED' },
      429,
      corsHeaders,
      { 'Retry-After': String(retrySec) }
    );
  }

  // 6. Parse JSON Payload
  let payload: ReconcileRequestPayload;
  try {
    payload = JSON.parse(rawBodyText);
  } catch {
    logProxyAudit({ statusCode: 400, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
    return jsonResponse({ error: 'Malformed JSON in request body.', code: 'MALFORMED_JSON' }, 400, corsHeaders);
  }

  // 7. Validate Body against RECONCILE_REQUEST_SCHEMA
  const isSchemaValid = validateReconcileRequest(payload);
  if (!isSchemaValid) {
    const errorDetails = validateReconcileRequest.errors
      ?.map((err) => `${err.instancePath || 'root'} ${err.message}`)
      .join('; ');
    logProxyAudit({ statusCode: 400, batchIndex: -2, itemCount: 0, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: `Invalid request payload: ${errorDetails || 'Schema mismatch'}`, code: 'SCHEMA_VALIDATION_FAILED' },
      400,
      corsHeaders
    );
  }

  clusterCount = payload.clusters.length;

  // 8. Model Locking & Secret Isolation (Model from AI_MODEL env ONLY; Key from AI_API_KEY env ONLY)
  const modelId = env?.AI_MODEL ?? process.env.AI_MODEL ?? 'gemini-3.5-flash';
  const apiKey = env?.AI_API_KEY ?? process.env.AI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    logProxyAudit({ statusCode: 500, batchIndex: -2, itemCount: clusterCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'AI inference service is unconfigured on the server.', code: 'API_KEY_UNCONFIGURED' },
      500,
      corsHeaders
    );
  }

  // 9. Forward to Upstream AI Provider (Google AI Studio / Gemini generateContent)
  const systemPrompt = `You are Sift's executive feedback reconciliation engine.
Analyze the following thematic problem clusters within the canonical category: "${payload.canonical_category}".
Your goal is to reconcile cross-batch clusters conservatively.
For pairs or sets of clusters in this category:
1. Determine the appropriate action:
   - "MERGE": The clusters describe the exact same underlying issue. Merge them into a single coherent cluster.
   - "KEEP_SEPARATE": The clusters describe distinct, independent issues that must not be merged.
   - "UNCERTAIN": The clusters exhibit thematic overlap, but ambiguity exists regarding whether they represent the same root cause. Human review is recommended.
2. For each evaluated group of cluster_ids, provide:
   - cluster_ids: Array of cluster_id strings being evaluated (minimum 2 IDs).
   - action: "MERGE" | "KEEP_SEPARATE" | "UNCERTAIN".
   - rationale: A concise, plain-language explanation of why this action was decided.
   - If action is "MERGE": provide merged_cluster_title, merged_problem_summary, and merged_root_cause_hypothesis.
3. Strict rule: Do NOT compute or return numeric similarity values. Return only the three explicit actions: MERGE, KEEP_SEPARATE, or UNCERTAIN.`;

  const userContent = JSON.stringify({
    canonical_category: payload.canonical_category,
    clusters: payload.clusters.map((c) => ({
      cluster_id: c.cluster_id,
      cluster_title: c.cluster_title,
      problem_summary: c.problem_summary,
      root_cause_hypothesis: c.root_cause_hypothesis,
      severity_rating: c.severity_rating,
      quote_feedback_ids: c.quote_feedback_ids || [],
    })),
  });

  const geminiPayload = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nCANDIDATE CLUSTERS FOR RECONCILIATION:\n${userContent}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RECONCILE_RESPONSE_SCHEMA,
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
    logProxyAudit({ statusCode: 502, batchIndex: -2, itemCount: clusterCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Upstream connection failure while contacting AI provider.', code: 'UPSTREAM_NETWORK_FAILURE' },
      502,
      corsHeaders
    );
  }

  // Handle upstream HTTP rate limits (429) and server errors
  if (providerResponse.status === 429) {
    const upstreamRetryAfter = providerResponse.headers.get('retry-after') || '60';
    logProxyAudit({ statusCode: 429, batchIndex: -2, itemCount: clusterCount, durationMs: Date.now() - startTime });
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
      batchIndex: -2,
      itemCount: clusterCount,
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
    logProxyAudit({ statusCode: 502, batchIndex: -2, itemCount: clusterCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Failed to parse upstream AI response as JSON.', code: 'UPSTREAM_PARSE_ERROR' },
      502,
      corsHeaders
    );
  }

  const candidateText = providerData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText || typeof candidateText !== 'string') {
    logProxyAudit({ statusCode: 502, batchIndex: -2, itemCount: clusterCount, durationMs: Date.now() - startTime });
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
    logProxyAudit({ statusCode: 502, batchIndex: -2, itemCount: clusterCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Upstream AI provider structured text could not be parsed as JSON.', code: 'UPSTREAM_MALFORMED_OUTPUT' },
      502,
      corsHeaders
    );
  }

  // 10. Validate Upstream Response against RECONCILE_RESPONSE_SCHEMA
  const isOutputValid = validateReconcileResponse(parsedOutput);
  if (!isOutputValid) {
    logProxyAudit({ statusCode: 502, batchIndex: -2, itemCount: clusterCount, durationMs: Date.now() - startTime });
    return jsonResponse(
      { error: 'Upstream AI provider output failed reconciliation schema validation.', code: 'UPSTREAM_SCHEMA_VIOLATION' },
      502,
      corsHeaders
    );
  }

  // 11. Return Validated Decisions (Zero Key Echo, Sanitized Headers)
  logProxyAudit({ statusCode: 200, batchIndex: -2, itemCount: clusterCount, durationMs: Date.now() - startTime });
  return jsonResponse({ decisions: parsedOutput.decisions }, 200, corsHeaders);
}
