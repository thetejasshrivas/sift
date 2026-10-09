# AGENTS.md — SIFT Project Agent Orientation & Standing Contract

> **READ THIS FILE FIRST on every task invocation, without exception.**
> This file governs all AI agent behaviour on the SIFT codebase.

---

## 1. SOURCE AUTHORITY HIERARCHY

Resolve conflicts strictly in this order — higher entries always win:

| Priority | Source | Location | Status |
|:---|:---|:---|:---|
| **1 (Highest)** | Master Discovery Document (MDD v2.0.1) | `Sift MDD.txt` (workspace root) | Frozen baseline — read-only |
| **2** | Product Requirements Document (PRD v2.0) | `SIFT —prd COMPREHENSIVE CONSOLIDATED P.txt` (workspace root) | Frozen baseline — read-only |
| **3** | Implementation Clarifications (IC-001 – IC-016) | This file, Section 3 | Authoritative clarifications |
| **4** | Playbook patterns & sprint task instructions | Task prompts, sprint docs | Scoped to task |

> **NEVER edit `Sift MDD.txt` or `SIFT —prd COMPREHENSIVE CONSOLIDATED P.txt`.** They are read-only discovery artefacts.
> If a task instruction contradicts MDD or PRD, STOP and report the conflict.

---

## 2. STANDING CONTRACT

The following rules apply to **every task** on this project, without exception.

1. **READ FIRST:** Before touching any file, read the PRD/MDD sections named in the task, plus `AGENTS.md`, `docs/SPRINT_STATUS.md`, and `docs/DECISIONS.md` (if they exist).
2. **INSPECT the workspace:** Check the file tree, git status, and package manifest before changing anything.
3. **AVOID unrelated changes:** No refactors, renames, deletions, or new dependencies outside the current task scope.
4. **STATE assumptions:** List any unclear points before acting — never guess silently.
5. **SCOPED changes only:** Change the smallest set of files needed.
6. **RUN the relevant tests/commands.** Ask before any install or download.
7. **For ANY visible UI change:** Validate in browser at 375 px, 768 px, and 1280 px — inspect DOM/console/network, take screenshots.
8. **REPORT every file changed** (path + one-line reason).
9. **REPORT every command executed.**
10. **REPORT raw pass/fail evidence** (actual output excerpts, not summaries). Mark anything not run as `NOT RUN` with the reason. Never say something works unless you ran it.
11. **STOP if blocked:** Explain in plain English, give ONE next action, do not work around the PRD/MDD.

**Additional hard rules:**
- Never print or request secrets.
- Never run `git reset --hard`, `git clean -fd`, or a force-push.
- Never enable any paid service or billing.
- Never mark a test PASS without executed evidence.

### Scope gates
- **P0 only** until the `p0-complete` tag is applied to the repository.
- **No new dependencies** without explicit founder approval.
- **No paid services** under any circumstances.
- **Secrets** must only reside in `.env` (gitignored) or host environment settings — never hardcoded.
- **Tests** remain `PENDING` in `docs/TEST_RESULTS.md` until actually executed; use `PASS` or `FAIL` only with raw evidence.

### Final report format (end of every task)
```
Done / Files changed / Commands run / Raw evidence / Not done or NOT RUN / Needs from founder / Next single step
```

---

## 3. IMPLEMENTATION CLARIFICATIONS (IC-001 – IC-016)

These clarifications take precedence over any ambiguous implementation detail in the PRD/MDD. They were established during sprint planning and must be treated as binding rules.

