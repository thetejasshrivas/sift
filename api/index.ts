/**
 * api/index.ts — Main Serverless Proxy Entry Point (Cloudflare Workers / Serverless)
 * Routes incoming requests to /api/health and /api/cluster.
 */

import { handleHealthCheck } from './health';
import { handleClusterRequest } from './cluster';
import { handleReconcileRequest } from './reconcile';

export { handleHealthCheck } from './health';
export { handleClusterRequest } from './cluster';
export { handleReconcileRequest } from './reconcile';
export * from './schemas';
export * from './rateLimiter';
export * from './logger';

export default {
  async fetch(request: Request, env?: Record<string, any>): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' || url.pathname === '/health') {
      return handleHealthCheck();
    }

    if (url.pathname === '/api/cluster') {
      return handleClusterRequest(request, env);
    }

    if (url.pathname === '/api/reconcile') {
      return handleReconcileRequest(request, env);
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint Not Found', code: 'NOT_FOUND' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  },
};
