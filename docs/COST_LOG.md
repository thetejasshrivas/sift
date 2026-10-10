# COST LOG — SIFT

**Target budget:** Rs. 0 / $0.00 additional spending  
**Policy:** Zero paid services. All infrastructure on free-tier allocations only.

---

## Budget Summary

| Category | Budget | Spent | Remaining |
|:---|:---|:---|:---|
| AI / LLM API | Rs. 0 (free-tier only) | Rs. 0 | Rs. 0 |
| Hosting (static + serverless) | Rs. 0 (free-tier only) | Rs. 0 | Rs. 0 |
| Third-party services | Rs. 0 | Rs. 0 | Rs. 0 |
| **Total** | **Rs. 0** | **Rs. 0** | **Rs. 0** |

---

## Cost Events Log

*(All cost events — even zero-cost confirmations — are logged here.)*

| Date | Task | Service | Action | Cost | Notes |
|:---|:---|:---|:---|:---|:---|
| 2026-10-09 | AG-PF-00 | None | Tracking file created | Rs. 0 | No services provisioned |
| 2026-10-09 | M2-A | Cloudflare Workers Rate Limiting | Platform-native rate limit evaluation at ₹0 | Rs. 0 | Evaluated platform-native Rate Limiting API at ₹0 (included in 100k req/day free tier). Proxy code evaluates env.RATE_LIMITER at ₹0 and falls back to instance-local throttling (10 RPM) when unattached. |
| 2026-10-10 | M2-E | Google AI Studio (Free Tier) | 300-row live qualification run (15 API calls: 6 Pass-1 batches + 9 Pass-2 calls) | Rs. 0 | Consumed 43,856 total tokens (19,513 prompt, 24,343 candidate). 15/15 calls HTTP 200 OK via gemini-3.5-flash-lite. 1.0% of daily 1,500 RPD quota used. ₹0 billing verified. |

---

## Free-Tier Allocations Tracking

| Service | Free Tier Limit | Current Usage | Status |
|:---|:---|:---|:---|
| AI Provider (Google AI Studio: `rich-crowbar-463013-e0`) | Model: `gemini-3.5-flash-lite` / `gemini-3.5-flash`; Free tier (zero billing); 1,500 RPD, 1,000,000 TPM | 16 calls total (~57k tokens total across smoke + M2-E 300-row run) | VERIFIED LIVE (Gate G-M2 PASSED) |
| Serverless proxy hosting (Cloudflare Workers) | 100,000 req/day; 10ms CPU/req; 128MB | 0 | APPROVED (DEC-STACK) |
| Cloudflare Rate Limiting Binding | Native Workers Rate Limiting API included in 100k req/day quota at ₹0 | 0 | EVALUATED & SUPPORTED (M2-A) |

---

## AI Provider Account GUI Audit (AG-AI-01 / Gate G-AI1)

*Audited via cloud AI provider web console (e.g., Google AI Studio / GCP Console). Governed by IC-007 and IC-009 (billing state must be confirmed directly from console dashboard, never inferred).*

| Provider | Project | Models Visible | Tier | Limits | Billing State | Card Required? | Date Checked | Source |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Google AI Studio** | `rich-crowbar-463013-e0` | None listed in console (standard studio default pool) | Free Tier | None listed in console (standard free-tier quota applies) | `free` (None / No billing linked) | **No** | 2026-10-09 | `https://aistudio.google.com/` |

---

## Live Provider Smoke Test Results (AG-AI-02 / Gate G-AI2)

*Audited via live API execution of `scripts/provider-smoke.js` against Google AI Studio project `rich-crowbar-463013-e0` on 2026-10-09.*

| Parameter | Value |
|:---|:---|
| **Verified Live Model** | `gemini-3.5-flash` |
| **API Endpoint** | `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent` |
| **HTTP Status** | `200 OK` |
| **Batch Size Tested** | 50 rows (`fixtures/synthetic_50.csv`) |
| **Schema Validation** | **PASSED** via Ajv against PRD §5.3 Draft-07 schema (`http://json-schema.org/draft-07/schema#`) |
| **Clusters Extracted** | 8 thematic problem clusters (`CLUST-01` through `CLUST-08`) |
| **Round-Trip Latency** | 32,352 ms |
| **Prompt Tokens** | 3,083 tokens |
| **Candidates Tokens** | 2,696 tokens |
| **Total Tokens** | 13,502 tokens (including internal reasoning overhead) |
| **Error Shape Probe** | Confirmed (deliberately broken request returned HTTP 404 with standard Google API error object) |
| **Gate G-AI2 Status** | **PASSED** |

---

## Capacity Qualification for Realistic Sift Runs (AG-AI-03 / Gate G-AI3)

