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
| 2026-10-09 | M2-A | **DEC-PROXY (IMPLEMENTED)** — Serverless proxy security controls, rate limiting, and origin hygiene. | Implemented POST /api/cluster: method/content-type validation, PRD §9.2 request schema, PRD §5.3 response schema, 2MB payload cap (TS-016), max 50 items/batch, per-item text cap (4,000 chars), ALLOWED_ORIGIN browser hygiene (IC-010), platform-native rate limiting check at ₹0 with instance-local 10 RPM fallback, model locking (AI_MODEL), zero payload logging (TS-022), and zero secret echo (TS-023). |
| 2026-10-10 | M2-E | **DEC-M2E (QUALIFIED)** — Live end-to-end qualification run on `fixtures/valid_300rows.csv`. | Executed 6 Pass-1 batches (50 rows/batch, 6s pacing) + 9 Pass-2 category reconciliation calls via active qualified model `gemini-3.5-flash-lite`. 15/15 calls HTTP 200 (100% success), 39 thematic clusters formed, 14 unclustered items (CLUST-UNC), 100% 1:1 ID integrity invariant verified, 43,856 total tokens, ~1% daily RPD quota used. Gate G-M2 PASSED. |
| 2026-10-10 | M4-C | **DEC-VERIFY (IMPLEMENTED)** — Exact substring quote verification engine; IC-001 overrides PRD REQ-011 .trim() and case-insensitivity option. | IC-001 takes precedence over PRD REQ-011 in Source Authority Hierarchy (Section 1). Verification requires snippet.length > 0 and rawText.includes(snippet) with strictly no trimming, case-folding, or fuzzy matching. Diagnostic near-matches show "Near Match / Normalized — Not Verbatim Verified" in distinct non-green styling (never using 'Verified' alone). Missing Feedback IDs display "Source row not found". Action outputs strictly filter to verified quotes only. |

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
- **Exact Model ID:** `gemini-3.5-flash` / `gemini-3.5-flash-lite` (Active qualified model for M2-E live qualification run)
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

### DEC-PROXY (IMPLEMENTED) — Serverless Proxy Security Controls, Rate Limiting & Origin Hygiene

- **Decision ID:** `DEC-PROXY`
- **Status:** IMPLEMENTED
- **Date:** 2026-10-09
- **Endpoint:** `POST /api/cluster`
- **Browser-Origin Hygiene Policy (`ALLOWED_ORIGIN`):**
  - Origin headers are checked against the `ALLOWED_ORIGIN` environment variable (defaults to `http://localhost:5173,http://127.0.0.1:5173`).
  - Requests with unrecognized origins are rejected with `HTTP 403 Forbidden` (`ORIGIN_FORBIDDEN`).
  - **Explicit Architectural Documentation:** This check constitutes **browser-origin hygiene only**. CORS is **NOT** authentication; non-browser scripts and cURL can freely forge request headers.
- **Rate Limiting Architecture & Serverless Limitation (`IC-010`):**
  - Evaluates platform-native Cloudflare Workers rate limiting binding (`env.RATE_LIMITER.limit()`) at ₹0 (included within the 100,000 req/day free tier).
  - In environments without platform bindings (local development, vitest execution, or non-Cloudflare runtimes), the proxy enforces best-effort instance-local sliding-window throttling (default: 10 RPM / IP per `PRD §9.3`).
  - **Explicit Operational Limitation:** Counters in the instance-local fallback are maintained in-memory per serverless instance / isolate. They are **not globally reliable or synchronized** across multiple concurrent edge execution instances.
- **Payload & Batch Caps:**
  - Total payload size cap: $\le 2\text{ MB}$ (`MAX_PAYLOAD_BYTES = 2097152`). Payloads exceeding 2 MB return `HTTP 413 Payload Too Large` (`TS-016`).
  - Batch item cap: $\le 50$ items per request (`MAX_ITEMS_PER_BATCH = 50`).
  - Per-item text cap: $\le 4,000$ characters per feedback row (`PER_ITEM_TEXT_CAP = 4000`), protecting upstream token budgets.
- **Model Locking & Secret Protection (`TS-023`):**
  - Model ID is read exclusively from the server environment variable `AI_MODEL` (`gemini-3.5-flash`), strictly ignoring any model parameter provided in client payloads.
  - API key is loaded exclusively from `AI_API_KEY` on the server.
  - The proxy strictly never echoes keys or authorization headers in response payloads or headers.
- **Zero-Payload Logging (`IC-011` / `TS-022`):**
  - Application code strictly logs only non-PII operational metrics: status code, `batch_index`, item count, and latency in milliseconds.
  - Feedback text, customer identifiers, and raw payloads are never logged.

---

### DEC-VERIFY (IMPLEMENTED) — Exact Substring Quote Verification Engine & Override Specification

