# DECISIONS — SIFT

**Purpose:** Record all architectural, product, and process decisions made during implementation.  
**Source of truth for locked decisions:** MDD v2.0.1 Section 6.1 and PRD v2.0 Section 15.1.

---

## Locked Decisions (from MDD v2.0.1 & PRD v2.0)

These decisions are **frozen** and must not be reopened without explicit founder authority.

| Decision ID | Summary | Status | Authority |
|:---|:---|:---|:---|
| **DEC-001** | Ephemeral browser-local CSV parsing; no persistent SQL/NoSQL database in MVP | Approved — Locked | MDD v2.0.1 / Founder |
| **DEC-002** | 3-parameter scoring model (40% Impact / 40% Frequency / 20% Severity) with live sliders | Approved — Locked | MDD v2.0.1 / Founder |
| **DEC-003** | Missing customer tier/ARR classified as `UNKNOWN` (1.0x weight multiplier — not $0 or Free) | Approved — Locked | MDD v2.0.1 / Review Board |
| **DEC-004** | Exact client-side substring verification for all verbatim quote receipts | Approved — Locked | MDD v2.0.1 / Review Board |
| **DEC-005** | Include `[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]` placeholders in Engineering Specs | Approved — Locked | MDD v2.0.1 / Founder |
| **DEC-006** | No live write-back integrations (Jira, Linear, Intercom) in MVP scope | Approved — Locked | MDD v2.0.1 / Founder |
| **DEC-007** | Cloud AI transmission disclosed in UI; private API keys prohibited from client JS bundle | Approved — Locked | MDD v2.0.1 / Review Board |
| **DEC-008** | Serverless proxy for AI key protection (stateless, zero payload logging) | Confirmed — Locked | PRD v2.0 / v1.2.1 |
| **DEC-009** | Two-pass conservative cross-batch reconciliation pipeline | Confirmed — Locked | PRD v2.0 / v1.2.1 |
| **DEC-010** | Matrix plot coordinates (I_n, F_n) remain fixed when sliders move — only card ranking updates | Approved — Locked | MDD v2.0.1 |

## Open Decisions (Pending Founder Input)

| Decision ID | Summary | Options | Needs By |
|:---|:---|:---|:---|
| **OPT-001** | Serverless proxy hosting platform | RESOLVED by DEC-STACK (Cloudflare Workers Free Tier) | Resolved 2026-10-09 |
| **OPT-002** | AI inference provider & model | RESOLVED by DEC-PROVIDER (Google AI Studio / `gemini-3.5-flash`) | Resolved 2026-10-09 |

## Superseded Decisions

| Superseded Proposal | Replaced By | Reason |
|:---|:---|:---|
| Per-cluster dynamic weight redistribution | Unified Global Comparability Policy (DEC-002) | Prevented score distortion across workspace |
| Auto-coerce missing metadata to `$0` or `Free` | DEC-003 (UNKNOWN isolation) | Distorts score distribution; misrepresents unsegmented accounts |
| Dynamic matrix dot movement on slider drag | DEC-010 (fixed coordinates) | Matrix coordinates reflect physical metrics, not priority weights |
| Direct client-side embedding of API keys | DEC-008 (serverless proxy) | Security violation |
| Persistent local storage / database caching | DEC-001 (ephemeral memory) | Eliminates database cost and privacy risk |

## Implementation Decisions (Sprint Log)

*(Decisions made during coding sprints are logged here with date and rationale.)*

| Date | Task | Decision | Rationale |
|:---|:---|:---|:---|
| 2026-10-09 | AG-PF-00 | Source `.txt` files remain at workspace root (read-only); `docs/source/` directory created as reserved mount point | Task requires never editing source docs; files kept at root; docs/source reserved for future reference |
| 2026-10-09 | AG-PF-03 | **DEC-PF03** (Status: APPROVED) — Founder approved Option B fallback for AG-PF-03. Browser automation tool is NOT AVAILABLE due to Playwright driver CDN HTTP 404. Approved fallback: manual founder inspection checklist for all visual QA gates (M1-C, M4). No claim of automated browser QA will be made. | Antigravity IDE browser tool fails to acquire `playwright-1.57.0-win32_x64.zip` from Microsoft/Akamai/Verizon CDNs (HTTP 404). Option B approved to avoid blocking sprint while maintaining visual QA rigor via manual founder testing. |
| 2026-10-09 | AG-ARCH-02 | **DEC-STACK (APPROVED)** — Founder approved full technology stack proposal: Vite + React + TypeScript + Cloudflare Workers / Pages (Status: APPROVED). | Formally approved by founder following AG-ARCH-01 evaluation. Rescored matrix: Cloudflare 33/35 vs Vercel 23/35. Zero additional cost, commercial use permitted, native rate-limiting, and unbounded network wait. |
| 2026-10-09 | AG-AI-04 | **DEC-PROVIDER (APPROVED)** — Approved AI inference provider (`Google AI Studio`) and model (`gemini-3.5-flash`). Zero billing confirmed, schema valid, capacity qualified (Gate G-AI4 passed). UI disclosure text drafted. | Live verification TS-018 passed (HTTP 200, Ajv valid on PRD §5.3 schema, 6/6 burst 0x 429). Free-tier allowances fit 300-row baseline (1% RPD) and 2,000-row maximum (5.2% RPD). Model ID read dynamically from env `AI_MODEL`. |

---

### DEC-STACK (APPROVED) — Technology Stack Specification

