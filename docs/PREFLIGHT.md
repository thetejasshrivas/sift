# PREFLIGHT — SIFT

**Purpose:** Pre-task checklist that every agent must complete before making any code changes.

---

## Mandatory Preflight Steps (run on every task)

- [ ] 1. Read `AGENTS.md` in full.
- [ ] 2. Read `docs/SPRINT_STATUS.md` — note current step and gates.
- [ ] 3. Read `docs/DECISIONS.md` — note all locked decisions.
- [ ] 4. Inspect workspace file tree (list root, list `src/`, list `docs/`).
- [ ] 5. Check git status (`git status`) — confirm working tree is clean.
- [ ] 6. Check package manifest (`package.json`) if it exists — note all dependencies.
- [ ] 7. Read named PRD/MDD sections for this task.
- [ ] 8. State assumptions out loud before acting.
- [ ] 9. Confirm scope: is this task P0? Is `p0-complete` tag absent? Proceed only with P0 work.
- [ ] 10. Confirm no paid services will be used.

---

## Gate Checklists (from PRD v2.0 Section 15.4)

### Provider-Verification Gate (must pass before Milestone 2)
- [ ] TS-018 Step 1: Model accessible, HTTP 200 received.
- [ ] TS-018 Step 2: Structured JSON output validates against PRD JSON Schema draft-07.
- [ ] TS-018 Step 3: 6 sequential batch requests complete without HTTP 429.
- [ ] TS-018 Step 4: Zero billing confirmed in provider console.
- [ ] Free-tier model name confirmed and recorded in `docs/DECISIONS.md`.

### Build-Readiness Gate (must pass before Milestone 5)
- [ ] Provider-Verification Gate passed.
- [ ] All PRD v2.0 specifications frozen (no open PRD changes).
- [ ] Static analysis confirms zero API keys in client JS bundle.
- [ ] Automated test framework configured for TS-001 through TS-020.

### Deployment-Readiness Gate (must pass before public deployment)
- [ ] Build-Readiness Gate passed.
- [ ] 100% PASS rate across TS-001 through TS-020 (with raw evidence).
- [ ] Serverless proxy CORS restricted strictly to production origin.
- [ ] Client memory profile verified clean after processing 2,000-row CSV.

---

## Blocked-State Protocol

If any preflight step reveals a blocker:
1. STOP — do not proceed with code changes.
2. Write a plain-English explanation of the blocker.
3. Identify ONE next action that unblocks it.
4. Report to founder if the blocker requires a decision.

---

*Governed by AGENTS.md Standing Contract and PRD v2.0 Section 15.4.*

---

## AG-PF-01 — Antigravity Product & Workspace State Audit

**Task:** AG-PF-01  
**Audited by:** Antigravity IDE agent  
**Audit date:** 2026-10-09  
**Evidence basis:** System context metadata, direct tool calls, PowerShell command output (see raw evidence column).  
**Status key:** `VERIFIED` = confirmed by live tool/command output; `VISIBLE-ONLY` = visible in IDE metadata but not independently provable by the agent; `UNVERIFIED` = cannot be confirmed with available tools.

---

### Source Document Sections Requested vs. Found

| Section | Requested | Found in source file | Status |
|:---|:---|:---|:---|
| MDD §4.8 "Antigravity considerations" | Yes | NOT FOUND — grep of `Sift MDD.txt` returned zero matches for "4.8" and "Antigravity" | UNVERIFIED |
| PRD §15.5 "handoff brief" | Yes | NOT FOUND — grep of PRD file returned zero matches for "15.5", "handoff", "Antigravity" | UNVERIFIED |
| IC-005 (proxy platform) | Loaded | Present in `AGENTS.md` §3 — serverless platform unselected | VERIFIED |
| IC-006 (browser API proof) | Loaded | Present in `AGENTS.md` §3 — live browser test required before any API claim | VERIFIED |

> **Implication:** MDD §4.8 and PRD §15.5 appear to be forward-planned references that do not yet exist in the frozen source documents. No Antigravity-specific guidance was found in MDD or PRD. This audit proceeds from direct observation only.

---

### Capability Table

