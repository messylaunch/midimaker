/**
 * Duplicate-detection engine.
 *
 * Every generated pack gets a signature built from musically meaningful
 * features (NOT raw bytes): rhythm placement, interval sequence, contour,
 * per-bar density, chord progression, bass movement class and phrase plan.
 * Two packs whose weighted similarity exceeds the threshold are treated as
 * near-duplicates - merely transposing a pattern does NOT evade detection
 * because intervals/contour/rhythm are key-independent.
 */

import { BAR_TICKS, SIXTEENTH, TOTAL_BARS, type NoteEvent, type PackSignature, type PartName } from '../types.js';

export const DUPLICATE_THRESHOLD = 0.82;

export function computeSignature(
  parts: Record<PartName, NoteEvent[]>,
  progression: string[],
  phrasePlan: string,
  bassStyle: string
): PackSignature {
  const melody = parts.melody;
  const onsetSlots = new Set<number>();
  for (const n of melody) {
    const slot = Math.round(n.start / SIXTEENTH);
    if (slot >= 0 && slot < 128) onsetSlots.add(slot);
  }
  // 128-bit rhythm mask as hex
  let hex = '';
  for (let nib = 0; nib < 32; nib++) {
    let val = 0;
    for (let b = 0; b < 4; b++) {
      if (onsetSlots.has(nib * 4 + b)) val |= 1 << b;
    }
    hex += val.toString(16);
  }

  const sorted = [...melody].sort((a, b) => a.start - b.start);
  const intervals: number[] = [];
  let contour = '';
  for (let i = 1; i < sorted.length; i++) {
    const iv = sorted[i].pitch - sorted[i - 1].pitch;
    intervals.push(iv);
    contour += iv > 0 ? 'U' : iv < 0 ? 'D' : 'R';
  }

  const density: number[] = [];
  for (let bar = 0; bar < TOTAL_BARS; bar++) {
    density.push(melody.filter((n) => n.start >= bar * BAR_TICKS && n.start < (bar + 1) * BAR_TICKS).length);
  }

  return {
    rhythm: hex,
    intervals,
    contour,
    density,
    progression: progression.join('-'),
    bassStyle,
    phrasePlan,
  };
}

/** Weighted similarity in [0, 1]. */
export function similarity(a: PackSignature, b: PackSignature): number {
  const rhythmSim = jaccardHex(a.rhythm, b.rhythm);
  const intervalSim = 1 - normalizedEdit(a.intervals.map(iStr), b.intervals.map(iStr));
  const contourSim = 1 - normalizedEdit([...a.contour], [...b.contour]);
  const densitySim = densitySimilarity(a.density, b.density);
  const progSim = a.progression === b.progression ? 1 : sharedTokenRatio(a.progression, b.progression);
  const bassSim = a.bassStyle === b.bassStyle ? 1 : 0;
  const planSim = a.phrasePlan === b.phrasePlan ? 1 : 0;

  return (
    rhythmSim * 0.3 +
    intervalSim * 0.25 +
    contourSim * 0.15 +
    densitySim * 0.1 +
    progSim * 0.1 +
    bassSim * 0.05 +
    planSim * 0.05
  );
}

export function isNearDuplicate(a: PackSignature, b: PackSignature, threshold = DUPLICATE_THRESHOLD): boolean {
  return similarity(a, b) >= threshold;
}

/* ---------------- helpers ---------------- */

function iStr(n: number): string {
  return String(n);
}

function jaccardHex(a: string, b: string): number {
  let inter = 0;
  let union = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = parseInt(a[i] ?? '0', 16);
    const vb = parseInt(b[i] ?? '0', 16);
    inter += popcount4(va & vb);
    union += popcount4(va | vb);
  }
  return union === 0 ? 1 : inter / union;
}

function popcount4(v: number): number {
  return (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1) + ((v >> 3) & 1);
}

/** Levenshtein distance normalized by the longer length; inputs capped at 64. */
function normalizedEdit(aArr: string[], bArr: string[]): number {
  const a = aArr.slice(0, 64);
  const b = bArr.slice(0, 64);
  if (a.length === 0 && b.length === 0) return 0;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n] / Math.max(m, n);
}

function densitySimilarity(a: number[], b: number[]): number {
  let diff = 0;
  let total = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    diff += Math.abs(va - vb);
    total += Math.max(va, vb);
  }
  return total === 0 ? 1 : 1 - diff / total;
}

function sharedTokenRatio(a: string, b: string): number {
  const ta = a.split('-');
  const tb = b.split('-');
  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t)).length;
  return shared / Math.max(ta.length, tb.length);
}
