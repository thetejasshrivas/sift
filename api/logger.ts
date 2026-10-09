/**
 * api/logger.ts — Zero-Payload Operational Logger
 * Governed by IC-011 and PRD §9.3.
 *
 * Rules:
 * 1. Application code must NEVER intentionally log request bodies, feedback text, or PII.
 * 2. Log ONLY non-sensitive operational metrics: status code, batch_index, item count, latency.
 * 3. Buffer entries are kept for auditability and verification in unit tests (TS-022).
 */

export interface ProxyAuditRecord {
  statusCode: number;
  batchIndex: number;
  itemCount: number;
  durationMs: number;
}

// In-memory capture buffer for test verification (TS-022)
export const auditLogBuffer: string[] = [];

/**
 * Emits a sanitized operational audit log containing strictly numeric metadata.
 * Prohibits logging of request bodies, text strings, headers, or PII.
 */
export function logProxyAudit(record: ProxyAuditRecord): void {
  const line = `[PROXY AUDIT] status=${record.statusCode} batch=${record.batchIndex} items=${record.itemCount} duration=${record.durationMs}ms`;
  auditLogBuffer.push(line);
  console.info(line);
}

/**
 * Clears the audit log buffer (for test isolation).
 */
export function clearAuditLogBuffer(): void {
  auditLogBuffer.length = 0;
}
