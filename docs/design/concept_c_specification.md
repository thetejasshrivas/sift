# SIFT Visual Redesign — Concept C: Editorial Analytics Specification

> **Phase 2B Blueprint — SIFT Executive Intelligence Dossier**
> Status: Awaiting Founder Approval before Implementation
> Baseline: PRD v2.0, MDD v2.0.1, AGENTS.md (IC-001 – IC-016), Concept C Prototype

---

## 1. Executive Summary & Design Philosophy

The founder has selected **Concept C — Editorial Analytics** as SIFT's primary visual direction.

Concept C shifts SIFT from a generic dark dashboard into an **authoritative, high-trust executive intelligence suite**. Inspired by the quiet authority of Swiss broadsheet publishing and modern financial intelligence platforms (Stripe Press, Bloomberg Intelligence, The Economist), Concept C uses:
- A warm alabaster and parchment palette (`#FBF9F5` / `#FFFFFF`) that minimizes eye fatigue during deep strategic review.
- High-contrast, stately serif typography (`Fraunces`) for analytical headlines, paired with precision tabular sans (`Inter`) and monospace telemetry (`JetBrains Mono`).
- Fine hairline ink dividers (`#E5DFD5`) that structure dense data cleanly without heavy drop shadows or decorative gradients.
- Synchronized visual focus connecting the 2×2 spatial matrix and ranked insight dossiers.

---

## 2. Mandatory Skills Application & Governance

| Skill | Mandatory Rule | Architectural Translation in Concept C |
|:---|:---|:---|
| **`redesign-existing-projects`** | **Preserve core functionality, data contracts, and scoring logic.** Audit before editing. | Zero modifications to: priority scoring math ($P_c$), stationary matrix coordinates ($F_n, I_n$), account deduplication logic (`IC-012`), or proxy tier weights (`IC-002`). Only presentation and structural markup are upgraded. |
| **`impeccable`** | **Anti-slop typography, strict modular spacing, semantic tokenization, WCAG contrast.** | Replaces generic system fonts with a curated 3-font typographic scale; establishes an 8pt layout grid; replaces arbitrary hex values with CSS custom properties. |
| **`minimalist-ui`** | **Restraint, flat bento hierarchy, disciplined whitespace, zero gratuitous glows.** | Eliminates heavy blur filters and outer glows; relies on hairline border contrast and typographic hierarchy to define boundaries. |
| **`high-end-visual-design`** | **Agency-grade aesthetic, micro-contrast, high information density without visual exhaustion.** | Dossier-style cards with numbered indices (`01`, `02`), subtle paper tones, bracketed provenance badges (`[Verified Quote]`), and crisp tactile sliders. |

---

## 3. Design System Foundations & Tokens

### 3.1 Typography Scale
Loaded via Google Fonts (`Fraunces` variable serif, `Inter` sans-serif, `JetBrains Mono` monospace):

```css
:root {
  --font-serif: 'Fraunces', Georgia, serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}
```

* **Display / Wordmark:** `Fraunces` 600 weight, 24px, letter-spacing `-0.02em`.
* **Section Headlines:** `Fraunces` 600 weight, 18px–20px, optical size calibrated.
* **Card Titles:** `Fraunces` 600 weight, 16px, line-height `1.3`.
* **Priority Scores (Display):** `Fraunces` 600 weight, 32px, tabular lining figures.
* **Section Eyebrows / Meta Labels:** `JetBrains Mono` 600 weight, 10px, uppercase, letter-spacing `0.08em`.
* **Body / Verbatim Quotes:** `Inter` 400 weight, 12px–13px, line-height `1.5`, italic for quotes.
* **Badges / Coordinates / Numerical Substrings:** `JetBrains Mono` 500/600 weight, 10px–11px.

### 3.2 Color System & Semantic Tokens

