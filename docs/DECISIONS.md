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
| **OPT-002** | AI inference provider & model | Verified free-tier candidates (TS-018 required first) | Before AG-M2 |

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

*Governed by AGENTS.md Standing Contract. Any decision overriding a Locked entry requires founder approval and a new row in this log.*

