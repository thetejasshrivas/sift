/**
 * functions/api/cluster.ts — Cloudflare Pages Function Shim
 * Routes incoming /api/cluster requests to the core server handler.
 */
import { handleClusterRequest } from '../../src/server/cluster';

export async function onRequest(context: { request: Request; env: Record<string, any> }): Promise<Response> {
  return handleClusterRequest(context.request, context.env);
}
