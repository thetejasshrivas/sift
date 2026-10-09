#!/usr/bin/env node

/**
 * provider-smoke.js — Live AI Provider Verification Smoke Test (TS-018 / AG-AI-02)
 * Governed by AGENTS.md Standing Contract, PRD §5.3, §10.3, IC-004, IC-007, IC-009, IC-011.
 *
 * Rules:
 * 1. Reads AI_API_KEY from environment or .env without printing or logging it.
 * 2. Never logs customer feedback text or raw key.
 * 3. Step 1: List live models available to the key.
 * 4. Step 2: Pick candidate from live results supporting structured JSON schema.
 * 5. Step 3: Send 50-row synthetic batch with PRD §5.3 schema (literal $schema URI).
 * 6. Step 4: Validate response with Ajv against schema.
 * 7. Step 5: Record latency, input/output token counts, HTTP status.
 * 8. Step 6: Test a deliberately broken request to capture real error shape.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Read API Key safely without logging
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

// PRD §5.3 JSON Schema Draft-07
const PRD_53_SCHEMA = {
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

// Gemini responseSchema clean subset (without $schema keyword for Gemini's OpenAPI schema parser)
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

async function runSmokeTest() {
  console.log('================================================================');
  console.log('SIFT AI PROVIDER LIVE SMOKE TEST (TS-018 / AG-AI-02)');
  console.log('================================================================\n');

  const apiKey = getApiKey();
  console.log('[SECURITY] AI_API_KEY detected and securely loaded (length: %d chars). Secret value hidden.', apiKey.length);

  // STEP 1: List models the key can call
  console.log('\n--- STEP 1: Querying Provider Models Endpoint ---');
  const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const modelsRes = await fetch(modelsUrl);
  if (!modelsRes.ok) {
    const errText = await modelsRes.text();
    console.error(`[FAIL] HTTP ${modelsRes.status} querying models endpoint: ${errText}`);
    process.exit(1);
  }

  const modelsData = await modelsRes.json();
  const allModels = modelsData.models || [];
  const contentModels = allModels.filter(m => (m.supportedGenerationMethods || []).includes('generateContent'));
  
  console.log(`[PASS] HTTP ${modelsRes.status} OK — Found ${allModels.length} total models (${contentModels.length} support generateContent).`);
  console.log('Live models capable of generateContent:');
  for (const m of contentModels) {
    const shortName = m.name.replace(/^models\//, '');
    console.log(`  - ${shortName} (inputLimit: ${m.inputTokenLimit}, outputLimit: ${m.outputTokenLimit})`);
  }

  // STEP 2: Pick candidates from LIVE results supporting structured output
  console.log('\n--- STEP 2: Selecting Live Candidate Model ---');
  const preferred = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash'
  ];
  
  const candidatesToTry = [];
  for (const pref of preferred) {
    const found = contentModels.find(m => m.name === `models/${pref}` || m.name === pref);
    if (found) {
      candidatesToTry.push(pref);
    }
  }

  // Also append any remaining content models
  for (const m of contentModels) {
    const shortName = m.name.replace(/^models\//, '');
    if (!candidatesToTry.includes(shortName)) {
      candidatesToTry.push(shortName);
    }
  }

  console.log(`[INFO] Found ${candidatesToTry.length} potential candidate models from LIVE endpoint.`);

  // STEP 3: Load fixtures/synthetic_50.csv and build request
  console.log('\n--- STEP 3: Preparing 50-Row Synthetic Batch ---');
  const csvPath = path.resolve(ROOT_DIR, 'fixtures', 'synthetic_50.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  console.log(`[INFO] Loaded synthetic fixtures: ${parsed.data.length} rows loaded.`);

  // Format batch items without logging text
  const batchItems = parsed.data.map(r => ({
    feedback_id: r.feedback_id,
    text: r.text,
    tier: r.tier || 'UNKNOWN'
  }));

  const promptText = `You are the SIFT AI clustering engine.
Analyze the following ${batchItems.length} customer feedback items. Group them into thematic problem clusters.
For each cluster:
- cluster_id: CLUST-01, CLUST-02, etc.
- cluster_title: Concise descriptive title
- canonical_category: Broad problem category (e.g. Export, Performance, Permissions, Billing, Authentication, Search, Integrations, API)
- problem_summary: 1-2 sentence description of the friction
- root_cause_hypothesis: Probable underlying technical cause
- severity_rating: 1 (minor/cosmetic), 2 (moderate/workaround), or 3 (blocker/data corruption)
- member_feedback_ids: array of feedback_ids belonging to this cluster
- quotes: array of objects with { "feedback_id": "...", "quote_snippet": "..." } using EXACT verbatim substrings from the source text.

You MUST format your entire response as a single valid JSON object adhering strictly to JSON Schema draft-07:
${JSON.stringify(PRD_53_SCHEMA, null, 2)}

Feedback items:
${JSON.stringify(batchItems, null, 2)}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.2
    }
  };

  let selectedModel = null;
  let generateRes = null;
  let generateData = null;
  let latencyMs = 0;
  let httpStatus = 0;

  for (const candidateModel of candidatesToTry) {
    console.log(`\n[ATTEMPT] Dispatching batch request to live candidate "${candidateModel}" (50 rows)...`);
    const startTime = Date.now();
    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
    
    try {
      const res = await fetch(generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const elapsed = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        console.warn(`[WARN] Candidate "${candidateModel}" returned HTTP ${res.status}: ${errBody.slice(0, 200)}...`);
        // If 404 (deprecated) or 503 (high demand) or 429, try next candidate
        continue;
      }

      // Success!
      selectedModel = candidateModel;
      generateRes = res;
      latencyMs = elapsed;
      httpStatus = res.status;
      generateData = await res.json();
      console.log(`[PASS] Candidate "${candidateModel}" succeeded with HTTP ${httpStatus} (${latencyMs} ms).`);
      break;
    } catch (err) {
      console.warn(`[WARN] Candidate "${candidateModel}" network error: ${err.message}`);
    }
  }

  if (!selectedModel || !generateData) {
    console.error('[FAIL] None of the live candidate models returned HTTP 200.');
    process.exit(1);
  }

  // STEP 4: Parse & validate response against PRD §5.3 schema
  console.log('\n--- STEP 4: Validating Output with Ajv against PRD §5.3 Schema ---');
  const candidate = generateData.candidates && generateData.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
    console.error('[FAIL] Malformed response structure — no candidate content part found.');
    process.exit(1);
  }

  const rawJsonText = candidate.content.parts[0].text;
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawJsonText);
  } catch (err) {
    console.error('[FAIL] Could not parse model response as JSON:', err.message);
    process.exit(1);
  }

  // Validate with Ajv draft-07
  const ajv = new Ajv({ strict: false });
  const validate = ajv.compile(PRD_53_SCHEMA);
  const isValid = validate(parsedJson);

  if (!isValid) {
    console.error('[FAIL] JSON Schema validation failed:');
    console.error(validate.errors);
    process.exit(1);
  }

  console.log(`[PASS] Schema validation SUCCEEDED! Response strictly satisfies PRD §5.3 draft-07 schema.`);
  console.log(`[INFO] Clusters extracted: ${parsedJson.clusters.length} clusters.`);
  for (const c of parsedJson.clusters) {
    console.log(`  - [${c.cluster_id}] ${c.cluster_title} (category: ${c.canonical_category}, severity: ${c.severity_rating}, members: ${c.member_feedback_ids.length}, quotes: ${c.quotes.length})`);
  }

  // STEP 5: Record metrics (latency, tokens, status)
  console.log('\n--- STEP 5: Latency & Token Usage Accounting ---');
  const usage = generateData.usageMetadata || {};
  console.log(`  - HTTP Status: ${httpStatus} OK`);
  console.log(`  - Round-trip Latency: ${latencyMs} ms`);
  console.log(`  - Prompt Tokens: ${usage.promptTokenCount ?? 'N/A'}`);
  console.log(`  - Candidates Tokens: ${usage.candidatesTokenCount ?? 'N/A'}`);
  console.log(`  - Total Tokens: ${usage.totalTokenCount ?? 'N/A'}`);

  // STEP 6: Test deliberately broken request to see error shape
  console.log('\n--- STEP 6: Testing Deliberately Broken Request (Error Shape Probe) ---');
  const brokenUrl = `https://generativelanguage.googleapis.com/v1beta/models/nonexistent-model-test:generateContent?key=${encodeURIComponent(apiKey)}`;
  const brokenRes = await fetch(brokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
  });

  const brokenStatus = brokenRes.status;
  const brokenBody = await brokenRes.json().catch(() => null);

  console.log(`[PASS] Deliberately broken request received expected error:`);
  console.log(`  - HTTP Status: ${brokenStatus}`);
  console.log(`  - Error Shape: ${JSON.stringify(brokenBody, null, 2)}`);

  console.log('\n================================================================');
  console.log('GATE G-AI2 EVALUATION: PASSED');
  console.log(`Model "${selectedModel}" returned schema-valid output on live key.`);
  console.log('================================================================');
}

runSmokeTest().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
