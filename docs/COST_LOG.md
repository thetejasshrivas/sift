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

---

## Free-Tier Allocations Tracking

| Service | Free Tier Limit | Current Usage | Status |
|:---|:---|:---|:---|
| AI Provider (Google AI Studio: `rich-crowbar-463013-e0`) | Model: `gemini-3.5-flash`; Free tier (zero billing); ~3,083 in / 2,696 out tokens per 50-row batch | 1 batch (~13.5k tokens total) | VERIFIED LIVE (Gate G-AI2 PASSED) |
| Serverless proxy hosting (Cloudflare Workers) | 100,000 req/day; 10ms CPU/req; 128MB | 0 | APPROVED (DEC-STACK) |

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

## Candidate Hosting Platform Verified Facts (Audited 2026-10-09)

*Audited via official documentation pages for task AG-ARCH-01.*

| Candidate Host | Plan / Tier | Credit Card Required? | Commercial Use Permitted? | Function & Compute Limits | Rate-Limiting Features | Official URL & Citation Date |
|:---|:---|:---|:---|:---|:---|:---|
| **Cloudflare Workers + Pages** | Free Tier | **No** (none for core Workers / Pages) | **Yes** (commercial projects permitted on Free tier) | 100,000 req/day; 10ms CPU time/req (network I/O wait is unbounded & excluded from CPU limit); 128MB memory; 100 worker scripts | Native Rate Limiting API binding (`env.RATE_LIMITER.limit()`); edge DDoS mitigation; strict CORS headers | `https://developers.cloudflare.com/workers/platform/limits/`<br>`https://www.cloudflare.com/plans/developer-platform/`<br>(Audited: 2026-10-09) |
| **Vercel** | Hobby (Free) | **No** | **No** (strictly restricted to personal, non-commercial use under Terms of Service) | 1,000,000 invocations/mo; 4 CPU-hours/mo; 360 GB-hours memory; max duration 300s (default 10s-60s) | No native free IP rate limiting without external paid/third-party add-ons (e.g. Upstash Redis) | `https://vercel.com/pricing`<br>`https://vercel.com/docs/functions/runtimes#serverless-function-limits`<br>(Audited: 2026-10-09) |
| **Netlify** | Free | **No** | **Yes** (commercial use permitted on Free plan) | Shared pool of 300 credits/mo: 10 credits/GB-hr compute, 15 credits per production deploy (limits active testing/deploys to ~20/mo) | No native free rate-limiting; requires custom middleware or external store | `https://www.netlify.com/pricing/`<br>(Audited: 2026-10-09) |

---

## Policy Reminders

- **Never** enable billing on any service account used by this project.
- If a free-tier quota is exhausted during evaluation, STOP work and report to founder before proceeding.
- Any cost event (even Rs. 1) must be logged here immediately.
- TS-018 Step 4 explicitly verifies zero billing before the AI provider is approved.

---

*Governed by AGENTS.md Standing Contract and PRD v2.0 Section 10.4.*

