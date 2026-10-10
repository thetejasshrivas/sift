/**
 * scripts/capture-m5a-evidence.js
 * Browser verification and visual evidence capture for Task M5-A and Gate G-M5A.
 * Governed by PRD REQ-012, §7.4; MDD §3.7, §3.9; IC-001, IC-002; GAP-07, GAP-17.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'http://127.0.0.1:5173/';
const evidenceDir = path.resolve('docs/evidence/m5');
fs.mkdirSync(evidenceDir, { recursive: true });

const tempProfile = path.join(os.tmpdir(), 'sift_cdp_profile_m5a_' + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const cdpPort = 9226;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) {
            cb.reject(new Error(msg.error.message));
          } else {
            cb.resolve(msg.result);
          }
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filename, buffer);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Runtime.evaluate exception');
    }
    return res.result ? res.result.value : undefined;
  }
}

async function main() {
  console.log('[M5-A Browser Evidence] Launching Chrome on port', cdpPort);

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempProfile}`,
    targetUrl,
  ], { stdio: 'ignore' });

  let versionData = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {
      await sleep(250);
    }
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Failed to connect to headless Chrome on port ' + cdpPort);
  }

  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page') || pages[0];

  const client = new CDPClient(page.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  console.log('[M5-A Browser Evidence] Navigating to', targetUrl);
  await client.send('Page.navigate', { url: targetUrl });
  await sleep(1500);

  // Ingest sample CSV & preview demo clusters
  console.log('[M5-A Browser Evidence] Loading sample CSV and clusters...');
  await client.evaluate(`document.querySelector('#btn-load-sample')?.click();`);
  await sleep(600);
  await client.evaluate(`document.querySelector('#btn-preview-demo-clusters')?.click();`);
  await sleep(600);

  // 1. Desktop Viewport (1280x800)
  console.log('[M5-A Browser Evidence] Setting viewport 1280x800 desktop...');
  await client.setViewport(1280, 800);
  await sleep(500);

  // 2. Open DeepDiveDrawer by clicking first ranked card
  console.log('[M5-A Browser Evidence] Opening DeepDiveDrawer for CLUST-01...');
  await client.evaluate(`
    (() => {
      const card = document.querySelector('#ranked-card-CLUST-01');
      if (card) card.click();
    })()
  `);
  await sleep(600);

  // Capture desktop drawer open
  const desktopDrawerShot = path.join(evidenceDir, 'm5a_drawer_desktop_1280px.png');
  await client.captureScreenshot(desktopDrawerShot);
  console.log('  Saved:', desktopDrawerShot);

  // 3. Click "📋 Copy Strategic Rationale" button
  console.log('[M5-A Browser Evidence] Clicking Copy Strategic Rationale button...');
  const copyResult = await client.evaluate(`
    (async () => {
      const btn = document.querySelector('#btn-copy-strategic-rationale');
      if (!btn) return { found: false };
      btn.click();
      await new Promise(r => setTimeout(r, 200));

      const toast = document.querySelector('#copy-toast');
      const fallbackBox = document.querySelector('#copy-fallback-textbox');
      
      return {
        found: true,
        toastVisible: !!toast,
        toastText: toast ? toast.textContent.trim() : null,
        fallbackVisible: !!fallbackBox,
        fallbackTextPreview: fallbackBox ? fallbackBox.value.substring(0, 100) : null
      };
    })()
  `);

  console.log('  Copy interaction result:', copyResult);

  // Capture screenshot after clicking Copy
  const desktopCopiedShot = path.join(evidenceDir, 'm5a_copied_interaction_1280px.png');
  await client.captureScreenshot(desktopCopiedShot);
  console.log('  Saved:', desktopCopiedShot);

  // 4. Tablet Viewport (768x1024)
  console.log('[M5-A Browser Evidence] Setting viewport 768x1024 tablet...');
  await client.setViewport(768, 1024);
  await sleep(500);
  const tabletDrawerShot = path.join(evidenceDir, 'm5a_drawer_tablet_768px.png');
  await client.captureScreenshot(tabletDrawerShot);
  console.log('  Saved:', tabletDrawerShot);

  // 5. Mobile Viewport (375x812)
  console.log('[M5-A Browser Evidence] Setting viewport 375x812 mobile...');
  await client.setViewport(375, 812);
  await sleep(500);
  const mobileDrawerShot = path.join(evidenceDir, 'm5a_drawer_mobile_375px.png');
  await client.captureScreenshot(mobileDrawerShot);
  console.log('  Saved:', mobileDrawerShot);

  // 6. Direct Generator Verification inside browser environment
  const generatorEvaluation = await client.evaluate(`
    (() => {
      // Inspect drawer text and buttons
      const btnRationale = document.querySelector('#btn-copy-strategic-rationale');
      const btnEng = document.querySelector('#btn-copy-engineering-spec');
      const toast = document.querySelector('#copy-toast');
      const fallbackBox = document.querySelector('#copy-fallback-textbox');

      return {
        btnRationaleText: btnRationale ? btnRationale.textContent.trim() : null,
        btnEngText: btnEng ? btnEng.textContent.trim() : null,
        toastText: toast ? toast.textContent.trim() : null,
        hasToastOrFallback: !!(toast || fallbackBox),
      };
    })()
  `);

  const evidenceReport = {
    timestamp: new Date().toISOString(),
    gate: 'G-M5A',
    browser: 'Google Chrome (CDP Headless)',
    viewports: ['1280x800', '768x1024', '375x812'],
    screenshots: {
      desktopDrawer: 'docs/evidence/m5/m5a_drawer_desktop_1280px.png',
      desktopCopied: 'docs/evidence/m5/m5a_copied_interaction_1280px.png',
      tabletDrawer: 'docs/evidence/m5/m5a_drawer_tablet_768px.png',
      mobileDrawer: 'docs/evidence/m5/m5a_drawer_mobile_375px.png',
    },
    interactions: {
      copyResult,
      generatorEvaluation,
    },
  };

  const reportPath = path.join(evidenceDir, 'm5a_evidence.json');
  fs.writeFileSync(reportPath, JSON.stringify(evidenceReport, null, 2));
  console.log('[M5-A Browser Evidence] Saved JSON report:', reportPath);

  client.ws.close();
  chromeProc.kill();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}

  console.log('[M5-A Browser Evidence] Verification completed successfully.');
}

main().catch((err) => {
  console.error('[M5-A Browser Evidence] Error:', err);
  process.exit(1);
});
