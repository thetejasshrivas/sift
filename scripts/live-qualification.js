#!/usr/bin/env node

/**
 * scripts/live-qualification.js — Live Qualification Run on 300-Row Fixture
 * Governed by PRD §5.2, §5.8, §10.3, §12.1; manual Part IV and Part V §M2-E;
 * IC-001, IC-002, IC-003, IC-004, IC-007, IC-008, IC-009, IC-010, IC-011, IC-012, IC-015;
 * DEC-PROVIDER, DEC-STACK.
 *
 * Scope:
 * 1. Read AI_API_KEY from environment or .env without ever printing or logging it.
 * 2. Ingest fixtures/valid_300rows.csv (300 rows, FB-001 to FB-300).
 * 3. Dispatch the 6 sequential Pass-1 batches (50 rows/batch) with verified 6s pacing.
 * 4. Implement exponential backoff retries on 429/503/502/network spikes (up to 3 retries).
 * 5. Assemble candidate clusters, resolve duplicates (GAP-13), isolate unclustered (GAP-11).
 * 6. Verify ID integrity invariant after Pass 1.
 * 7. Execute Pass-2 category reconciliation for multi-cluster categories with 6s pacing.
 * 8. Verify ID integrity invariant after Pass 2.
 * 9. Apply Root-Cause Hypothesis notice and deterministic missing context scanner.
 * 10. Output complete run metrics: total API calls, successful calls, clusters formed,
 *     unclustered count (CLUST-UNC), wall-clock duration, and total token usage.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Read API Key safely without logging or leaking
function getApiKey() {
  if (process.env.AI_API_KEY && process.env.AI_API_KEY.trim()) {
    return process.env.AI_API_KEY.trim();
  }
  const envPath = path.resolve(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      if (k.trim() === 'AI_API_KEY') {
        const val = v.join('=').trim().replace(/^["']|["']$/g, '');
        if (val) return val;
      }
    }
  }
  throw new Error('AI_API_KEY not found in environment or .env file');
}

function getModelId() {
  if (process.env.AI_MODEL && process.env.AI_MODEL.trim()) {
    return process.env.AI_MODEL.trim();
  }
  const envPath = path.resolve(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      if (k.trim() === 'AI_MODEL') {
        const val = v.join('=').trim().replace(/^["']|["']$/g, '');
        if (val) return val;
      }
    }
  }
  return 'gemini-3.5-flash-lite';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoffDelay(attempt, retryAfterHeader, baseMs = 2000) {
  const jitter = Math.floor(Math.random() * (baseMs * 0.4));
  if (retryAfterHeader) {
    const parsedSeconds = parseInt(retryAfterHeader, 10);
    if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
      return parsedSeconds * 1000 + jitter;
    }
  }
  return Math.pow(2, attempt) * baseMs + jitter;
}

// Schemas
const PRD_53_RESPONSE_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["clusters"],
  "properties": {
    "clusters": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "cluster_id",
          "cluster_title",
          "canonical_category",
          "problem_summary",
          "root_cause_hypothesis",
          "severity_rating",
          "member_feedback_ids",
          "quotes"
        ],
        "properties": {
          "cluster_id": { "type": "string" },
          "cluster_title": { "type": "string" },
          "canonical_category": { "type": "string" },
          "problem_summary": { "type": "string" },
          "root_cause_hypothesis": { "type": "string" },
          "severity_rating": { "type": "integer", "minimum": 1, "maximum": 3 },
          "member_feedback_ids": { "type": "array", "items": { "type": "string" } },
          "quotes": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["feedback_id", "quote_snippet"],
              "properties": {
                "feedback_id": { "type": "string" },
                "quote_snippet": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
};

const GEMINI_RESPONSE_SCHEMA = {
  "type": "object",
  "required": ["clusters"],
  "properties": {
    "clusters": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "cluster_id",
          "cluster_title",
          "canonical_category",
          "problem_summary",
          "root_cause_hypothesis",
          "severity_rating",
          "member_feedback_ids",
          "quotes"
        ],
        "properties": {
          "cluster_id": { "type": "string" },
          "cluster_title": { "type": "string" },
          "canonical_category": { "type": "string" },
          "problem_summary": { "type": "string" },
          "root_cause_hypothesis": { "type": "string" },
          "severity_rating": { "type": "integer" },
          "member_feedback_ids": { "type": "array", "items": { "type": "string" } },
          "quotes": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["feedback_id", "quote_snippet"],
              "properties": {
                "feedback_id": { "type": "string" },
                "quote_snippet": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
};

const RECONCILE_RESPONSE_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["decisions"],
  "properties": {
    "decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["cluster_ids", "action", "rationale"],
        "properties": {
          "cluster_ids": { "type": "array", "items": { "type": "string" } },
          "action": { "type": "string", "enum": ["MERGE", "KEEP_SEPARATE", "UNCERTAIN"] },
          "rationale": { "type": "string" },
          "merged_cluster_title": { "type": "string" },
          "merged_problem_summary": { "type": "string" },
          "merged_root_cause_hypothesis": { "type": "string" }
        }
      }
    }
  }
};

const GEMINI_RECONCILE_RESPONSE_SCHEMA = {
  "type": "object",
  "required": ["decisions"],
  "properties": {
    "decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["cluster_ids", "action", "rationale"],
        "properties": {
          "cluster_ids": { "type": "array", "items": { "type": "string" } },
          "action": { "type": "string", "enum": ["MERGE", "KEEP_SEPARATE", "UNCERTAIN"] },
          "rationale": { "type": "string" },
          "merged_cluster_title": { "type": "string" },
          "merged_problem_summary": { "type": "string" },
          "merged_root_cause_hypothesis": { "type": "string" }
        }
      }
    }
  }
};

const ajv = new Ajv({ allErrors: true });
const validateClusterResponse = ajv.compile(PRD_53_RESPONSE_SCHEMA);
const validateReconcileResponse = ajv.compile(RECONCILE_RESPONSE_SCHEMA);

// Missing context regex scanner
const TECHNICAL_SIGNALS = {
  browser: /chrome|firefox|safari|edge|opera|browser/i,
  os: /windows|mac|macos|ios|android|linux|ubuntu/i,
  versionOrCode: /v\d+\.\d+|\b\d+\.\d+\.\d+\b|error\s*code|err\b/i,
  httpStatus: /\b[45]\d{2}\b|timeout|gateway|504|502|500|404|403|401|429/i,
  payloadOrSize: /\b\d+\s*(?:kb|mb|gb|records|rows|items)\b/i,
};

function detectMissingContext(memberTexts, quotes) {
  const combined = [...memberTexts, ...quotes.map((q) => q.quote_snippet)].join(' ');
  const signalsFound = {
    browser: TECHNICAL_SIGNALS.browser.test(combined),
    os: TECHNICAL_SIGNALS.os.test(combined),
    versionOrCode: TECHNICAL_SIGNALS.versionOrCode.test(combined),
    httpStatus: TECHNICAL_SIGNALS.httpStatus.test(combined),
    payloadOrSize: TECHNICAL_SIGNALS.payloadOrSize.test(combined),
  };
  const hasTechnicalContext = Object.values(signalsFound).some(Boolean);
  return {
    needs_investigation: !hasTechnicalContext,
    detected_signals: signalsFound,
  };
}

let totalApiCalls = 0;
let successfulCalls = 0;

async function fetchWithRetry(url, options, maxRetries = 4) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    totalApiCalls++;
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        successfulCalls++;
        return res;
      }

      const isRetryable = res.status === 429 || res.status === 503 || res.status === 502 || res.status === 504;
      const retryAfter = res.headers.get('retry-after');
      const errText = await res.text();

      if (isRetryable && attempt < maxRetries) {
        attempt++;
        const delay = calculateBackoffDelay(attempt, retryAfter, 3000);
        console.warn(`[RETRY] HTTP ${res.status} (attempt ${attempt}/${maxRetries}). Retrying in ${(delay / 1000).toFixed(1)}s... Message: ${errText.slice(0, 150)}`);
        await sleep(delay);
        continue;
      }

      throw new Error(`HTTP ${res.status} after ${attempt} retries: ${errText}`);
    } catch (err) {
      if (attempt < maxRetries && !err.message.startsWith('HTTP ')) {
        attempt++;
        const delay = calculateBackoffDelay(attempt, null, 3000);
        console.warn(`[RETRY] Network failure (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${(delay / 1000).toFixed(1)}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

async function runLiveQualification() {
  const runStartTime = Date.now();
  console.log('================================================================================');
  console.log('SIFT MILESTONE 2 — LIVE END-TO-END QUALIFICATION RUN (300 ROWS)');
  console.log('Governed by PRD §5.2, §5.8, §10.3, §12.1; manual Part IV & Part V §M2-E');
  console.log('================================================================================\n');

  const apiKey = getApiKey();
  const modelId = getModelId();
  console.log(`[CONFIG] Provider: Google AI Studio | Model: ${modelId}`);
  console.log(`[SECURITY] AI_API_KEY detected and securely loaded (secret hidden, length: ${apiKey.length} chars).`);

  // STEP 1: Ingest 300-row fixture
  console.log('\n--- STEP 1: Ingesting fixtures/valid_300rows.csv ---');
  const csvPath = path.resolve(ROOT_DIR, 'fixtures', 'valid_300rows.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Fixture not found at ${csvPath}`);
  }
  const csvRaw = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });
  console.log(`[INGEST] Loaded ${parsed.data.length} rows.`);

  const rows = parsed.data;
  if (rows.length !== 300) {
    throw new Error(`Expected exactly 300 rows, found ${rows.length}`);
  }

  const rawRowMap = new Map();
  const inputFeedbackIds = [];
  for (const r of rows) {
    const id = r['Feedback ID'] || r.feedback_id;
    const text = r['Raw Feedback Text'] || r.text;
    rawRowMap.set(id, text);
    inputFeedbackIds.push(id);
  }

  // STEP 2: Pass 1 Sequential Batch Extraction (6 batches x 50 rows)
  console.log('\n--- STEP 2: Pass 1 Sequential Batch Extraction (6 Batches x 50 Rows, 6s Pacing) ---');
  const batches = [];
  for (let i = 0; i < 300; i += 50) {
    batches.push(rows.slice(i, i + 50));
  }

  const PACING_MS = 6000;
  let totalPromptTokens = 0;
  let totalCandidateTokens = 0;
  let totalTokens = 0;
  const rawPass1Clusters = [];
  const batchLatencies = [];

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const batchIndex = b;
    const batchFeedbackIds = batch.map((r) => r['Feedback ID'] || r.feedback_id);

    if (b > 0) {
      console.log(`[PACING] Waiting ${PACING_MS / 1000}s pacing delay to avoid rate limit (concurrency 1)...`);
      await sleep(PACING_MS);
    }

    console.log(`\n[BATCH ${b + 1}/6] Dispatching items ${batchFeedbackIds[0]}..${batchFeedbackIds[batchFeedbackIds.length - 1]} (${batch.length} rows)...`);
    const batchStartTime = Date.now();

    const systemPrompt = `You are Sift's executive customer feedback clustering engine.
Analyze the following batch of customer feedback items and group them into coherent thematic problem clusters.
Strict requirements:
1. Each cluster must have: cluster_id ("CLUST-01", etc.), cluster_title, canonical_category, problem_summary, root_cause_hypothesis, severity_rating (1: minor, 2: major, 3: blocker), member_feedback_ids (array of feedback_ids), and quotes.
2. Every quote must have: feedback_id and quote_snippet.
3. CRITICAL: quote_snippet MUST be an EXACT VERBATIM SUBSTRING of the source feedback row text. Do not rephrase, summarize, or alter even a single character.`;

    const userContent = JSON.stringify({
      batch_index: batchIndex,
      total_batches: batches.length,
      items: batch.map((r) => ({
        feedback_id: r['Feedback ID'] || r.feedback_id,
        text: r['Raw Feedback Text'] || r.text,
        tier: r['Customer Tier'] || r.tier || 'UNKNOWN',
      })),
    });

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: `${systemPrompt}\n\nFEEDBACK DATA BATCH:\n${userContent}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    };

    const providerUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetchWithRetry(providerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    const batchDuration = Date.now() - batchStartTime;
    batchLatencies.push(batchDuration);

    const data = await res.json();
    const usage = data.usageMetadata || {};
    const promptTokens = usage.promptTokenCount || 0;
    const candTokens = usage.candidatesTokenCount || 0;
    const batchTotalTokens = usage.totalTokenCount || promptTokens + candTokens;

    totalPromptTokens += promptTokens;
    totalCandidateTokens += candTokens;
    totalTokens += batchTotalTokens;

    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error(`[FAIL] Batch ${b + 1} returned empty candidate text`);
    }

    const parsedClusters = JSON.parse(candidateText);
    const isValid = validateClusterResponse(parsedClusters);
    if (!isValid) {
      console.warn(`[WARN] Batch ${b + 1} failed schema validation:`, validateClusterResponse.errors);
      throw new Error(`Batch ${b + 1} failed PRD §5.3 schema validation`);
    }

    // Verify exact quotes (IC-001)
    let verifiedQuotes = 0;
    let unverifiedQuotes = 0;
    for (const cl of parsedClusters.clusters) {
      const globalClusterId = `CLUST-B${b + 1}-${cl.cluster_id}`;
      const processedCluster = {
        ...cl,
        cluster_id: globalClusterId,
        quotes: (cl.quotes || []).map((q) => {
          const sourceText = rawRowMap.get(q.feedback_id) || '';
          const isExact = sourceText.includes(q.quote_snippet);
          if (isExact) verifiedQuotes++;
          else unverifiedQuotes++;
          return {
            ...q,
            is_verified: isExact,
            match_status: isExact ? 'VERIFIED' : 'UNVERIFIED',
          };
        }),
      };
      rawPass1Clusters.push(processedCluster);
    }

    console.log(`[BATCH ${b + 1}/6 SUCCESS] Latency: ${batchDuration}ms | HTTP 200 | Clusters: ${parsedClusters.clusters.length} | Tokens: ${batchTotalTokens} (${promptTokens} in, ${candTokens} out) | Quotes: ${verifiedQuotes} verified, ${unverifiedQuotes} unverified`);
  }

  // STEP 3: Pass 1 Assembly & Deduplication (GAP-13, GAP-11)
  console.log('\n--- STEP 3: Pass 1 Assembly & ID Integrity Invariant Verification ---');
  console.log(`[INFO] Collected ${rawPass1Clusters.length} raw clusters across 6 batches.`);

  // Resolve duplicate memberships per GAP-13
  const assignedFeedbackIds = new Map();
  for (const cluster of rawPass1Clusters) {
    for (const id of cluster.member_feedback_ids || []) {
      if (!rawRowMap.has(id)) continue;
      const current = assignedFeedbackIds.get(id);
      if (!current) {
        assignedFeedbackIds.set(id, cluster);
      } else {
        const curSev = current.severity_rating || 1;
        const newSev = cluster.severity_rating || 1;
        if (newSev > curSev) {
          assignedFeedbackIds.set(id, cluster);
        } else if (newSev === curSev) {
          const curSize = current.member_feedback_ids.length;
          const newSize = cluster.member_feedback_ids.length;
          if (newSize > curSize) {
            assignedFeedbackIds.set(id, cluster);
          } else if (newSize === curSize) {
            if (cluster.cluster_id < current.cluster_id) {
              assignedFeedbackIds.set(id, cluster);
            }
          }
        }
      }
    }
  }

  const deduplicatedClusters = [];
  const clusteredIdsSet = new Set();

  for (const cluster of rawPass1Clusters) {
    const validMembers = (cluster.member_feedback_ids || []).filter(
      (id) => assignedFeedbackIds.get(id) === cluster
    );
    if (validMembers.length > 0) {
      validMembers.forEach((id) => clusteredIdsSet.add(id));
      deduplicatedClusters.push({
        ...cluster,
        member_feedback_ids: validMembers,
      });
    }
  }

  const unclusteredIds = inputFeedbackIds.filter((id) => !clusteredIdsSet.has(id));
  let clustUnc = null;
  if (unclusteredIds.length > 0) {
    clustUnc = {
      cluster_id: 'CLUST-UNC',
      cluster_title: 'Unclustered Feedback',
      canonical_category: 'Unassigned',
      problem_summary: `${unclusteredIds.length} feedback items isolated for manual review.`,
      root_cause_hypothesis: 'Multiple unrelated issues or insufficient cluster density.',
      severity_rating: 1,
      member_feedback_ids: unclusteredIds,
      quotes: [],
      is_unclustered_bucket: true,
    };
  }

  const pass1AllClusters = clustUnc ? [...deduplicatedClusters, clustUnc] : deduplicatedClusters;
  const pass1Accounted = new Set();
  let pass1DuplicateCount = 0;
  for (const c of pass1AllClusters) {
    for (const id of c.member_feedback_ids) {
      if (pass1Accounted.has(id)) pass1DuplicateCount++;
      pass1Accounted.add(id);
    }
  }
  const pass1MissingCount = inputFeedbackIds.filter((id) => !pass1Accounted.has(id)).length;
  console.log(`[PASS 1 INTEGRITY] Total clusters: ${deduplicatedClusters.length} (+ CLUST-UNC: ${unclusteredIds.length} items)`);
  console.log(`[PASS 1 INTEGRITY] 300 Input IDs: ${pass1Accounted.size}/300 accounted for | Collisions: ${pass1DuplicateCount} | Missing: ${pass1MissingCount}`);
  if (pass1Accounted.size !== 300 || pass1DuplicateCount !== 0 || pass1MissingCount !== 0) {
    throw new Error('Pass 1 ID integrity invariant failed!');
  }

  // STEP 4: Pass 2 Cross-Batch Category Reconciliation
  console.log('\n--- STEP 4: Pass 2 Cross-Batch Category Reconciliation ---');
  const categoryMap = new Map();
  for (const cluster of deduplicatedClusters) {
    const cat = cluster.canonical_category || 'General';
    const list = categoryMap.get(cat) || [];
    list.push(cluster);
    categoryMap.set(cat, list);
  }

  const multiClusterCategories = [];
  for (const [cat, list] of categoryMap.entries()) {
    if (list.length > 1) {
      multiClusterCategories.push({ category: cat, clusters: list });
    }
  }

  console.log(`[PASS 2] Identified ${categoryMap.size} distinct categories. Categories requiring reconciliation (>1 cluster): ${multiClusterCategories.length}`);
  for (const item of multiClusterCategories) {
    console.log(`  - Category "${item.category}": ${item.clusters.length} preliminary clusters (${item.clusters.map((c) => c.cluster_id).join(', ')})`);
  }

  let reconciledClusters = [...deduplicatedClusters];
  const allDecisions = [];

  for (const item of multiClusterCategories) {
    console.log(`\n[RECONCILE: ${item.category}] Waiting ${PACING_MS / 1000}s pacing before Pass 2 reconciliation request...`);
    await sleep(PACING_MS);

    const reconcileStartTime = Date.now();
    const reconcilePrompt = `You are Sift's executive customer feedback reconciliation engine.
Reconcile the following ${item.clusters.length} preliminary clusters in category "${item.category}".
Decide for each set of clusters whether to:
- MERGE: They represent the exact same core friction/bug across batches.
- KEEP_SEPARATE: They represent distinct sub-problems or distinct user workflows.
- UNCERTAIN: They appear related but evidence is ambiguous (0.60 to 0.84 similarity).

Requirements:
1. Provide a plain-language rationale for each decision.
2. For MERGE, provide a merged_cluster_title, merged_problem_summary, and merged_root_cause_hypothesis.
3. Every cluster_id must be referenced in cluster_ids array.

Cluster summaries:
${JSON.stringify(
  item.clusters.map((c) => ({
    cluster_id: c.cluster_id,
    cluster_title: c.cluster_title,
    problem_summary: c.problem_summary,
    root_cause_hypothesis: c.root_cause_hypothesis,
    severity_rating: c.severity_rating,
    member_count: c.member_feedback_ids.length,
    quote_ids: c.quotes.map((q) => q.feedback_id),
  })),
  null,
  2
)}`;

    const reconcileGeminiPayload = {
      contents: [{ parts: [{ text: reconcilePrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RECONCILE_RESPONSE_SCHEMA,
      },
    };

    const providerUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let res;
    try {
      res = await fetchWithRetry(providerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reconcileGeminiPayload),
      });
    } catch (err) {
      console.warn(`[WARN] Pass 2 reconciliation failed for category ${item.category} (${err.message}). Retaining preliminary clusters.`);
      continue;
    }

    const reconDuration = Date.now() - reconcileStartTime;

    const data = await res.json();
    const usage = data.usageMetadata || {};
    const promptTokens = usage.promptTokenCount || 0;
    const candTokens = usage.candidatesTokenCount || 0;
    const reconTokens = usage.totalTokenCount || promptTokens + candTokens;

    totalPromptTokens += promptTokens;
    totalCandidateTokens += candTokens;
    totalTokens += reconTokens;

    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      console.warn(`[WARN] Pass 2 empty content for category ${item.category}. Retaining preliminary clusters.`);
      continue;
    }

    const parsedDecisions = JSON.parse(candidateText);
    const isValid = validateReconcileResponse(parsedDecisions);
    if (!isValid) {
      console.warn(`[WARN] Pass 2 schema validation failed for ${item.category}. Retaining preliminary clusters.`);
      continue;
    }

    console.log(`[PASS 2 SUCCESS: ${item.category}] Latency: ${reconDuration}ms | Decisions: ${parsedDecisions.decisions.length} | Tokens: ${reconTokens}`);

    for (const dec of parsedDecisions.decisions) {
      allDecisions.push({ category: item.category, ...dec });
      console.log(`  -> Decision [${dec.action}]: clusters ${dec.cluster_ids.join(', ')} — "${dec.rationale}"`);

      if (dec.action === 'MERGE') {
        const toMerge = reconciledClusters.filter((c) => dec.cluster_ids.includes(c.cluster_id));
        if (toMerge.length >= 2) {
          reconciledClusters = reconciledClusters.filter((c) => !dec.cluster_ids.includes(c.cluster_id));
          const unionMembers = Array.from(new Set(toMerge.flatMap((c) => c.member_feedback_ids)));
          const maxSeverity = Math.max(...toMerge.map((c) => c.severity_rating || 1));
          const allQuotes = toMerge.flatMap((c) => c.quotes || []);

          const mergedCluster = {
            cluster_id: toMerge[0].cluster_id,
            cluster_title: dec.merged_cluster_title || toMerge[0].cluster_title,
            canonical_category: item.category,
            problem_summary: dec.merged_problem_summary || toMerge[0].problem_summary,
            root_cause_hypothesis: dec.merged_root_cause_hypothesis || toMerge[0].root_cause_hypothesis,
            severity_rating: maxSeverity,
            member_feedback_ids: unionMembers,
            quotes: allQuotes,
            is_merged: true,
            merged_from_cluster_ids: dec.cluster_ids,
          };
          reconciledClusters.push(mergedCluster);
        }
      } else if (dec.action === 'UNCERTAIN') {
        for (const c of reconciledClusters) {
          if (dec.cluster_ids.includes(c.cluster_id)) {
            c.isUncertain = true;
            c.reviewFlag = 'Uncertain Cluster — Review Recommended';
            c.reconciliationRationale = dec.rationale;
          }
        }
      }
    }
  }

  // STEP 5: Verify Pass 2 Invariant & Missing Context
  console.log('\n--- STEP 5: Verification of Pass 2 Invariant, Root Cause Boundary Notice & Missing Context ---');
  const finalClustersWithUnc = clustUnc ? [...reconciledClusters, clustUnc] : reconciledClusters;
  const pass2Accounted = new Set();
  let pass2DuplicateCount = 0;
  for (const c of finalClustersWithUnc) {
    for (const id of c.member_feedback_ids) {
      if (pass2Accounted.has(id)) pass2DuplicateCount++;
      pass2Accounted.add(id);
    }
  }
  const pass2MissingCount = inputFeedbackIds.filter((id) => !pass2Accounted.has(id)).length;
  console.log(`[PASS 2 INTEGRITY] Final clusters: ${reconciledClusters.length} (+ CLUST-UNC: ${unclusteredIds.length} items)`);
  console.log(`[PASS 2 INTEGRITY] 300 Input IDs: ${pass2Accounted.size}/300 accounted for | Collisions: ${pass2DuplicateCount} | Missing: ${pass2MissingCount}`);
  if (pass2Accounted.size !== 300 || pass2DuplicateCount !== 0 || pass2MissingCount !== 0) {
    throw new Error('Pass 2 ID integrity invariant failed!');
  }

  const BOUNDARY_NOTICE =
    'Root causes are AI-inferred hypotheses based on quote patterns. Verify against system logs before major engineering changes.';
  let clustersNeedingInvestigation = 0;

  for (const c of reconciledClusters) {
    c.root_cause_boundary_notice = BOUNDARY_NOTICE;
    const memberTexts = c.member_feedback_ids.map((id) => rawRowMap.get(id) || '');
    const contextCheck = detectMissingContext(memberTexts, c.quotes || []);
    c.needs_investigation = contextCheck.needs_investigation;
    c.detected_technical_signals = contextCheck.detected_signals;
    if (c.needs_investigation) clustersNeedingInvestigation++;
  }

  const totalDurationMs = Date.now() - runStartTime;
  const wallClockMinutes = (totalDurationMs / 60000).toFixed(2);

  // STEP 6: Run Metrics Report
  console.log('\n================================================================================');
  console.log('QUALIFICATION RUN METRICS SUMMARY (GATE G-M2)');
  console.log('================================================================================');
  console.log(`Total Dataset Rows Tested:       300 rows (FB-001 to FB-300)`);
  console.log(`Total API Calls Dispatched:      ${totalApiCalls}`);
  console.log(`Successful Calls (HTTP 200):     ${successfulCalls}/${totalApiCalls}`);
  console.log(`Pass-1 Batches:                  ${batches.length} sequential batches (50 rows/batch, 6s pacing)`);
  console.log(`Pass-2 Consolidation Calls:      ${multiClusterCategories.length} category calls`);
  console.log(`Total Clusters Formed:           ${reconciledClusters.length} problem clusters`);
  console.log(`Unclustered Items (CLUST-UNC):   ${unclusteredIds.length} rows`);
  console.log(`1:1 ID Integrity:                100% PASS (300/300 accounted for, 0 duplicate, 0 missing)`);
  console.log(`Clusters Flagged [INVESTIGATE]:  ${clustersNeedingInvestigation}/${reconciledClusters.length}`);
  console.log(`Wall-Clock Duration:             ${(totalDurationMs / 1000).toFixed(1)}s (~${wallClockMinutes} min)`);
  console.log(`Token Usage:`);
  console.log(`  - Prompt Tokens:               ${totalPromptTokens.toLocaleString()} tokens`);
  console.log(`  - Candidates Tokens:           ${totalCandidateTokens.toLocaleString()} tokens`);
  console.log(`  - Total Tokens (Quota):        ${totalTokens.toLocaleString()} tokens`);
  console.log(`Daily Quota Impact:              ~${((totalApiCalls / 1500) * 100).toFixed(2)}% of 1,500 RPD free tier limit`);
  console.log('================================================================================\n');

  return {
    totalApiCalls,
    successfulCalls,
    clustersFormed: reconciledClusters.length,
    unclusteredCount: unclusteredIds.length,
    wallClockDurationMs: totalDurationMs,
    wallClockMinutes,
    totalPromptTokens,
    totalCandidateTokens,
    totalTokens,
    clustersNeedingInvestigation,
    reconciledClusters,
  };
}

runLiveQualification()
  .then((res) => {
    console.log('[QUALIFICATION COMPLETE] Live qualification run completed successfully with Gate G-M2 green.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[QUALIFICATION FAILED]:', err);
    process.exit(1);
  });
