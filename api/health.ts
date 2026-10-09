/**
 * api/health.ts — Serverless Proxy Health Endpoint
 * Conforms to standard Web Request/Response contract for Cloudflare Workers.
 */
export interface HealthResponse {
  status: 'ok';
  service: 'sift-proxy';
  timestamp: string;
}

export function handleHealthCheck(): Response {
  const payload: HealthResponse = {
    status: 'ok',
    service: 'sift-proxy',
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' || url.pathname === '/health') {
      return handleHealthCheck();
    }
    return new Response('Not Found', { status: 404 });
  },
};
