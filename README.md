# SIFT — Deterministic Customer Feedback Synthesis Workspace

> **Transform unstructured qualitative feedback into prioritized, executive-ready engineering deliverables with mathematical precision and zero hallucinations.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Tests: 208/208 PASS](https://img.shields.io/badge/Tests-208%2F208%20PASS-brightgreen.svg)](docs/TEST_RESULTS.md)
[![Live Production](https://img.shields.io/badge/Cloudflare_Pages-LIVE%20(₹0)-success.svg)](https://sift-0r0.pages.dev)
[![Milestone: release-1](https://img.shields.io/badge/Release-release--1-blueviolet.svg)](#release)

**Live Production Deployment:** [https://sift-0r0.pages.dev](https://sift-0r0.pages.dev)  
**GitHub Repository:** [https://github.com/thetejasshrivas/sift](https://github.com/thetejasshrivas/sift)  
**Operating Budget:** **₹0 / $0.00** (Strictly zero paid infrastructure or billing).

---

## 1. What Sift Is vs. What Sift Is Not

| What Sift IS | What Sift IS NOT |
|:---|:---|
| **Ephemeral In-Memory Synthesis Workspace:** Parses CSV feedback rows entirely in client-side browser memory (`DEC-001`). No data persists after the browser tab is closed. | **NOT a CRM or Database:** Zero persistent SQL/NoSQL storage, zero database caching, zero analytics trackers, and zero server-side state. |
| **Deterministic Mathematical Prioritization:** Computes priority scores ($P_c$) via pure deterministic functions balancing Impact ($I_n$), Frequency ($F_n$), and Severity ($S_n$) with reactive 60-FPS sliders (`REQ-008`, `REQ-009`). | **NOT an Autonomous Decider:** AI does **not** decide feature priority. Humans control priority weights dynamically; the math computes rankings deterministically. |
| **Verbatim Quote Verification Engine:** Verifies customer quote receipts via strict exact-substring matching (`IC-001`). Paraphrased or altered text is flagged and excluded from deliverables. | **NOT a Financial / ARR Accounting Tool:** Customer tier weights (`Enterprise 3.0`, `Pro 2.0`, `Free/UNKNOWN 1.0`) are **relative priority proxies**, strictly never actual ARR or dollar figures (`IC-002`). |
| **Dual-View Workspace:** 2×2 priority matrix scatterplot paired with badged ranked problem cards and an accessible deep-dive drawer (`REQ-010`, `REQ-011`). | **NOT a Live Project Management Sync:** Does not write back directly to Jira, Linear, or Slack in P0 scope (deferred to P1/P2). |
| **5-Tier Decoupled Action Output Generator:** Generates executive PM Strategic Trade-Off Rationales and Engineering Specs with explicit missing-context warnings (`REQ-012`, `DEC-005`). | **NOT a Hallucinated Spec Writer:** Technical solutions and acceptance criteria are explicitly marked *Candidate — AI-drafted* and require human engineering confirmation. |

---

## 2. The Role of AI in Sift

Sift applies AI strictly as a **bounded semantic extraction worker** under rigorous security, schema, and privacy guardrails:

1. **Pass 1 — Batch Extraction:** Dispatches raw feedback rows in bounded batches of 50 items through a secure serverless proxy. The AI extracts candidate problem clusters, category classifications, and initial severity ratings (1 to 3).
2. **Schema Enforcement:** Every upstream response is strictly validated against PRD §5.3 JSON Schema Draft-07 (`http://json-schema.org/draft-07/schema#`, `IC-004`). Malformed responses trigger sanitized errors and automatic retries.
3. **Pass 2 — Conservative Reconciliation:** Detects cross-batch semantic duplicates across identical categories, returning only three strict decisions: `MERGE`, `KEEP_SEPARATE`, or `UNCERTAIN` (`IC-003`). Uncertain clusters are isolated into `CLUST-UNC` for human review.
4. **Hypothesis vs. Fact Decoupling:** AI-drafted root-cause hypotheses are clearly segregated from factual, verbatim customer quotes (`DEC-005`). If source feedback lacks technical context, Sift injects `[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]`.

---

## 3. Mandatory Data Privacy Notice

To satisfy `PRD §11.3`, `DEC-007`, and `IC-011`, the following disclosure text is displayed in the application prior to ingestion:

> **Data Privacy Notice:**  
> *"Selected feedback text is sent through Sift's server proxy to a third-party cloud AI provider for analysis. Do not upload data you are not allowed to share. Sift's code does not intentionally log feedback text."*

### Zero-Payload Logging Policy (`IC-011` / `TS-022`)
- The serverless proxy records **zero persistent request payload logs**.
- Application logs contain only operational telemetry: HTTP status code, `batch_index`, item count, and latency in milliseconds.
- Customer identifiers, account names, and feedback text are **never logged**.

---

## 4. Architecture & Security Controls

```
[ Browser Client: React SPA ]
             │
             │ HTTPS (POST /api/cluster, /api/reconcile)
             ▼
[ Cloudflare Pages Functions (Edge Proxy) ]
  ├── Browser-Origin Hygiene (ALLOWED_ORIGIN)
  ├── 2 MB Payload Ceiling (HTTP 413)
  ├── 50 Items / Batch Cap & 4,000 Chars / Item Cap
  ├── Native Rate Limiting (10 RPM/IP)
  ├── Zero-Payload Logging (TS-022)
  ├── Zero Secret Echo (TS-023)
  └── Model Locking (AI_MODEL)
             │
             │ HTTPS (REST API + Secret AI_API_KEY)
             ▼
[ Google AI Studio (gemini-3.5-flash-lite) ]
```

### Rate Limiting Architecture & Limitations
- **Proxy Rate Throttling:** The serverless proxy enforces a rate limit of **10 RPM per IP** with sequential batch pacing ($\ge 6\text{s}$ spacing between calls per `PRD §9.3`).
- **Provider Free-Tier Quota:** Google AI Studio allows 15 RPM, 1,000,000 TPM, and 1,500 RPD under zero active billing (`billing=none`).
- **Edge Instance-Local Limitation:** In serverless runtimes without global state synchronization, fallback rate-limiting counters operate per isolate. In production, edge rate-limiting bindings (`env.RATE_LIMITER`) provide coordinated protection.

---

## 5. Environment Variables

The serverless proxy requires the following environment variables set in the host dashboard (strictly names only — never commit values to version control):

| Variable Name | Type | Description |
|:---|:---|:---|
| `AI_API_KEY` | Secret (Encrypted) | Private API key for Google AI Studio inference. |
| `AI_MODEL` | Plain text | Qualified Gemini model ID (e.g. `gemini-3.5-flash-lite`). |
| `ALLOWED_ORIGIN` | Plain text | Allowed Origin header for CORS hygiene. |
| `RATE_LIMIT_RPM` | Plain text | Requests per minute per client IP (`10`). |
| `MAX_PAYLOAD_BYTES` | Plain text | Maximum payload size ceiling (`2097152` = 2 MB). |

---

## 6. How to Run Tests & Validate Locally

```bash
# 1. Install dependencies
npm install

# 2. Run complete test suite (208/208 tests passing)
npm test

# 3. Static type check (TypeScript strict mode)
npm run lint

# 4. Production build
npm run build

# 5. Security audit: scan working tree, git history & dist/ for leaked secrets
npm run scan:secrets

# 6. Local development server (port 5173)
npm run dev
```

---

## 7. Known Limitations & Deferred Items (P0 vs. P1 Scope)

In accordance with `IC-013` (P0 independence from P1) and the PRD Gap Register:

| Item ID | Classification | Status & Behavior in Release 1 |
|:---|:---|:---|
| **GAP-01 / GAP-07** | Contradictory Evidence | Opposing request analysis is deferred to P1. In P0 deliverables, Section 5 explicitly records: `Contradictory Evidence analysis not built in P0 (GAP-07)`. |
| **GAP-02** | Search & Filtering | P0 delivers minimal title/summary search and badge toggle filters. Multi-factor composite boolean search is deferred to P1. |
| **GAP-03** | CS Advisory View | Customer Success account advisory matrix is deferred to P1. |
| **GAP-05** | Split / Merge UI | Dynamic manual merging and splitting of thematic clusters in the UI is deferred to P1. |
| **GAP-11** | Unclustered Rows (`CLUST-UNC`) | Items that fail reconciliation or AI clustering are safely segregated into the `Unclustered Feedback` bucket ($S_c = 1, P_c = 0$) for transparent manual review. |
| **GAP-12** | Tier Conflict Coercion | Conflicting tier values for the same account ID are resolved deterministically by priority hierarchy (`Enterprise` > `Pro` > `Free` > `UNKNOWN`). |
| **GAP-15** | Matrix Coordinate Split | Quadrant boundaries are split visually at the normalized midpoint `0.5` on both axes, documented in the legend as `split at 0.5 of normalized scale`. |

---

## 8. Index of Verification Evidence Files

All architectural, visual, and network proof files are indexed in the repository:

| Milestone / Gate | Description | Location / Evidence Path |
|:---|:---|:---|
| **Milestone 1 (G-M1C)** | Ingestion UI, dropzone, schema modal, data quality warnings, responsive viewports (375/768/1280px) | [`docs/evidence/m1/`](docs/evidence/m1/) |
| **Milestone 2 (G-M2)** | Live qualification run on 300 rows (15/15 HTTP 200, 1:1 ID integrity, ₹0 spend) | [`docs/COST_LOG.md#L147-L169`](docs/COST_LOG.md#L147-L169) |
| **Milestone 3 (G-M3B)** | Stationary invariant proof, tooltip breakdown, 60-FPS re-ranking | [`docs/evidence/m3/`](docs/evidence/m3/) |
| **Milestone 4 (G-M4D)** | 2×2 priority matrix visual audit, cards, deep-dive drawer, exact quote verification, WCAG AA contrast audit across 375/768/800/1280px | [`docs/evidence/m4/`](docs/evidence/m4/) |
| **Milestone 5 (G-M5A)** | PM Strategic Trade-Off Rationale and Engineering Spec deliverables with clipboard fallback | [`docs/evidence/m5/`](docs/evidence/m5/) |
| **Deployment (G-D4)** | Live Cloudflare Pages public smoke test (`https://sift-0r0.pages.dev`), edge health probe, live bundle secret scan | [`docs/DEPLOYMENT.md#section-4`](docs/DEPLOYMENT.md#section-4) |
| **Test Matrix** | Comprehensive traceability matrix (TS-001 through TS-038) | [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) |

---

## License

MIT © 2026 SIFT Contributors. Governed by [AGENTS.md](AGENTS.md).
