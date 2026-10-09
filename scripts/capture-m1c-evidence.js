/**
 * scripts/capture-m1c-evidence.js
 * Captures responsive screenshots and network evidence via Chrome DevTools Protocol (CDP)
 * for Gate G-M1C.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'http://127.0.0.1:5173/';
const evidenceDir = path.resolve('docs/evidence/m1');
fs.mkdirSync(evidenceDir, { recursive: true });

const tempProfile = path.join(os.tmpdir(), 'sift_cdp_profile_' + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const cdpPort = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[EVIDENCE] Starting Chrome with remote debugging on port', cdpPort);

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempProfile}`,
    targetUrl
  ], { stdio: 'ignore' });

  // Wait for CDP endpoint to become ready
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
    throw new Error('Failed to connect to Chrome DevTools endpoint');
  }

  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page') || pages[0];

  if (!page || !page.webSocketDebuggerUrl) {
    chromeProc.kill();
    throw new Error('No inspectable page found');
  }

  console.log('[EVIDENCE] Connecting to CDP WebSocket:', page.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve) => ws.onopen = resolve);

  let idCounter = 1;
  const pendingRequests = new Map();
  const networkLog = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message));
      } else {
        resolve(msg.result);
      }
    } else if (msg.method) {
      if (msg.method.startsWith('Network.')) {
        networkLog.push({ timestamp: Date.now(), method: msg.method, params: msg.params });
      }
    }
  };

  function sendCdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  try {
    await sendCdp('Network.enable');
    await sendCdp('Page.enable');
    await sendCdp('DOM.enable');

    console.log('[EVIDENCE] Waiting for page load...');
    await sleep(1500);

    async function capture(filename, width = 1280, height = 800) {
      await sendCdp('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768
      });
      await sleep(400);

      const { data } = await sendCdp('Page.captureScreenshot', { format: 'png' });
      const dest = path.join(evidenceDir, filename);
      fs.writeFileSync(dest, Buffer.from(data, 'base64'));
      console.log(`[PASS] Saved ${filename} (${width}x${height}, ${fs.statSync(dest).size} bytes)`);
    }

    // 1. Hero / Landing screenshots
    console.log('[EVIDENCE] Capturing Hero Screen across viewports...');
    await capture('m1c_hero_1280px.png', 1280, 800);
    await capture('m1c_hero_768px.png', 768, 1024);
    await capture('m1c_hero_375px.png', 375, 667);

    // 2. Open Privacy Modal
    console.log('[EVIDENCE] Opening Privacy Modal...');
    await sendCdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await sendCdp('Runtime.evaluate', {
      expression: `document.querySelector('button[aria-label="View Data Privacy and Security specifications"]').click()`
    });
    await sleep(600);
    await capture('m1c_privacy_modal_1280px.png', 1280, 800);

    // Close Privacy Modal
    await sendCdp('Runtime.evaluate', {
      expression: `document.querySelector('.modal-content button[aria-label="Close modal"]').click()`
    });
    await sleep(400);

    // 3. Load Sample Dataset
    console.log('[EVIDENCE] Loading benchmark dataset synthetic_50.csv...');
    await sendCdp('Runtime.evaluate', {
      expression: `document.getElementById('btn-load-sample').click()`
    });
    await sleep(1000);

    // 4. Capture Ingestion Workspace (Loaded State)
    console.log('[EVIDENCE] Capturing Ingestion Workspace across viewports...');
    await capture('m1c_workspace_1280px.png', 1280, 950);
    await capture('m1c_workspace_768px.png', 768, 1100);
    await capture('m1c_workspace_375px.png', 375, 800);

    // 5. Open Start New Analysis Confirmation Dialog
    console.log('[EVIDENCE] Opening Start New Analysis Confirmation Dialog...');
    await sendCdp('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start New Analysis')).click()`
    });
    await sleep(600);
    await capture('m1c_confirm_dialog_1280px.png', 1280, 800);

    // Save Network Evidence Log
    const networkLogPath = path.join(evidenceDir, 'network_evidence.json');
    fs.writeFileSync(networkLogPath, JSON.stringify(networkLog, null, 2));
    console.log(`[PASS] Saved network evidence (${networkLog.length} events) -> ${networkLogPath}`);

  } finally {
    ws.close();
    chromeProc.kill();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  console.log('[EVIDENCE] All evidence successfully collected in docs/evidence/m1/');
}

main().catch((err) => {
  console.error('[EVIDENCE] Error:', err);
  process.exit(1);
});
