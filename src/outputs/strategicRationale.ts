/**
 * src/outputs/strategicRationale.ts
 * Strategic Trade-off Rationale Generator (PM Deliverable)
 * Governed by PRD REQ-012, §7.4; MDD §3.7, §3.9; IC-001, IC-002; GAP-07, GAP-17.
 * 
 * Rules:
 * 1. Output must be valid, copy-ready Markdown.
 * 2. Header contains Priority Score, Severity, and Affected Accounts with Confirmed/Estimated.
 * 3. Section 1 is Executive Summary with AI problem_summary.
 * 4. Section 2 is Business Impact using 'Impact Score (I_n)' and 'Raw Tier Weight (I_c)' — NEVER $ or ARR.
 *    Includes Frequency with total incidents N_c, and Account Segment Breakdown (Enterprise, Mid-Market, Free/Starter, UNKNOWN).
 * 5. Section 3 is Verbatim Customer Evidence: ONLY verified quotes, each tagged [Verified Quote].
 *    If any quotes were unverified, adds notice: 'N additional quote(s) could not be verified and are omitted'.
 * 6. Section 4 is Strategic Recommendation labeled 'Suggested (rule-based)' or 'AI-drafted' (GAP-17).
 * 7. Section 5 is Contradictory Evidence noted as not built in P0 (GAP-07).
 */

import { ScoredCluster } from '../types/scoring';
import { ProcessedFeedbackRow } from '../types/identity';
import { verify } from '../verify/quoteVerifier';

export interface StrategicRationaleOptions {
  recommendationSource?: 'Suggested (rule-based)' | 'AI-drafted';
  customRecommendation?: string;
}

export interface AccountSegmentBreakdown {
  Enterprise: number;
  MidMarket: number;
  FreeStarter: number;
  UNKNOWN: number;
}

/**
 * Derives account segment breakdown counts from cluster member feedback rows.
 * Follows GAP-12 account tier conflict resolution (highest tier weight wins for confirmed accounts).
 */
export function calculateSegmentBreakdown(
  cluster: ScoredCluster,
  allRows?: ProcessedFeedbackRow[]
): AccountSegmentBreakdown {
  if (!allRows || allRows.length === 0) {
    return {
      Enterprise: 0,
      MidMarket: 0,
      FreeStarter: 0,
      UNKNOWN: cluster.metrics?.U_c ?? 0,
    };
  }

  const memberIdSet = new Set(cluster.member_feedback_ids || []);
  const memberRows = allRows.filter((r) => memberIdSet.has(r.identity.feedbackId));

  // Confirmed accounts: group by trimmed non-empty Account ID
  const confirmedAccountTiers = new Map<string, { maxWeight: number; canonicalTier: string }>();
  // Estimated accounts: rows without Account ID
  const estimatedRows: ProcessedFeedbackRow[] = [];

  for (const row of memberRows) {
    const rawAccountId = row.identity.accountId?.trim();
    if (rawAccountId && rawAccountId.length > 0) {
      const current = confirmedAccountTiers.get(rawAccountId);
      const rowWeight = row.tierResolution?.weight ?? 1.0;
      const rowTier = row.tierResolution?.canonicalTier ?? 'UNKNOWN';

      if (!current || rowWeight > current.maxWeight) {
        confirmedAccountTiers.set(rawAccountId, {
          maxWeight: rowWeight,
          canonicalTier: rowTier,
        });
      }
    } else {
      estimatedRows.push(row);
    }
  }

  const counts: AccountSegmentBreakdown = {
    Enterprise: 0,
    MidMarket: 0,
    FreeStarter: 0,
    UNKNOWN: 0,
  };

  // 1. Count confirmed accounts by their resolved tier (GAP-12)
  for (const info of confirmedAccountTiers.values()) {
    if (info.canonicalTier === 'Enterprise' || info.maxWeight === 3.0) {
      counts.Enterprise += 1;
    } else if (info.canonicalTier === 'Pro / Mid-Market' || info.maxWeight === 2.0) {
      counts.MidMarket += 1;
    } else if (info.canonicalTier === 'Free / Starter') {
      counts.FreeStarter += 1;
    } else {
      counts.UNKNOWN += 1;
    }
  }

  // 2. Count estimated accounts (each row counts as 1 estimated account)
  for (const row of estimatedRows) {
    const tier = row.tierResolution?.canonicalTier;
    if (tier === 'Enterprise') {
      counts.Enterprise += 1;
    } else if (tier === 'Pro / Mid-Market') {
      counts.MidMarket += 1;
    } else if (tier === 'Free / Starter') {
      counts.FreeStarter += 1;
    } else {
      counts.UNKNOWN += 1;
    }
  }

  return counts;
}

/**
 * Returns a deterministic, rule-based PM recommendation based on quadrant and severity.
 */
