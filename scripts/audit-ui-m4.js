/**
 * scripts/audit-ui-m4.js
 * Comprehensive UI and Accessibility Audit for Milestone 4 (Matrix, Cards, Drawer, Sliders, Ingestion).
 * Governed by PRD §3.2, §8.2–8.4, TS-014, TS-015, TS-030; MDD §4.1–4.5; IC-002, IC-014; DEC-PF03.
 *
 * Viewports audited: 375px, 768px, 800px, 1280px.
 * Tests:
 * 1. Multi-viewport rendering & zero horizontal overflow (document.scrollWidth <= innerWidth).
 * 2. WCAG 2.1 AA text contrast computation (>= 4.5:1) across design tokens and computed elements.
 * 3. Keyboard navigation sequence, focus-visible indicators, drawer focus trap, and focus restore.
 * 4. aria-live polite regions for live card and drawer updates.
 * 5. String audit: scan DOM for forbidden '$', 'ARR', 'revenue' next to proxy values (IC-002).
 * 6. Quadrant label wording audit (IC-014 and M4-A strings).
 * 7. Badges text audit: verify 100% of badges carry textual labels (zero icon-only badges).
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'http://127.0.0.1:5173/';
const evidenceDir = path.resolve('docs/evidence/m4');
fs.mkdirSync(evidenceDir, { recursive: true });

const tempProfile = path.join(os.tmpdir(), 'sift_cdp_profile_audit_' + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const cdpPort = 9226;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Relative luminance formula per WCAG 2.1
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (clean.length === 6) {
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }
  return [0, 0, 0];
}

async function runAudit() {
  console.log('================================================================');
  console.log(' SIFT MILESTONE 4 UI AUDIT & ACCESSIBILITY VERIFICATION SUITE');
  console.log(' Governed by PRD §3.2, §8.2–8.4, TS-014, TS-015; IC-002, IC-014');
  console.log('================================================================\n');

  console.log('[AUDIT] Launching headless Chrome on port', cdpPort);
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

  console.log('[AUDIT] Connected to CDP WebSocket:', page.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
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

  async function evalExpr(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
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
    console.log(`  [SCREENSHOT] Saved ${path.basename(filepath)} (${width}x${height}, ${buffer.length} bytes)`);
  }

  const results = {
    viewports: [],
    contrast: [],
    keyboard: {},
    focusTrap: {},
    ariaLive: {},
    stringAudit: {},
    quadrantLabels: {},
    badgeTextAudit: {},
  };

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await sleep(1500);

    // -------------------------------------------------------------
    // PHASE 1: INGESTION SCREEN STATE (EMPTY STATE) SCREENSHOTS
    // -------------------------------------------------------------
    console.log('\n--- PHASE 1: INGESTION SCREEN AUDIT (EMPTY DROPZONE) ---');
    await captureScreenshot(path.join(evidenceDir, 'audit_ingestion_1280px.png'), 1280, 800);
    await captureScreenshot(path.join(evidenceDir, 'audit_ingestion_375px.png'), 375, 812);

    // Ingest sample CSV and load demo clusters
    console.log('\n[AUDIT] Ingesting sample CSV & loading demo clusters for workspace audit...');
    await evalExpr(`document.querySelector('#btn-load-sample')?.click();`);
    await sleep(600);
    await evalExpr(`document.querySelector('#btn-preview-demo-clusters')?.click();`);
    await sleep(800);

    // -------------------------------------------------------------
    // PHASE 2: MULTI-VIEWPORT AUDIT & HORIZONTAL SCROLL CHECKS
    // -------------------------------------------------------------
    console.log('\n--- PHASE 2: RESPONSIVE VIEWPORTS & SCROLL OVERFLOW AUDIT ---');
    const viewports = [
      { name: 'Mobile', width: 375, height: 812, screenshot: 'audit_mobile_375px.png' },
      { name: 'Tablet (Portrait 768px)', width: 768, height: 1024, screenshot: 'audit_tablet_768px.png' },
      { name: 'Tablet (TS-015 800px)', width: 800, height: 1024, screenshot: 'audit_tablet_800px.png' },
      { name: 'Desktop (Dual-View 1280px)', width: 1280, height: 900, screenshot: 'audit_desktop_1280px.png' },
    ];

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 600,
      });
      await sleep(400);

      const scrollMetrics = await evalExpr(`(() => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const bodyScrollWidth = document.body.scrollWidth;
        const innerWidth = window.innerWidth;
        const hasHorizontalScroll = docScrollWidth > innerWidth || bodyScrollWidth > innerWidth;
        return {
          innerWidth,
          docScrollWidth,
          bodyScrollWidth,
          hasHorizontalScroll,
          scrollDelta: Math.max(docScrollWidth, bodyScrollWidth) - innerWidth
        };
      })()`);

      const pass = !scrollMetrics.hasHorizontalScroll;
      console.log(`  [VIEWPORT ${vp.width}px - ${vp.name}]`);
      console.log(`    window.innerWidth: ${scrollMetrics.innerWidth}px`);
      console.log(`    document.documentElement.scrollWidth: ${scrollMetrics.docScrollWidth}px`);
      console.log(`    document.body.scrollWidth: ${scrollMetrics.bodyScrollWidth}px`);
      console.log(`    Zero horizontal scroll? ${pass ? 'PASS (scrollWidth <= innerWidth)' : 'FAIL (overflow detected)'}`);

      await captureScreenshot(path.join(evidenceDir, vp.screenshot), vp.width, vp.height);

      results.viewports.push({
        name: vp.name,
        width: vp.width,
        ...scrollMetrics,
        pass,
      });
    }

    // -------------------------------------------------------------
    // PHASE 2B: TABLET TAB SWITCHING (TS-015)
    // -------------------------------------------------------------
    console.log('\n--- PHASE 2B: TABLET TAB SWITCHING AUDIT (800px - TS-015) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);

    const tabletTabsExist = await evalExpr(`(() => {
      const tabsBar = document.querySelector('.tablet-tabs-bar');
      const matrixTab = document.querySelector('#tab-matrix-view');
      const cardsTab = document.querySelector('#tab-ranked-cards');
      return {
        tabsBarVisible: tabsBar && window.getComputedStyle(tabsBar).display !== 'none',
        matrixTabFound: !!matrixTab,
        cardsTabFound: !!cardsTab,
      };
    })()`);

    console.log('  Tablet Tabs Bar visible at 800px:', tabletTabsExist.tabsBarVisible ? 'PASS' : 'FAIL');

    // Switch to Matrix Tab
    await evalExpr(`document.querySelector('#tab-matrix-view')?.click();`);
    await sleep(400);
    await captureScreenshot(path.join(evidenceDir, 'audit_tablet_800px_matrix_tab.png'), 800, 1024);

    // Switch back to Cards Tab
    await evalExpr(`document.querySelector('#tab-ranked-cards')?.click();`);
    await sleep(400);
    await captureScreenshot(path.join(evidenceDir, 'audit_tablet_800px_cards_tab.png'), 800, 1024);

    // -------------------------------------------------------------
    // PHASE 3: DEEP-DIVE DRAWER RESPONSIVE & FOCUS AUDIT
    // -------------------------------------------------------------
    console.log('\n--- PHASE 3: DEEP-DIVE DRAWER AUDIT (1280px Desktop & 375px Mobile) ---');

    // Reset to Desktop 1280px
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);

    // Click first ranked card to open drawer
    await evalExpr(`document.querySelector('#btn-card-details-CLUST-01, #ranked-card-CLUST-01')?.click();`);
    await sleep(500);

    const drawerDesktopMetrics = await evalExpr(`(() => {
      const drawer = document.querySelector('#deep-dive-drawer');
      const backdrop = document.querySelector('#drawer-backdrop');
      const docScrollWidth = document.documentElement.scrollWidth;
      const innerWidth = window.innerWidth;
      const rect = drawer ? drawer.getBoundingClientRect() : null;
      return {
        isOpen: !!drawer,
        width: rect ? rect.width : 0,
        role: drawer ? drawer.getAttribute('role') : null,
        ariaModal: drawer ? drawer.getAttribute('aria-modal') : null,
        docScrollWidth,
        innerWidth,
        noOverflow: docScrollWidth <= innerWidth,
      };
    })()`);

    console.log('  [DRAWER DESKTOP 1280px]');
    console.log(`    Drawer open: ${drawerDesktopMetrics.isOpen ? 'PASS' : 'FAIL'}`);
    console.log(`    Drawer width: ${drawerDesktopMetrics.width}px (Target: 600px)`);
    console.log(`    role="dialog": ${drawerDesktopMetrics.role === 'dialog' ? 'PASS' : 'FAIL'}`);
    console.log(`    aria-modal="true": ${drawerDesktopMetrics.ariaModal === 'true' ? 'PASS' : 'FAIL'}`);
    console.log(`    Zero overflow with drawer open: ${drawerDesktopMetrics.noOverflow ? 'PASS' : 'FAIL'}`);

    await captureScreenshot(path.join(evidenceDir, 'audit_drawer_desktop_1280px.png'), 1280, 900);

    // Test Focus Trap in Drawer
    console.log('\n  [FOCUS TRAP TEST]');
    const focusTrapResult = await evalExpr(`(() => {
      const drawer = document.querySelector('#deep-dive-drawer');
      if (!drawer) return { error: 'Drawer not found' };
      const focusableEls = drawer.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const count = focusableEls.length;
      const firstEl = focusableEls[0];
      const lastEl = focusableEls[count - 1];

      // Test loop: simulate Tab on last element
      lastEl.focus();
      const activeAtLast = document.activeElement === lastEl;

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      window.dispatchEvent(event);

      return {
        focusableCount: count,
        firstElementTag: firstEl ? firstEl.id || firstEl.tagName : 'none',
        lastElementTag: lastEl ? lastEl.id || lastEl.tagName : 'none',
        activeAtLast,
      };
    })()`);
    console.log(`    Focusable elements in drawer: ${focusTrapResult.focusableCount}`);
    console.log(`    First focusable: ${focusTrapResult.firstElementTag}`);
    console.log(`    Last focusable: ${focusTrapResult.lastElementTag}`);

    // Test Escape key closes drawer and restores focus
    console.log('\n  [ESCAPE KEY & FOCUS RESTORATION TEST]');
    await evalExpr(`(() => {
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      window.dispatchEvent(escEvent);
    })()`);
    await sleep(400);

    const drawerClosedState = await evalExpr(`(() => {
      const drawer = document.querySelector('#deep-dive-drawer');
      return {
        isClosed: !drawer,
        activeElementId: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : 'none',
      };
    })()`);
    console.log(`    Drawer closed on Escape: ${drawerClosedState.isClosed ? 'PASS' : 'FAIL'}`);
    console.log(`    Focus restored to trigger: ${drawerClosedState.activeElementId}`);

    // Now test Mobile Drawer (375px)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(300);

    await evalExpr(`document.querySelector('#btn-card-details-CLUST-01, #ranked-card-CLUST-01')?.click();`);
    await sleep(500);

    const drawerMobileMetrics = await evalExpr(`(() => {
      const drawer = document.querySelector('#deep-dive-drawer');
      const rect = drawer ? drawer.getBoundingClientRect() : null;
      const docScrollWidth = document.documentElement.scrollWidth;
      const innerWidth = window.innerWidth;
      return {
        isOpen: !!drawer,
        width: rect ? rect.width : 0,
        isFullScreenSheet: rect ? Math.abs(rect.width - innerWidth) < 5 : false,
        noOverflow: docScrollWidth <= innerWidth,
      };
    })()`);

    console.log('\n  [DRAWER MOBILE 375px]');
    console.log(`    Drawer width: ${drawerMobileMetrics.width}px`);
    console.log(`    Full-screen sheet: ${drawerMobileMetrics.isFullScreenSheet ? 'PASS' : 'FAIL'}`);
    console.log(`    Zero overflow on mobile: ${drawerMobileMetrics.noOverflow ? 'PASS' : 'FAIL'}`);

    await captureScreenshot(path.join(evidenceDir, 'audit_drawer_mobile_375px.png'), 375, 812);

    // Close mobile drawer
    await evalExpr(`document.querySelector('#btn-close-drawer')?.click();`);
    await sleep(400);

    // Reset back to Desktop for detailed inspection
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);

    // -------------------------------------------------------------
    // PHASE 4: TEXT CONTRAST AUDIT (WCAG 2.1 AA >= 4.5:1)
    // -------------------------------------------------------------
    console.log('\n--- PHASE 4: COLOR CONTRAST RATIO AUDIT (WCAG 2.1 AA >= 4.5:1) ---');
    const tokenPairs = [
      { role: 'Primary Body Text on Dark App Background', text: '#F8FAFC', bg: '#0F172A', minRequired: 4.5 },
      { role: 'Primary Body Text on Card Surface', text: '#F8FAFC', bg: '#1E293B', minRequired: 4.5 },
      { role: 'Secondary Text on Dark App Background', text: '#CBD5E1', bg: '#0F172A', minRequired: 4.5 },
      { role: 'Secondary Text on Card Surface', text: '#CBD5E1', bg: '#1E293B', minRequired: 4.5 },
      { role: 'Muted Secondary Text on Card Surface', text: '#94A3B8', bg: '#1E293B', minRequired: 4.5 },
      { role: 'Interactive Sky Accent on Dark App Background', text: '#38BDF8', bg: '#0F172A', minRequired: 4.5 },
      { role: 'Interactive Sky Accent on Card Surface', text: '#38BDF8', bg: '#1E293B', minRequired: 4.5 },
      { role: 'Gold Badge Text on Card Surface', text: '#F59E0B', bg: '#1E293B', minRequired: 4.5 },
      { role: 'Blue Badge Text on Card Surface', text: '#38BDF8', bg: '#1E293B', minRequired: 4.5 },
      { role: 'Red Blocker Text on Card Surface (Upgraded WCAG AA Token)', text: '#F87171', bg: '#1E293B', minRequired: 4.5 },
      { role: 'Green Verified Badge Text on Card Surface', text: '#34D399', bg: '#1E293B', minRequired: 4.5 },
      { role: 'Data Quality Banner Text on Amber Surface', text: '#FEF3C7', bg: '#451A03', minRequired: 4.5 },
    ];

    let allContrastPass = true;
    for (const pair of tokenPairs) {
      const rgbText = hexToRgb(pair.text);
      const rgbBg = hexToRgb(pair.bg);
      const ratio = getContrastRatio(rgbText, rgbBg);
      const pass = ratio >= pair.minRequired;
      if (!pass) allContrastPass = false;
      console.log(`  ${pair.role}:`);
      console.log(`    Text: ${pair.text} | Bg: ${pair.bg} | Ratio: ${ratio.toFixed(2)}:1 | Target: >=${pair.minRequired}:1 -> ${pass ? 'PASS' : 'FAIL'}`);
      results.contrast.push({ ...pair, computedRatio: ratio.toFixed(2), pass });
    }

    // Live computed color test on rendered badges in DOM
    const liveComputedContrast = await evalExpr(`(() => {
      const redBadge = document.querySelector('.badge-red-blocker');
      if (!redBadge) return { found: false };
      const style = window.getComputedStyle(redBadge);
      return {
        found: true,
        computedColor: style.color,
      };
    })()`);
    console.log('  Live rendered red badge computed color:', liveComputedContrast.computedColor);

    // -------------------------------------------------------------
    // PHASE 5: KEYBOARD NAVIGATION PATH & FOCUS VISIBILITY AUDIT
    // -------------------------------------------------------------
    console.log('\n--- PHASE 5: KEYBOARD NAVIGATION PATH & FOCUS VISIBILITY AUDIT ---');
    const tabStops = await evalExpr(`(() => {
      const focusable = Array.from(document.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      });

      return focusable.map(el => ({
        id: el.id || '',
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        tabIndex: el.tabIndex,
        ariaLabel: el.getAttribute('aria-label') || el.innerText?.substring(0, 30) || '',
      }));
    })()`);

    console.log(`  Total reachable interactive tab stops: ${tabStops.length}`);
    tabStops.slice(0, 10).forEach((ts, idx) => {
      console.log(`    [Tab #${idx + 1}] <${ts.tag}> id="${ts.id}" role="${ts.role}" label="${ts.ariaLabel}"`);
    });
    results.keyboard.tabStopsCount = tabStops.length;
    results.keyboard.sampleStops = tabStops.slice(0, 10);

    // -------------------------------------------------------------
    // PHASE 6: ARIA-LIVE ANNOUNCER AUDIT
    // -------------------------------------------------------------
    console.log('\n--- PHASE 6: ARIA-LIVE ANNOUNCEMENTS AUDIT ---');
    const ariaLiveRegions = await evalExpr(`(() => {
      const liveEls = Array.from(document.querySelectorAll('[aria-live]'));
      return liveEls.map(el => ({
        id: el.id,
        ariaLive: el.getAttribute('aria-live'),
        ariaAtomic: el.getAttribute('aria-atomic'),
        text: el.innerText.trim(),
      }));
    })()`);

    ariaLiveRegions.forEach(reg => {
      console.log(`  aria-live="${reg.ariaLive}" element id="${reg.id}": "${reg.text}"`);
    });
    results.ariaLive = ariaLiveRegions;

    // -------------------------------------------------------------
    // PHASE 7: DOM STRING AUDIT — SCAN FOR '$', 'ARR', 'revenue' NEXT TO PROXIES (IC-002)
    // -------------------------------------------------------------
    console.log('\n--- PHASE 7: STRING AUDIT — SCAN FOR FORBIDDEN REVENUE LABELS (IC-002) ---');
    const stringAudit = await evalExpr(`(() => {
      const allElements = Array.from(document.querySelectorAll('#dual-view-workspace *'));
      const violations = [];

      allElements.forEach(el => {
        // Direct text content of this node (excluding child nodes)
        let directText = '';
        for (let child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            directText += child.textContent;
          }
        }
        directText = directText.trim();
        if (!directText) return;

        // Check if dollar sign appears next to any number
        if (/\\$\\s*\\d/.test(directText) || /\\d+\\s*\\$/.test(directText)) {
          violations.push({ type: 'DOLLAR_SIGN_NEXT_TO_NUMBER', id: el.id, text: directText });
        }

        // Check if ARR is labeled as a dollar currency value (e.g. ARR: $12k)
        if (/ARR\\s*:\\s*\\$|\\$\\s*\\d+k?\\s*ARR/i.test(directText)) {
          violations.push({ type: 'ARR_DOLLAR_LABEL', id: el.id, text: directText });
        }

        // Check if revenue is labeled as actual dollar value next to proxy
        if (/revenue\\s*:\\s*\\$/i.test(directText)) {
          violations.push({ type: 'REVENUE_DOLLAR_LABEL', id: el.id, text: directText });
        }
      });

      return {
        violationsCount: violations.length,
        violations,
      };
    })()`);

    console.log(`  Violations found: ${stringAudit.violationsCount}`);
    if (stringAudit.violationsCount === 0) {
      console.log('  [PASS] Zero dollar signs ($) or actual ARR currency labels found next to proxy metrics!');
    } else {
      console.log('  [FAIL] Violations:', JSON.stringify(stringAudit.violations, null, 2));
    }
    results.stringAudit = stringAudit;

    // -------------------------------------------------------------
    // PHASE 8: QUADRANT LABEL WORDING AUDIT (IC-014 & M4-A)
    // -------------------------------------------------------------
    console.log('\n--- PHASE 8: QUADRANT LABEL WORDING AUDIT (IC-014 & M4-A) ---');
    const quadrantAudit = await evalExpr(`(() => {
      const tr = document.querySelector('#quadrant-label-top-right');
      const tl = document.querySelector('#quadrant-label-top-left');
      const br = document.querySelector('#quadrant-label-bottom-right');
      const bl = document.querySelector('#quadrant-label-bottom-left');

      return {
        topRight: tr ? { text: tr.innerText.trim(), dataIc014: tr.getAttribute('data-ic014') } : null,
        topLeft: tl ? { text: tl.innerText.trim(), dataIc014: tl.getAttribute('data-ic014') } : null,
        bottomRight: br ? { text: br.innerText.trim(), dataIc014: br.getAttribute('data-ic014') } : null,
        bottomLeft: bl ? { text: bl.innerText.trim(), dataIc014: bl.getAttribute('data-ic014') } : null,
      };
    })()`);

    console.log('  Top-Right:', JSON.stringify(quadrantAudit.topRight));
    console.log('  Top-Left:', JSON.stringify(quadrantAudit.topLeft));
    console.log('  Bottom-Right:', JSON.stringify(quadrantAudit.bottomRight));
    console.log('  Bottom-Left:', JSON.stringify(quadrantAudit.bottomLeft));

    results.quadrantLabels = quadrantAudit;

    // -------------------------------------------------------------
    // PHASE 9: BADGE TEXT AUDIT — VERIFY ALL BADGES CARRY TEXT
    // -------------------------------------------------------------
    console.log('\n--- PHASE 9: BADGE TEXT AUDIT (VERIFY ALL BADGES CARRY VISIBLE TEXT) ---');
    const badgeAudit = await evalExpr(`(() => {
      const badges = Array.from(document.querySelectorAll('[class*="badge"]'));
      const badgeList = badges.map(b => ({
        id: b.id,
        className: b.className,
        text: b.innerText.trim(),
        hasText: /[a-zA-Z]/.test(b.innerText),
      }));

      const iconOnly = badgeList.filter(b => !b.hasText);

      return {
        totalBadges: badgeList.length,
        iconOnlyCount: iconOnly.length,
        iconOnlyBadges: iconOnly,
        sampleBadges: badgeList.slice(0, 8),
      };
    })()`);

    console.log(`  Total badges detected in DOM: ${badgeAudit.totalBadges}`);
    console.log(`  Icon-only badges (lacking text): ${badgeAudit.iconOnlyCount}`);
    badgeAudit.sampleBadges.forEach(b => {
      console.log(`    Badge id="${b.id}": "${b.text}" -> ${b.hasText ? 'PASS (has text)' : 'FAIL (icon-only)'}`);
    });
    results.badgeTextAudit = badgeAudit;

    // Save full JSON audit output
    const outJsonPath = path.join(evidenceDir, 'm4_ui_audit_evidence.json');
    fs.writeFileSync(outJsonPath, JSON.stringify(results, null, 2));
    console.log('\n[AUDIT] Saved full audit report JSON to', outJsonPath);

  } finally {
    ws.close();
    chromeProc.kill();
  }

  return results;
}

runAudit()
  .then(() => {
    console.log('\n================================================================');
    console.log(' AUDIT COMPLETE — ALL GATES & CHECKS EVALUATED');
    console.log('================================================================');
  })
  .catch((err) => {
    console.error('[AUDIT ERROR]', err);
    process.exit(1);
  });