| Capability / Setting | Finding | Evidence | Status |
|:---|:---|:---|:---|
| **Agent identity** | Antigravity IDE (Google DeepMind) | System prompt header: `You are Antigravity, a powerful agentic AI coding assistant designed by the Google Deepmind team` | VISIBLE-ONLY |
| **Agent version** | Not programmatically exposed | No version string accessible to the agent via any tool | UNVERIFIED |
| **Active model** | Claude Sonnet 4.6 (Thinking) | Received in `USER_SETTINGS_CHANGE` metadata: `Model Selection → Claude Sonnet 4.6 (Thinking)` | VISIBLE-ONLY |
| **Workspace path** | `W:\AI Product Sprint\SIFT` | Confirmed by corpus mapping: `w:/AI Product Sprint/SIFT` and all `list_dir` / `run_command` calls | VERIFIED |
| **Workspace type** | Single flat workspace — no git repository | `git status` → exit code 1, `fatal: not a git repository` | VERIFIED |
| **Open folders / file tree root** | `W:\AI Product Sprint\SIFT` (4 items at root: `AGENTS.md`, `Sift MDD.txt`, PRD `.txt`, `docs/`) | `Get-ChildItem -Recurse -Depth 3` output | VERIFIED |
| **Active document (IDE)** | `W:\AI Product Sprint\SIFT\AGENTS.md` | `ADDITIONAL_METADATA.Active Document` | VISIBLE-ONLY |
| **Terminal command execution** | Available — agent can propose and run PowerShell commands on Windows host | Multiple `run_command` calls succeeded in this task (exit code 0) | VERIFIED |
| **Browser subagent / open browser** | Available — `browser_subagent` tool present in tool schema; can open URLs and record sessions | Tool schema confirms `browser_subagent`. IC-006: API availability must be proven by live test before any browser API claim is made. No live browser call made in this task (out of scope). | VISIBLE-ONLY |
| **Approval / terminal permission mode** | Not directly inspectable by the agent — IDE settings panel not readable via tool | No tool exposes approval-mode or permission flags programmatically | UNVERIFIED |
| **Agent mode(s)** | Standard agentic mode (tool-calling enabled); no explicit "restricted" mode signal observed | System prompt and tool availability consistent with full agentic mode | VISIBLE-ONLY |
| **Workspace-level customizations (.agents/)** | ABSENT — no `.agents/` directory found at workspace root | `Get-ChildItem -Filter ".agents" -Force` returned empty output | VERIFIED |
| **Global customizations root** | `C:\Users\thete\.gemini\config` — exists, contains `plugins/`, `sidecars/`, `projects/`, `config.json`, `mcp_config.json` | `Get-ChildItem C:\Users\thete\.gemini\config -Depth 3` output | VERIFIED |
| **Rules loaded (workspace)** | `AGENTS.md` at workspace root — 5 sections, IC-001 through IC-016 | File read at task start; loaded as `RULE[W:\AI Product Sprint\SIFT\AGENTS.md]` in system context | VERIFIED |
| **Rules loaded (global)** | None found at `C:\Users\thete\.gemini\config\rules\` — no `rules/` directory or standalone `GEMINI.md`/`AGENTS.md` at global config root | Directory listing confirms absence | VERIFIED |
| **Skills available (global plugins)** | 5 plugin bundles: `chrome-devtools-plugin`, `firebase`, `gemini-api`, `google-antigravity-sdk`, `modern-web-guidance-plugin` — total ~20 skills | `Get-ChildItem C:\Users\thete\.gemini\config\plugins` output; skill list in system prompt | VERIFIED |
| **Skills available (workspace)** | NONE — no `skills/` directory under workspace or `.agents/` | Workspace tree listing | VERIFIED |
| **MCP servers active** | `gemini-api-docs` (eager tools: `gemini_search_docs`, `gemini_get_doc`) | System prompt MCP section; `mcp_config.json` at global config is empty (0 bytes) | VERIFIED |
| **package.json / npm dependencies** | ABSENT — no `package.json` exists in workspace | `Test-Path package.json` → `False` | VERIFIED |
| **Source documents (read-only)** | `Sift MDD.txt` (49,720 bytes), PRD `.txt` (80,489 bytes) at root; copies also in `docs/source/` | `Get-ChildItem -Recurse` output | VERIFIED |
| **docs/ tracking files** | `COST_LOG.md`, `DECISIONS.md`, `PREFLIGHT.md`, `SPRINT_STATUS.md`, `TEST_RESULTS.md` — all present | `Get-ChildItem docs/` output | VERIFIED |
| **Paid services** | None enabled or used | No billing calls, no paid API keys referenced, no cloud service invoked | VERIFIED |

---

### Gate G-PF1 Assessment

| Criterion | Status |
|:---|:---|
| Capability table written with VERIFIED / VISIBLE-ONLY / UNVERIFIED labels | ✅ DONE |
| No unverified claim stated as fact | ✅ DONE — all UNVERIFIED items explicitly labelled and explained |
| MDD §4.8 and PRD §15.5 referenced but absent — conflict reported to founder | ✅ DONE (see "Source Document Sections" table above) |

**Gate G-PF1: MET**

---

### Commands Executed in This Task

| # | Command | Exit Code | Result |
|:---|:---|:---|:---|
| 1 | `git status` | 1 | `fatal: not a git repository` |
| 2 | `Get-ChildItem W:\AI Product Sprint\SIFT -Recurse -Depth 3` | 0 | Full file tree captured |
| 3 | `Test-Path package.json` | 0 | `False` |
| 4 | `Get-ChildItem .agents -Force` | 0 | Empty (no .agents dir) |
| 5 | `Get-ChildItem C:\Users\thete\.gemini\config -Depth 3 -Force` | 0 | Global config tree captured |
| 6 | `grep "4.8"` in MDD | — | No results |
| 7 | `grep "15.5"` in PRD | — | No results |
| 8 | `grep "Antigravity"` in MDD + PRD | — | No results |

---

*AG-PF-01 written 2026-10-09. Governed by AGENTS.md Standing Contract.*

---

## AG-PF-02 — Runtime & Toolchain Audit

**Task:** AG-PF-02  
**Audited by:** Antigravity IDE agent  
**Audit date:** 2026-10-09  
**Evidence basis:** Live PowerShell/terminal command output — all results are exact excerpts.  
**Status key:** `PASS` = command executed, exit 0, expected output received; `FAIL` = command executed, non-zero exit or unexpected output; `NOT RUN` = explicitly deferred or out of scope.

---

### Source Document Sections

MDD §4.8 and PRD §15.5 confirmed absent (established in AG-PF-01 — not re-grepped). IC-005 and IC-006 noted. No source document guidance on toolchain versions found; audit proceeds from direct observation only.

---

### Toolchain Version Table

| Tool | Command | Raw Output | Exit Code | Result |
|:---|:---|:---|:---|:---|
| **Node.js** | `node -v` | `v24.21.0` | 0 | **PASS** |
| **npm** | `npm -v` | `11.19.0` | 0 | **PASS** |
| **Git** | `git --version` | `git version 2.56.0.windows.2` | 0 | **PASS** |
| **node binary path** | `Get-Command node \| Select Source` | `C:\Program Files\nodejs\node.exe` | 0 | **PASS** |
| **git binary path** | `Get-Command git \| Select Source` | `C:\Program Files\Git\cmd\git.exe` | 0 | **PASS** |
| **pnpm** | `Get-Command pnpm -ErrorAction SilentlyContinue` | *(empty — not installed)* | 1 | **NOT RUN** — not present on PATH; `where pnpm` returned empty; not installed, not invoked |
| **yarn** | `Get-Command yarn -ErrorAction SilentlyContinue` | *(empty — not installed)* | 1 | **NOT RUN** — not present on PATH; not installed, not invoked |
| **npm ls -g --depth=0** | `npm ls -g --depth=0` | `npm error code ENOENT … lstat 'C:\Users\thete\AppData\Roaming\npm'` | 1 | **FAIL** ⚠️ — see note below |
| **Trivial Node script** | `node -e "console.log(1)"` | `1` | 0 | **PASS** |
| **Local static server** | *(not run)* | — | — | **NOT RUN** — explicitly deferred to AG-ARCH-04 per task scope |

---

### npm Global Directory Anomaly

**Finding:** `npm ls -g --depth=0` fails with `ENOENT: no such file or directory, lstat 'C:\Users\thete\AppData\Roaming\npm'`.

**Diagnosis:**
- `npm config get prefix` → `C:\Users\thete\AppData\Roaming\npm` (correct default)
- `Test-Path C:\Users\thete\AppData\Roaming\npm` → `False`
- The directory does not exist. This happens on a clean Node.js install where `npm install -g` has never been run — npm creates the global prefix directory lazily on first global install.
- npm itself (`npm -v`) functions correctly; only the global package listing command fails because the target directory is absent.

**Impact:** No globally installed npm packages are present. This is expected for a fresh machine. The directory will be auto-created the first time `npm install -g` is run (which requires founder approval per the standing contract before any install).

**Classification:** FAIL on `npm ls -g` — recorded as a known expected state, not a blocker for P0 work.

---

### Gate G-PF2 Assessment

| Criterion | Finding | Status |
|:---|:---|:---|
| Node.js present and executable | v24.21.0 at `C:\Program Files\nodejs\node.exe` | ✅ VERIFIED |
| npm present and functional | v11.19.0; `npm -v` exits 0 | ✅ VERIFIED |
| Git present and executable | v2.56.0.windows.2 at `C:\Program Files\Git\cmd\git.exe` | ✅ VERIFIED |
| Node can execute inline scripts | `node -e "console.log(1)"` → output `1`, exit 0 | ✅ VERIFIED |
| pnpm / yarn | Neither installed; neither required at this stage | ✅ N/A |
| npm global dir exists | ABSENT — `C:\Users\thete\AppData\Roaming\npm` does not exist | ⚠️ RECORDED (known expected state — not a blocker) |
| No install or download commands run | Confirmed — zero `npm install`, `npx`, or download calls made | ✅ VERIFIED |
| Static server check deferred | Deferred to AG-ARCH-04 per task brief | ✅ RECORDED |

**Gate G-PF2: MET** — Node, npm, and Git are all verified and functional. The only anomaly (missing npm global directory) is a known benign state on a fresh install and is not a blocker.

---

### Commands Executed in This Task

| # | Command | Exit Code | Raw Output Excerpt |
|:---|:---|:---|:---|
| 1 | `node -v` | 0 | `v24.21.0` |
| 2 | `npm -v` | 0 | `11.19.0` |
| 3 | `git --version` | 0 | `git version 2.56.0.windows.2` |
| 4 | `where node` | 0 | *(empty stdout — PowerShell `where` alias differs from cmd `where`)* |
| 5 | `where git` | 0 | *(empty stdout — same issue)* |
| 6 | `where pnpm 2>&1; where yarn 2>&1` | 0 | *(empty — neither found)* |
| 7 | `Get-Command node \| Select Source` | 0 | `C:\Program Files\nodejs\node.exe` |
| 8 | `Get-Command git \| Select Source` | 0 | `C:\Program Files\Git\cmd\git.exe` |
| 9 | `Get-Command pnpm/yarn -ErrorAction SilentlyContinue` | 1 | *(empty — not installed)* |
| 10 | `npm ls -g --depth=0` | 1 | `npm error code ENOENT … lstat 'C:\Users\thete\AppData\Roaming\npm'` |
| 11 | `node -e "console.log(1)"` | 0 | `1` |
| 12 | `Test-Path C:\Users\thete\AppData\Roaming\npm` | 0 | `False` |
| 13 | `npm config get prefix` | 0 | `C:\Users\thete\AppData\Roaming\npm` |

---

*AG-PF-02 written 2026-10-09. Governed by AGENTS.md Standing Contract.*

---

## AG-PF-03 — Browser and Visual QA Proof

**Task:** AG-PF-03  
**Audited by:** Antigravity IDE agent  
**Audit date:** 2026-10-09  
**Gate:** G-PF3  
**Status: PASSED (via founder-approved manual inspection fallback — DEC-PF03 / Option B)**

---

### Source Document Sections

PRD §8.4, §3.2, TS-014, TS-015 — confirmed absent from frozen source document (consistent with AG-PF-01/02 findings). IC-006 (browser API availability must be proved by live test) — this task IS the live test. Proceeding from task brief directly.

---

### Scratch Files Created

| File | Purpose | Status |
|:---|:---|:---|
| `scratch/browser-check/index.html` | Browser capability test page (input, button, console.log, fetch to nonexistent path) | Created — confirmed, first 5 lines verified |
| `scratch/browser-check/server.js` | Node.js built-in HTTP server on port 8787 | Created and launched |
| `docs/evidence/preflight/` | Screenshot save target directory | Created (empty — no screenshots captured; browser failed) |

**Server launch evidence:** `node scratch/browser-check/server.js` → exit: running (daemon), log output: `AG-PF-03 server listening on http://127.0.0.1:8787` ✅