export function getRuleBasedRecommendation(cluster: ScoredCluster): string {
  if (cluster.flags?.isCriticalBlocker || cluster.severity_rating === 3) {
    if (cluster.metrics?.U_c < 3) {
      return 'Expedite immediate engineering root-cause analysis despite low frequency. Level 3 Critical Blocker represents high churn risk for affected accounts.';
    }
    return 'Immediate Engineering Intervention: Prioritize a dedicated hotfix/patch in the current sprint to mitigate severe customer blocker across multiple accounts.';
  }

  const isHighImpact = (cluster.normalized?.I_n ?? 0) >= 0.5;
  const isHighFreq = (cluster.normalized?.F_n ?? 0) >= 0.5;

  if (isHighImpact && isHighFreq) {
    return 'Top Priority Sprint Candidate: High tier impact combined with high frequency indicates systemic product friction. Prioritize in the next sprint planning cycle.';
  }

  if (isHighImpact && !isHighFreq) {
    return 'Targeted Account Engagement: High tier-weighted impact concentrated in a small account cohort. Conduct direct customer outreach or white-glove mitigation while scoping a targeted product refinement.';
  }

  if (!isHighImpact && isHighFreq) {
    return 'Product Usability Optimization: High frequency across starter accounts represents broad friction. Batch into product backlog for self-serve flow improvements.';
  }

  return 'Low Immediate Priority: Low tier impact and low frequency. Monitor incoming incident trends before allocating active engineering capacity.';
}

/**
 * Pure generator function producing copy-ready Markdown for the PM Strategic Trade-off Rationale.
 */
export function generateStrategicTradeoffRationale(
  cluster: ScoredCluster,
  allRows?: ProcessedFeedbackRow[],
  options?: StrategicRationaleOptions
): string {
  const recommendationSource = options?.recommendationSource ?? 'Suggested (rule-based)';
  const recommendationText =
    options?.customRecommendation || getRuleBasedRecommendation(cluster);

  // 1. Header Details
  const confirmedCount = cluster.metrics?.confirmedAccountsCount ?? 0;
  const estimatedCount = cluster.metrics?.estimatedAccountsCount ?? 0;
  const affiliationString = `Confirmed: ${confirmedCount}, Estimated: ${estimatedCount}`;

  // 2. Business Impact & Segment Breakdown
  const breakdown = calculateSegmentBreakdown(cluster, allRows);
  const inScore = (cluster.normalized?.I_n ?? 0).toFixed(4);
  const icWeight = (cluster.metrics?.I_c ?? 0).toFixed(1);
  const fnScore = (cluster.normalized?.F_n ?? 0).toFixed(4);
  const ncVolume = cluster.metrics?.N_c ?? 0;

  // 3. Verbatim Customer Evidence (Verified quotes only per IC-001)
  const quotes = cluster.quotes || [];
  const verifiedQuoteLines: string[] = [];
  let unverifiedCount = 0;

  for (const q of quotes) {
    const row = allRows?.find((r) => r.identity.feedbackId === q.feedback_id);
    const result = verify(q.quote_snippet, row?.text);

    if (result.isVerified) {
      const rawAccountId = row?.identity?.accountId?.trim();
      const accountLabel = rawAccountId && rawAccountId.length > 0 ? rawAccountId : 'UNKNOWN';
      verifiedQuoteLines.push(
        `> "${q.quote_snippet}" — Account: ${accountLabel} (Feedback ID: ${q.feedback_id}) [Verified Quote]`
      );
    } else {
      unverifiedCount += 1;
    }
  }

  let evidenceSectionContent: string;
  if (verifiedQuoteLines.length > 0) {
    evidenceSectionContent = verifiedQuoteLines.join('\n\n');
    if (unverifiedCount > 0) {
      evidenceSectionContent += `\n\n*${unverifiedCount} additional quote(s) could not be verified and are omitted.*`;
    }
  } else {
    evidenceSectionContent = '> [No verbatim quotes verified against source records]';
    if (unverifiedCount > 0) {
      evidenceSectionContent += `\n\n*${unverifiedCount} additional quote(s) could not be verified and are omitted.*`;
    }
  }

  // 4. Build Complete Markdown Deliverable
  const markdown = `# Strategic Trade-off Rationale: ${cluster.cluster_title}

**Priority Score:** ${cluster.priority_score.toFixed(1)}/100 | **Severity:** Level ${cluster.severity_rating} | **Affected Accounts:** ${cluster.metrics.U_c} (${affiliationString})

## 1. Executive Summary
${cluster.problem_summary || '[No problem summary available]'}

## 2. Business Impact
- **Impact Score (I_n):** ${inScore} (Raw Tier Weight: ${icWeight})
- **Frequency Score (F_n):** ${fnScore} (Total Incidents: ${ncVolume})
- **Account Segment Breakdown:** Enterprise: ${breakdown.Enterprise}, Mid-Market: ${breakdown.MidMarket}, Free/Starter: ${breakdown.FreeStarter}, UNKNOWN: ${breakdown.UNKNOWN}

## 3. Verbatim Customer Evidence
${evidenceSectionContent}

## 4. Strategic Recommendation
**Source:** ${recommendationSource}

${recommendationText}

## 5. Contradictory Evidence
*Contradictory Evidence analysis not built in P0 (GAP-07).*
`;

  return markdown;
}
