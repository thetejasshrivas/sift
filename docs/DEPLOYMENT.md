# DEPLOYMENT GUIDE — SIFT

**Target Platform:** Cloudflare Pages (Frontend SPA + Pages Functions Serverless Proxy)  
**Governing Directives:** PRD REQ-013, §9.3; IC-005, IC-010, IC-011; DEC-STACK (APPROVED), DEC-PROVIDER, DEC-DEP01.  
**Budget / Cost Policy:** ₹0 / $0.00 (Zero paid services, zero credit card required).

---

## 1. Build & Project Configuration

When connecting the GitHub repository (`thetejasshrivas/sift`) to Cloudflare Pages, configure the following build settings:

| Setting | Value |
|:---|:---|
| **Framework preset** | `Vite` (or `None`) |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` (workspace root) |
| **Node.js Version** | `20` or higher (e.g. `NODE_VERSION=20.18.0` in Environment Variables) |

Cloudflare Pages automatically discovers the `functions/` directory and provisions edge API routes at `/api/cluster`, `/api/reconcile`, and `/api/health`.

---

## 2. Production Environment Variables (Host Dashboard)

Configure the following environment variables in the Cloudflare Pages dashboard under **Settings** $\to$ **Environment variables**.

> **SECURITY NOTICE (AGENTS.md / IC-011):**  
> Never commit real secrets or credentials into git. Values must only be entered directly in the Cloudflare dashboard.

| Variable Name | Type / Security Level | Description | Recommended Production Value |
|:---|:---|:---|:---|
| `AI_API_KEY` | **Secret (Encrypted)** | Private API key for Google AI Studio inference. | *(Founder's Google AI Studio Key from console)* |
| `AI_MODEL` | Plain text | Qualified Gemini model identifier for inference. | `gemini-3.5-flash-lite` (or `gemini-3.5-flash`) |
| `ALLOWED_ORIGIN` | Plain text | Allowed browser Origin header for CORS hygiene. | `https://sift.pages.dev` (or custom production domain) |
| `RATE_LIMIT_RPM` | Plain text | Rate limit per minute per client IP address. | `10` |
| `MAX_PAYLOAD_BYTES` | Plain text | Hard ceiling for POST request payload size (HTTP 413). | `2097152` (2 MB) |

---

## 3. Step-by-Step Deployment Instructions