| ID | One-Line Rule Summary |
|:---|:---|
| **IC-001** | Quote text displayed in evidence panels must be **exact verbatim substrings** of the source CSV row — no paraphrasing, no rewording, no summarisation; any non-exact match is flagged `Unverified`. |
| **IC-002** | Customer tier weights (`Enterprise 3.0`, `Pro 2.0`, `Free/UNKNOWN 1.0`) are **proxies for relative priority**, not verified ARR dollar values — never label them as actual revenue or ARR. |
| **IC-003** | Similarity thresholds (>=0.85 merge, 0.60–0.84 uncertain, <0.60 distinct) are **provisional calibration values**, not empirically validated; Pass 2 reconciliation returns exactly three outcomes: `MERGE`, `KEEP_SEPARATE`, or `UNCERTAIN`. |
| **IC-004** | The JSON Schema URI used for LLM response validation is the **literal string** `http://json-schema.org/draft-07/schema#` — do not resolve, fetch, or hyperlink it. |
| **IC-005** | The serverless proxy hosting platform (Vercel vs. Cloudflare Workers) is **unknown/unselected** — do not hard-code platform-specific syntax until the founder confirms the choice. |
| **IC-006** | Before claiming any browser API or Web API is available, **prove it with a live browser test** — no assumed availability from training data. |
| **IC-007** | The AI inference provider and model name are **unverified** — mark provider status as `REQUIRES VERIFICATION` until TS-018 smoke test passes with a real API key in the founder's project. |
| **IC-008** | Capacity math (50 rows ~= 8,000 tokens per batch) is an **estimate** — actual token usage must be verified during TS-018; adjust batch size if limits differ. |
| **IC-009** | Do **not infer billing status** from HTTP response headers or latency — billing confirmation requires explicit zero-billing verification in the provider console. |
| **IC-010** | Do **not make global rate-limit claims** about any provider — only the specific project key's quota is relevant; CORS restriction on the proxy is a security control, not an authentication mechanism. |
| **IC-011** | All logging and privacy language must be **honest and literal**: "zero payload logging" means the proxy writes no persistent logs of request content — do not extend this claim to provider-side logging. |
| **IC-012** | Data-quality union counts (`Confirmed` unique accounts vs. `Estimated` total rows) use **distinct-row deduplication** — a single Account ID appearing in N rows counts as 1 confirmed account. |
| **IC-013** | P0 deliverables are **fully independent of P1** — shipping P0 must never be blocked by P1 (CS Advisory, Deduplication Visualiser) being incomplete. |
| **IC-014** | The four 2x2 matrix quadrant labels are: **Top-Right = "High Revenue Risk / High Volume"**, **Top-Left = "Enterprise Risk / Low Volume"**, **Bottom-Right = "Mass Friction / Low ARR"**, **Bottom-Left = "Low Priority"** — use these exact labels, never invent alternatives. |
| **IC-015** | Do **not invent a local AI fallback** (e.g., an on-device model) — the only approved AI path is the serverless proxy to a verified free-tier cloud provider; if that path is unavailable, surface raw unclustered data. |
| **IC-016** | When selecting between implementation approaches, **evaluate the full technology stack first** (browser APIs, PapaParse, React state) before reaching for external libraries or services. |

---

## 4. OPERATIONAL RULES

### 4.1 Source document integrity
- `docs/source/` files are **read-only**. Never modify, rename, or delete them.
- If any task instruction says to edit a source document, STOP immediately and report the conflict to the founder.

### 4.2 Priority scope gate
- Implement **P0 features only** until the repository is tagged `p0-complete`.
- P1 and P2 tasks must not be started or partially scaffolded during P0.

### 4.3 Dependency control
- **No new npm/pip/other packages** may be added without explicit founder approval.
- Approved baseline libraries: PapaParse (CSV parsing), React (UI framework), standard browser APIs.

### 4.4 Cost controls
- **Zero paid services.** No paid API keys, no paid hosting tiers, no paid data services.
- Free-tier serverless proxy (Vercel or Cloudflare Workers free tier) only — selection pending founder decision.

### 4.5 Secret management
- API keys, tokens, and credentials live **only** in `.env` (gitignored) or host environment variables.
- `.env` must be listed in `.gitignore` before any key is written.
- Never hardcode a secret anywhere in source files.

### 4.6 Test status integrity
- All test IDs in `docs/TEST_RESULTS.md` start as `PENDING`.
- Upgrade to `PASS` only with raw command output evidence in the report.
- Upgrade to `FAIL` only with raw error output evidence.
- Never write `PASS` speculatively.

---

## 5. QUICK REFERENCE: KEY FORMULAS & CONSTANTS

### Priority Score
```
P_c = Round_1( 100 x [ W_ARR * I_n + W_Vol * F_n + W_Sev * S_n ] )
```

### Tier Weights (proxies only — not verified ARR)
| Tier | Weight |
|:---|:---|
| Enterprise | 3.0 |
| Pro / Mid-Market | 2.0 |
| Free / Starter | 1.0 |
| UNKNOWN | 1.0 |

### Default Slider Weights
| Component | Default |
|:---|:---|
| Impact / ARR (W_ARR) | 0.40 (40%) |
| Frequency / Volume (W_Vol) | 0.40 (40%) |
| Severity (W_Sev) | 0.20 (20%) |

### Similarity Thresholds (Pass 2 — provisional)
| Range | Outcome |
|:---|:---|
| >= 0.85 | `MERGE` |
| 0.60 – 0.84 | `UNCERTAIN` (flag both clusters) |
| < 0.60 | `KEEP_SEPARATE` |

### Data Quality Warning Trigger
- Banner displays when `(UNKNOWN rows / Total rows) > 0.05` (5%).

---

*Last updated: AG-PF-00 — 2026-10-09*
