/**
 * functions/api/reconcile.ts — Cloudflare Pages Function Shim
 * Routes incoming /api/reconcile requests to the core server handler.
 */
import { handleReconcileRequest } from '../../src/server/reconcile';

export async function onRequest(context: { request: Request; env: Record<string, any> }): Promise<Response> {
  return handleReconcileRequest(context.request, context.env);
}
