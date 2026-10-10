/**
 * src/outputs/engineeringSpec.ts
 * Engineering Specification Generator with 5-Tier Safety Decoupling (Dev Deliverable)
 * Governed by PRD REQ-012, §7.2–7.4, TS-013; DEC-005; Gate G-M5B.
 *
 * Rules:
 * 1. Output must be valid, copy-ready Markdown adhering strictly to the 5-Tier Safety Decoupling Framework:
 *    - 1. Customer-Reported Observation
 *    - 2. Verified Verbatim Receipts (verified only)
 *    - 3. AI Root-Cause Hypothesis (labeled with boundary notice)
 *    - 4. Proposed Technical Investigation
 *    - 5. Candidate Acceptance Criteria + 'Suggested potential solutions (require engineering confirmation)'
 * 2. When needs_investigation = true (from M2-D deterministic scanner or option), insert the literal string:
 *    `[NEEDS INVESTIGATION: Technical Context Missing in Source Feedback]` at the top of Section 4.
 * 3. AI-drafted investigation steps and criteria MUST be labeled 'Candidate — AI-drafted'.
 * 4. The PRD §7.4 example endpoint/metrics (/api/v1/export, <3.0 seconds, <0.01%) are examples only and must NOT appear as facts.
 * 5. Verbatim receipts MUST only include quotes that pass exact substring verification against source records.
 */

import { ScoredCluster } from '../types/scoring';
import { ProcessedFeedbackRow } from '../types/identity';
import { verify } from '../verify/quoteVerifier';
import {
  detectTechnicalContext,
  INVESTIGATION_PLACEHOLDER,
} from '../verify/missingContext';

export interface EngineeringSpecOptions {
  needs_investigation?: boolean;
  investigationSteps?: string[];
  acceptanceCriteria?: string[];
}

/**
 * Derives default AI-drafted investigation steps tailored to the cluster topic without hardcoding example facts.
 */
function getDefaultInvestigationSteps(cluster: ScoredCluster): string[] {
  const category = cluster.canonical_category || 'Application Component';
  const title = cluster.cluster_title || 'Reported Incident';

  return [
    `Inspect application logs and server metrics corresponding to reported incidents for ${title}.`,
    `Audit telemetry, error response codes, and network payloads associated with the ${category} workflow.`,
    `Attempt local reproduction using customer-reported failure sequence to isolate the failure state.`,
  ];
}

/**
 * Derives default AI-drafted acceptance criteria without hardcoding example metrics.
 */
function getDefaultAcceptanceCriteria(cluster: ScoredCluster): string[] {
  const title = cluster.cluster_title || 'Reported Incident';

  return [
    `Validate issue reproduction against the identified failure pattern in a staging environment.`,
    `Resolve underlying failure condition without regressions in related customer workflows.`,
    `Add automated regression tests covering the reported failure scenario for ${title}.`,
  ];
}

/**
 * Determines whether the cluster requires an investigation placeholder due to missing technical context.
 */
export function resolveNeedsInvestigation(
  cluster: ScoredCluster,
  allRows?: ProcessedFeedbackRow[],
  options?: EngineeringSpecOptions
): boolean {
  if (typeof options?.needs_investigation === 'boolean') {
    return options.needs_investigation;
  }

  // Check if cluster was already flagged during AI assembly / M2-D
  if (typeof (cluster as any).needs_investigation === 'boolean') {
    return (cluster as any).needs_investigation;
  }

  // Gather text from member rows
  const memberIdSet = new Set(cluster.member_feedback_ids || []);
  const memberTexts: string[] = [];

  if (allRows && allRows.length > 0) {
    for (const row of allRows) {
      if (memberIdSet.has(row.identity.feedbackId)) {
        memberTexts.push(row.text);
      }
    }
  }

  // Also include quote snippets and problem summary if row text is not available
  if (memberTexts.length === 0) {
    if (cluster.quotes) {
      for (const q of cluster.quotes) {
        if (q.quote_snippet) memberTexts.push(q.quote_snippet);
      }
    }
    if (cluster.problem_summary) {
      memberTexts.push(cluster.problem_summary);
    }
  }

  const detection = detectTechnicalContext(memberTexts);
  return detection.needs_investigation;
}