- **Decision ID:** `DEC-STACK (APPROVED)`
- **Status:** APPROVED
- **Date:** 2026-10-09
- **Founder Decision:** `"A — I accept DEC-STACK as proposed (Vite + React + TypeScript + Cloudflare Workers / Pages)"`
- **Chosen Frontend:** React SPA with Vite
- **Language:** TypeScript
- **Test Runner:** Vitest
- **Serverless Proxy Host:** Cloudflare Workers (Free Tier)
- **Static Hosting:** Cloudflare Pages (Free Tier)
- **Browser-Test Method:** Manual founder inspection checklist fallback (`DEC-PF03`)
- **Package Manager:** npm (v11.19.0 verified in `AG-PF-02`)
- **CSV Parser:** PapaParse
- **Schema Validator:** ajv
- **Explicitly Rejected / Not Used:**
  - **Vercel Functions:** Commercial use restriction on Hobby tier (requires $20/seat/mo Pro plan) and lack of free native IP rate limiting.
  - **Netlify:** Deploy credit pool constraint (300 credits/mo shared budget; 15 credits per production deploy caps active deploys to ~20/mo).
  - **Next.js:** SSR unnecessary for ephemeral client app (`DEC-001`, `DEC-008`).
  - **Firebase / Supabase:** Persistent database prohibited by `DEC-001`.

---

### DEC-PROVIDER (APPROVED) — AI Inference Provider, Model & Privacy Specification

- **Decision ID:** `DEC-PROVIDER (APPROVED)`
- **Status:** APPROVED
- **Date:** 2026-10-09
- **Provider:** Google AI Studio (Google Cloud Platform)
- **Exact Model ID:** `gemini-3.5-flash`
  - *Dynamic Configuration Rule:* The model ID is read exclusively from the environment variable `AI_MODEL` (configured in `.env` for local testing and Cloudflare Worker secrets for production proxy). It is **never hard-coded** anywhere in client application or serverless proxy source code.
- **Account Tier:** Free Tier
- **Billing State:** `billing=none` (Explicitly verified via founder console GUI audit; zero credit card required or linked).
- **Quota Limits:** Standard Google AI Studio Free Tier limits:
  - Requests Per Minute: 15 RPM
  - Tokens Per Minute: 1,000,000 TPM
  - Requests Per Day: 1,500 RPD
- **Capacity Qualification Decision:**
  - **300-Row Baseline (P0 MVP):** **FIT — APPROVED**. Consumes 11 nominal calls (~15 with $1.3\times$ retries) $\approx 1.0\%$ of daily RPD quota, ~138k tokens, ~5 min sequential runtime.
  - **2,000-Row Maximum Ceiling:** **FIT — APPROVED**. Consumes 60 nominal calls (~78 with $1.3\times$ retries) $\approx 5.2\%$ of daily RPD quota, ~832k tokens, ~28 min sequential runtime.
- **Structured-Output Method Used:**
  - REST endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`
  - Generation configuration: `responseMimeType: "application/json"`, validated upstream by Ajv against literal Draft-07 schema URI `http://json-schema.org/draft-07/schema#` (`IC-004`).
- **Cluster Quality Notes:**
  - In live benchmark testing (`fixtures/synthetic_50.csv`), `gemini-3.5-flash` extracted 8 crisp thematic clusters (`CLUST-01` to `CLUST-08`) with 100% exact verbatim quotes from source text and accurate severity classifications (1 minor to 3 blocker).
- **Pacing Parameters & Rate Limiting:**
  - Serverless proxy enforces strict rate throttling of **10 RPM/IP** ($\ge 6\text{s}$ spacing between calls per `PRD §9.3`).
  - Sequential processing latency (~32s per 50-row batch) naturally throttles execution to $\sim 1.8\text{ RPM}$, providing $>80\%$ margin under both the 10 RPM proxy limit and the 15 RPM provider limit.
- **Retry & Error Recovery Policy:**
  - Transient HTTP 429 and 503 errors trigger exponential backoff ($2^n \times 1000\text{ms} + \text{jitter}$) up to a maximum of 3 retries per batch call (`PRD §5.8`).
- **Quota Exhaustion Fallback (`IC-015`):**
  - Per `IC-015`, do **NOT** invent a local AI fallback (e.g. on-device WebLLM).
  - If the cloud AI quota is exhausted or permanently fails after 3 retries, Sift routes unprocessed rows to the `Unclustered Feedback` bucket (`CLUST-UNC`, $S_c = 1, P_c = 0$) and renders raw unclustered feedback with an explanatory warning banner: *"Analysis degraded: AI provider quota reached. Displaying raw feedback."*

#### Mandatory UI Privacy Disclosure Text

To satisfy `PRD §11.3`, `DEC-007`, and `IC-011`, the following disclosure text will be rendered visibly in the Ingestion Dropzone and Settings Drawer of the application before any user submits feedback data for clustering:

> **Data Privacy Notice:**
> *"Selected feedback text is sent through Sift's server proxy to a third-party cloud AI provider for analysis. Do not upload data you are not allowed to share. Sift's code does not intentionally log feedback text."*

#### Provider-Side Terms & Retention Disclosure

- Sift's proxy enforces **zero payload logging** on its own infrastructure (`IC-011`).
- Upstream provider-side data retention, processing, and potential model training terms are governed solely by the provider's terms of service:
  - Google AI Studio Terms of Service: [https://ai.google.dev/terms](https://ai.google.dev/terms) (Status: `UNVERIFIED` until founder reviews).
  - Google Generative AI Additional Terms of Service: [https://policies.google.com/terms](https://policies.google.com/terms).

---

*Governed by AGENTS.md Standing Contract. Any decision overriding a Locked entry requires founder approval and a new row in this log.*