---

### Browser Capability Results

| # | Capability | Result | Evidence |
|:---|:---|:---|:---|
| 1 | Open localhost URL | **NOT AVAILABLE** | `open_browser_url` failed — Playwright driver CDN returned HTTP 404 (see blocker) |
| 2 | Type in input and click button | **NOT AVAILABLE** | Blocked by #1 |
| 3 | Read DOM text after click | **NOT AVAILABLE** | Blocked by #1 |
| 4 | Screenshot at default viewport | **NOT AVAILABLE** | Blocked by #1 |
| 5 | Screenshot at 375 / 768 / 1280 px | **NOT AVAILABLE** | Blocked by #1 |
| 6 | Read console output | **NOT AVAILABLE** | Blocked by #1 |
| 7 | Read network requests / failed request | **NOT AVAILABLE** | Blocked by #1 |

---

### Blocker Detail

**Root cause:** The Antigravity browser tool (`open_browser_url`) depends on Playwright. When invoked, it attempts to download the Playwright driver binary from Microsoft's CDN. All three CDN endpoints returned HTTP 404:

```
failed to create browser context: failed to run playwright manager:
failed to install playwright: could not install driver:
  error: got non 200 status code: 404 (Not Found) from
    https://playwright.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip
  error: got non 200 status code: 404 (Not Found) from
    https://playwright-akamai.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip
  error: got non 200 status code: 404 (Not Found) from
    https://playwright-verizon.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip
```

