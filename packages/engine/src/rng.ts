/**
 * Deterministic seeded PRNG (mulberry32).
 *
 * Integer-only math so the exact same sequence can be reproduced in a future
 * C++/JUCE port. Never use Math.random() anywhere in the engine.
 */

export type Rng = () => number;

/** Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a stable sub-seed from a base seed and a label (e.g. per part). */
export function deriveSeed(seed: number, label: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 2654435761);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Integer in [lo, hi] inclusive. */
export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** True with probability p. */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Pick a uniform random element. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Pick an index according to weights (weights need not sum to 1). */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** Pick an element according to parallel weights array. */
export function weightedPick<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  return items[weightedIndex(rng, weights)];
}

/** Gaussian-ish jitter in [-amount, amount] (sum of two uniforms, centered). */
export function jitter(rng: Rng, amount: number): number {
  return (rng() + rng() - 1) * amount;
}

/** Clamp helper. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