/**
 * Pure generator function producing copy-ready Markdown for the Developer Engineering Specification.
 */
export function generateEngineeringSpecification(
  cluster: ScoredCluster,
  allRows?: ProcessedFeedbackRow[],
  options?: EngineeringSpecOptions
): string {
  const needsInvestigation = resolveNeedsInvestigation(cluster, allRows, options);

  // 1. Header Details
  const title = cluster.cluster_title || 'Untitled Cluster';
  const clusterId = cluster.cluster_id || 'CLUST-UNKNOWN';
  const severity = cluster.severity_rating || 1;

  // 2. Section 2: Verified Verbatim Receipts (verified only per IC-001)
  const quotes = cluster.quotes || [];
  const verifiedReceiptLines: string[] = [];
  let unverifiedCount = 0;

  for (const q of quotes) {
    const row = allRows?.find((r) => r.identity.feedbackId === q.feedback_id);
    const result = verify(q.quote_snippet, row?.text);

    if (result.isVerified) {
      verifiedReceiptLines.push(`- \`[${q.feedback_id}]\`: "${q.quote_snippet}" [Verified]`);
    } else {
      unverifiedCount += 1;
    }
  }

  let receiptsContent: string;
  if (verifiedReceiptLines.length > 0) {
    receiptsContent = verifiedReceiptLines.join('\n');
    if (unverifiedCount > 0) {
      receiptsContent += `\n\n*${unverifiedCount} additional quote(s) could not be verified and are omitted.*`;
    }
  } else {
    receiptsContent = '> [No verbatim quotes verified against source records]';
    if (unverifiedCount > 0) {
      receiptsContent += `\n\n*${unverifiedCount} additional quote(s) could not be verified and are omitted.*`;
    }
  }

  // 3. Section 3: AI Root-Cause Hypothesis (labeled)
  const hypothesisText =
    cluster.root_cause_hypothesis ||
    'Root cause hypothesis pending technical investigation of production logs.';

  // 4. Section 4: Proposed Technical Investigation
  const investigationSteps =
    options?.investigationSteps && options.investigationSteps.length > 0
      ? options.investigationSteps
      : getDefaultInvestigationSteps(cluster);

  const stepsList = investigationSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n');

  let investigationContent = '';
  if (needsInvestigation) {
    investigationContent += `${INVESTIGATION_PLACEHOLDER}\n\n`;
  }
  investigationContent += `**Proposed Technical Investigation (Candidate — AI-drafted):**\n${stepsList}`;

  // 5. Section 5: Candidate Acceptance Criteria + Suggested potential solutions
  const criteria =
    options?.acceptanceCriteria && options.acceptanceCriteria.length > 0
      ? options.acceptanceCriteria
      : getDefaultAcceptanceCriteria(cluster);

  const criteriaList = criteria.map((c) => `- [ ] ${c}`).join('\n');

  // Build Complete Markdown Specification
  const markdown = `# Engineering Specification: ${title}

**Target Cluster ID:** ${clusterId} | **Severity Rating:** Level ${severity}

## 1. Customer-Reported Observation
${cluster.problem_summary || '[No problem summary available]'}

## 2. Verified Verbatim Receipts
${receiptsContent}

## 3. AI Root-Cause Hypothesis
*Notice: Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.*

${hypothesisText}

## 4. Proposed Technical Investigation
${investigationContent}

## 5. Candidate Acceptance Criteria
### Suggested potential solutions (require engineering confirmation)
**Acceptance Criteria (Candidate — AI-drafted):**
${criteriaList}
`;

  return markdown;
}
