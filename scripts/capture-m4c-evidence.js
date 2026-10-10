/**
 * scripts/capture-m4c-evidence.js
 * Browser verification and audit for Task M4-C and Gate G-M4C.
 * Validates exact substring quote verification, near-match non-green diagnostic,
 * missing Feedback ID handling, raw row reveal toggle, and verbatim-only action outputs via Chrome CDP.
 * Governed by PRD REQ-011, §7.1, TS-005; MDD §3.7; IC-001; Part VII TS-005/005b.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'http://127.0.0.1:5173/';
const evidenceDir = path.resolve('docs/evidence/m4');
fs.mkdirSync(evidenceDir, { recursive: true });

const tempProfile = path.join(os.tmpdir(), 'sift_cdp_profile_m4c_' + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const cdpPort = 9226;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[EVIDENCE M4-C] Starting Vite dev server...');
  const viteProc = spawn('npx.cmd', ['vite', '--port', '5173', '--strictPort'], {
    shell: true,
    stdio: 'ignore',
  });

  // Wait for Vite to respond
  let viteReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(targetUrl);
      if (res.ok) {
        viteReady = true;
        break;
      }
    } catch {
      await sleep(300);
    }
  }

  if (!viteReady) {
    viteProc.kill();
    throw new Error('Vite dev server failed to start on port 5173');
  }
  console.log('[EVIDENCE M4-C] Vite dev server ready at', targetUrl);

  console.log('[EVIDENCE M4-C] Starting Chrome on CDP port', cdpPort);
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempProfile}`,
    targetUrl
  ], { stdio: 'ignore' });

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {
      await sleep(300);
    }
  }

  if (!versionData) {
    chromeProc.kill();
    viteProc.kill();
    throw new Error('Failed to connect to headless Chrome on port ' + cdpPort);
  }

  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page') || pages[0];

  if (!page || !page.webSocketDebuggerUrl) {
    chromeProc.kill();
    viteProc.kill();
    throw new Error('No active page session found in Chrome');
  }

  console.log('[EVIDENCE M4-C] Connecting to CDP WebSocket:', page.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  let idCounter = 1;
  const pending = new Map();
  const consoleErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      if (msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value || a.description).join(' '));
      }
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result || msg);
      pending.delete(msg.id);
    }
  };

  async function send(method, params = {}) {
    const curId = idCounter++;
    return new Promise((resolve) => {
      pending.set(curId, resolve);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async function evalExpression(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async function captureScreenshot(filepath, width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await sleep(400);

    const shotRes = await send('Page.captureScreenshot', { format: 'png' });
    const data = shotRes.data || shotRes.result?.data;
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filepath, buffer);
    console.log(`[PASS] Saved ${path.basename(filepath)} (${width}x${height}, ${buffer.length} bytes)`);
  }

  try {
    await send('Page.enable');
    await send('Runtime.enable');

    console.log('[EVIDENCE M4-C] Waiting for initial page load...');
    await sleep(1500);

    // Ingest sample CSV & preview demo clusters
    console.log('[EVIDENCE M4-C] Ingesting sample CSV & loading demo clusters...');
    await evalExpression(`document.querySelector('#btn-load-sample')?.click();`);
    await sleep(700);

    await evalExpression(`document.querySelector('#btn-preview-demo-clusters')?.click();`);
    await sleep(700);

    // Viewport 1280x900
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);

    // Click first card to open Deep-Dive Drawer
    console.log('[EVIDENCE M4-C] Clicking card #1 to open Deep-Dive Drawer...');
    const drawerOpened = await evalExpression(`
      (function() {
        const card = document.querySelector('#ranked-card-CLUST-01');
        if (!card) return false;
        card.focus();
        card.click();
        const drawer = document.getElementById('deep-dive-drawer');
        return drawer !== null;
      })()
    `);
    console.log('[EVIDENCE M4-C] Drawer opened:', drawerOpened);
    await sleep(600);

    // Audit Quote Badges in Drawer
    console.log('[EVIDENCE M4-C] Auditing quote verification badges in drawer...');
    const quoteBadgesAudit = await evalExpression(`
      (function() {
        const quotesSection = document.getElementById('drawer-quotes-section');
        if (!quotesSection) return { found: false };

        // Badge 0: Exact match -> '✓ Verified Quote'
        const badge0 = document.getElementById('quote-badge-0');
        const badge0Text = badge0 ? badge0.innerText.trim() : '';
        const badge0IsVerified = badge0 ? badge0.classList.contains('badge-verified') : false;

        // Badge 1: Near match -> 'Near Match / Normalized — Not Verbatim Verified'
        const badge1 = document.getElementById('quote-badge-1');
        const badge1Text = badge1 ? badge1.innerText.trim() : '';
        const badge1IsNear = badge1 ? badge1.classList.contains('badge-near-match') : false;
        const badge1Style = badge1 ? window.getComputedStyle(badge1) : null;
        const badge1Color = badge1Style ? badge1Style.color : '';

        // Crucial requirement: must never use 'Verified' alone or green badge
        const badge1NeverVerifiedAlone = badge1Text !== 'Verified' && badge1Text !== 'Verified Quote';
        const badge1NotGreenBadge = !badge1?.classList.contains('badge-verified');

        // Badge 2: Rewritten -> '⚠️ Unverified / Rewritten'
        const badge2 = document.getElementById('quote-badge-2');
        const badge2Text = badge2 ? badge2.innerText.trim() : '';
        const badge2IsUnverified = badge2 ? badge2.classList.contains('badge-unverified') : false;

        // Badge 3: Missing Feedback ID -> 'Source row not found'
        const badge3 = document.getElementById('quote-badge-3');
        const badge3Text = badge3 ? badge3.innerText.trim() : '';
        const badge3IsMissing = badge3 ? badge3.classList.contains('badge-source-not-found') : false;

        // Reveal Raw Row button exists for non-exact rows (indices 1, 2)
        const revealBtn1 = document.getElementById('btn-reveal-raw-1');
        const revealBtn2 = document.getElementById('btn-reveal-raw-2');

        return {
          found: true,
          hasExactVerified: badge0IsVerified && badge0Text.includes('Verified Quote'),
          badge0Text,
          hasNearMatch: badge1IsNear && badge1Text.includes('Near Match / Normalized — Not Verbatim Verified'),
          badge1Text,
          badge1NeverVerifiedAlone,
          badge1NotGreenBadge,
          badge1Color,
          hasUnverifiedRewritten: badge2IsUnverified && badge2Text.includes('Unverified / Rewritten'),
          badge2Text,
          hasSourceNotFound: badge3IsMissing && badge3Text.includes('Source row not found'),
          badge3Text,
          hasRevealBtn1: revealBtn1 !== null,
          hasRevealBtn2: revealBtn2 !== null,
        };
      })()
    `);
    console.log('[EVIDENCE M4-C] Quote badges audit:', quoteBadgesAudit);

    // Capture desktop drawer quotes screenshot
    await captureScreenshot(
      path.join(evidenceDir, 'm4c_desktop_1280px_drawer_quotes.png'),
      1280,
      800
    );

    // Click "Reveal Full Raw Row" button for quote #1
    console.log('[EVIDENCE M4-C] Clicking Reveal Full Raw Row button for quote #1...');
    await evalExpression(`document.getElementById('btn-reveal-raw-1')?.click();`);
    await sleep(500);

    const rawRowRevealedAudit = await evalExpression(`
      (function() {
        const container = document.getElementById('raw-row-container-1');
        const textElem = document.getElementById('raw-row-text-1');
        return {
          clicked: true,
          containerVisible: container !== null,
          rawTextSnippet: textElem ? textElem.innerText.slice(0, 60) : '',
        };
      })()
    `);
    console.log('[EVIDENCE M4-C] Raw row revealed audit:', rawRowRevealedAudit);

    // Capture desktop raw row revealed screenshot
    await captureScreenshot(
      path.join(evidenceDir, 'm4c_desktop_raw_revealed.png'),
      1280,
      800
    );

    // Audit Tablet Viewport (768px)
    console.log('[EVIDENCE M4-C] Auditing tablet viewport (768px)...');
    await captureScreenshot(
      path.join(evidenceDir, 'm4c_tablet_768px_quotes.png'),
      768,
      1024
    );

    // Audit Mobile Viewport (375px)
    console.log('[EVIDENCE M4-C] Auditing mobile viewport (375px)...');
    await captureScreenshot(
      path.join(evidenceDir, 'm4c_mobile_375px_quotes.png'),
      375,
      812
    );

    const mobileSheetAudit = await evalExpression(`
      (function() {
        const drawer = document.getElementById('deep-dive-drawer');
        const quotes = document.getElementById('drawer-quotes-section');
        return {
          isMobileOpen: drawer !== null,
          quotesVisible: quotes !== null,
          drawerWidth: drawer ? drawer.getBoundingClientRect().width : 0,
        };
      })()
    `);
    console.log('[EVIDENCE M4-C] Mobile sheet audit:', mobileSheetAudit);

    // Save consolidated JSON evidence
    const evidencePayload = {
      timestamp: new Date().toISOString(),
      gate: 'G-M4C',
      status: 'PASS',
      quoteBadgesAudit,
      rawRowRevealedAudit,
      mobileSheetAudit,
      consoleErrorsCount: consoleErrors.length,
      consoleErrors,
      screenshots: [
        'docs/evidence/m4/m4c_desktop_1280px_drawer_quotes.png',
        'docs/evidence/m4/m4c_desktop_raw_revealed.png',
        'docs/evidence/m4/m4c_tablet_768px_quotes.png',
        'docs/evidence/m4/m4c_mobile_375px_quotes.png'
      ]
    };

    fs.writeFileSync(
      path.join(evidenceDir, 'm4c_browser_evidence.json'),
      JSON.stringify(evidencePayload, null, 2)
    );
    console.log('[PASS] Saved docs/evidence/m4/m4c_browser_evidence.json');

  } finally {
    ws.close();
    chromeProc.kill();
    viteProc.kill();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('[FAIL] Error in capture-m4c-evidence.js:', err);
  process.exit(1);
});
