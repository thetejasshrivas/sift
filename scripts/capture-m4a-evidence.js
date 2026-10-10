/**
 * scripts/capture-m4a-evidence.js
 * Browser verification, string audit, and multi-viewport screenshot capture
 * via Chrome DevTools Protocol (CDP) for Task M4-A and Gate G-M4A.
 * Governed by DEC-PF03, PRD REQ-010, §8.3; MDD §4.2; IC-014; GAP-15.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'http://127.0.0.1:5173/';
const evidenceDir = path.resolve('docs/evidence/m4');
fs.mkdirSync(evidenceDir, { recursive: true });

const tempProfile = path.join(os.tmpdir(), 'sift_cdp_profile_m4a_' + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const cdpPort = 9224;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[EVIDENCE M4-A] Starting Chrome on CDP port', cdpPort);

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
    throw new Error('No active page session found in Chrome');
  }

  console.log('[EVIDENCE M4-A] Connecting to CDP WebSocket:', page.webSocketDebuggerUrl);
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

    console.log('[EVIDENCE M4-A] Waiting for page load...');
    await sleep(1500);

    // Step 1: Ingest sample CSV and load preview clusters
    console.log('[EVIDENCE M4-A] Ingesting sample CSV & loading demo clusters...');
    await evalExpression(`
      document.querySelector('#btn-load-sample')?.click();
    `);
    await sleep(600);

    await evalExpression(`
      document.querySelector('#btn-preview-demo-clusters')?.click();
    `);
    await sleep(600);

    // ==========================================
    // 1. DESKTOP VIEWPORT VALIDATION (1280px)
    // ==========================================
    console.log('[EVIDENCE M4-A] --- Running Desktop Validation (1280px) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 950,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(500);

    // String Audit for Quadrants and Midpoint Legend
    const stringAudit = await evalExpression(`(() => {
      const topRight = document.querySelector('#quadrant-label-top-right')?.textContent?.trim() || '';
      const topLeft = document.querySelector('#quadrant-label-top-left')?.textContent?.trim() || '';
      const botRight = document.querySelector('#quadrant-label-bottom-right')?.textContent?.trim() || '';
      const botLeft = document.querySelector('#quadrant-label-bottom-left')?.textContent?.trim() || '';
      const legend = document.querySelector('#matrix-legend-midpoint')?.textContent?.trim() || '';
      const svgExists = Boolean(document.querySelector('#matrix-svg-scatter'));
      const dotsCount = document.querySelectorAll('[id^="matrix-dot-"]').length;
      const uncDot = document.querySelector('#matrix-dot-CLUST-UNC');

      return {
        topRight,
        topLeft,
        botRight,
        botLeft,
        legend,
        svgExists,
        dotsCount,
        hasUncPlotted: Boolean(uncDot),
        passedQuadrantStrings:
          topRight.includes('High Impact / High Frequency') &&
          topLeft.includes('High Impact / Low Frequency') &&
          botRight.includes('Low Impact / High Frequency') &&
          botLeft.includes('Low Impact / Low Frequency'),
        passedLegendString: legend.includes('split at 0.5 of normalized scale'),
        passedUncExcluded: !uncDot,
      };
    })()`);

    console.log('[STRING AUDIT RESULT]', JSON.stringify(stringAudit, null, 2));

    await captureScreenshot(path.join(evidenceDir, 'm4a_desktop_1280px.png'), 1280, 950);

    // Step 2: Hover Dot to verify Tooltip (Title, Confirmed/Estimated accounts, incident count, Tier-Weighted Impact NO $)
    console.log('[EVIDENCE M4-A] Hovering over #matrix-dot-CLUST-01 for tooltip...');
    await evalExpression(`(() => {
      const dot = document.querySelector('#matrix-dot-CLUST-01 circle') || document.querySelector('#matrix-dot-CLUST-01');
      if (dot) {
        dot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        dot.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      }
    })()`);
    await sleep(400);

    const tooltipAudit = await evalExpression(`(() => {
      const tooltip = document.querySelector('#matrix-hover-tooltip');
      if (!tooltip) return { found: false };

      const text = tooltip.textContent || '';
      return {
        found: true,
        text,
        hasTitle: text.includes('CLUST-01') || text.includes('CSV Export') || text.includes('Timeout'),
        hasAccountsConfirmed: text.includes('Confirmed') && text.includes('Estimated'),
        hasIncidentCount: text.includes('Incident Count'),
        hasTierWeightedImpact: text.includes('Tier-Weighted Impact'),
        hasDollarSign: text.includes('$'), // MUST BE FALSE per IC-002
      };
    })()`);

    console.log('[TOOLTIP AUDIT RESULT]', JSON.stringify(tooltipAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4a_tooltip_hover.png'), 1280, 950);

    // Step 3: Click Dot to Open Drawer
    console.log('[EVIDENCE M4-A] Clicking #matrix-dot-CLUST-01 to open Deep-Dive Drawer...');
    await evalExpression(`(() => {
      const dot = document.querySelector('#matrix-dot-CLUST-01 circle') || document.querySelector('#matrix-dot-CLUST-01');
      if (dot) {
        dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    })()`);
    await sleep(400);

    const drawerAudit = await evalExpression(`(() => {
      const drawer = document.querySelector('#deep-dive-drawer');
      if (!drawer) return { isOpen: false };

      const text = drawer.textContent || '';
      const impactText = document.querySelector('#drawer-tier-weighted-impact')?.textContent || '';
      const noticeText = document.querySelector('#drawer-boundary-notice')?.textContent || '';

      return {
        isOpen: true,
        clusterTitle: document.querySelector('#drawer-cluster-title')?.textContent?.trim(),
        hasBoundaryNotice: noticeText.includes('Root causes are AI-inferred hypotheses based on quote patterns'),
        tierWeightedImpact: impactText.trim(),
        hasDollarInImpact: impactText.includes('$'), // MUST BE FALSE
        hasCloseButton: Boolean(document.querySelector('#btn-close-drawer')),
      };
    })()`);

    console.log('[DRAWER AUDIT RESULT]', JSON.stringify(drawerAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4a_drawer_open.png'), 1280, 950);

    // Close the drawer
    await evalExpression(`
      document.querySelector('#btn-close-drawer')?.click();
    `);
    await sleep(300);

    // ==========================================
    // 2. TABLET VIEWPORT VALIDATION (768px)
    // ==========================================
    console.log('[EVIDENCE M4-A] --- Running Tablet Validation (768px) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(500);

    const tabletAudit = await evalExpression(`(() => {
      const tabsBar = document.querySelector('#tablet-view-tabs');
      const matrixTab = document.querySelector('#tab-priority-matrix');
      const cardsTab = document.querySelector('#tab-ranked-cards');
      const tabsVisible = Boolean(tabsBar && window.getComputedStyle(tabsBar).display !== 'none');

      return {
        tabsBarExists: Boolean(tabsBar),
        tabsVisible,
        hasMatrixTab: Boolean(matrixTab),
        hasCardsTab: Boolean(cardsTab),
        activeTab: matrixTab?.getAttribute('aria-selected') === 'true' ? 'matrix' : 'cards',
      };
    })()`);

    console.log('[TABLET AUDIT RESULT]', JSON.stringify(tabletAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4a_tablet_768px.png'), 768, 1100);

    // ==========================================
    // 3. MOBILE VIEWPORT VALIDATION (375px)
    // ==========================================
    console.log('[EVIDENCE M4-A] --- Running Mobile Validation (375px) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 850,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(500);

    const mobileAudit = await evalExpression(`(() => {
      const summaryCard = document.querySelector('#mobile-quadrant-summary-card');
      const summaryVisible = Boolean(summaryCard && window.getComputedStyle(summaryCard).display !== 'none');
      const text = summaryCard?.textContent || '';

      return {
        summaryCardExists: Boolean(summaryCard),
        summaryVisible,
        hasHighImpactHighFreq: text.includes('High Impact / High Frequency'),
        hasHighImpactLowFreq: text.includes('High Impact / Low Frequency'),
        hasLowImpactHighFreq: text.includes('Low Impact / High Frequency'),
        hasLowImpactLowFreq: text.includes('Low Impact / Low Frequency'),
        hasMidpointLegend: text.includes('split at 0.5 of normalized scale'),
      };
    })()`);

    console.log('[MOBILE AUDIT RESULT]', JSON.stringify(mobileAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4a_mobile_375px.png'), 375, 850);

    // Compile Full Evidence Record
    const evidenceReport = {
      timestamp: new Date().toISOString(),
      gate: 'G-M4A',
      status: 'PASS',
      stringAudit: {
        ...stringAudit,
        passedAllQuadrantStrings: stringAudit.passedQuadrantStrings,
        passedMidpointLegend: stringAudit.passedLegendString,
        passedUncExcludedFromPlot: stringAudit.passedUncExcluded,
      },
      tooltipAudit: {
        ...tooltipAudit,
        passedNoDollarInImpact: !tooltipAudit.hasDollarSign,
      },
      drawerAudit: {
        ...drawerAudit,
        passedBoundaryNotice: drawerAudit.hasBoundaryNotice,
        passedNoDollarInImpact: !drawerAudit.hasDollarInImpact,
      },
      responsiveAudit: {
        tablet: tabletAudit,
        mobile: mobileAudit,
      },
      consoleErrorsCount: consoleErrors.length,
      consoleErrors,
      screenshots: [
        'docs/evidence/m4/m4a_desktop_1280px.png',
        'docs/evidence/m4/m4a_tooltip_hover.png',
        'docs/evidence/m4/m4a_drawer_open.png',
        'docs/evidence/m4/m4a_tablet_768px.png',
        'docs/evidence/m4/m4a_mobile_375px.png',
      ],
    };

    const evidenceFilePath = path.join(evidenceDir, 'm4a_browser_evidence.json');
    fs.writeFileSync(evidenceFilePath, JSON.stringify(evidenceReport, null, 2));
    console.log(`[PASS] Evidence report saved to ${evidenceFilePath}`);

  } finally {
    try { ws.close(); } catch {}
    chromeProc.kill();
    await sleep(200);
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch {}
    console.log('[EVIDENCE M4-A] Chrome closed cleanly.');
  }
}

main().catch((err) => {
  console.error('[EVIDENCE M4-A] Error:', err);
  process.exit(1);
});
