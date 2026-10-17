"""
scripts/generate_user_guide.py — Generates a 4-page Sift Visual User Guide PDF.
Governed by SIFT MDD v2.0.1, PRD v2.0, IC-001 through IC-016, and DEC-001 through DEC-010.

Pages:
1. Overview & Architectural Pillars
2. CSV Blueprint & 7 Columns Table
3. 2x2 Strategic Priority Matrix & 60 FPS Dynamic Sliders
4. Deep-Dive Drawer, Quote Verification & Engineering Spec Generation
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.patches as patches

# --- Color Palette ---
NAVY_DARK = "#0f172a"
SLATE_HEADER = "#1e293b"
SLATE_TEXT = "#334155"
SLATE_MUTED = "#64748b"
BG_LIGHT = "#f8fafc"
CARD_BG = "#ffffff"
BORDER_COLOR = "#cbd5e1"
ACCENT_BLUE = "#2563eb"
ACCENT_BLUE_LIGHT = "#eff6ff"
ACCENT_GREEN = "#10b981"
ACCENT_GREEN_LIGHT = "#ecfdf5"
ACCENT_AMBER = "#f59e0b"
ACCENT_AMBER_LIGHT = "#fffbeb"
ACCENT_RED = "#ef4444"
ACCENT_RED_LIGHT = "#fef2f2"
ACCENT_PURPLE = "#7c3aed"
ACCENT_PURPLE_LIGHT = "#f5f3ff"


def add_header_footer(ax, page_num, total_pages, title, subtitle):
    """Adds a standard header banner and footer to every page."""
    # Header background accent line
    ax.add_patch(patches.Rectangle((0, 0.94), 1, 0.06, facecolor=NAVY_DARK, edgecolor='none', transform=ax.transAxes))
    ax.text(0.04, 0.975, "SIFT", transform=ax.transAxes, fontsize=14, fontweight='bold', color="#ffffff", va='center')
    ax.text(0.12, 0.975, "|   AI-Native Product Feedback Discovery Workspace", transform=ax.transAxes, fontsize=9, color="#94a3b8", va='center')
    ax.text(0.96, 0.975, "VISUAL USER GUIDE", transform=ax.transAxes, fontsize=8, fontweight='bold', color="#38bdf8", ha='right', va='center')

    # Page Main Title & Subtitle
    ax.text(0.04, 0.905, title, transform=ax.transAxes, fontsize=16, fontweight='bold', color=NAVY_DARK, va='center')
    ax.text(0.04, 0.88, subtitle, transform=ax.transAxes, fontsize=9.5, color=SLATE_MUTED, va='center')
    ax.plot([0.04, 0.96], [0.865, 0.865], transform=ax.transAxes, color=ACCENT_BLUE, linewidth=1.5)

    # Footer
    ax.plot([0.04, 0.96], [0.04, 0.04], transform=ax.transAxes, color=BORDER_COLOR, linewidth=0.8)
    ax.text(0.04, 0.025, "Sift Product Guide   •   Ephemeral Browser-Local Discovery   •   Strict Zero-Persistence", transform=ax.transAxes, fontsize=7.5, color=SLATE_MUTED, va='center')
    ax.text(0.96, 0.025, f"Page {page_num} of {total_pages}", transform=ax.transAxes, fontsize=8, fontweight='bold', color=NAVY_DARK, ha='right', va='center')


def draw_card(ax, x, y, width, height, bg_color=CARD_BG, border_color=BORDER_COLOR, linewidth=1.0, corner_radius=0.015):
    """Draws a rounded rectangular card container."""
    box = patches.FancyBboxPatch(
        (x, y), width, height,
        boxstyle=f"round,pad=0,rounding_size={corner_radius}",
        facecolor=bg_color, edgecolor=border_color, linewidth=linewidth,
        transform=ax.transAxes
    )
    ax.add_patch(box)
    return box


# ==============================================================================
# PAGE 1: OVERVIEW & ARCHITECTURAL PILLARS
# ==============================================================================
def build_page_1(pdf):
    fig = plt.figure(figsize=(8.5, 11), dpi=300)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis('off')

    add_header_footer(ax, 1, 4,
                      "1. System Overview & Core Architectural Pillars",
                      "How Sift transforms high-volume unstructured feedback into verified roadmap action items")

    # --- Top Banner: The Product Problem & Sift Solution ---
    draw_card(ax, 0.04, 0.74, 0.92, 0.11, bg_color=ACCENT_BLUE_LIGHT, border_color=ACCENT_BLUE, linewidth=1.2)
    ax.text(0.06, 0.825, "THE B2B SAAS FEEDBACK CRISIS & SIFT'S APPROACH", transform=ax.transAxes,
            fontsize=10, fontweight='bold', color=ACCENT_BLUE, va='center')
    summary_text = (
        "Modern product teams face thousands of unstructured feedback rows across Zendesk, Gong, Intercom, and G2.\n"
        "Traditional tools create 'Unweighted Volume Illusions' (10 free users requesting dark mode outvote 1 Enterprise account\n"
        "threatening to churn over a data export timeout). LLM chatbots invent hallucinated quotes and ungrounded tech specs.\n"
        "Sift couples client-side deterministic math with controlled 2-pass AI clustering and verbatim substring verification."
    )
    ax.text(0.06, 0.775, summary_text, transform=ax.transAxes, fontsize=8.2, color=SLATE_TEXT, va='center', linespacing=1.35)

    # --- 4 Core Pillars Grid (2x2) ---
    pillars = [
        ("Pillar 1: Ephemeral Local-First Privacy",
         "• 100% in-browser CSV parsing via PapaParse (no database).\n"
         "• Stateless serverless proxy with ZERO payload logging.\n"
         "• API keys locked on edge; client bundles contain zero secrets.\n"
         "• Unprocessed rows remain in ephemeral browser state.",
         0.04, 0.555, ACCENT_GREEN, ACCENT_GREEN_LIGHT),

        ("Pillar 2: Deterministic Hybrid Math (No LLM Guesswork)",
         "• Score: P_c = Round_1(100 × [W_ARR·I_n + W_Vol·F_n + W_Sev·S_n]).\n"
         "• Live sliders recalculate rank in <1.5 ms (60 FPS benchmark).\n"
         "• Stationary Coordinates: Matrix dots (F_n, I_n) NEVER move on drag.\n"
         "• UNKNOWN tiers isolated at 1.0x baseline weight multiplier.",
         0.51, 0.555, ACCENT_BLUE, ACCENT_BLUE_LIGHT),

        ("Pillar 3: Verbatim Quote Verification (IC-001)",
         "• Exact substring inclusion against source CSV row in memory.\n"
         "• Zero .trim(), zero lowercasing, zero punctuation normalization.\n"
         "• Exact matches get green 'Verified Quote' badge.\n"
         "• Normalized near-matches explicitly flagged 'Not Verbatim Verified'.",
         0.04, 0.365, ACCENT_AMBER, ACCENT_AMBER_LIGHT),

        ("Pillar 4: 5-Tier Safety Decoupling (PRD §7.4)",
         "• Raw observations separated from AI root-cause hypotheses.\n"
         "• Missing tech context triggers '[NEEDS INVESTIGATION]' tags.\n"
         "• Copy-ready PM Strategic Rationales & Dev Engineering Specs.\n"
         "• Zero AI hallucination of databases, APIs, or architectural stacks.",
         0.51, 0.365, ACCENT_PURPLE, ACCENT_PURPLE_LIGHT),
    ]

    for title, desc, px, py, accent_col, bg_col in pillars:
        draw_card(ax, px, py, 0.45, 0.165, bg_color="#ffffff", border_color=BORDER_COLOR)
        draw_card(ax, px, py + 0.13, 0.45, 0.035, bg_color=bg_col, border_color=accent_col, linewidth=0.8)
        ax.text(px + 0.02, py + 0.147, title, transform=ax.transAxes, fontsize=8.8, fontweight='bold', color=accent_col, va='center')
        ax.text(px + 0.02, py + 0.065, desc, transform=ax.transAxes, fontsize=8.0, color=SLATE_TEXT, va='center', linespacing=1.35)

    # --- End-to-End Workflow Diagram ---
    draw_card(ax, 0.04, 0.075, 0.92, 0.265, bg_color=BG_LIGHT, border_color=BORDER_COLOR)
    ax.text(0.06, 0.315, "END-TO-END DISCOVERY & TRIAGE PIPELINE", transform=ax.transAxes,
            fontsize=10, fontweight='bold', color=NAVY_DARK, va='center')

    steps = [
        ("1. Ingestion & Schema", "Drop 300–2,000 row CSV\nAuto-detect 7 columns\nIsolate UNKNOWN tiers", 0.06),
        ("2. Two-Pass AI Proxy", "50-row batching (~8k tok)\nPass 1 cluster formulation\nPass 2 category reconcile", 0.29),
        ("3. Math & 2x2 Matrix", "Deterministic P_c scoring\n4 quadrant categorization\n60 FPS live slider ranks", 0.52),
        ("4. Evidence & Specs", "IC-001 quote verification\n[NEEDS INVESTIGATION]\nCopy PM & Eng deliverables", 0.75)
    ]

    for stitle, sdesc, sx in steps:
        draw_card(ax, sx, 0.105, 0.19, 0.18, bg_color=CARD_BG, border_color=BORDER_COLOR)
        # Step header pill
        draw_card(ax, sx + 0.01, 0.245, 0.17, 0.03, bg_color=NAVY_DARK, border_color=NAVY_DARK)
        ax.text(sx + 0.095, 0.26, stitle, transform=ax.transAxes, fontsize=7.5, fontweight='bold', color="#ffffff", ha='center', va='center')
        ax.text(sx + 0.095, 0.17, sdesc, transform=ax.transAxes, fontsize=7.2, color=SLATE_TEXT, ha='center', va='center', linespacing=1.3)

    # Arrows between workflow steps
    for ax_pos in [0.255, 0.485, 0.715]:
        ax.text(ax_pos, 0.195, "➔", transform=ax.transAxes, fontsize=14, color=ACCENT_BLUE, ha='center', va='center')

    pdf.savefig(fig)
    plt.close(fig)


# ==============================================================================
# PAGE 2: CSV BLUEPRINT & 7 COLUMNS TABLE
# ==============================================================================
def build_page_2(pdf):
    fig = plt.figure(figsize=(8.5, 11), dpi=300)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis('off')

    add_header_footer(ax, 2, 4,
                      "2. CSV Blueprint & 7 Canonical Columns Specification",
                      "Standardize messy feedback exports while guaranteeing zero data loss and strict privacy")

    # --- Section: Ingestion Engine Parameters ---
    draw_card(ax, 0.04, 0.77, 0.92, 0.085, bg_color=CARD_BG, border_color=BORDER_COLOR)
    ax.text(0.06, 0.835, "INGESTION ENGINE PARAMETERS & DATA LIMITS (REQ-001 & REQ-002)", transform=ax.transAxes,
            fontsize=9.5, fontweight='bold', color=NAVY_DARK, va='center')
    engine_meta = (
        "• Parsing: Browser-local PapaParse with auto delimiter detection (comma, tab, semicolon) and UTF-8/UTF-16 encoding.\n"
        "• Capacity Ceiling: Up to 10 MB or 2,000 rows parsed in memory. (300 rows benchmarks in <40 ms; ceiling benchmarks in <0.5 s).\n"
        "• Privacy Invariant: Raw feedback text never leaves client memory except via chunked JSON to the stateless proxy route."
    )
    ax.text(0.06, 0.795, engine_meta, transform=ax.transAxes, fontsize=7.8, color=SLATE_TEXT, va='center', linespacing=1.3)

    # --- Section: The 7 Columns Specification Table ---
    ax.text(0.04, 0.74, "CANONICAL 7-COLUMN SCHEMA MAPPING GRID", transform=ax.transAxes,
            fontsize=10, fontweight='bold', color=NAVY_DARK, va='center')

    # Table layout coordinates
    cols = [
        ("Column Name", 0.04, 0.15),
        ("Key", 0.19, 0.09),
        ("Req", 0.28, 0.07),
        ("Recognized Aliases / Headers", 0.35, 0.25),
        ("Handling, Weight Multipliers & Fallback Rules", 0.60, 0.36)
    ]

    # Header Row
    draw_card(ax, 0.04, 0.685, 0.92, 0.035, bg_color=NAVY_DARK, border_color=NAVY_DARK)
    for ctitle, cx, cw in cols:
        ax.text(cx + 0.01, 0.702, ctitle, transform=ax.transAxes, fontsize=7.8, fontweight='bold', color="#ffffff", va='center')

    rows_data = [
        ("Raw Feedback Text", "text", "Required",
         "feedback, text, comment, description,\nnotes, review, issue_description",
         "Mandatory core text. Preserved verbatim. Missing column\nblocks ingestion with explicit error toast."),

        ("Customer Tier / ARR", "tier", "Optional",
         "tier, plan, arr, mrr, customer_tier,\naccount_type, segment",
         "Mapped to Enterprise (3.0x), Pro (2.0x), Free (1.0x).\nMissing/invalid rows set to UNKNOWN (1.0x proxy)."),

        ("Feedback ID", "feedback_id", "Optional",
         "id, uuid, row_id, ticket_id,\nfeedback_id, reference_id",
         "Preserved verbatim. If omitted, Sift assigns stable\nsequential IDs (FB-001). Duplicates get '_row2' suffix."),

        ("Account ID", "account_id", "Optional",
         "account_id, company, org_id, domain,\ncustomer_name, organization",
         "Paying corporate entity. Dual-reporting: Confirmed accounts\nvs Estimated rows. Triggers warning pill if unmapped."),

        ("User ID / Submitter", "user_id", "Optional",
         "user_id, author_id, email, submitter,\nuser_email, contact_id",
         "Individual human submitter. Enables user-level incident\ncounts while strictly decoupled from corporate accounts."),

        ("Source Channel", "source", "Optional",
         "channel, source, touchpoint, platform,\norigin, intake_method",
         "Categorizes origin (Zendesk, Gong, Intercom, G2, In-App).\nPreserved in deep-dive evidence panel."),

        ("Date Submitted", "date", "Optional",
         "date, created_at, timestamp, time,\nsubmitted_at, log_date",
         "Temporal tracking for churn velocity and recency.\nPreserved in raw metadata inspection table.")
    ]

    y_pos = 0.645
    for r_idx, (r_name, r_key, r_req, r_aliases, r_rules) in enumerate(rows_data):
        row_bg = CARD_BG if r_idx % 2 == 0 else BG_LIGHT
        draw_card(ax, 0.04, y_pos - 0.015, 0.92, 0.052, bg_color=row_bg, border_color=BORDER_COLOR)

        ax.text(0.04 + 0.01, y_pos + 0.01, r_name, transform=ax.transAxes, fontsize=7.8, fontweight='bold', color=NAVY_DARK, va='center')
        ax.text(0.19 + 0.01, y_pos + 0.01, r_key, transform=ax.transAxes, fontsize=7.4, fontfamily='monospace', color=ACCENT_BLUE, va='center')

        req_color = ACCENT_RED if r_req == "Required" else SLATE_MUTED
        ax.text(0.28 + 0.01, y_pos + 0.01, r_req, transform=ax.transAxes, fontsize=7.5, fontweight='bold', color=req_color, va='center')

        ax.text(0.35 + 0.01, y_pos + 0.01, r_aliases, transform=ax.transAxes, fontsize=6.8, color=SLATE_TEXT, va='center', linespacing=1.2)
        ax.text(0.60 + 0.01, y_pos + 0.01, r_rules, transform=ax.transAxes, fontsize=6.8, color=SLATE_TEXT, va='center', linespacing=1.2)
        y_pos -= 0.054

    # --- Section: Data Quality & Defensive Integrity Rules ---
    ax.text(0.04, 0.245, "CRITICAL DATA QUALITY & IDENTITY GUARDRAILS", transform=ax.transAxes,
            fontsize=10, fontweight='bold', color=NAVY_DARK, va='center')

    cards = [
        ("Data Quality Warning Banner (IC-012)",
         "Displayed whenever UNKNOWN tier or unmapped accounts >5%.\n"
         "Notice: 'Data Quality Warning: N% of records lack\n"
         "tier/account metadata and are evaluated provisionally\n"
         "(1.0x weight). Scores may reflect volume over ARR.'",
         0.04, 0.145, 0.45, 0.085, ACCENT_AMBER, ACCENT_AMBER_LIGHT),

        ("Dual Account Identity Counts (REQ-003)",
         "Sift never fabricates corporate names. Dual reporting:\n"
         "• Confirmed: Deduplicated unique Account IDs.\n"
         "• Estimated: 1 row = 1 provisional account (U_c = N_c).\n"
         "• Warning pill: 'Account IDs Unmapped — Frequency Estimated'.",
         0.51, 0.145, 0.45, 0.085, ACCENT_BLUE, ACCENT_BLUE_LIGHT),

        ("Strict UNKNOWN Tier Isolation (DEC-003)",
         "Missing customer tier is NEVER auto-coerced to Free or $0.\n"
         "Carries a neutral 1.0x weight multiplier (preventing score distortion)\n"
         "while maintaining clear visual badges in deep-dive drawer.",
         0.04, 0.05, 0.45, 0.085, ACCENT_PURPLE, ACCENT_PURPLE_LIGHT),

        ("Verbatim Cell Storage (IC-001)",
         "PapaParse outputs are stored without trimming, case conversion,\n"
         "or character stripping. Exact substrings guarantee downstream\n"
         "receipt verification passes without false negative mismatches.",
         0.51, 0.05, 0.45, 0.085, ACCENT_GREEN, ACCENT_GREEN_LIGHT),
    ]

    for ctitle, cdesc, cx, cy, cw, ch, col_accent, col_bg in cards:
        draw_card(ax, cx, cy, cw, ch, bg_color=CARD_BG, border_color=BORDER_COLOR)
        draw_card(ax, cx, cy + ch - 0.024, cw, 0.024, bg_color=col_bg, border_color=col_accent, linewidth=0.8)
        ax.text(cx + 0.015, cy + ch - 0.012, ctitle, transform=ax.transAxes, fontsize=7.8, fontweight='bold', color=col_accent, va='center')
        ax.text(cx + 0.015, cy + (ch - 0.024) / 2, cdesc, transform=ax.transAxes, fontsize=6.8, color=SLATE_TEXT, va='center', linespacing=1.25)

    pdf.savefig(fig)
    plt.close(fig)


# ==============================================================================
# PAGE 3: 2x2 MATRIX & DYNAMIC SLIDERS
# ==============================================================================
def build_page_3(pdf):
    fig = plt.figure(figsize=(8.5, 11), dpi=300)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis('off')

    add_header_footer(ax, 3, 4,
                      "3. 2x2 Strategic Priority Matrix & 60-FPS Dynamic Sliders",
                      "Visualizing ARR revenue risk vs incident volume with stationary physical coordinate invariants")

    # --- Priority Formula Box ---
    draw_card(ax, 0.04, 0.77, 0.92, 0.085, bg_color=CARD_BG, border_color=BORDER_COLOR)
    ax.text(0.06, 0.835, "HYBRID DETERMINISTIC SCORING FORMULA (PRD §6.1 & MDD §3.5)", transform=ax.transAxes,
            fontsize=9.5, fontweight='bold', color=NAVY_DARK, va='center')
    formula_desc = (
        r"$\mathbf{P_c = \mathrm{Round}_1\left(100 \times \left[ W_{\mathrm{ARR}} \cdot I_n + W_{\mathrm{Vol}} \cdot F_n + W_{\mathrm{Sev}} \cdot S_n \right]\right)}$" +
        "   |   Defaults: 40% ARR Impact, 40% Volume, 20% Severity\n"
        "• Normalized Revenue Impact (I_n): Weighted tier sum divided by max dataset cluster sum.\n"
        "• Normalized Volume (F_n): Log-normalized frequency count (F_n = ln(1 + N_c) / ln(1 + N_max)).\n"
        "• Severity Score (S_n): Direct mapping from cluster severity (Blocker=1.0, Major=0.6, Minor=0.3)."
    )
    ax.text(0.06, 0.795, formula_desc, transform=ax.transAxes, fontsize=8.0, color=SLATE_TEXT, va='center', linespacing=1.3)

    # --- Left: 2x2 Matrix Graphic ---
    draw_card(ax, 0.04, 0.31, 0.50, 0.44, bg_color=BG_LIGHT, border_color=BORDER_COLOR)
    ax.text(0.06, 0.725, "THE 2x2 STRATEGIC DECISION MATRIX", transform=ax.transAxes,
            fontsize=9.5, fontweight='bold', color=NAVY_DARK, va='center')

    # Draw the 4 quadrants inside the matrix card
    # Card boundaries: x: 0.07 to 0.51, y: 0.35 to 0.70
    qx0, qy0, qw, qh = 0.07, 0.35, 0.44, 0.34
    qmid_x = qx0 + qw / 2
    qmid_y = qy0 + qh / 2

    # Quadrant 2 (Top Left): Enterprise Risk / Low Volume
    draw_card(ax, qx0, qmid_y, qw/2 - 0.005, qh/2 - 0.005, bg_color=ACCENT_PURPLE_LIGHT, border_color=ACCENT_PURPLE, linewidth=0.8)
    ax.text(qx0 + 0.012, qmid_y + qh/4 + 0.03, "Enterprise Risk /\nLow Volume", transform=ax.transAxes,
            fontsize=7.8, fontweight='bold', color=ACCENT_PURPLE, va='center')
    ax.text(qx0 + 0.012, qmid_y + 0.02, "Few accounts, high ARR churn risk", transform=ax.transAxes, fontsize=6.3, color=SLATE_MUTED)

    # Quadrant 1 (Top Right): High Revenue Risk / High Volume
    draw_card(ax, qmid_x + 0.005, qmid_y, qw/2 - 0.005, qh/2 - 0.005, bg_color=ACCENT_RED_LIGHT, border_color=ACCENT_RED, linewidth=0.8)
    ax.text(qmid_x + 0.015, qmid_y + qh/4 + 0.03, "High Revenue Risk /\nHigh Volume", transform=ax.transAxes,
            fontsize=7.8, fontweight='bold', color=ACCENT_RED, va='center')
    ax.text(qmid_x + 0.015, qmid_y + 0.02, "Immediate executive roadmap priority", transform=ax.transAxes, fontsize=6.3, color=SLATE_MUTED)

    # Quadrant 3 (Bottom Left): Low Priority
    draw_card(ax, qx0, qy0, qw/2 - 0.005, qh/2 - 0.005, bg_color="#ffffff", border_color=BORDER_COLOR, linewidth=0.8)
    ax.text(qx0 + 0.012, qy0 + qh/4 + 0.03, "Low Priority", transform=ax.transAxes,
            fontsize=7.8, fontweight='bold', color=SLATE_MUTED, va='center')
    ax.text(qx0 + 0.012, qy0 + 0.02, "Monitor in backlog / triage later", transform=ax.transAxes, fontsize=6.3, color=SLATE_MUTED)

    # Quadrant 4 (Bottom Right): Mass Friction / Low ARR
    draw_card(ax, qmid_x + 0.005, qy0, qw/2 - 0.005, qh/2 - 0.005, bg_color=ACCENT_AMBER_LIGHT, border_color=ACCENT_AMBER, linewidth=0.8)
    ax.text(qmid_x + 0.015, qy0 + qh/4 + 0.03, "Mass Friction /\nLow ARR", transform=ax.transAxes,
            fontsize=7.8, fontweight='bold', color=ACCENT_AMBER, va='center')
    ax.text(qmid_x + 0.015, qy0 + 0.02, "High-volume UX polish / self-serve PLG", transform=ax.transAxes, fontsize=6.3, color=SLATE_MUTED)

    # Illustrative Dot Clusters (Positioned cleanly without text collision)
    dots = [
        (qmid_x + 0.16, qmid_y + 0.08, ACCENT_RED),
        (qmid_x + 0.09, qmid_y + 0.05, ACCENT_RED),
        (qx0 + 0.14, qmid_y + 0.06, ACCENT_PURPLE),
        (qmid_x + 0.15, qy0 + 0.06, ACCENT_AMBER),
        (qx0 + 0.14, qy0 + 0.06, SLATE_MUTED)
    ]
    for dx, dy, dcol in dots:
        dot = patches.Circle((dx, dy), 0.007, facecolor=dcol, edgecolor="#ffffff", linewidth=1.2, transform=ax.transAxes)
        ax.add_patch(dot)

    # Matrix Axis Labels
    ax.text(qmid_x, 0.33, "Incident Volume (Frequency F_n)  ➔", transform=ax.transAxes,
            fontsize=7.5, fontweight='bold', color=NAVY_DARK, ha='center', va='center')
    ax.text(0.055, qmid_y, "Customer Tier Weight / ARR Impact (I_n)  ➔", transform=ax.transAxes,
            fontsize=7.5, fontweight='bold', color=NAVY_DARK, ha='center', va='center', rotation=90)

    # --- Right: Stationary Coordinates & Live Sliders Box ---
    draw_card(ax, 0.56, 0.31, 0.40, 0.44, bg_color=CARD_BG, border_color=BORDER_COLOR)
    ax.text(0.58, 0.725, "STATIONARY COORDINATE INVARIANT (DEC-010)", transform=ax.transAxes,
            fontsize=9.0, fontweight='bold', color=NAVY_DARK, va='center')

    invariant_desc = (
        "CRITICAL PRODUCT RULE (MDD §4.2 & TS-006):\n"
        "When a user drags weighting sliders (ARR, Volume, Severity),\n"
        "matrix dots (F_n, I_n) DO NOT MOVE on the chart.\n\n"
        "• Why? Physical reality does not change when internal team\n"
        "  priorities change. Volume is volume; tier impact is tier impact.\n"
        "• What updates? Cluster Priority Score (P_c), quadrant badge,\n"
        "  and the sorted card list in the adjacent view.\n"
        "• Latency: Under 1.5 ms execution benchmark ensures buttery-smooth\n"
        "  60 FPS responsiveness even with 1,000+ clusters."
    )
    ax.text(0.58, 0.60, invariant_desc, transform=ax.transAxes, fontsize=7.2, color=SLATE_TEXT, va='center', linespacing=1.35)

    # Slider Mockup Visual
    draw_card(ax, 0.58, 0.335, 0.36, 0.14, bg_color=BG_LIGHT, border_color=BORDER_COLOR)
    ax.text(0.60, 0.455, "Live Slider Control Panel (Defaults)", transform=ax.transAxes, fontsize=7.8, fontweight='bold', color=NAVY_DARK)

    sliders = [
        ("ARR / Impact Weight (W_ARR)", "40%", 0.42, ACCENT_BLUE),
        ("Volume Weight (W_Vol)", "40%", 0.38, ACCENT_GREEN),
        ("Severity Weight (W_Sev)", "20%", 0.34, ACCENT_AMBER)
    ]
    for s_name, s_val, s_y, s_color in sliders:
        ax.text(0.60, s_y, s_name, transform=ax.transAxes, fontsize=6.8, color=SLATE_TEXT)
        ax.text(0.91, s_y, s_val, transform=ax.transAxes, fontsize=7.0, fontweight='bold', color=s_color, ha='right')
        # Slider Track
        ax.plot([0.60, 0.86], [s_y - 0.012, s_y - 0.012], transform=ax.transAxes, color=BORDER_COLOR, linewidth=3)
        # Slider Fill
        fill_x = 0.60 + 0.26 * (0.4 if s_val == "40%" else 0.2)
        ax.plot([0.60, fill_x], [s_y - 0.012, s_y - 0.012], transform=ax.transAxes, color=s_color, linewidth=3)
        # Slider Knob
        knob = patches.Circle((fill_x, s_y - 0.012), 0.005, facecolor="#ffffff", edgecolor=s_color, linewidth=1.5, transform=ax.transAxes)
        ax.add_patch(knob)

    # --- Bottom: Four Canonical Quadrant Definitions ---
    ax.text(0.04, 0.275, "CANONICAL 2x2 QUADRANT POLICY & ACTION BLUEPRINT (IC-014)", transform=ax.transAxes,
            fontsize=10, fontweight='bold', color=NAVY_DARK, va='center')

    quadrant_specs = [
        ("High Revenue Risk / High Volume",
         "Top-Right: Chronic blockers\nimpacting enterprise ARR.\nAction: Sprint commitment;\ngenerate Engineering Spec.",
         0.04, 0.075, 0.22, 0.18, ACCENT_RED, ACCENT_RED_LIGHT),

        ("Enterprise Risk / Low Volume",
         "Top-Left: Bespoke enterprise\npain points & churn threats.\nAction: CS advisory;\nexecutive discovery call.",
         0.27, 0.075, 0.22, 0.18, ACCENT_PURPLE, ACCENT_PURPLE_LIGHT),

        ("Mass Friction / Low ARR",
         "Bottom-Right: Broad UX paper\ncuts across self-serve tiers.\nAction: PLG backlog;\nbatch into UI polish sprints.",
         0.50, 0.075, 0.22, 0.18, ACCENT_AMBER, ACCENT_AMBER_LIGHT),

        ("Low Priority",
         "Bottom-Left: Niche or cosmetic\nfeedback with minimal impact.\nAction: Retain in backlog;\nmonitor future cohort trend.",
         0.73, 0.075, 0.23, 0.18, SLATE_MUTED, BG_LIGHT),
    ]

    for qname, qdesc, qx, qy, qw, qh, qcol, qbg in quadrant_specs:
        draw_card(ax, qx, qy, qw, qh, bg_color=CARD_BG, border_color=BORDER_COLOR)
        draw_card(ax, qx, qy + qh - 0.035, qw, 0.035, bg_color=qbg, border_color=qcol, linewidth=0.8)
        ax.text(qx + 0.01, qy + qh - 0.018, qname, transform=ax.transAxes, fontsize=7.2, fontweight='bold', color=qcol, va='center')
        ax.text(qx + 0.01, qy + (qh - 0.035) / 2, qdesc, transform=ax.transAxes, fontsize=6.8, color=SLATE_TEXT, va='center', linespacing=1.3)

    pdf.savefig(fig)
    plt.close(fig)


# ==============================================================================
# PAGE 4: DRAWER, QUOTE VERIFICATION & SPEC GENERATION
# ==============================================================================
def build_page_4(pdf):
    fig = plt.figure(figsize=(8.5, 11), dpi=300)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis('off')

    add_header_footer(ax, 4, 4,
                      "4. Deep-Dive Drawer, Quote Verification & Spec Generation",
                      "Auditing exact evidence receipts and generating copy-ready deliverables for PMs and Engineers")

    # --- Top: The Deep-Dive Drawer Architecture ---
    draw_card(ax, 0.04, 0.58, 0.45, 0.275, bg_color=CARD_BG, border_color=BORDER_COLOR)
    ax.text(0.06, 0.835, "THE DEEP-DIVE EVIDENCE DRAWER", transform=ax.transAxes,
            fontsize=9.5, fontweight='bold', color=NAVY_DARK, va='center')

    drawer_anatomy = (
        "Clicking any cluster card opens an accessible slide-over drawer\n"
        "exposing four decoupled intelligence layers:\n\n"
        "1. Metric Bar: Priority Score (P_c), Severity Badge (1–3),\n"
        "   Affected Accounts count (Confirmed vs Estimated).\n"
        "2. AI Root-Cause Hypothesis: Demarcated as 'AI-Drafted',\n"
        "   explaining mechanical failure (e.g. 60s gateway timeout).\n"
        "3. Traceable Evidence Panel: Verbatim quote receipts,\n"
        "   exact substring verification badges, and source row reveal.\n"
        "4. Action Output Hub: One-click export of copy-ready PM\n"
        "   Strategic Rationales and Developer Engineering Specs."
    )
    ax.text(0.06, 0.705, drawer_anatomy, transform=ax.transAxes, fontsize=7.2, color=SLATE_TEXT, va='center', linespacing=1.35)

    # --- Top Right: Exact Quote Verification Engine (IC-001) ---
    draw_card(ax, 0.51, 0.58, 0.45, 0.275, bg_color=CARD_BG, border_color=BORDER_COLOR)
    ax.text(0.53, 0.835, "EXACT QUOTE VERIFICATION (IC-001 & TS-005)", transform=ax.transAxes,
            fontsize=9.5, fontweight='bold', color=NAVY_DARK, va='center')

    verify_engine_desc = (
        "SIFT'S CARDINAL VERIFICATION RULE:\n"
        "Quotes displayed in evidence panels MUST BE exact verbatim substrings\n"
        "of the source CSV row. No paraphrasing, no rewording.\n\n"
        "Badges & Guardrails:\n"
        "• [Verified Quote] (Green Badge): Exact case-sensitive match.\n"
        "• [Near Match / Normalized — Not Verbatim Verified] (Amber):\n"
        "  Displayed if punctuation/whitespace was modified by LLM.\n"
        "• [Source row not found]: Displayed if Feedback ID is missing.\n"
        "• [Reveal Full Raw Row]: Interactive toggle revealing unmutated\n"
        "  raw text directly from the parsed CSV in memory."
    )
    ax.text(0.53, 0.705, verify_engine_desc, transform=ax.transAxes, fontsize=7.2, color=SLATE_TEXT, va='center', linespacing=1.35)

    # --- Middle: 5-Tier Safety Decoupling Framework ---
    draw_card(ax, 0.04, 0.38, 0.92, 0.18, bg_color=BG_LIGHT, border_color=BORDER_COLOR)
    ax.text(0.06, 0.535, "THE 5-TIER SAFETY DECOUPLING ARCHITECTURE (DEC-005 & TS-013)", transform=ax.transAxes,
            fontsize=9.5, fontweight='bold', color=NAVY_DARK, va='center')

    tiers = [
        ("Tier 1: Observation", "Raw user feedback\npreserved in client memory", 0.06, ACCENT_BLUE),
        ("Tier 2: Verified Quotes", "IC-001 exact substring\nreceipts only", 0.24, ACCENT_GREEN),
        ("Tier 3: AI Hypothesis", "Thematic failure root-cause\nlabeled 'AI-Drafted'", 0.42, ACCENT_PURPLE),
        ("Tier 4: Investigations", "Injected [NEEDS INVESTIGATION]\nplaceholders for missing context", 0.60, ACCENT_AMBER),
        ("Tier 5: Eng Notes", "Human architecture decisions\ndecoupled from AI guessing", 0.78, NAVY_DARK)
    ]
    for tname, tdesc, tx, tcol in tiers:
        draw_card(ax, tx, 0.40, 0.16, 0.11, bg_color=CARD_BG, border_color=BORDER_COLOR)
        draw_card(ax, tx, 0.485, 0.16, 0.025, bg_color=CARD_BG, border_color=tcol, linewidth=0.8)
        ax.text(tx + 0.08, 0.497, tname, transform=ax.transAxes, fontsize=7.2, fontweight='bold', color=tcol, ha='center', va='center')
        ax.text(tx + 0.08, 0.44, tdesc, transform=ax.transAxes, fontsize=6.6, color=SLATE_TEXT, ha='center', va='center', linespacing=1.2)

    # --- Bottom: Two Canonical Deliverables Comparison ---
    ax.text(0.04, 0.35, "COPY-READY ROLE-TAILORED DELIVERABLES GENERATOR", transform=ax.transAxes,
            fontsize=10, fontweight='bold', color=NAVY_DARK, va='center')

    # PM Deliverable Card
    draw_card(ax, 0.04, 0.075, 0.45, 0.255, bg_color=CARD_BG, border_color=BORDER_COLOR)
    draw_card(ax, 0.04, 0.295, 0.45, 0.035, bg_color=ACCENT_BLUE_LIGHT, border_color=ACCENT_BLUE, linewidth=0.8)
    ax.text(0.06, 0.312, "PM Strategic Trade-Off Rationale (PRD §7.4)", transform=ax.transAxes,
            fontsize=8.5, fontweight='bold', color=ACCENT_BLUE, va='center')

    pm_content = (
        "Executive decision memo format with 5 canonical sections:\n"
        "• Header: Priority Score (P_c), Severity, Confirmed/Estimated accounts.\n"
        "• Section 1: Executive Summary & Customer Problem Statement.\n"
        "• Section 2: Business & ARR Impact (strict proxy tier weights;\n"
        "  never labels proxy scores as actual dollars per IC-002).\n"
        "• Section 3: Verbatim Customer Evidence Receipts (verified quotes).\n"
        "• Section 4: Strategic Recommendation (Suggested vs AI-Drafted).\n"
        "• Section 5: Contradictory Evidence Boundary (GAP-07 / P1 marker)."
    )
    ax.text(0.06, 0.185, pm_content, transform=ax.transAxes, fontsize=7.0, color=SLATE_TEXT, va='center', linespacing=1.3)

    # Eng Deliverable Card
    draw_card(ax, 0.51, 0.075, 0.45, 0.255, bg_color=CARD_BG, border_color=BORDER_COLOR)
    draw_card(ax, 0.51, 0.295, 0.45, 0.035, bg_color=ACCENT_PURPLE_LIGHT, border_color=ACCENT_PURPLE, linewidth=0.8)
    ax.text(0.53, 0.312, "Developer Engineering Spec (PRD §7.4 & TS-013)", transform=ax.transAxes,
            fontsize=8.5, fontweight='bold', color=ACCENT_PURPLE, va='center')

    eng_content = (
        "Copy-ready technical implementation ticket for engineering:\n"
        "• Problem Statement: Thematic cluster and root-cause hypothesis.\n"
        "• Reproduction Steps: Derived from source feedback rows.\n"
        "• Affected Customer Accounts: Deduplicated confirmed account list.\n"
        "• Safety Placeholders (DEC-005): When browser/OS or stack context\n"
        "  is missing, automatically injects:\n"
        "  '[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]'\n"
        "• Clipboard Reliability: Auto-copies with textarea fallback."
    )
    ax.text(0.53, 0.185, eng_content, transform=ax.transAxes, fontsize=7.0, color=SLATE_TEXT, va='center', linespacing=1.3)

    pdf.savefig(fig)
    plt.close(fig)


# ==============================================================================
# MAIN ENTRY POINT
# ==============================================================================
def main():
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, "Sift_Visual_User_Guide.pdf")

    print(f"[SIFT] Generating Visual User Guide PDF at: {pdf_path}")
    with PdfPages(pdf_path) as pdf:
        print("  - Building Page 1: Overview & Architectural Pillars...")
        build_page_1(pdf)
        print("  - Building Page 2: CSV Blueprint & 7 Columns Table...")
        build_page_2(pdf)
        print("  - Building Page 3: 2x2 Strategic Priority Matrix & 60 FPS Sliders...")
        build_page_3(pdf)
        print("  - Building Page 4: Deep-Dive Drawer & Engineering Spec Generation...")
        build_page_4(pdf)

    print(f"[SIFT] Visual User Guide PDF generated successfully! ({os.path.getsize(pdf_path)} bytes)")


if __name__ == "__main__":
    main()
