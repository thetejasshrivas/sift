/**
 * scoring/weights.ts — Slider Weight Normalization & All-Zero Fallback
 * Governed by PRD REQ-008, §6.1–6.2, TS-008; MDD §3.5; IC-002.
 *
 * Rules:
 * 1. Default slider values: Impact/ARR 40%, Volume/Frequency 40%, Severity 20%.
 * 2. Slider values w_ARR, w_Vol, w_Sev in [0, 100].
 * 3. Weights are normalized so that W_ARR + W_Vol + W_Sev = 1.0 (100%).
 * 4. All-zero sliders (0 / 0 / 0) automatically fallback to baseline 40/40/20 weights (TS-008).
 * 5. Labels: strictly 'Impact Score / Tier-Weighted Impact', never ARR or $ (IC-002).
 */

import { SliderWeights, NormalizedWeights } from '../types/scoring';

export const DEFAULT_SLIDER_WEIGHTS: Readonly<SliderWeights> = {
  arr: 40,
  vol: 40,
  sev: 20,
};

export const DEFAULT_NORMALIZED_WEIGHTS: Readonly<NormalizedWeights> = {
  wArr: 0.40,
  wVol: 0.40,
  wSev: 0.20,
};

/**
 * Normalizes user interactive slider weights to sum to strictly 1.0 (100%).
 * If all sliders are 0 or sum is 0, defaults to baseline 40/40/20.
 */
export function normalizeSliderWeights(rawWeights?: Partial<SliderWeights>): NormalizedWeights {
  const arr = Math.max(0, rawWeights?.arr ?? DEFAULT_SLIDER_WEIGHTS.arr);
  const vol = Math.max(0, rawWeights?.vol ?? DEFAULT_SLIDER_WEIGHTS.vol);
  const sev = Math.max(0, rawWeights?.sev ?? DEFAULT_SLIDER_WEIGHTS.sev);

  const sum = arr + vol + sev;

  // PRD §6.2 / TS-008: If all sliders set to 0, default to approved baseline 40/40/20
  if (sum === 0 || !Number.isFinite(sum)) {
    return { ...DEFAULT_NORMALIZED_WEIGHTS };
  }

  return {
    wArr: arr / sum,
    wVol: vol / sum,
    wSev: sev / sum,
  };
}
