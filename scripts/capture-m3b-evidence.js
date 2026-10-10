/**
 * scripts/capture-m3b-evidence.js
 * Browser verification and screenshot capture via Chrome DevTools Protocol (CDP)
 * for Task M3-B and Gate G-M3B (governed by DEC-PF03, PRD REQ-009, TS-006).
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'http://127.0.0.1:5173/';
const evidenceDir = path.resolve('docs/evidence/m3');
fs.mkdirSync(evidenceDir, { recursive: true });

const tempProfile = path.join(os.tmpdir(), 'sift_cdp_profile_m3b_' + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const cdpPort = 9223;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[EVIDENCE M3-B] Starting Chrome on CDP port', cdpPort);

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
    throw new Error('Failed to connect to Chrome DevTools endpoint');
  }

  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page') || pages[0];

  if (!page || !page.webSocketDebuggerUrl) {
    chromeProc.kill();
    throw new Error('No inspectable page found');
  }

  console.log('[EVIDENCE M3-B] Connecting to CDP WebSocket:', page.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve) => ws.onopen = resolve);

  let idCounter = 1;
  const pendingRequests = new Map();
  const consoleLogs = [];

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
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push({
        type: msg.params.type,
        text: msg.params.args.map((a) => a.value).join(' ')
      });
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
    await sendCdp('Runtime.enable');
    await sendCdp('Page.enable');
    await sendCdp('DOM.enable');

    console.log('[EVIDENCE M3-B] Waiting for page load...');
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

    // Step 1: Load Benchmark Sample Dataset
    console.log('[EVIDENCE M3-B] Clicking #btn-load-sample...');
    await sendCdp('Runtime.evaluate', {
      expression: `document.getElementById('btn-load-sample').click()`
    });
    await sleep(800);

    // Step 2: Click Demo Preview Button to render Dual-View Workspace & Sliders
    console.log('[EVIDENCE M3-B] Clicking #btn-preview-demo-clusters...');
    await sendCdp('Runtime.evaluate', {
      expression: `document.getElementById('btn-preview-demo-clusters').click()`
    });
    await sleep(800);

    // Step 3: Read Initial State (Sliders, Matrix Coordinates, Top Cards)
    const initialState = await sendCdp('Runtime.evaluate', {
      expression: `(() => {
        const pImpact = document.getElementById('pct-impact')?.textContent?.trim();
        const pFreq = document.getElementById('pct-frequency')?.textContent?.trim();
        const pSev = document.getElementById('pct-severity')?.textContent?.trim();
        
        const dot1 = document.getElementById('matrix-dot-CLUST-01');
        const dotFn = dot1?.getAttribute('data-fn');
        const dotIn = dot1?.getAttribute('data-in');
        
        const cards = Array.from(document.querySelectorAll('#ranked-cards-container > [data-cluster-id]')).map(c => ({
          id: c.getAttribute('data-cluster-id'),
          rank: c.getAttribute('data-rank'),
          score: c.getAttribute('data-score'),
          fn: c.getAttribute('data-fn'),
          in: c.getAttribute('data-in')
        }));
        
        return { pImpact, pFreq, pSev, dotFn, dotIn, cards };
      })()`,
      returnByValue: true
    });

    console.log('[INITIAL STATE]', JSON.stringify(initialState.result.value, null, 2));

    // Capture Desktop View at 40/40/20
    await capture('m3b_desktop_1280px.png', 1280, 950);
    await capture('m3b_tablet_768px.png', 768, 1100);
    await capture('m3b_mobile_375px.png', 375, 850);

    // Step 4: Live Slider Calibration — Set Impact Slider to 100% (TS-006 action)
    console.log('[EVIDENCE M3-B] Setting #slider-impact to 100%...');
    await sendCdp('Runtime.evaluate', {
      expression: `(() => {
        const slider = document.getElementById('slider-impact');
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(slider, '100');
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      })()`,
    });

    // Wait for RAF batching and React re-render
    await sleep(500);

    const postState = await sendCdp('Runtime.evaluate', {
      expression: `(() => {
        const pImpact = document.getElementById('pct-impact')?.textContent?.trim();
        const pFreq = document.getElementById('pct-frequency')?.textContent?.trim();
        const pSev = document.getElementById('pct-severity')?.textContent?.trim();
        
        const dot1 = document.getElementById('matrix-dot-CLUST-01');
        const dotFn = dot1?.getAttribute('data-fn');
        const dotIn = dot1?.getAttribute('data-in');
        
        const cards = Array.from(document.querySelectorAll('#ranked-cards-container > [data-cluster-id]')).map(c => ({
          id: c.getAttribute('data-cluster-id'),
          rank: c.getAttribute('data-rank'),
          score: c.getAttribute('data-score'),
          fn: c.getAttribute('data-fn'),
          in: c.getAttribute('data-in')
        }));
        
        return { pImpact, pFreq, pSev, dotFn, dotIn, cards };
      })()`,
      returnByValue: true
    });

    console.log('[POST-SLIDER-100 STATE]', JSON.stringify(postState.result.value, null, 2));
    await capture('m3b_impact_100_1280px.png', 1280, 950);

    // Step 5: Test Reset to 40/40/20 Button (GAP-03)
    console.log('[EVIDENCE M3-B] Clicking #btn-reset-sliders...');
    await sendCdp('Runtime.evaluate', {
      expression: `document.getElementById('btn-reset-sliders').click()`
    });
    await sleep(500);

    const resetState = await sendCdp('Runtime.evaluate', {
      expression: `(() => {
        const pImpact = document.getElementById('pct-impact')?.textContent?.trim();
        const pFreq = document.getElementById('pct-frequency')?.textContent?.trim();
        const pSev = document.getElementById('pct-severity')?.textContent?.trim();
        return { pImpact, pFreq, pSev };
      })()`,
      returnByValue: true
    });

    console.log('[RESET STATE]', JSON.stringify(resetState.result.value, null, 2));

    // Step 6: Test Breakdown Tooltip
    console.log('[EVIDENCE M3-B] Hovering over score badge for breakdown tooltip...');
    await sendCdp('Runtime.evaluate', {
      expression: `(() => {
        const scoreBtn = document.querySelector('#card-score-wrapper-CLUST-01 button');
        if (scoreBtn) {
          scoreBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          scoreBtn.focus();
        }
      })()`
    });
    await sleep(500);

    const tooltipState = await sendCdp('Runtime.evaluate', {
      expression: `(() => {
        const tooltip = document.querySelector('[role="tooltip"]');
        return tooltip ? tooltip.innerText : 'TOOLTIP_NOT_FOUND';
      })()`,
      returnByValue: true
    });

    console.log('[TOOLTIP CONTENT]\n', tooltipState.result.value);
    await capture('m3b_tooltip_breakdown.png', 1280, 950);

    // Save summary evidence report
    const evidenceReport = {
      timestamp: new Date().toISOString(),
      gate: 'G-M3B',
      ts006: {
        initialState: initialState.result.value,
        postSlider100State: postState.result.value,
        resetState: resetState.result.value,
        coordinateStationary:
          initialState.result.value.dotFn === postState.result.value.dotFn &&
          initialState.result.value.dotIn === postState.result.value.dotIn,
        rankingReordered:
          initialState.result.value.cards[0].score !== postState.result.value.cards[0].score,
      },
      tooltipText: tooltipState.result.value,
      consoleErrorsCount: consoleLogs.filter(l => l.type === 'error').length,
      screenshots: [
        'docs/evidence/m3/m3b_desktop_1280px.png',
        'docs/evidence/m3/m3b_tablet_768px.png',
        'docs/evidence/m3/m3b_mobile_375px.png',
        'docs/evidence/m3/m3b_impact_100_1280px.png',
        'docs/evidence/m3/m3b_tooltip_breakdown.png',
      ]
    };

    fs.writeFileSync(
      path.join(evidenceDir, 'm3b_browser_evidence.json'),
      JSON.stringify(evidenceReport, null, 2)
    );

    console.log('[PASS] Full M3-B browser evidence collected in docs/evidence/m3/');

  } finally {
    ws.close();
    chromeProc.kill();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('[EVIDENCE M3-B] Error:', err);
  process.exit(1);
});
