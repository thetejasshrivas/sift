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

## 4. Verification & Smoke Test Checklist (Post-Deployment)

Once deployed, verify the live deployment at `https://<project-name>.pages.dev`:

1. **Static SPA Load:** Open the deployment URL; verify dropzone, UI header, and slider controls render cleanly.
2. **Health Check:** Open `https://<project-name>.pages.dev/api/health`; verify `HTTP 200` with `{"status":"ok","timestamp":...}`.
3. **CORS & Origin Hygiene:** Dispatching a request from an unauthorized origin returns `HTTP 403 Forbidden` (`ORIGIN_FORBIDDEN`).
4. **CSV Ingestion & Clustering:** Upload `fixtures/synthetic_50.csv`; verify Pass-1 batch extraction and Pass-2 category reconciliation complete with green badges.
5. **Zero Payload Logging:** Inspect Cloudflare Functions real-time logs; confirm zero verbatim customer feedback rows or PII appear in logs (`IC-011` / `TS-022`).
