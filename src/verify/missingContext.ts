/**
 * verify/missingContext.ts — Deterministic Missing-Context Detector & Safety Placeholders
 * Governed by PRD REQ-007, §5.8; MDD §3.6, §3.10; DEC-005; Gate G-M2D.
 *
 * SPECIFICATION:
 * 1. Root-Cause Label & Boundary Notice (MDD §3.6):
 *    - Label: "Root-Cause Hypothesis"
 *    - Mandatory Notice Text:
 *      "Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes."
 * 2. Deterministic Missing-Context Detector:
 *    - Deterministic regex scanner over cluster member feedback text and quote snippets.
 *    - Detects presence of technical environment context:
 *      * Browser: /chrome|firefox|safari|edge|opera|browser/i
 *      * OS: /windows|mac|macos|ios|android|linux|ubuntu/i
 *      * Version/Code: /v\d+\.\d+|\b\d+\.\d+\.\d+\b|error\s*code|err\b/i
 *      * HTTP/Error Status: /\b[45]\d{2}\b|timeout|gateway|504|502|500|404|403|401|429/i
 *      * Payload/Size: /\b\d+\s*(?:kb|mb|gb|records|rows|items|entries|files)\b/i
 *    - Limitations Documentation:
 *      * Keyword Pattern Sensitivity: Regex detection relies on recognized tokens; colloquial expressions
 *        (e.g., "Apple laptop" instead of "macOS") or unusual spelling may not trigger matches.
 *      * Polysemy False Positives: Words like "windows" or "browser" can occur in non-technical metaphors.
 *      * Platform Boundaries: Proprietary internal client versions or unlisted platforms without standard
 *        version semantics will not be caught without manual specification.
 * 3. Investigation Placeholder Injection:
 *    - If NONE of these technical signals are present across member rows, set needs_investigation = true.
 *    - Injects: "[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]"
 * 4. Non-Technical Feedback Handling:
 *    - Cosmetic, billing, or workflow friction without technical failure modes defaults hypothesis
 *      to workflow friction explanation + investigation placeholder.
 */

export const ROOT_CAUSE_LABEL = 'Root-Cause Hypothesis';

export const BOUNDARY_NOTICE_TEXT =
  'Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.';

export const INVESTIGATION_PLACEHOLDER =
  '[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]';

// Deterministic Technical Signal Regex Patterns
export const TECHNICAL_REGEX = {
  browser: /chrome|firefox|safari|edge|opera|browser/i,
  os: /windows|mac|macos|ios|android|linux|ubuntu/i,
  versionCode: /v\d+\.\d+|\b\d+\.\d+\.\d+\b|error\s*code|err\b/i,
  httpStatus: /\b[45]\d{2}\b|timeout|gateway|504|502|500|404|403|401|429/i,
  payloadSize: /\b\d+\s*(?:kb|mb|gb|records|rows|items|entries|files)\b/i,
} as const;

export interface TechnicalContextSignals {
  hasBrowser: boolean;
  hasOs: boolean;
  hasVersionCode: boolean;
  hasHttpStatus: boolean;
  hasPayloadSize: boolean;
  anySignalPresent: boolean;
  matchedSignals: string[];
}

export interface MissingContextDetectionResult {
  needs_investigation: boolean;
  signals: TechnicalContextSignals;
  placeholder: string;
}

/**
 * Scans an array of feedback texts (raw row text and/or quotes) for technical environment signals.
 */
export function detectTechnicalContext(texts: string[]): MissingContextDetectionResult {
  const combined = texts.join(' ');

  const hasBrowser = TECHNICAL_REGEX.browser.test(combined);
  const hasOs = TECHNICAL_REGEX.os.test(combined);
  const hasVersionCode = TECHNICAL_REGEX.versionCode.test(combined);
  const hasHttpStatus = TECHNICAL_REGEX.httpStatus.test(combined);
  const hasPayloadSize = TECHNICAL_REGEX.payloadSize.test(combined);

  const matchedSignals: string[] = [];
  if (hasBrowser) matchedSignals.push('browser');
  if (hasOs) matchedSignals.push('os');
  if (hasVersionCode) matchedSignals.push('version/code');
  if (hasHttpStatus) matchedSignals.push('http/status');
  if (hasPayloadSize) matchedSignals.push('payload/size');

  const anySignalPresent = matchedSignals.length > 0;
  const needs_investigation = !anySignalPresent;

  return {
    needs_investigation,
    signals: {
      hasBrowser,
      hasOs,
      hasVersionCode,
      hasHttpStatus,
      hasPayloadSize,
      anySignalPresent,
      matchedSignals,
    },
    placeholder: INVESTIGATION_PLACEHOLDER,
  };
}

/**
 * Checks if feedback or category is non-technical (e.g. UI alignment, billing, cosmetic, workflow friction).
 */
export function isNonTechnicalCluster(canonicalCategory?: string, title?: string): boolean {
  const text = `${canonicalCategory || ''} ${title || ''}`.toLowerCase();
  const nonTechPattern = /billing|invoice|payment|pricing|ui alignment|cosmetic|workflow|layout|styling|font|color/i;
  return nonTechPattern.test(text);
}

/**
 * Applies deterministic missing-context detection and formats the root-cause hypothesis.
 * If non-technical feedback lacks technical signals, defaults hypothesis to workflow friction with placeholder.
 */
export function enrichClusterWithRootCauseHypothesis(
  cluster: {
    canonical_category?: string;
    cluster_title?: string;
    root_cause_hypothesis?: string;
    quotes?: Array<{ quote_snippet: string }>;
  },
  memberTexts: string[] = []
): {
  needs_investigation: boolean;
  root_cause_hypothesis: string;
  investigation_placeholder?: string;
  signals: TechnicalContextSignals;
} {
  // Aggregate texts from member rows and quotes
  const quoteTexts = cluster.quotes?.map((q) => q.quote_snippet) || [];
  const allTexts = [...memberTexts, ...quoteTexts];

  const detection = detectTechnicalContext(allTexts);
  const nonTech = isNonTechnicalCluster(cluster.canonical_category, cluster.cluster_title);

  let finalHypothesis = cluster.root_cause_hypothesis?.trim() || '';

  if (detection.needs_investigation) {
    if (nonTech) {
      // Non-technical complaints default to workflow friction wording + placeholder
      if (!finalHypothesis || finalHypothesis.toLowerCase().includes('needs investigation')) {
        finalHypothesis = `Workflow friction and user interface ergonomics issue in ${cluster.canonical_category || 'general workflow'}. ${INVESTIGATION_PLACEHOLDER}`;
      } else if (!finalHypothesis.includes(INVESTIGATION_PLACEHOLDER)) {
        finalHypothesis = `${finalHypothesis} ${INVESTIGATION_PLACEHOLDER}`;
      }
    } else {
      // Technical complaint missing environment details
      if (!finalHypothesis.includes(INVESTIGATION_PLACEHOLDER)) {
        finalHypothesis = finalHypothesis
          ? `${finalHypothesis} ${INVESTIGATION_PLACEHOLDER}`
          : `Potential runtime or execution failure. ${INVESTIGATION_PLACEHOLDER}`;
      }
    }
  }

  return {
    needs_investigation: detection.needs_investigation,
    root_cause_hypothesis: finalHypothesis,
    investigation_placeholder: detection.needs_investigation ? INVESTIGATION_PLACEHOLDER : undefined,
    signals: detection.signals,
  };
}
