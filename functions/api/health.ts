/**
 * functions/api/health.ts — Cloudflare Pages Function Shim
 * Routes incoming /api/health requests to the core server handler.
 */
import { handleHealthCheck } from '../../src/server';

export async function onRequest(): Promise<Response> {
  return handleHealthCheck();
}