*Governed by PRD §5.2, §5.4, §9.3, §10.3, and IC-008. Audited on 2026-10-09 using verified `gemini-3.5-flash` benchmarks.*

### 1. Call Volume Projections
- **Pass 1 Batch Extraction:** $\text{Calls} = \lceil \text{Rows} / 50 \rceil$.
  - 300 rows (P0 baseline): 6 calls.
  - 1,000 rows (Mid-tier): 20 calls.
  - 2,000 rows (PRD maximum limit): 40 calls.
- **Pass 2 Cross-Batch Reconciliation:** $\text{Calls} \le \text{Canonical categories with } >1 \text{ batch cluster}$.
  - Real observation from 50-row fixture: 0 cross-batch duplication (single batch).
  - Multi-batch scenarios:
    - 300 rows (6 batches): 5 consolidation calls.
    - 1,000 rows (20 batches): 10 consolidation calls.
    - 2,000 rows (40 batches): 20 consolidation calls.
- **Retries Model:**
  - Expected ($1.3\times$): Accounts for occasional network hiccups or 503 demand spikes.
  - Worst-Case ($4\times$): Every call retries 3 times before failing ($1 + 3 = 4$).

### 2. Token & Latency Budget Accounting
- **Measured per Pass-1 50-row batch:** 3,083 prompt tokens + 2,696 candidate tokens = 5,779 raw tokens; 13,502 total quota tokens (including internal thinking tokens).
- **Estimated per Pass-2 consolidation call:** ~1,500 prompt tokens + ~1,000 candidate tokens $\approx 5,000$ total quota tokens.
- **Call Spacing & Proxy Limits:**
  - PRD §9.3 proxy rate limit: 10 RPM/IP $\implies \ge 6\text{s}$ spacing between calls.
  - Observed model latency: ~32.3s per 50-row batch.
  - In sequential pipelining, request rate naturally throttles to $\sim 1.8\text{ RPM}$, providing $82\%$ headroom under the 10 RPM proxy limit.

### 3. Capacity & Quota Comparison Table

| Metric / Scenario | 300 Rows (P0 Baseline) | 1,000 Rows (Mid-Tier) | 2,000 Rows (PRD Max) | Provider Free Limit | Headroom / Margin |
|:---|:---|:---|:---|:---|:---|
| **Pass-1 Calls** | 6 | 20 | 40 | — | — |
| **Pass-2 Calls** | 5 | 10 | 20 | — | — |
| **Nominal Total Calls** | 11 | 30 | 60 | — | — |
| **Expected Calls (1.3x)** | **15 calls** | **39 calls** | **78 calls** | 1,500 RPD | **95%–99% daily headroom** |
| **Worst-Case Calls (4x)** | 44 calls | 120 calls | 240 calls | 1,500 RPD | **84% daily headroom** |
| **Expected Token Load** | ~138k tokens | ~416k tokens | ~832k tokens | 1,000,000 TPM | Distributed across run |
| **Sequential Run Duration** | ~4.5–5.5 min | ~13–15 min | ~26–30 min | Unlimited conn. | Client progress required |
| **Daily Quota Consumed** | **1.0% of RPD** | **2.6% of RPD** | **5.2% of RPD** | 1,500 RPD total | Key easily accommodates test runs |

### 4. Key Contention with Testing Note
- Automated tests (Vitest) and live smoke scripts use the same project key (`rich-crowbar-463013-e0`).
- Because a full 300-row baseline run consumes only 15 calls (1% of daily limit) and test runs consume $<20$ calls, there is zero risk of daily quota exhaustion under standard development workflows.
- Recommendation: Maintain unit test mocking for standard CI, reserving live calls for smoke tests (`npm run smoke:provider`) and integration gates.

### 5. Bounded Burst Test Results (Step 3 TS-018)
- Executed `scripts/burst-test.js` against `gemini-3.5-flash`:
  - 6 consecutive sequential requests executed.
  - **Results:** 6/6 HTTP 200 OK.
  - **Rate Limits (429):** **0 encountered**.
  - **Average Latency:** 1,352 ms.
  - **Backoff Behavior:** Exponential backoff tested and verified in codebase; zero retries triggered during live burst.

### 6. Capacity Qualification Decision Table (Gate G-AI3)

| Dataset Size | Scope Status | Daily Quota Impact | Execution Feasibility | Final Decision |
|:---|:---|:---|:---|:---|
| **300 Rows** | **P0 Baseline Target** | **~1.0% RPD** (15 calls) | **~5 min duration** | **FIT — APPROVED FOR P0 MVP** |
| **1,000 Rows** | Mid-Tier Target | ~2.6% RPD (39 calls) | ~14 min duration | **FIT — SUPPORTED** |
| **2,000 Rows** | **PRD Maximum Ceiling** | **~5.2% RPD** (78 calls) | **~28 min duration** | **FIT — SUPPORTED (Requires UI batch progress indicator)** |

