# SIFT — Deterministic Customer Feedback Synthesis Engine

> Sift transforms unstructured qualitative customer feedback into executive-ready, revenue-weighted problem clusters with verified verbatim quotes and deterministic prioritization scores.

---

## Architecture Overview

- **Frontend:** React 18 SPA (Vite + TypeScript) with ephemeral browser-local memory model (`DEC-001`). No persistent local storage, IndexedDB, or external analytics.
- **Serverless Proxy:** Cloudflare Workers endpoint (`POST /api/cluster`, `DEC-STACK`, `DEC-008`) providing secret isolation and security hygiene between client and cloud AI provider.
- **AI Inference Provider:** Google AI Studio (`gemini-3.5-flash`, `DEC-PROVIDER`) operating under free-tier quotas (15 RPM, 1M TPM, 1,500 RPD) with zero active billing (`billing=none`).

---

## Serverless Proxy Security Controls (`POST /api/cluster`)

The serverless proxy implements strict security controls governed by PRD REQ-013, §9.2–9.3, IC-010, and IC-011:

1. **Protocol & Content-Type Enforcement:**
   - Accepts `POST` only (rejects others with `405 Method Not Allowed` and `Allow: POST`).
   - Requires `Content-Type: application/json` (rejects others with `415 Unsupported Media Type`).
2. **Payload Size Limit (`TS-016`):**
   - Maximum total payload size: **2 MB**. Requests exceeding 2 MB return `HTTP 413 Payload Too Large`.
3. **Batch and Text Length Caps:**
   - Maximum batch size: **50 items** per request (`BATCH_SIZE_EXCEEDED`).
   - Per-item text cap: **4,000 characters** per row (`ITEM_TEXT_LENGTH_EXCEEDED`). Protects against unbounded token consumption and payload abuse.
4. **Browser-Origin Hygiene (`ALLOWED_ORIGIN`):**
   - Origin header is validated against configured `ALLOWED_ORIGIN` environment variable. Unauthorized origins are rejected with `HTTP 403 Forbidden`.
   - **Important Security Note:** This check is for *browser-origin hygiene only*. CORS is NOT authentication; non-browser scripts (e.g. cURL) can forge headers.
5. **Rate Limiting Architecture & Limitations:**
   - Evaluates platform-native Cloudflare Workers rate limiting binding (`env.RATE_LIMITER.limit()`) at ₹0.
   - In environments without platform bindings (local dev, test suite), enforces best-effort instance-local sliding-window throttling (default: 10 RPM per PRD §9.3).
   - **Instance-Local Limitation:** In serverless runtimes, instance-local in-memory counters are per serverless instance / isolate and are **not globally reliable or synchronized** across multiple concurrent edge execution instances.
6. **Model Invocation Locking:**
   - Model ID is read exclusively from the server environment (`AI_MODEL`), defaulting to `gemini-3.5-flash`. Any model parameter sent in client requests is strictly ignored.
   - API key (`AI_API_KEY`) resides strictly in server environment and is never exposed in client bundles or logged.
7. **Zero-Payload Logging (`IC-011` / `TS-022`):**
   - Proxy application code logs only operational metrics: HTTP status code, `batch_index`, item count, and latency in milliseconds.
   - Request bodies, feedback text, customer identifiers, and PII are strictly never logged.
8. **Secrets Isolation & Zero Key Echo (`TS-023`):**
   - Neither response body nor response headers ever echo the API key, upstream authorization headers, or sensitive configuration values.

---

## Development & Testing

```bash
# Run unit tests
npm test

# Type check
npm run lint

# Build production bundle
npm run build

# Scan for leaked secrets
npm run scan:secrets
```
