# TEST RESULTS — SIFT

**Policy:** Status must be `PENDING` until the test is actually executed with raw evidence.  
`PASS` and `FAIL` require raw command output in the sprint report. Never write `PASS` speculatively.

---

## Test Suite: TS-001 through TS-038

| Test ID | Category | Scenario | Linked REQ | Status | Evidence |
|:---|:---|:---|:---|:---|:---|
| **TS-001** | Ingestion | Parse valid 300-row CSV; headers parsed; schema mapped; 300 rows loaded in <5 seconds | REQ-001, REQ-002 | PASS | **Date:** 2026-10-09 \| **Commit:** 7496b23 \| **Env:** Node v24.21.0, Win11, Vitest 2.1.4 \| **Command:** `npx vitest run tests/unit/ingest.test.ts` \| **Expected:** <5s runtime, valid mapping \| **Observed:** 300 rows parsed and mapped in 0.60 ms (<5s satisfied) \| **Evidence Path:** `tests/unit/ingest.test.ts#L142-L165` |
| **TS-002** | Data Policy | Missing tier column — tiers set to `UNKNOWN` (1.0x weight); quality warning banner rendered if UNKNOWN >5% | REQ-003, REQ-004 | PASS | **Date:** 2026-10-09 \| **Commit:** 7496b23 \| **Env:** Node v24.21.0, Win11, Vitest 2.1.4 \| **Command:** `npx vitest run tests/unit/identity.test.ts` \| **Expected:** All tiers UNKNOWN (1.0x), banner if >5% \| **Observed:** 100% UNKNOWN, warning banner triggered (100% > 5%) with verbatim PRD text \| **Evidence Path:** `tests/unit/identity.test.ts#L284-L306` |
| **TS-003** | Math | Priority score invariant: I_n=0.8, F_n=0.5, S_n=1.0, weights 40/40/20 → P_c = 72.0 exactly | REQ-008 | PENDING | — |
| **TS-004** | Security | Static analysis of client JS bundle — zero API key strings detected | REQ-013 | PENDING | — |
| **TS-005** | Guardrail | Exact quote verification — green Verified badge for exact match; yellow Unverified badge for modified text | REQ-011 | PENDING | — |
| **TS-006** | UI Math | Live slider re-ranking — set ARR slider to 100%; cards re-ranked at 60 FPS; matrix plot coordinates (F_n, I_n) remain fixed | REQ-009, REQ-010 | PENDING | — |
| **TS-007** | Adversarial | Profane/angry feedback ("Your app is trash, export fails!") — extract functional failure; preserve row; no error thrown | REQ-005 | PENDING | — |
| **TS-008** | Math Edge | All sliders set to 0 — auto-default to 40/40/20; score does not evaluate to NaN | REQ-008 | PENDING | — |
| **TS-009** | AI Schema | Malformed LLM response — retries triggered; failed items routed to Unclustered Feedback bucket; app renders gracefully | REQ-005 | PENDING | — |
| **TS-010** | Ingestion | Duplicate feedback IDs in CSV — append row suffix (FB-001_row2); all IDs globally unique in memory | REQ-001 | PASS | **Date:** 2026-10-09 \| **Commit:** 7496b23 \| **Env:** Node v24.21.0, Win11, Vitest 2.1.4 \| **Command:** `npx vitest run tests/unit/ingest.test.ts` \| **Expected:** Unique suffix per collision, 100% unique IDs \| **Observed:** Suffixes FB-001_row2, FB-001_row3 assigned, Set size equals row count \| **Evidence Path:** `tests/unit/ingest.test.ts#L124-L135` |
| **TS-011** | Math Edge | Free-tier-only dataset (10 Free customers, I_c=10.0) — I_n computes to 1.0 correctly (not 0.0) | REQ-008 | PENDING | — |
| **TS-012** | AI Pipeline | Rate limit HTTP 429 response — exponential backoff triggered (up to 3 attempts); retries succeed or partial status flagged | REQ-006 | PENDING | — |
| **TS-013** | Output Safety | Source feedback lacking browser/OS context — [NEEDS INVESTIGATION] placeholder injected in Engineering Spec | REQ-007, REQ-012 | PENDING | — |
| **TS-014** | Accessibility | Keyboard navigation — all interactive components accessible via keyboard; 100% focus trap and tab stop coverage | — | PENDING | — |
| **TS-015** | UI Responsive | Tablet viewport (800px) — tabbed Matrix/Card layout renders; zero horizontal overflow scrolling | REQ-010 | PENDING | — |
| **TS-016** | Security | Proxy payload size limit — 5MB POST payload returns HTTP 413 Payload Too Large | REQ-013 | PASS | **Date:** 2026-10-09 \| **Commit:** 8b13f38 \| **Env:** Node v24.21.0, Win11, Vitest 2.1.4 \| **Command:** `npx vitest run tests/unit/proxy.test.ts` \| **Expected:** 5MB payload returns HTTP 413 Payload Too Large \| **Observed:** 5MB and >2MB payloads rejected with HTTP 413 and code PAYLOAD_TOO_LARGE; payloads under 2MB accepted \| **Evidence Path:** `tests/unit/proxy.test.ts#L224-L281` |
| **TS-017** | Data Policy | Missing Account IDs — display Confirmed: 0, Estimated: N; warning pill visible | REQ-004 | PASS | **Date:** 2026-10-09 \| **Commit:** 7496b23 \| **Env:** Node v24.21.0, Win11, Vitest 2.1.4 \| **Command:** `npx vitest run tests/unit/identity.test.ts` \| **Expected:** Confirmed: 0, Estimated: N, warning pill visible \| **Observed:** Confirmed: 0, Estimated: 4, warning pill 'Account IDs Unmapped — Frequency Estimated' rendered \| **Evidence Path:** `tests/unit/identity.test.ts#L173-L204` |
| **TS-018** | Provider Verification | AI Studio Smoke Test (4-step protocol): HTTP 200 / JSON schema valid / 6 batches no 429 / zero billing confirmed | REQ-013 | PASS | Executed 2026-10-09: HTTP 200 on gemini-3.5-flash; Ajv draft-07 valid (8 clusters); 6/6 burst requests 200 OK (0x 429); zero billing confirmed in dashboard (AG-AI-01/02/03) |
| **TS-019** | AI Reconciliation | Ambiguous cross-batch match (similarity 0.70) — cluster flagged "Uncertain Cluster — Review Recommended" | REQ-006 | PENDING | — |
| **TS-020** | Production Gate | Full test suite run — 100% pass rate across TS-001 through TS-019 | All P0 REQs | PENDING | — |
| **TS-021** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-022** | Logging Security | Zero payload logging — sentinel strings in request never appear in captured logs | REQ-013, IC-011 | PASS | **Date:** 2026-10-09 \| **Commit:** 8b13f38 \| **Env:** Node v24.21.0, Win11, Vitest 2.1.4 \| **Command:** `npx vitest run tests/unit/proxy.test.ts` \| **Expected:** Sentinel PII strings in request body never appear in captured logs \| **Observed:** Zero occurrences of sentinel PII strings in console or audit buffer; audit log records only numeric status, batch_index, itemCount, duration \| **Evidence Path:** `tests/unit/proxy.test.ts#L490-L536` |
| **TS-023** | Secrets Isolation | Zero secret echo & model locking — response headers and body never echo API key; model locked to AI_MODEL | REQ-013, DEC-PROVIDER, IC-010 | PASS | **Date:** 2026-10-09 \| **Commit:** 8b13f38 \| **Env:** Node v24.21.0, Win11, Vitest 2.1.4 \| **Command:** `npx vitest run tests/unit/proxy.test.ts` \| **Expected:** Key never echoed in body or headers; client model overrides strictly ignored \| **Observed:** Zero key or auth header echo in 200/error responses; request body model override ignored, env AI_MODEL gemini-3.5-flash invoked \| **Evidence Path:** `tests/unit/proxy.test.ts#L416-L489` |
| **TS-024** | Data Quality | Data quality metrics calculation (Unknown Tier %, Missing Account ID %, distinct-row union issue %) and warning banner trigger threshold (>5%) | REQ-004, §4.6, IC-012 | PASS | **Date:** 2026-10-09 \| **Commit:** 7496b23 \| **Env:** Node v24.21.0, Win11, Vitest 2.1.4 \| **Command:** `npx vitest run tests/unit/identity.test.ts` \| **Expected:** 3 distinct metrics, union deduplication, banner trigger at >5% \| **Observed:** 3 metrics verified, overlapping issue row counted once (union 30% vs sum 40%), banner triggers strictly at >5% with verbatim text \| **Evidence Path:** `tests/unit/identity.test.ts#L207-L282` |
| **TS-025** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-026** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-027** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-028** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-029** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-030** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-031** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-032** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-033** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-034** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-035** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-036** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-037** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |
| **TS-038** | TBD | Pre-registered — scenario to be defined in implementation sprint | TBD | PENDING | — |

---

## Notes

- TS-001 through TS-020 are fully defined in PRD v2.0 Part XII (Section 12.1).
- TS-021 through TS-038 are **pre-registered slots** reserved for implementation-phase tests (P1 polish, edge cases, accessibility deep-dives, performance benchmarks). Scenarios will be defined and added during the relevant implementation sprint.
- The gate TS-020 ("Production Gate") requires 100% PASS across TS-001–TS-019 — only then may it be run.

---

*Governed by AGENTS.md Standing Contract. Never change status without raw executed evidence.*
