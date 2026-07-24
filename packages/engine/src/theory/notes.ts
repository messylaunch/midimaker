/** Note-name <-> pitch-class utilities. */

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const KEY_TO_PC: Record<string, number> = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

export function keyToPc(key: string): number {
  const pc = KEY_TO_PC[key.trim()];
  if (pc === undefined) throw new Error(`Unknown key: ${key}`);
  return pc;
}

export function pcToKey(pc: number): string {
  return KEYS[((pc % 12) + 12) % 12];
}

/** MIDI note number from pitch class + octave (C4 = 60, octave 4). */
export function midiNote(pc: number, octave: number): number {
  return (octave + 1) * 12 + (((pc % 12) + 12) % 12);
}

export function pitchClassOf(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Move `pitch` to the octave placement closest to `target`. */
export function nearestOctave(pc: number, target: number): number {
  const base = pitchClassOf(pc);
  let best = base;
  let bestDist = Infinity;
  for (let oct = -1; oct <= 9; oct++) {
    const m = (oct + 1) * 12 + base;
    if (m < 0 || m > 127) continue;
    const d = Math.abs(m - target);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

/** Clamp a midi pitch into [lo, hi] by octave transposition. */
export function fitToRange(pitch: number, lo: number, hi: number): number {
  let p = pitch;
  while (p < lo) p += 12;
  while (p > hi) p -= 12;
  if (p < lo) p = lo; // range narrower than an octave; give up gracefully
  return p;
}