- **Decision ID:** `DEC-VERIFY`
- **Status:** IMPLEMENTED
- **Date:** 2026-10-10
- **Governing Directives:** PRD REQ-011, §7.1, TS-005; MDD §3.7; IC-001; Part VII TS-005/005b.
- **Hierarchy Override Resolution (AGENTS.md Section 1):**
  - PRD REQ-011 contemplated `.trim()` and a case-insensitive matching option.
  - Under Section 1 Source Authority Hierarchy, **Implementation Clarification IC-001 (Priority 3) explicitly overrides PRD REQ-011 (Priority 2)**:
    > *"Quote text displayed in evidence panels must be exact verbatim substrings of the source CSV row — no paraphrasing, no rewording, no summarisation; any non-exact match is flagged Unverified."*
- **Exact Verification Mathematical Definition:**
  $$\text{Status} = \begin{cases} \text{VERIFIED} & \text{if } \text{Snippet.length} > 0 \land \text{Snippet} \subseteq \text{RawText}(\text{Feedback ID}) \\ \text{NEAR\_MATCH} & \text{if } \text{Normalize}(\text{Snippet}) \subseteq \text{Normalize}(\text{RawText}(\text{Feedback ID})) \\ \text{UNVERIFIED} & \text{otherwise} \end{cases}$$
  - **VERIFIED Requirements:** Strictly case-sensitive, whitespace-sensitive, punctuation-sensitive exact substring inclusion. Zero `.trim()`, zero case-folding, zero punctuation stripping, zero unicode normalization.
  - **Diagnostic Secondary Check (`NEAR_MATCH`):** If exact matching fails, an isolated diagnostic comparison evaluates `normRaw.includes(normSnippet)` (where text is lowercased, punctuation stripped, and whitespace collapsed). When matched, the UI displays `Near Match / Normalized — Not Verbatim Verified` in visually distinct non-green styling. This badge **must never use the word "Verified" alone or the green badge**.
  - **Missing Source Row (`SOURCE_NOT_FOUND`):** If a Feedback ID cannot be matched to an ingested record, the UI displays `Source row not found`.
  - **Raw Row Reveal Toggle:** Non-exact quotes (`NEAR_MATCH` and `UNVERIFIED`) include an interactive toggle button (`[Reveal Full Raw Row]`) allowing users to inspect the exact unmutated cell string stored at ingestion.
  - **Action Output Decoupling:** Action output generators (PM Strategic Rationale and Dev Engineering Spec) strictly filter quote receipts so that **only VERIFIED quotes are presented as verbatim customer evidence**.

---

### DEC-M5A (IMPLEMENTED) — PM Strategic Trade-Off Rationale Template & Non-ARR Compliance
- **Decision ID:** `DEC-M5A`
- **Status:** IMPLEMENTED
- **Date:** 2026-10-10
- **Governing Directives:** PRD REQ-012, §7.4; MDD §3.7, §3.9; IC-001, IC-002; GAP-07, GAP-17.
- **Specification:**
  - **Template Schema:** Generated deliverables strictly adhere to the five canonical sections defined in PRD §7.4: Header (Priority Score, Severity, Affected Accounts Confirmed/Estimated), Section 1 Executive Summary, Section 2 Business Impact, Section 3 Verbatim Customer Evidence, Section 4 Strategic Recommendation, Section 5 Contradictory Evidence.
  - **Currency / ARR Labeling Safeguard (`IC-002`):** Section 2 displays `Impact Score (I_n)` and `Raw Tier Weight (I_c)`. Output strictly contains zero `$` or `ARR` labels next to proxy weights.
  - **Account Segment Breakdown:** Segment counts across Enterprise, Mid-Market, Free/Starter, and UNKNOWN are derived deterministically using GAP-12 tier conflict resolution across unique confirmed and estimated account rows ($U_c$).
  - **Exact Verbatim Evidence Guardrail (`IC-001`):** Only verified quotes are rendered with `[Verified Quote]`. Unverified, near-match, or missing quotes are excluded from verbatim quotes and summarized with `N additional quote(s) could not be verified and are omitted`.
  - **Strategic Recommendation Source (`GAP-17`):** Explicitly tagged with source metadata (`Suggested (rule-based)` by default or `AI-drafted` when provided).
  - **Contradictory Evidence Boundary (`GAP-07`):** Opposing request analysis (MDD §3.9) is recorded as not built in P0 and noted explicitly as `Contradictory Evidence analysis not built in P0 (GAP-07)`.
  - **Clipboard API Failure Recovery:** In `DeepDiveDrawer`, clipboard write errors fall back to an accessible read-only `<textarea id="copy-fallback-textbox">` with auto-select on focus and informative toast notification.

---

*Governed by AGENTS.md Standing Contract. Any decision overriding a Locked entry requires founder approval and a new row in this log.*