**Interpretation:** `playwright-1.57.0-win32_x64.zip` does not exist on the CDN. This is an Antigravity IDE version/configuration issue — the IDE is requesting a Playwright build that has not been published or has been removed from the CDN. This is outside project control.

**Impact:** All 7 browser capability checks are NOT AVAILABLE. No screenshots were taken. Gate G-PF3 cannot be met without this being resolved.

**IC-006 implication:** Per IC-006, browser API availability requires live browser test proof. That proof cannot be obtained until the Playwright driver issue is resolved. No browser API claims can be made.

---

### Gate G-PF3 Assessment

| Criterion | Status |
|:---|:---|
| All 7 browser capabilities PASS | ❌ NOT MET — automated browser tool unavailable |
| Each failing capability has founder-approved fallback | ✅ MET — founder approved manual inspection fallback (Option B; DEC-PF03) |

**Gate G-PF3: PASSED (via founder-approved manual inspection fallback — DEC-PF03 / Option B)**

---

### Proposed Fallbacks (requires founder approval before proceeding)

| Option | Description | Implication |
|:---|:---|:---|
| **A** | Founder updates Antigravity IDE to a version with a working Playwright driver and re-runs AG-PF-03 | Cleanest path; no workaround needed |
| **B** | Founder approves manual browser testing: founder opens `http://127.0.0.1:8787` in their own Chrome, performs steps 2–7 manually, and reports raw output back to agent for recording | Screenshots taken by founder; capability claims VISIBLE-ONLY not VERIFIED |
| **C** | Founder approves deferral: mark all browser capabilities as DEFERRED pending IDE fix; proceed to AG-PF-04 with browser checks flagged as open risk | Unblocks sprint; leaves G-PF3 open |

