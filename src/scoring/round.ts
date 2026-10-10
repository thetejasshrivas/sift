/**
 * scoring/round.ts — Documented Half-Up Rounding Helper
 * Governed by PRD REQ-008, §6.1, §6.5; MDD §3.5; TS-003.
 *
 * Rules:
 * - Round to exactly 1 decimal place using standard mathematical round-half-up.
 * - Safely protects against IEEE-754 floating-point inaccuracies on .x5 boundaries
 *   (e.g., 72.05 -> 72.1, 72.04 -> 72.0) by applying Number.EPSILON.
 * - Protects against non-finite (NaN, Infinity) values by returning 0.0.
 */

/**
 * Rounds a number to exactly 1 decimal place using half-up rounding.
 *
 * @param value Number to round
 * @returns Number rounded to 1 decimal place
 *
 * @example
 * round1(72.05) // 72.1
 * round1(72.04) // 72.0
 * round1(86.6667) // 86.7
 */
export function round1(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.0;
  }
  return Math.round((value + Number.EPSILON) * 10) / 10;
}