---

## Candidate Hosting Platform Verified Facts (Audited 2026-10-09)

*Audited via official documentation pages for task AG-ARCH-01.*

| Candidate Host | Plan / Tier | Credit Card Required? | Commercial Use Permitted? | Function & Compute Limits | Rate-Limiting Features | Official URL & Citation Date |
|:---|:---|:---|:---|:---|:---|:---|
| **Cloudflare Workers + Pages** | Free Tier | **No** (none for core Workers / Pages) | **Yes** (commercial projects permitted on Free tier) | 100,000 req/day; 10ms CPU time/req (network I/O wait is unbounded & excluded from CPU limit); 128MB memory; 100 worker scripts | Native Rate Limiting API binding (`env.RATE_LIMITER.limit()`); edge DDoS mitigation; strict CORS headers | `https://developers.cloudflare.com/workers/platform/limits/`<br>`https://www.cloudflare.com/plans/developer-platform/`<br>(Audited: 2026-10-09) |
| **Vercel** | Hobby (Free) | **No** | **No** (strictly restricted to personal, non-commercial use under Terms of Service) | 1,000,000 invocations/mo; 4 CPU-hours/mo; 360 GB-hours memory; max duration 300s (default 10s-60s) | No native free IP rate limiting without external paid/third-party add-ons (e.g. Upstash Redis) | `https://vercel.com/pricing`<br>`https://vercel.com/docs/functions/runtimes#serverless-function-limits`<br>(Audited: 2026-10-09) |
| **Netlify** | Free | **No** | **Yes** (commercial use permitted on Free plan) | Shared pool of 300 credits/mo: 10 credits/GB-hr compute, 15 credits per production deploy (limits active testing/deploys to ~20/mo) | No native free rate-limiting; requires custom middleware or external store | `https://www.netlify.com/pricing/`<br>(Audited: 2026-10-09) |

---

## Live Qualification Run Results — 300 Rows (M2-E / Gate G-M2)

*Audited via live execution of `scripts/live-qualification.js` on `fixtures/valid_300rows.csv` on 2026-10-10.*

| Parameter | Measured Value | PRD Specification & Notes |
|:---|:---|:---|
| **Active Qualified Model** | `gemini-3.5-flash-lite` | Dynamically configured via `AI_MODEL` in `.env` (DEC-PROVIDER) |
| **Dataset Tested** | `fixtures/valid_300rows.csv` | 300 rows (FB-001 to FB-300), 6 product themes |
| **Total API Calls Dispatched** | **15 calls** | 6 Pass-1 batches (50 rows/batch) + 9 Pass-2 category reconciliation calls |
| **Successful Calls (HTTP 200)** | **15/15 (100% success)** | Zero failures; zero retries required on active model |
| **Sequential Pacing** | $\ge 6.0\text{s}$ spacing | Strict 10 RPM client-side throttling enforced (DEC-PROVIDER) |
| **Thematic Clusters Formed** | **39 problem clusters** | Enriched with root-cause boundary notice (MDD §3.6) |
| **Unclustered Items (`CLUST-UNC`)** | **14 rows** | Isolated for manual review ($S=1, P=0$, GAP-11) |
| **1:1 ID Integrity Invariant** | **100% PASS** | 300/300 accounted for, 0 duplicate, 0 missing |
| **Missing-Context Flags** | **15/39 clusters flagged** | `needs_investigation=true` injected where technical context is absent |
| **Wall-Clock Duration** | **163.4s (~2.72 min)** | Well within the ~5 min target for 300-row baseline |
| **Prompt Tokens** | 19,513 tokens | Input token consumption across 15 requests |
| **Candidates Tokens** | 24,343 tokens | Structured JSON output token consumption |
| **Total Tokens (Quota)** | **43,856 tokens** | Headroom: <5% of 1,000,000 TPM limit |
| **Daily Quota Impact** | **~1.00% of 1,500 RPD** | 15 calls / 1,500 daily quota = 1.0% |
| **Total Incurred Cost** | **₹0.00 / $0.00** | Strict ₹0 budget maintained; zero billing enabled |
| **Gate G-M2 Status** | **PASSED** | Full Milestone 2 pipeline qualified live |

---

## Policy Reminders

- **Never** enable billing on any service account used by this project.
- If a free-tier quota is exhausted during evaluation, STOP work and report to founder before proceeding.
- Any cost event (even Rs. 1) must be logged here immediately.
- TS-018 Step 4 explicitly verifies zero billing before the AI provider is approved.

---

*Governed by AGENTS.md Standing Contract and PRD v2.0 Section 10.4.*

