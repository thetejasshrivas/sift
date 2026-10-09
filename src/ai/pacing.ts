/**
 * ai/pacing.ts — Pacing, Backoff, and Sleep Utilities
 * Governed by PRD §5.8, §9.3; DEC-PROVIDER; IC-008.
 *
 * Rules:
 * 1. Default pacing is 6,000 ms (10 RPM proxy limit, stricter than provider 15 RPM).
 * 2. Exponential backoff delay on retryable errors: 2^n * 1000 ms + jitter.
 * 3. Honors Retry-After header when present.
 * 4. Cancellable sleep via AbortSignal.
 */

// Stricter of provider RPM (15) and proxy limit (10 RPM) = 10 RPM -> 6,000 ms minimum spacing
export const DEFAULT_PACING_MS = 6000;
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Calculates exponential backoff delay with jitter.
 * Formula: delay = 2^attempt * baseMs + jitter.
 * Honors Retry-After header when provided by upstream.
 */
export function calculateBackoffDelay(
  attempt: number,
  retryAfterHeader?: string | null,
  baseMs: number = 1000
): number {
  const jitter = Math.floor(Math.random() * (baseMs * 0.4)); // proportional randomized jitter

  if (retryAfterHeader) {
    const parsedSeconds = parseInt(retryAfterHeader, 10);
    if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
      return parsedSeconds * 1000 + jitter;
    }
  }

  // 2^attempt * baseMs: attempt 0 -> 1*baseMs, attempt 1 -> 2*baseMs, attempt 2 -> 4*baseMs
  return Math.pow(2, attempt) * baseMs + jitter;
}

/**
 * Asynchronously pauses execution for `ms` milliseconds, cancellable via AbortSignal.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Operation aborted by user.', 'AbortError'));
    }

    if (ms <= 0) {
      return resolve();
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Operation aborted by user.', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort);
  });
}
