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
| AI Provider (TBD — pending TS-018) | Unknown until verified | 0 | REQUIRES VERIFICATION |
| Serverless proxy hosting (TBD — OPT-001) | Sourced facts recorded below | 0 | PENDING FOUNDER DECISION |

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

