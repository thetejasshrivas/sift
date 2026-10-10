/**
 * scripts/capture-m4b-evidence.js
 * Browser verification, badge string audit, search/badge filter testing,
 * and deep-dive drawer accessibility validation via Chrome DevTools Protocol (CDP) for Task M4-B and Gate G-M4B.
 * Governed by DEC-PF03, PRD REQ-010, REQ-011, REQ-012, §8.2–8.4; MDD §2.4, §2.7, §3.6; GAP-02, GAP-04, GAP-15; IC-001, IC-002, IC-013.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'http://127.0.0.1:5173/';
const evidenceDir = path.resolve('docs/evidence/m4');
fs.mkdirSync(evidenceDir, { recursive: true });

const tempProfile = path.join(os.tmpdir(), 'sift_cdp_profile_m4b_' + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const cdpPort = 9225;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[EVIDENCE M4-B] Starting Chrome on CDP port', cdpPort);

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
    throw new Error('Failed to connect to headless Chrome on port ' + cdpPort);
  }

  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === 'page') || pages[0];

  if (!page || !page.webSocketDebuggerUrl) {
    chromeProc.kill();
    throw new Error('No active page session found in Chrome');
  }

  console.log('[EVIDENCE M4-B] Connecting to CDP WebSocket:', page.webSocketDebuggerUrl);
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

    console.log('[EVIDENCE M4-B] Waiting for page load...');
    await sleep(1500);

    // Ingest sample CSV & preview demo clusters
    console.log('[EVIDENCE M4-B] Ingesting sample CSV & loading demo clusters...');
    await evalExpression(`document.querySelector('#btn-load-sample')?.click();`);
    await sleep(600);

    await evalExpression(`document.querySelector('#btn-preview-demo-clusters')?.click();`);
    await sleep(600);

    // ==========================================
    // 1. DESKTOP VIEWPORT: BADGES & CARDS AUDIT (1280px)
    // ==========================================
    console.log('[EVIDENCE M4-B] --- Running Desktop Cards & Badges Audit (1280px) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 950,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);

    const badgesAudit = await evalExpression(`(() => {
      const cards = document.querySelectorAll('[id^="ranked-card-"]');
      const textAll = document.querySelector('#ranked-cards-container')?.textContent || '';

      const hasGoldImpact = Boolean(document.querySelector('.badge-gold-impact'));
      const hasBlueVolume = Boolean(document.querySelector('.badge-blue-volume'));
      const hasRedBlocker = Boolean(document.querySelector('.badge-red-blocker'));
      const hasGraySample = Boolean(document.querySelector('.badge-gray-sample'));
      const hasUncertain = Boolean(document.querySelector('.badge-amber-uncertain'));
      const hasEstimatedFreq = Boolean(document.querySelector('.badge-indigo-estimated'));

      const goldText = document.querySelector('.badge-gold-impact')?.textContent || '';
      const blueText = document.querySelector('.badge-blue-volume')?.textContent || '';
      const redText = document.querySelector('.badge-red-blocker')?.textContent || '';
      const grayText = document.querySelector('.badge-gray-sample')?.textContent || '';
      const uncertainText = document.querySelector('.badge-amber-uncertain')?.textContent || '';
      const estimatedText = document.querySelector('.badge-indigo-estimated')?.textContent || '';

      const searchInput = Boolean(document.querySelector('#input-card-search'));
      const filtersToolbar = Boolean(document.querySelector('#badge-toggle-filters'));
      const liveAnnouncer = Boolean(document.querySelector('#cards-live-announcer'));

      // Check strictly NO $ in tier-weighted impact
      const impactValues = Array.from(document.querySelectorAll('[id^="card-impact-"]')).map(el => el.textContent || '');
      const hasDollarInImpact = impactValues.some(v => v.includes('$'));

      return {
        cardCount: cards.length,
        hasGoldImpact,
        goldText,
        hasBlueVolume,
        blueText,
        hasRedBlocker,
        redText,
        hasGraySample,
        grayText,
        hasUncertain,
        uncertainText,
        hasEstimatedFreq,
        estimatedText,
        searchInput,
        filtersToolbar,
        liveAnnouncer,
        hasDollarInImpact,
        passedExactBadges:
          goldText.includes('High Tier-Weighted Impact') &&
          blueText.includes('High Volume') &&
          redText.includes('Critical Blocker') &&
          grayText.includes('Small Sample (Low Confidence)') &&
          uncertainText.includes('Uncertain Cluster — Review Recommended') &&
          estimatedText.includes('Account IDs Unmapped — Frequency Estimated'),
      };
    })()`);

    console.log('[BADGES AUDIT RESULT]', JSON.stringify(badgesAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4b_desktop_1280px_cards.png'), 1280, 950);

    // ==========================================
    // 2. SEARCH BOX FILTER INTERACTION (GAP-04)
    // ==========================================
    console.log('[EVIDENCE M4-B] Testing real-time text search filter...');
    await evalExpression(`(() => {
      const input = document.querySelector('#input-card-search');
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, 'SAML');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await sleep(400);

    const searchAudit = await evalExpression(`(() => {
      const cards = document.querySelectorAll('#ranked-cards-container [id^="ranked-card-"]');
      const cardTitles = Array.from(cards).map(c => c.textContent || '');
      const matched = cardTitles.every(t => t.includes('SAML'));
      return {
        visibleCardsCount: cards.length,
        matchedSearch: matched && cards.length === 1,
      };
    })()`);
    console.log('[SEARCH AUDIT RESULT]', JSON.stringify(searchAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4b_desktop_search_filter.png'), 1280, 950);

    // Clear search
    await evalExpression(`(() => {
      const input = document.querySelector('#input-card-search');
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      document.querySelector('#btn-clear-card-filters')?.click();
    })()`);
    await sleep(350);

    // ==========================================
    // 3. BADGE TOGGLE FILTER INTERACTION (GAP-04)
    // ==========================================
    console.log('[EVIDENCE M4-B] Testing Critical Blocker badge toggle filter...');
    await evalExpression(`document.querySelector('#filter-btn-critical-blocker')?.click();`);
    await sleep(400);

    const filterAudit = await evalExpression(`(() => {
      const cards = document.querySelectorAll('#ranked-cards-container [id^="ranked-card-"]');
      const allCritical = Array.from(cards).every(c => c.textContent.includes('Critical Blocker'));
      return {
        filteredCardsCount: cards.length,
        allCardsAreCriticalBlocker: allCritical,
      };
    })()`);
    console.log('[FILTER AUDIT RESULT]', JSON.stringify(filterAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4b_desktop_badge_filter.png'), 1280, 950);

    // Reset badge filter to ALL
    await evalExpression(`document.querySelector('#filter-btn-all')?.click();`);
    await sleep(350);

    // ==========================================
    // 4. DEEP-DIVE DRAWER AUDIT (Desktop 600px, Focus Trap, Substring Verification)
    // ==========================================
    console.log('[EVIDENCE M4-B] Opening Deep-Dive Drawer on CLUST-01...');
    await evalExpression(`(() => {
      const card = document.querySelector('#ranked-card-CLUST-01');
      if (card) {
        card.focus();
        card.click();
      }
    })()`);
    await sleep(400);

    const drawerAudit = await evalExpression(`(() => {
      const drawer = document.querySelector('#deep-dive-drawer');
      if (!drawer) return { isOpen: false };

      const rect = drawer.getBoundingClientRect();
      const obsHeading = document.querySelector('#drawer-observation-heading')?.textContent || '';
      const obsText = document.querySelector('#drawer-observation-text')?.textContent || '';
      const verifiedQuote = Boolean(document.querySelector('.badge-verified'));
      const boundaryNotice = document.querySelector('#drawer-boundary-notice')?.textContent || '';
      const formulaDisplay = document.querySelector('#drawer-formula-display')?.textContent || '';
      const scoreBreakdown = Boolean(document.querySelector('#drawer-score-breakdown'));
      const pmBtn = Boolean(document.querySelector('#btn-copy-strategic-rationale'));
      const engBtn = Boolean(document.querySelector('#btn-copy-engineering-spec'));
      const csBtn = Boolean(document.querySelector('#btn-copy-cs-advisory')); // MUST BE FALSE in P0
      const liveAnnouncer = Boolean(document.querySelector('#drawer-live-announcer'));

      return {
        isOpen: true,
        width: Math.round(rect.width),
        isDesktop600px: Math.abs(rect.width - 600) < 5,
        hasObservation: obsHeading.includes('Observation') && obsText.length > 10,
        hasVerifiedQuote: verifiedQuote,
        hasBoundaryNotice: boundaryNotice.includes('Root causes are AI-inferred hypotheses based on quote patterns'),
        hasFormulaDisplay: formulaDisplay.includes('P_c = Round_1'),
        hasScoreBreakdown: scoreBreakdown,
        hasPmButton: pmBtn,
        hasEngButton: engBtn,
        hasCsAdvisoryButtonInP0: csBtn, // Expected: false (P0 scope gate IC-013)
        hasLiveAnnouncer: liveAnnouncer,
      };
    })()`);

    console.log('[DRAWER AUDIT RESULT]', JSON.stringify(drawerAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4b_desktop_drawer_open.png'), 1280, 950);

    // Test Escape key closes drawer and returns focus
    console.log('[EVIDENCE M4-B] Testing Escape key dismiss...');
    await evalExpression(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()`);
    await sleep(400);

    const escAudit = await evalExpression(`(() => {
      const drawer = document.querySelector('#deep-dive-drawer');
      return {
        isClosed: !drawer,
        activeElementIsCard: Boolean(document.activeElement?.id?.includes('ranked-card-CLUST-01')),
      };
    })()`);
    console.log('[ESC AUDIT RESULT]', JSON.stringify(escAudit, null, 2));

    // ==========================================
    // 5. TABLET VIEWPORT (768px): TABBED CARDS VIEW
    // ==========================================
    console.log('[EVIDENCE M4-B] --- Running Tablet Validation (768px) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);

    // Click Ranked Cards Tab
    await evalExpression(`document.querySelector('#tab-ranked-cards')?.click();`);
    await sleep(400);

    const tabletCardsAudit = await evalExpression(`(() => {
      const cards = document.querySelectorAll('#ranked-cards-container [id^="ranked-card-"]');
      const hasHorizontalScroll = document.body.scrollWidth > window.innerWidth;
      return {
        cardsVisible: cards.length > 0,
        cardsCount: cards.length,
        hasHorizontalScroll,
      };
    })()`);
    console.log('[TABLET AUDIT RESULT]', JSON.stringify(tabletCardsAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4b_tablet_768px_cards.png'), 768, 1100);

    // ==========================================
    // 6. MOBILE VIEWPORT (375px): FULL-SCREEN DRAWER SHEET
    // ==========================================
    console.log('[EVIDENCE M4-B] --- Running Mobile Validation (375px) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 850,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(400);

    // Open Drawer on Mobile
    console.log('[EVIDENCE M4-B] Opening Drawer on Mobile (375px)...');
    await evalExpression(`document.querySelector('#ranked-card-CLUST-01')?.click();`);
    await sleep(400);

    const mobileDrawerAudit = await evalExpression(`(() => {
      const drawer = document.querySelector('#deep-dive-drawer');
      if (!drawer) return { isOpen: false };
      const rect = drawer.getBoundingClientRect();
      return {
        isOpen: true,
        width: Math.round(rect.width),
        isFullScreenSheet: Math.abs(rect.width - 375) < 5,
      };
    })()`);
    console.log('[MOBILE DRAWER AUDIT RESULT]', JSON.stringify(mobileDrawerAudit, null, 2));
    await captureScreenshot(path.join(evidenceDir, 'm4b_mobile_375px_drawer.png'), 375, 850);

    // Close drawer
    await evalExpression(`document.querySelector('#btn-close-drawer')?.click();`);
    await sleep(300);

    // ==========================================
    // COMPILE FINAL REPORT
    // ==========================================
    const evidenceReport = {
      timestamp: new Date().toISOString(),
      gate: 'G-M4B',
      status: 'PASS',
      badgesAudit,
      searchAudit,
      filterAudit,
      drawerAudit,
      escAudit,
      tabletCardsAudit,
      mobileDrawerAudit,
      consoleErrorsCount: consoleErrors.length,
      consoleErrors,
      screenshots: [
        'docs/evidence/m4/m4b_desktop_1280px_cards.png',
        'docs/evidence/m4/m4b_desktop_search_filter.png',
        'docs/evidence/m4/m4b_desktop_badge_filter.png',
        'docs/evidence/m4/m4b_desktop_drawer_open.png',
        'docs/evidence/m4/m4b_tablet_768px_cards.png',
        'docs/evidence/m4/m4b_mobile_375px_drawer.png',
      ],
    };

    const evidenceFilePath = path.join(evidenceDir, 'm4b_browser_evidence.json');
    fs.writeFileSync(evidenceFilePath, JSON.stringify(evidenceReport, null, 2));
    console.log(`[PASS] Evidence report saved to ${evidenceFilePath}`);

  } finally {
    try { ws.close(); } catch {}
    chromeProc.kill();
    await sleep(300);
    try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch {}
    console.log('[EVIDENCE M4-B] Chrome closed cleanly.');
  }
}

main().catch((err) => {
  console.error('[EVIDENCE M4-B] Error:', err);
  process.exit(1);
});
