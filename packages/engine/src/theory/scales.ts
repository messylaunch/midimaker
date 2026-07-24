/** Scale and mode definitions. */

export interface ScaleDef {
  id: string;
  name: string; // display name used in metadata, e.g. "Natural Minor"
  intervals: number[]; // semitone offsets from tonic
  minor: boolean; // "feels minor" (used for mood matching)
}

export const SCALES: Record<string, ScaleDef> = {
  major: { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11], minor: false },
  naturalMinor: { id: 'naturalMinor', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10], minor: true },
  harmonicMinor: { id: 'harmonicMinor', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], minor: true },
  melodicMinor: { id: 'melodicMinor', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11], minor: true },
  dorian: { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], minor: true },
  phrygian: { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], minor: true },
  lydian: { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], minor: false },
  mixolydian: { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], minor: false },
  majorPentatonic: { id: 'majorPentatonic', name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], minor: false },
  minorPentatonic: { id: 'minorPentatonic', name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], minor: true },
};

export function scaleById(id: string): ScaleDef {
  const s = SCALES[id];
  if (!s) throw new Error(`Unknown scale: ${id}`);
  return s;
}

export function scaleByName(name: string): ScaleDef {
  const found = Object.values(SCALES).find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (!found) throw new Error(`Unknown scale name: ${name}`);
  return found;
}

/** Pitch classes of a scale in a key. */
export function scalePcs(keyPc: number, scaleId: string): number[] {
  return scaleById(scaleId).intervals.map((i) => (keyPc + i) % 12);
}

/** Is the pitch class in the scale? */
export function inScale(pc: number, keyPc: number, scaleId: string): boolean {
  return scalePcs(keyPc, scaleId).includes(((pc % 12) + 12) % 12);
}

/**
 * Pitch class of a 1-based scale degree (wraps past the octave).
 * degree 1 = tonic, 2 = second, ... For pentatonic scales degrees wrap at 5.
 */
export function degreePc(keyPc: number, scaleId: string, degree: number): number {
  const ints = scaleById(scaleId).intervals;
  const idx = ((degree - 1) % ints.length + ints.length) % ints.length;
  return (keyPc + ints[idx]) % 12;
}

/**
 * Step along the scale from a midi pitch by `steps` scale degrees
 * (positive = up). If the pitch is not exactly on the scale, snaps to the
 * nearest scale tone first.
 */
export function stepInScale(pitch: number, steps: number, keyPc: number, scaleId: string): number {
  const ints = scaleById(scaleId).intervals;
  const n = ints.length;
  // Build absolute scale lattice around the pitch.
  const pcs = ints.map((i) => (keyPc + i) % 12);
  // Find nearest scale tone at or below pitch.
  let base = pitch;
  let guard = 0;
  while (!pcs.includes(((base % 12) + 12) % 12) && guard++ < 12) base--;
  // index of base within scale
  const basePc = ((base % 12) + 12) % 12;
  let idx = pcs.indexOf(basePc);
  let cur = base;
  const dir = steps >= 0 ? 1 : -1;
  for (let k = 0; k < Math.abs(steps); k++) {
    const nextIdx = ((idx + dir) % n + n) % n;
    let delta = ints[nextIdx] - ints[idx];
    if (dir > 0 && delta <= 0) delta += 12;
    if (dir < 0 && delta >= 0) delta -= 12;
    cur += delta;
    idx = nextIdx;
  }
  return cur;
}

/** Nearest scale tone to a midi pitch. */
export function snapToScale(pitch: number, keyPc: number, scaleId: string): number {
  for (let d = 0; d <= 6; d++) {
    if (inScale(pitch - d, keyPc, scaleId)) return pitch - d;
    if (inScale(pitch + d, keyPc, scaleId)) return pitch + d;
  }
  return pitch;
}
