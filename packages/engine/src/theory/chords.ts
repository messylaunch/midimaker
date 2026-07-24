/**
 * Chord construction, roman-numeral parsing and voice leading.
 *
 * Progressions in genre profiles are written as roman-numeral tokens:
 *   "I" "vi" "V7" "IVmaj7" "iidim" "bVII" "iv" "isus4" "Vsus4" "VIadd9" ...
 * Case carries the triad quality (upper = major, lower = minor) and an
 * optional leading b/# shifts the root chromatically relative to the scale
 * degree. Degrees are resolved against the *current scale*, so "VI" in
 * natural minor lands on the natural-minor 6th degree.
 */

import { degreePc, scaleById } from './scales.js';

export interface ParsedChord {
  rootPc: number;
  intervals: number[]; // semitones from root
  roman: string;
  degree: number; // 1-7
}

const QUALITIES: Record<string, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  minadd9: [0, 3, 7, 14],
  maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
  dom9: [0, 4, 7, 10, 14],
  six: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
};

const ROMAN_RE = /^(b|#)?(vii|vi|v|iv|iii|ii|i|VII|VI|V|IV|III|II|I)(.*)$/;

const DEGREE_OF: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7,
};

/** Parse a roman token in a key/scale context into root pc + intervals. */
export function parseRoman(token: string, keyPc: number, scaleId: string): ParsedChord {
  const m = ROMAN_RE.exec(token.trim());
  if (!m) throw new Error(`Bad roman numeral: ${token}`);
  const [, accidental, numeral, suffixRaw] = m;
  const degree = DEGREE_OF[numeral.toLowerCase()];
  const isUpper = numeral === numeral.toUpperCase();
  let rootPc = degreePc(keyPc, scaleId, degree);
  if (accidental === 'b') rootPc = (rootPc + 11) % 12;
  if (accidental === '#') rootPc = (rootPc + 1) % 12;

  const suffix = suffixRaw.trim();
  let intervals: number[];
  if (suffix === '' ) {
    intervals = isUpper ? QUALITIES.maj : QUALITIES.min;
  } else if (suffix === '7') {
    intervals = isUpper ? QUALITIES.dom7 : QUALITIES.min7;
  } else if (suffix === 'maj7') {
    intervals = QUALITIES.maj7;
  } else if (suffix === 'm7b5' || suffix === 'ø') {
    intervals = QUALITIES.m7b5;
  } else if (suffix === 'dim') {
    intervals = QUALITIES.dim;
  } else if (suffix === 'dim7') {
    intervals = QUALITIES.dim7;
  } else if (suffix === 'aug') {
    intervals = QUALITIES.aug;
  } else if (suffix === 'sus2') {
    intervals = QUALITIES.sus2;
  } else if (suffix === 'sus4') {
    intervals = QUALITIES.sus4;
  } else if (suffix === 'add9') {
    intervals = isUpper ? QUALITIES.add9 : QUALITIES.minadd9;
  } else if (suffix === '9') {
    intervals = isUpper ? QUALITIES.dom9 : QUALITIES.min9;
  } else if (suffix === 'maj9') {
    intervals = QUALITIES.maj9;
  } else if (suffix === '6') {
    intervals = isUpper ? QUALITIES.six : QUALITIES.min6;
  } else {
    throw new Error(`Unknown chord suffix "${suffix}" in ${token}`);
  }
  return { rootPc, intervals, roman: token, degree };
}

/**
 * Upgrade a triad according to chord complexity (adds 7ths/9ths/sus colors).
 * Returns a NEW token string so progression signatures stay readable.
 */
export function upgradeToken(
  token: string,
  chordComplexity: number,
  isDominantish: boolean,
  roll: () => number
): string {
  const hasSuffix = /(7|9|6|sus|dim|aug|add)/.test(token);
  if (hasSuffix) return token;
  const c = chordComplexity;
  const isUpper = /[A-Z]/.test(token.replace(/^[b#]/, '')[0]);
  // probability of adding a 7th grows with complexity
  const p7 = c <= 3 ? 0.08 : c <= 6 ? 0.35 : 0.6;
  const p9 = c <= 6 ? 0 : 0.25;
  const psus = c <= 3 ? 0.02 : 0.08;
  const r = roll();
  if (r < p9) return token + (isUpper && !isDominantish ? 'maj9' : '9');
  if (r < p9 + p7) {
    if (isDominantish) return token + '7';
    return token + (isUpper ? 'maj7' : '7');
  }
  if (r < p9 + p7 + psus && isUpper) return token + 'sus4';
  return token;
}

/**
 * Voice-lead a sequence of chords inside [lo, hi].
 * First chord voiced near the register center; subsequent chords move each
 * voice to the nearest available chord tone (minimal total movement).
 */
export function voiceLead(
  chords: { rootPc: number; intervals: number[] }[],
  lo: number,
  hi: number
): number[][] {
  const center = Math.round((lo + hi) / 2);
  const out: number[][] = [];
  let prev: number[] | null = null;

  for (const ch of chords) {
    const pcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
    // limit to 4 voices max for clean playback (root, 3rd-ish, 5th-ish, color)
    const usePcs = pcs.length > 4 ? [pcs[0], pcs[1], pcs[2], pcs[pcs.length - 1]] : pcs;
    if (!prev) {
      // stack compactly around center
      const voiced: number[] = [];
      let anchor = center - Math.floor(usePcs.length * 2);
      for (const pc of usePcs) {
        let p = anchor;
        while (((p % 12) + 12) % 12 !== pc) p++;
        while (voiced.includes(p)) p += 12;
        voiced.push(p);
        anchor = p - 3;
      }
      const norm = normalizeVoicing(voiced, lo, hi);
      out.push(norm);
      prev = norm;
    } else {
      // greedy nearest-tone assignment from previous voicing
      const remaining = [...usePcs];
      const voiced: number[] = [];
      for (const v of prev) {
        if (remaining.length === 0) break;
        let bestIdx = 0;
        let bestPitch = 0;
        let bestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const cand = nearestPitchWithPc(remaining[i], v);
          const d = Math.abs(cand - v);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
            bestPitch = cand;
          }
        }
        voiced.push(bestPitch);
        remaining.splice(bestIdx, 1);
      }
      // any chord tones left (chord bigger than prev voicing): place near center
      for (const pc of remaining) voiced.push(nearestPitchWithPc(pc, center));
      const norm = normalizeVoicing(voiced, lo, hi);
      out.push(norm);
      prev = norm;
    }
  }
  return out;
}

function nearestPitchWithPc(pc: number, target: number): number {
  const tpc = ((target % 12) + 12) % 12;
  let diff = (pc - tpc + 12) % 12;
  if (diff > 6) diff -= 12;
  return target + diff;
}

function normalizeVoicing(voiced: number[], lo: number, hi: number): number[] {
  const uniq = [...new Set(voiced)].sort((a, b) => a - b);
  const fixed = uniq.map((p) => {
    let v = p;
    while (v < lo) v += 12;
    while (v > hi) v -= 12;
    return v;
  });
  // remove duplicates created by octave folding, keep sorted
  return [...new Set(fixed)].sort((a, b) => a - b);
}