```css
:root {
  /* Surfaces & Canvas */
  --bg-app: #FBF9F5;             /* Warm Alabaster Canvas */
  --bg-surface: #FFFFFF;         /* Crisp White Card/Panel Surface */
  --bg-subtle: #F4F1EA;          /* Inset Parchment / Quote Box */
  --bg-hover: #EFECE4;           /* Subtle Hover Tone */

  /* Hairline Borders */
  --border-main: #E5DFD5;        /* Neutral Hairline Border */
  --border-strong: #292524;      /* High-contrast Ink Border */
  --border-dashed: #A8A29E;      /* Grid Crosshair Dashed Line */
  --border-focus: #1C1917;       /* Keyboard Focus Ring */

  /* Text Roles */
  --text-primary: #1C1917;       /* Deep Ink Black (WCAG AAA >= 14:1) */
  --text-secondary: #57534E;     /* Warm Slate 600 (WCAG AA >= 6.5:1) */
  --text-muted: #A8A29E;         /* Warm Stone 400 */

  /* Semantic Status Roles */
  --sev-blocker-text: #991B1B;   /* Crimson 800 */
  --sev-blocker-bg: #FEF2F2;     /* Crimson 50 */
  --sev-blocker-border: #FECACA; /* Crimson 200 */

  --sev-major-text: #B45309;     /* Amber 700 */
  --sev-major-bg: #FFFBEB;       /* Amber 50 */
  --sev-major-border: #FDE68A;   /* Amber 200 */

  --sev-minor-text: #475569;     /* Slate 600 */
  --sev-minor-bg: #F1F5F9;       /* Slate 100 */
  --sev-minor-border: #CBD5E1;   /* Slate 300 */

  --quote-verified-text: #15803D; /* Forest Green 700 */
  --quote-verified-bg: #F0FDF4;
  --quote-near-text: #B45309;     /* Amber 700 */
  --quote-near-bg: #FFFBEB;
}
```