---

### Resolution & Fallback Selection (DEC-PF03)

- **Selected Fallback:** Option B (APPROVED by founder on 2026-10-09).
- **Decision Record:** [`DEC-PF03`](file:///W:/AI%20Product%20Sprint/SIFT/docs/DECISIONS.md) in `docs/DECISIONS.md`.
- **Approved Policy:** Manual founder inspection checklist for all visual QA gates (M1-C, M4). Automated browser tool is NOT AVAILABLE due to Playwright driver CDN HTTP 404 (`playwright-1.57.0-win32_x64.zip`). No claim of automated browser QA will be made.
- **Gate G-PF3 Outcome:** PASSED via founder-approved manual inspection fallback (Option B).

---

### Commands Executed in This Task

| # | Command | Exit Code | Result |
|:---|:---|:---|:---|
| 1 | `Test-Path scratch; Test-Path docs\evidence` | 0 | Both `False` — directories absent, created next |
| 2 | `New-Item -ItemType Directory scratch\browser-check` | 0 | Created |
| 3 | `New-Item -ItemType Directory docs\evidence\preflight` | 0 | Created |
| 4 | `Set-Content scratch\browser-check\index.html` | 0 | HTML file written |
| 5 | `Get-Content index.html -First 5` | 0 | Verified: `<!DOCTYPE html>` confirmed |
| 6 | `Set-Content scratch\browser-check\server.js` | 0 | Server script written |
| 7 | `node scratch\browser-check\server.js` (daemon) | RUNNING | Log: `AG-PF-03 server listening on http://127.0.0.1:8787` |
| 8 | `browser_subagent` → `open_browser_url` | ERROR | Playwright CDN 404 — see blocker |
| 9 | `manage_task kill` (server) | CANCELLED | Server stopped cleanly |

---

*AG-PF-03 updated 2026-10-09. Status: PASSED (via fallback DEC-PF03). Governed by AGENTS.md Standing Contract.*

---

## AG-PF-04 — Plugin, Skill, MCP, and Browser-Tool Inventory

**Task:** AG-PF-04  
**Audited by:** Antigravity IDE agent  
**Audit date:** 2026-10-09  
**Gate:** G-PF4  
**Status:** COMPLETE — zero installs performed; pending founder review of Required/Optional decisions  
**UI Status Basis:** Verified with founder via UI inquiry:
- Plugins/extensions panel: Not visible in UI; managed via background configuration.
- MCP server panel: Not visible in UI; runs headlessly via configuration.
- Browser preview panel: Not visible in UI; relies strictly on agent tools (non-functional per AG-PF-03).

---

### Inventory Table

| Name | Type | Installed? | Enabled? | Sift relevance (cite REQ/IC) | Required/Optional/Not Needed | Credentials? | Persistence? | Cost risk? | Security implications | Decision |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **gemini-api-docs** | MCP Server | Yes (VERIFIED) | Yes (VERIFIED) | REQ-005, REQ-013, TS-018, IC-007 (Official doc lookup for Gemini endpoints, JSON schemas, error codes) | Optional | None | No | ₹0 / $0.00 | Read-only public doc query; no project data transmitted | Retain as Optional reference tool for TS-018 and proxy schema engineering |
| **gemini-api** | Plugin | Yes (VERIFIED) | Yes (VERIFIED) | REQ-005, REQ-006, REQ-007, TS-018, IC-007, IC-008 (AI batch clustering, schema definitions, TS-018 verification) | Optional | GEMINI_API_KEY for TS-018 smoke test (serverless proxy env only) | No | ₹0 (free-tier quota only) | Private key must never leak into client bundle (DEC-007, DEC-008, REQ-013) | Retain as Optional reference for proxy AI pipeline; do not add Gemini SDK to client bundle |
| **gemini-api-dev** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | REQ-005, REQ-006, TS-018, IC-004 (JSON schema draft-07 structuring, error retry handling) | Optional | None for skill docs; required for TS-018 | No | ₹0 | Zero client secret exposure (DEC-007) | Retain as Optional reference for proxy integration |
| **modern-web-guidance-plugin** | Plugin | Yes (VERIFIED) | Yes (VERIFIED) | REQ-009, REQ-010, TS-015, IC-016 (Vanilla CSS, container queries, 60 FPS slider performance, zero-dependency patterns) | Optional | None | No | ₹0 | None | Retain as Optional frontend guidance reference for Milestones 3 & 4 |
| **modern-web-guidance** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | REQ-009, REQ-010, TS-015, IC-016 (Web standards, accessible modal patterns, responsive layout) | Optional | None | No | ₹0 | None | Retain as Optional reference for UI development |
| **chrome-devtools-plugin** | Plugin | Yes (VERIFIED) | Yes (VERIFIED) | REQ-010, TS-014, TS-015, IC-006 (UI performance, a11y, layout inspection) | Optional | None | No | ₹0 | Local debugging only | Retain as Optional reference; visual QA is manual per DEC-PF03 |
| **chrome-devtools** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | TS-014, TS-015, IC-006 (DOM/network inspection guidance) | Optional | None | No | ₹0 | Local debugging only | Retain as Optional debugging guidance |
| **a11y-debugging** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | TS-014, MDD §4.5 (WCAG AA accessibility auditing, keyboard focus, ARIA) | Optional | None | No | ₹0 | None | Retain as Optional reference for Milestone 4 accessibility checks |
| **debug-optimize-lcp** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | REQ-009, PRD §11.1 (60 FPS slider math, CWV optimization) | Optional | None | No | ₹0 | None | Retain as Optional reference for UI performance tuning |
| **memory-leak-debugging** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | REQ-001, PRD §9.4, PRD §15.4 (Ephemeral memory lifecycle, client memory validation after 2,000 rows) | Optional | None | No | ₹0 | None | Retain as Optional reference for Deployment-Readiness memory testing |
| **troubleshooting** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | IC-006 (DevTools connection debugging) | Not Needed | None | No | ₹0 | None | Do Not Use; DevTools MCP not active |
| **firebase** | Plugin | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001, DEC-006, DEC-008, MDD §4.7 (Sift is strictly zero-database, zero-server-persistence) | Not Needed | GCP/Firebase credentials | Persistent DB risk | High if paid Firebase activated | Violates DEC-001 zero-persistence privacy guarantee | Do Not Use / Strictly Prohibited for Sift runtime. Zero Firebase calls allowed. |
| **firebase-firestore** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001 (no persistent database) | Not Needed | GCP credentials | Yes | Blaze billing risk | Database persistence risk | Do Not Use |
| **firestore-rules-creation** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001 | Not Needed | None | No | ₹0 | Security rules for prohibited DB | Do Not Use |
| **firebase-security-rules-auditor** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001 | Not Needed | None | No | ₹0 | None | Do Not Use |
| **firebase-auth-basics** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001 (no auth/user accounts) | Not Needed | Auth credentials | Yes | Billing risk | Violates ephemeral model | Do Not Use |
| **firebase-hosting-basics** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | IC-005, MDD §4.7 (Free-tier static hosting; Sift uses Vercel/Cloudflare Workers per IC-005) | Not Needed | Firebase token | No | Billing risk | Cloud hosting configuration | Do Not Use (proxy unselected, Vercel/Cloudflare per IC-005) |
| **firebase-app-hosting-basics** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001 | Not Needed | GCP credentials | Yes | High | Cloud infrastructure risk | Do Not Use |
| **firebase-data-connect** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001 (PostgreSQL DB) | Not Needed | SQL credentials | Yes | High | Database persistence risk | Do Not Use |
| **firebase-crashlytics** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001 & privacy | Not Needed | App credentials | Yes | Billing risk | Telemetry risk | Do Not Use |
| **firebase-remote-config-basics** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None | Not Needed | None | No | ₹0 | None | Do Not Use |
| **firebase-ai-logic-basics** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-008 (requires Firebase backend) | Not Needed | Firebase credentials | Yes | Billing risk | Architecture violation | Do Not Use |
| **firebase-basics** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None | Not Needed | Firebase login | No | ₹0 | None | Do Not Use |
| **extension-to-functions-codebase** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None | Not Needed | None | No | ₹0 | None | Do Not Use |
| **xcode-project-setup** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None (Sift is web-only, not iOS/macOS) | Not Needed | None | No | ₹0 | None | Do Not Use |
| **firestore-rules-author** | Subagent | Yes (VERIFIED) | Yes (VERIFIED) | None — conflicts with DEC-001 | Not Needed | None | No | ₹0 | None | Do Not Use / Never Invoke |
| **google-antigravity-sdk** | Plugin | Yes (VERIFIED) | Yes (VERIFIED) | None (Sift is a web app, not an AGY autonomous agent pipeline) | Not Needed | None | No | ₹0 | None | Do Not Use |
| **google-antigravity-sdk** (skill) | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None | Not Needed | None | No | ₹0 | None | Do Not Use |
| **gemini-live-api-dev** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None (Sift uses batch REST clustering, not WebSocket audio/video streaming) | Not Needed | None | No | ₹0 | None | Do Not Use |
| **gemini-omni-flash-api** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None (Sift is tabular text feedback, not video generative editing) | Not Needed | None | No | ₹0 | None | Do Not Use |
| **chrome-extensions** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None (Sift is a web application, not a Chrome browser extension) | Not Needed | None | No | ₹0 | None | Do Not Use |
| **agy-customizations** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | AGENTS.md contract (governance complete) | Not Needed | None | No | ₹0 | None | Do Not Use |
| **antigravity-guide** | Skill | Yes (VERIFIED) | Yes (VERIFIED) | None (IDE general guide) | Not Needed | None | No | ₹0 | None | Do Not Use |
| **permissioned-github** | Skill | Yes (VERIFIED) | No (VERIFIED: not loaded in agent session) | None (Local git only; live writeback prohibited per DEC-006) | Not Needed | GitHub token | No | ₹0 | GitHub repository access | Do Not Use |
| **browser_subagent** | Browser Tool | Yes (VERIFIED) | No (VERIFIED: fails with Playwright CDN 404) | TS-014, TS-015, IC-006 (Browser visual automation) | Not Needed (Fallback Approved) | None | No | ₹0 | Local browser process | Do Not Use; replaced by founder manual inspection checklist per DEC-PF03 |

---

### Gate G-PF4 Assessment

| Criterion | Status |
|:---|:---|
| Inventory table complete with all 11 mandatory columns | ✅ MET |
| Zero installs or downloads performed | ✅ MET (0 packages installed, 0 files downloaded) |
| Every Required / Optional decision presented to founder | ✅ PRESENTED IN FINAL REPORT (awaiting founder read) |

**Gate G-PF4: MET (Table Complete, 0 Installs, Decisions Documented)**

---

*AG-PF-04 written 2026-10-09. Governed by AGENTS.md Standing Contract.*

---

## AG-PF-05 — Git Safety Setup

**Task:** AG-PF-05  
**Executed by:** Antigravity IDE agent  
**Execution date:** 2026-10-09  
**Gate:** G-PF5  
**Status: PASSED**

---

### Setup Details

1. **Repository Initialized:**
   - Command: `git init; git branch -M main`
   - Default branch: `main`
2. **`.gitignore` Created:**
   - Patterns covered: `node_modules/`, `dist/`, `build/`, `.env`, `.env.*`, `!.env.example`, `.vercel/`, `.netlify/`, `.wrangler/`, `coverage/`, `test-results/`, `playwright-report/`, `*.log`, `scratch/`, `docs/evidence/**/*.har`
3. **`.env.example` Created:**
   - Variable names only (zero secrets): `GEMINI_API_KEY=`, `PORT=`
4. **Ignore Verification Proof:**
   - Command: `git check-ignore -v .env`
   - Output: `.gitignore:9:.env	.env` (exit code 0)
   - `.env.production` test: `.gitignore:10:.env.*	.env.production` (exit code 0)
   - `.env.example` test: `.gitignore:11:!.env.example	.env.example` (negated, tracked)
   - `scratch/` test: `.gitignore:27:scratch/	scratch/` (exit code 0)
5. **Baseline Commit & Tag:**
   - Tag: `baseline`

---

### Gate G-PF5 Assessment

| Criterion | Finding / Command Evidence | Status |
|:---|:---|:---|
| Baseline commit created (sources, docs, rules, .gitignore) | Tagged `baseline` on `main` branch | ✅ PASSED |
| `.env` ignored proved by command | `git check-ignore -v .env` → `.gitignore:9:.env .env` | ✅ PASSED |

**Gate G-PF5: PASSED**

*AG-PF-05 written 2026-10-09. Governed by AGENTS.md Standing Contract.*

---

## AG-PF-06 — Secret Handling Setup

**Task:** AG-PF-06  
**Executed by:** Antigravity IDE agent  
**Execution date:** 2026-10-09  
**Gate:** G-PF6  
**Status: PASSED**

---

### Implementation Details

1. **Secret Scanning Script (`scripts/secret-scan` / `scripts/secret-scan.js`):**
   - Reads `.env` values without printing or logging them.
   - Searches working tree, git commit history (`git log -p`), and future build outputs for defined secret values and common credential patterns (Google AI Studio keys, private keys, AWS tokens, generic secret assignments).
   - Reports strictly `MATCH` / `NO MATCH` along with offending file paths (never secret values).
   - Exits 0 on clean scan, 1 on credential match.
2. **Scan Verification Evidence:**
   - Working tree / history baseline scan: `NO MATCH: No secrets detected in working tree or git history.` (exit code 0).
   - Injected test secret in dummy tracked file: `MATCH: docs/test-dummy-leak.txt` without logging secret value (exit code 1).
   - Post-cleanup verification: `NO MATCH: No secrets detected in working tree or git history.` (exit code 0).
3. **Environment Variable Names Documented in `.env.example`:**
   - Names only (zero values / secrets):
     - `AI_API_KEY=`
     - `AI_MODEL=`
     - `ALLOWED_ORIGIN=`
     - `RATE_LIMIT_RPM=`
     - `MAX_PAYLOAD_BYTES=`
4. **npm Script `scan:secrets` Status:**
   - **DEFERRED to AG-ARCH-03:** `package.json` does not exist yet (pre-scaffolding state). Script will be added to `package.json` during AG-ARCH-03 scaffolding.
5. **`.env` Tracking Status:**
   - Untracked and ignored: `git check-ignore -v .env` → `.gitignore:9:.env .env`.

---

### Gate G-PF6 Assessment

| Criterion | Finding / Command Evidence | Status |
|:---|:---|:---|
| Secret scan script works | `node scripts/secret-scan.js` runs cleanly; proved detection on test leak | ✅ PASSED |
| `.env` untracked | `git check-ignore -v .env` confirms ignore rule; not staged in git | ✅ PASSED |
| Names-only `.env.example` committed | Contains 5 required variable names with empty values; committed | ✅ PASSED |
| `scan:secrets` npm script disposition | Recorded as deferred until AG-ARCH-03 (no `package.json` yet) | ✅ RECORDED |

**Gate G-PF6: PASSED**

---

*AG-PF-06 written 2026-10-09. Governed by AGENTS.md Standing Contract.*

