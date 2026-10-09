#!/usr/bin/env node

/**
 * burst-test.js — Bounded Provider Burst / Quota Test (TS-018 Step 3 / AG-AI-03)
 * Governed by AGENTS.md Standing Contract, PRD §5.8, §10.3, IC-008, IC-009, IC-011.
 *
 * Rules:
 * 1. Reads AI_API_KEY from environment or .env without logging or printing it.
 * 2. Runs bounded burst of requests against verified model (gemini-3.5-flash).
 * 3. Records HTTP status, latency, headers (retry-after), and backoff behavior on 429s.
 * 4. Never logs secret keys or feedback content.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

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
  throw new Error('AI_API_KEY not found in environment or .env');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBurstTest() {
  console.log('================================================================');
  console.log('SIFT BOUNDED BURST & RATE-LIMIT QUALIFICATION TEST (AG-AI-03)');
  console.log('================================================================\n');

  const apiKey = getApiKey();
  console.log('[SECURITY] AI_API_KEY securely loaded (%d chars). Value hidden.\n', apiKey.length);

  const model = (process.env.AI_MODEL && process.env.AI_MODEL.trim()) || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Test 6 sequential/burst calls as required by TS-018 Step 3
  const TOTAL_CALLS = 6;
  const results = [];

  console.log(`[INFO] Executing ${TOTAL_CALLS} sequential test requests against "${model}"...`);
  console.log('Testing rate limit resilience, latency, and 429 backoff handling:\n');

  for (let i = 1; i <= TOTAL_CALLS; i++) {
    const startTime = Date.now();
    let attempt = 0;
    let maxAttempts = 3;
    let finalStatus = null;
    let finalLatency = null;
    let retryAfterHeader = null;
    let errorDetail = null;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const payload = {
          contents: [
            {
              role: "user",
              parts: [{ text: `SIFT batch rate test ping ${i} attempt ${attempt}. Summarize: "Feedback item ${i}: CSV export times out." in 5 words.` }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 50
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        finalLatency = Date.now() - startTime;
        finalStatus = res.status;
        retryAfterHeader = res.headers.get('retry-after');

        if (res.status === 200) {
          const data = await res.json();
          const tokens = data.usageMetadata || {};
          results.push({
            callIndex: i,
            attempt,
            status: 200,
            latencyMs: finalLatency,
            retryAfter: null,
            tokens: tokens.totalTokenCount || 0,
            outcome: 'SUCCESS'
          });
          console.log(`  [Call ${i}/${TOTAL_CALLS}] HTTP 200 OK — Latency: ${finalLatency} ms | Tokens: ${tokens.totalTokenCount || 'N/A'}`);
          break;
        } else if (res.status === 429) {
          console.warn(`  [Call ${i}/${TOTAL_CALLS}] [WARN] HTTP 429 Rate Limited on attempt ${attempt}. Retry-After: ${retryAfterHeader || 'none'}`);
          const errBody = await res.text();
          errorDetail = errBody.slice(0, 150);
          
          // Exponential backoff: 2^attempt * 1000ms + random jitter
          const backoffMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
          console.log(`    Applying exponential backoff: sleeping ${backoffMs} ms...`);
          await sleep(backoffMs);
        } else if (res.status === 503) {
          console.warn(`  [Call ${i}/${TOTAL_CALLS}] [WARN] HTTP 503 Service Unavailable on attempt ${attempt}.`);
          const backoffMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
          await sleep(backoffMs);
        } else {
          const errText = await res.text();
          errorDetail = errText.slice(0, 150);
          results.push({
            callIndex: i,
            attempt,
            status: finalStatus,
            latencyMs: finalLatency,
            retryAfter: retryAfterHeader,
            outcome: `ERROR: ${errorDetail}`
          });
          console.error(`  [Call ${i}/${TOTAL_CALLS}] HTTP ${finalStatus}: ${errorDetail}`);
          break;
        }
      } catch (err) {
        console.error(`  [Call ${i}/${TOTAL_CALLS}] Network error on attempt ${attempt}: ${err.message}`);
        await sleep(1000);
      }
    }

    if (finalStatus !== 200 && !results.find(r => r.callIndex === i)) {
      results.push({
        callIndex: i,
        attempt,
        status: finalStatus,
        latencyMs: finalLatency,
        retryAfter: retryAfterHeader,
        outcome: `FAILED after ${attempt} attempts`
      });
    }

    // Small inter-call spacing (500ms) to simulate rapid pipelining
    if (i < TOTAL_CALLS) {
      await sleep(500);
    }
  }

  console.log('\n================================================================');
  console.log('BURST TEST RESULTS SUMMARY:');
  console.log('================================================================');
  console.table(results);

  const allSuccess = results.filter(r => r.status === 200).length === TOTAL_CALLS;
  const any429 = results.some(r => r.status === 429 || r.attempt > 1);

  console.log(`\nTotal Calls: ${TOTAL_CALLS}`);
  console.log(`Successful Calls (HTTP 200): ${results.filter(r => r.status === 200).length}/${TOTAL_CALLS}`);
  console.log(`Rate Limit (429) Triggered: ${any429 ? 'YES (Handled via backoff)' : 'NO (0 rate limits encountered)'}`);
  console.log(`Quota Verification Gate: ${allSuccess ? 'PASSED' : 'BLOCKED'}\n`);
}

runBurstTest().catch(err => {
  console.error('[FATAL]:', err);
  process.exit(1);
});