### 3.3 Spacing & Layout Architecture
* Base spacing unit: **4px / 8px modular scale** (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`).
* Desktop Canonical Split ($1280\text{px}$): **460px fixed left column (Matrix)**, **1fr fluid right column (Ranked Cards Stack)**.

---

## 4. Component Hierarchy & Redesign Blueprint

### 4.1 Global Application Bar (`App.tsx`)
* **Header Structure:** Stately `SIFT` wordmark in `Fraunces` serif. Inset metadata chips displaying active dataset name (`synthetic_50.csv`), row count (`50 rows`), and privacy badge (`ZERO PAYLOAD LOGGING`).
* **Design Detail:** 2px solid `--border-strong` bottom rule reminiscent of a publication masthead.

### 4.2 Priority Weight Calibration Bar (`CalibrationBar.tsx`)
* **Visual Treatment:** Clean horizontal brass/ink slider rail. Sliders have dark slate thumbs (`#292524`) and subtle track fills.
* **Component Values:**
  - Impact Weight ($W_{\text{ARR}}$): Default 40%
  - Frequency Weight ($W_{\text{Vol}}$): Default 40%
  - Severity Weight ($W_{\text{Sev}}$): Default 20%
* **Live Calculation:** Slider adjustments recalculate $P_c$ dynamically without altering matrix dot locations.

### 4.3 2×2 Spatial Priority Matrix (`SpatialMatrixView.tsx`)
* **Container:** Aspect ratio 1:1, warm parchment background (`#FAF8F5`), framed by 1px solid `--border-strong`.
* **Grid Crosshairs:** 1px dashed lines (`--border-dashed`) bisecting the container at $X = 50\%$ and $Y = 50\%$.
* **Canonical Quadrant Labels (`IC-014` Compliance):**
  - **Top-Right:** `High Revenue Risk / High Volume` (Crimson accent `#991B1B`)
  - **Top-Left:** `Enterprise Risk / Low Volume` (`#57534E`)
  - **Bottom-Right:** `Mass Friction / Low ARR` (`#57534E`)
  - **Bottom-Left:** `Low Priority` (`#A8A29E`)
* **Cluster Data Pins:**
  - Pinned strictly to $(F_n, I_n)$ coordinates.
  - Solid ink-black circular dots (`12px`) with white border and hairline halo. Critical blockers use `--sev-blocker-text` (`#991B1B`).
  - Monospace micro-tag beneath each pin showing `CLUST-XX (Score)`.
  - Hovering a pin highlights its corresponding card in the right column and vice versa.

### 4.4 Ranked Insight Cards Stack (`RankedCardList.tsx`)
* **Layout:** Vertical stack with `16px` gap. Each card features a 3-column dossier broadside layout:
  1. **Rank Column (72px):** Stately serif index numeral (`01`, `02`, `03`) in `--text-muted`, with `CLUST-XX` in monospace underneath. Separated by a 1px vertical hairline rule.
  2. **Content Column (Fluid):**
     - Title row with `Fraunces` serif cluster headline and semantic severity pill (`BLOCKER`, `MAJOR`, `MINOR`).
     - Metadata line: **Confirmed Accounts** (`IC-012` deduplicated count), **Estimated Incidents**, and **Tier Weight Proxy** (`Enterprise 3.0` / `Pro 2.0` / `Free 1.0` per `IC-002`).
     - Verbatim quote callout box: Inset parchment background (`--bg-subtle`), 2px solid left rule, exact verbatim source substring (`IC-001`), and `[Verified Quote]` or `[Near Match]` provenance tag.
  3. **Score & Action Column (110px):**
     - Uppercase monospace label `PRIORITY SCORE`.
     - Prominent 32px `Fraunces` serif priority score numeral (`91.2`).
     - Quadrant classification tag (`Top Decile`, `Enterprise Risk`, etc.).
     - Tactile "Inspect Dossier &rarr;" button that opens `DeepDiveDrawer.tsx`.

### 4.5 Deep Dive Drawer (`DeepDiveDrawer.tsx`)
* **Layout:** Slide-over drawer (640px desktop width) with warm alabaster backdrop, clean horizontal section slats, and tabbed inspection views:
  - **Overview Tab:** Complete cluster synthesis, formula breakdown, and tier weight distribution.
  - **Verbatim Evidence Tab:** All matched quotes from the CSV with exact row index numbers and highlighted matching substrings (`IC-001`).
  - **Account Roster Tab:** Distinct deduplicated account list (`IC-012`).

### 4.6 Ancillary UI Components
* **Data Quality Banner (`DataQualityBanner.tsx`):** Warm amber editorial alert triggered when UNKNOWN accounts exceed 5% of rows.
* **Upload Dropzone (`Dropzone.tsx`):** Clean broadsheet dropzone with dashed ink borders, drag-and-drop support, and CSV blueprint guidance.

---

## 5. Animation & Micro-Interactions

Following `impeccable` guidelines on purposeful motion:
* **Pin & Card Hover Sync:** Hovering a matrix pin smoothly scales it from `scale(1.0)` to `scale(1.25)` over `150ms` using `cubic-bezier(0.16, 1, 0.3, 1)`, while simultaneously illuminating the corresponding card border.
* **Score Transition:** When sliders move, score numbers update with a subtle opacity pulse (`120ms`) to confirm dynamic re-ranking.
* **Drawer Slide-Over:** Transitions smoothly from `translateX(100%)` to `translateX(0)` over `250ms` with zero layout shift.
* **Reduced Motion:** All transitions respect `@media (prefers-reduced-motion: reduce)` by falling back to instantaneous state swaps.

---

## 6. Responsive Behavior Across Viewports

| Viewport | Layout Strategy |
|:---|:---|
| **Desktop ($1280\text{px}$+)** | Side-by-side 45% (Matrix) / 55% (Ranked Cards) desktop workspace. Fixed height viewport with independent cards scrolling. |
| **Tablet ($768\text{px}$ – $1024\text{px}$)** | Stacked layout: Calibration bar at top, matrix rendered as a centered 420px square panel, followed by ranked cards below. Tap targets minimum 44px. |
| **Mobile ($375\text{px}$)** | Single column stack: Header collapsed, matrix presented in a collapsible accordion view with pinch-to-inspect, cards rendered with full-width quote blocks and vertical score badges. |

---

## 7. Accessibility (WCAG 2.1 AA Compliance)

1. **Color Contrast:**
   - Deep ink text (`#1C1917`) on warm alabaster (`#FBF9F5`): Contrast ratio **14.2:1** (Exceeds WCAG AAA requirement of 7:1).
   - Secondary text (`#57534E`) on white/alabaster: Contrast ratio **6.8:1** (Exceeds WCAG AA requirement of 4.5:1).
   - Blocker badge (`#991B1B` on `#FEF2F2`): Contrast ratio **5.8:1**.
2. **Keyboard Navigation:** Visible 2px solid `#1C1917` focus ring with 2px offset on all interactive buttons, sliders, and cards.
3. **Screen Readers:** ARIA labels on matrix pins (`aria-label="Cluster 01: CSV Export Timeout, Priority Score 91.2"`), `role="slider"` with `aria-valuenow` on calibration sliders.

---

## 8. Invariant Preservation Checklist

| Requirement | Baseline Reference | Status in Concept C |
|:---|:---|:---|
| **Verbatim Quotes** | `IC-001` | Displays exact source CSV substrings only; non-exact flagged `Unverified`. |
| **Tier Weights as Proxies** | `IC-002` | Labeled strictly as weight multipliers (`3.0`, `2.0`, `1.0`), never as dollar ARR. |
| **Fixed Matrix Coordinates** | PRD §5.2 | Plotted at $(F_n, I_n)$; sliders adjust priority score ($P_c$) but **never move matrix pins**. |
| **Exact Quadrant Labels** | `IC-014` | Uses exact strings: *High Revenue Risk / High Volume*, *Enterprise Risk / Low Volume*, *Mass Friction / Low ARR*, *Low Priority*. |
| **Account Deduplication** | `IC-012` | Confirmed unique accounts calculated by distinct Account IDs. |
| **Zero Payload Logging** | `IC-011` | Honest, literal privacy notice preserved in header and drawer. |

---

## 9. Implementation Scope (Phase 2B)

Phase 2B implementation will be executed in three scoped, verifiable steps:

1. **Step 1: Design Tokens & Typography Setup**
   - Update `index.html` to load Google Fonts (`Fraunces`, `Inter`, `JetBrains Mono`).
   - Refactor `src/index.css` to define the Concept C CSS custom property token system (`--bg-app`, `--font-serif`, etc.).
2. **Step 2: Component Presentation Upgrades**
   - Refactor `src/ui/SpatialMatrixView.tsx` with Concept C hairline crosshairs, small-caps quadrant typography, and pin hover states.
   - Refactor `src/ui/RankedCardList.tsx` with the 3-column dossier layout and serif priority score numerals.
   - Refactor `src/ui/CalibrationBar.tsx` and `src/App.tsx` header for broadsheet styling.
   - Refactor `src/ui/DeepDiveDrawer.tsx` to match the dossier aesthetic.
3. **Step 3: Multi-Viewport Validation & Regression Testing**
   - Verify all unit and integration tests pass (`npm test`).
   - Validate visual rendering across 375px, 768px, and 1280px via automated headless browser captures.

---

## 10. Functional & Regression Risks with Mitigations

| Identified Risk | Severity | Mitigation Strategy |
|:---|:---|:---|
| **Font Loading Flash (FOUT/FOIT)** | Low | Include `<link rel="preconnect">` and fall back gracefully to `Georgia, serif` and `system-ui`. |
| **Matrix Pin Clipping on Viewport Resize** | Medium | Maintain percentage-based coordinate offsets (`top: (1 - In)*100%`, `left: Fn*100%`) with CSS `transform: translate(-50%, 50%)` and boundary clamping. |
| **Card Content Overflow on Small Screens** | Medium | Use responsive CSS grid (`grid-template-columns: 1fr` under 640px) so the 3-column broadside card gracefully collapses into a vertical dossier card. |
| **Accidental Logic Mutation** | Critical | No changes permitted to scoring formulas in `src/scoring/` or ingestion algorithms in `src/ingest/`. |