### Step 3.1: Connect GitHub Repository to Cloudflare Pages
1. Log into the Cloudflare dashboard at [https://dash.cloudflare.com/](https://dash.cloudflare.com/).
2. In the left navigation, select **Workers & Pages**.
3. Click **Create application** $\to$ select the **Pages** tab $\to$ click **Connect to Git**.
4. Authorize Cloudflare to access your GitHub account (`thetejasshrivas`).
5. Select the repository: `thetejasshrivas/sift`.
6. Click **Begin setup**.

### Step 3.2: Configure Build Settings
1. Set **Project name** to `sift` (or preferred name).
2. Set **Production branch** to `main`.
3. Under **Build settings**:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Click **Save and Deploy**. (The initial build will succeed for static assets, but edge AI functions will require the environment variables added in Step 3.3).

### Step 3.3: Set Environment Variables in Cloudflare Pages
1. In your Cloudflare Pages project, navigate to **Settings** $\to$ **Environment variables**.
2. Click **Add variable** (or **Edit variables**) for the **Production** environment:
   - Add `AI_API_KEY`: Click the **Encrypt** lock icon so the key is encrypted at rest and masked in logs.
   - Add `AI_MODEL`: Set to `gemini-3.5-flash-lite`.
   - Add `ALLOWED_ORIGIN`: Set to your assigned Pages URL (e.g., `https://sift.pages.dev`).
   - Add `RATE_LIMIT_RPM`: Set to `10`.
   - Add `MAX_PAYLOAD_BYTES`: Set to `2097152`.
3. Click **Save**.
4. Go to the **Deployments** tab and click **Retry deployment** on the latest commit to ensure the new environment variables take effect.

---

## 4. Live Production Smoke Test Results (Gate G-D4 / Task DEP-04)

**Audited Date:** 2026-10-10  
**Live Production URL:** `https://sift-0r0.pages.dev`  
**Host Platform:** Cloudflare Pages (Static SPA) + Cloudflare Pages Functions (Edge Serverless Proxy)  
**Active AI Model:** `gemini-3.5-flash-lite` (via `AI_MODEL` environment variable)  
**Gate G-D4 Status:** **PASSED**

### Executed Verification Protocol & Results

| Check / Test | Command / Request | Expected | Observed | Latency / Status | Result |
|:---|:---|:---|:---|:---|:---|
| **1. HTTPS Root Load** | `GET https://sift-0r0.pages.dev` | HTTP 200, valid HTML with title | HTTP 200, `<title>SIFT — AI Product Feedback Discovery Workspace</title>`, `text/html; charset=utf-8` | ~1.1s | **PASS** |
| **2. Edge Health Probe** | `GET https://sift-0r0.pages.dev/api/health` | HTTP 200, `status: "ok"` | HTTP 200, `{"status":"ok","service":"sift-proxy","timestamp":"2026-10-10T17:28:13.618Z"}` | 215ms | **PASS** |
| **3. Live Proxy Clustering** | `POST https://sift-0r0.pages.dev/api/cluster` (Synthetic checkout issue) | HTTP 200, valid PRD §5.3 clusters | HTTP 200, extracted `CLUST-01: Checkout Freeze Issues` (Severity 3, verbatim quote `"App freezes on checkout"`) | 5,820ms | **PASS** |
| **4. Live Proxy Reconciliation** | `POST https://sift-0r0.pages.dev/api/reconcile` (Synthetic latency pair) | HTTP 200, valid decision array | HTTP 200, returned `action: "UNCERTAIN"` with explicit human review rationale | 5,910ms | **PASS** |
| **5. Method Validation** | `GET https://sift-0r0.pages.dev/api/cluster` | HTTP 405 Method Not Allowed | HTTP 405, `{"error":"Method Not Allowed. Only POST requests are supported.","code":"METHOD_NOT_ALLOWED"}` | 220ms | **PASS** |
| **6. Payload Size Ceiling** | `POST https://sift-0r0.pages.dev/api/cluster` with 2.1 MB payload | HTTP 413 Payload Too Large | HTTP 413, `{"error":"Payload Too Large. Maximum allowed request size is 2 MB.","code":"PAYLOAD_TOO_LARGE"}` | 310ms | **PASS** |
| **7. Secrets Isolation & Header Audit** | Inspect response headers across 200, 400, 405, 413 | Zero echo of `AI_API_KEY`, auth headers | Zero credentials in headers: only `access-control-allow-origin`, `cache-control: no-store`, `server: cloudflare`, `cf-ray` | — | **PASS** |
| **8. Deployed Bundle Secret Scan (TS-036)** | Download `https://sift-0r0.pages.dev/assets/index-XjXsrDhu.js` (318,927 bytes); scan | Zero API keys or tokens in bundle | `NO MATCH: No secrets detected in target: scratch/deployed_bundle/index-XjXsrDhu.js` | 45ms | **PASS** |

---

## 5. Post-Redesign Production Deployment Verification (Commit `d828448`)

**Audited Date:** 2026-10-17  
**Live Production URL:** `https://sift-0r0.pages.dev`  
**Deploy Commit:** `d828448` (`feat(redesign): deploy approved Editorial Analytics design and Cartesian Sieve brand identity`)  
**Host Platform:** Cloudflare Pages + Cloudflare Pages Functions  
**Active Assets:** `/assets/index-Dv1ikEYQ.js` (327.87 kB) and `/assets/index-Bu_I2VKt.css` (3.29 kB)  
**Status:** **PASSED / FULLY OPERATIONAL**

### Executed Verification Protocol & Results

| Check / Test | Command / Request | Expected | Observed | Latency / Status | Result |
|:---|:---|:---|:---|:---|:---|
| **1. HTTPS Root Load** | `GET https://sift-0r0.pages.dev/` | HTTP 200, Fraunces serif fonts, new asset bundle | HTTP 200, `index-Dv1ikEYQ.js`, `index-Bu_I2VKt.css` | 142ms | **PASS** |
| **2. Edge Health Probe** | `GET https://sift-0r0.pages.dev/api/health` | HTTP 200, `status: "ok"` | HTTP 200, `{"status":"ok","service":"sift-proxy","timestamp":"2026-10-17T10:18:58.959Z"}` | 205ms | **PASS** |
| **3. Live Proxy Clustering (Gemini AI)** | `POST https://sift-0r0.pages.dev/api/cluster` (Synthetic checkout issue) | HTTP 200, valid PRD §5.3 schema clusters | HTTP 200, extracted `CLUST-01: Checkout Freezes and Infinite Loading` (Severity 3, verbatim quotes) | 1,774ms | **PASS** |
| **4. Live Proxy Reconciliation (Pass 2)** | `POST https://sift-0r0.pages.dev/api/reconcile` (Synthetic checkout cluster pair) | HTTP 200, valid decision array | HTTP 200, returned `action: "UNCERTAIN"` with explicit human review rationale | 1,595ms | **PASS** |
| **5. Deployed Bundle Secret Scan (TS-036)** | Download live `index-Dv1ikEYQ.js` and run regex secret scan | Zero API keys or tokens in bundle | `NO MATCH: No secrets detected in target: dist/deployed_bundle.js` | 42ms | **PASS** |
| **6. Visual Redesign Assets** | Confirm Cartesian Sieve logo, Collimating Aperture dropzone art, cartographic corner registers, and editorial typography | Bundled in production CSS/JS | Fully verified in compiled bundle | — | **PASS** |

