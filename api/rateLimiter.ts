/**
 * api/rateLimiter.ts — Rate Limiting Implementation
 * Governed by PRD §9.3, IC-010, and DEC-STACK.
 *
 * Evaluation:
 * 1. Checks for platform-native rate limiting (e.g. Cloudflare Workers env.RATE_LIMITER at ₹0).
 * 2. If platform-native binding is absent (local dev, test suite, non-CF runtime),
 *    falls back to best-effort instance-local sliding-window throttling (default: 10 RPM).
 *
 * Note on Instance-Local Limitation (Documented in DECISIONS.md & README):
 * In serverless environments, instance-local memory counters are per-isolate / per-container
 * and not globally synchronized across multiple concurrent edge execution instances.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface CloudflareRateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// In-memory sliding window store for instance-local fallback: IP -> timestamp[]
const localRequestTimestamps = new Map<string, number[]>();

const WINDOW_MS = 60 * 1000; // 60 seconds (1 minute window)
const DEFAULT_RATE_LIMIT_RPM = 10; // PRD §9.3 default: 10 RPM/IP

/**
 * Extracts the client IP from standard proxy and edge headers.
 */
export function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff && xff.trim()) {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  return '127.0.0.1';
}

/**
 * Evaluates whether an incoming request is allowed under rate limiting rules.
 */
export async function checkRateLimit(
  request: Request,
  env?: Record<string, any>
): Promise<RateLimitResult> {
  const clientIp = getClientIp(request);

  // 1. Check for platform-native rate limit binding (Cloudflare Workers native at ₹0)
  if (env?.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    try {
      const binding = env.RATE_LIMITER as CloudflareRateLimiterBinding;
      const result = await binding.limit({ key: clientIp });
      if (!result.success) {
        return { allowed: false, retryAfterSeconds: 60 };
      }
      return { allowed: true };
    } catch {
      // If platform binding throws unexpectedly, continue to instance-local fallback
    }
  }

  // 2. Best-effort instance-local sliding window rate limiting
  const envRpm = env?.RATE_LIMIT_RPM ?? process.env.RATE_LIMIT_RPM;
  const maxRpm = envRpm ? parseInt(String(envRpm), 10) : DEFAULT_RATE_LIMIT_RPM;
  const rpmLimit = Number.isFinite(maxRpm) && maxRpm > 0 ? maxRpm : DEFAULT_RATE_LIMIT_RPM;

  const now = Date.now();
  const existingTimestamps = localRequestTimestamps.get(clientIp) || [];

  // Filter out timestamps outside the active 60-second window
  const activeTimestamps = existingTimestamps.filter((ts) => now - ts < WINDOW_MS);

  if (activeTimestamps.length >= rpmLimit) {
    const oldestTimestamp = activeTimestamps[0];
    const retryAfterMs = oldestTimestamp + WINDOW_MS - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    localRequestTimestamps.set(clientIp, activeTimestamps);
    return {
      allowed: false,
      retryAfterSeconds,
    };
  }

  // Record current request timestamp
  activeTimestamps.push(now);
  localRequestTimestamps.set(clientIp, activeTimestamps);

  // Periodic garbage collection of dormant IP entries
  if (localRequestTimestamps.size > 1000) {
    for (const [ip, tsList] of localRequestTimestamps.entries()) {
      if (tsList.every((ts) => now - ts >= WINDOW_MS)) {
        localRequestTimestamps.delete(ip);
      }
    }
  }

  return { allowed: true };
}

/**
 * Resets the in-memory rate limiter store (used for test isolation).
 */
export function resetRateLimiter(): void {
  localRequestTimestamps.clear();
}
