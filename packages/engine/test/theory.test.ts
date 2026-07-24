import { describe, expect, it } from 'vitest';
import { keyToPc, midiNote } from '../src/theory/notes.js';
import { inScale, scalePcs, stepInScale } from '../src/theory/scales.js';
import { parseRoman, voiceLead } from '../src/theory/chords.js';
import { mulberry32, deriveSeed } from '../src/rng.js';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('derives distinct sub-seeds per label', () => {
    expect(deriveSeed(1, 'melody')).not.toBe(deriveSeed(1, 'bass'));
    expect(deriveSeed(1, 'melody')).toBe(deriveSeed(1, 'melody'));
  });
});

describe('scales', () => {
  it('builds C major and A natural minor', () => {
    expect(scalePcs(0, 'major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(scalePcs(9, 'naturalMinor')).toEqual([9, 11, 0, 2, 4, 5, 7]);
  });
  it('steps within the scale', () => {
    // C4 up one step in C major = D4
    expect(stepInScale(60, 1, 0, 'major')).toBe(62);
    expect(stepInScale(60, -1, 0, 'major')).toBe(59); // B3
    expect(stepInScale(60, 7, 0, 'major')).toBe(72); // octave
  });
  it('checks membership', () => {
    expect(inScale(6, 0, 'major')).toBe(false); // F# not in C major
    expect(inScale(6, 0, 'lydian')).toBe(true);
  });
});

describe('roman numeral parsing', () => {
  it('parses diatonic triads', () => {
    const I = parseRoman('I', 0, 'major');
    expect(I.rootPc).toBe(0);
    expect(I.intervals).toEqual([0, 4, 7]);
    const vi = parseRoman('vi', 0, 'major');
    expect(vi.rootPc).toBe(9);
    expect(vi.intervals).toEqual([0, 3, 7]);
  });
  it('parses sevenths and borrowed chords', () => {
    const V7 = parseRoman('V7', 0, 'major');
    expect(V7.rootPc).toBe(7);
    expect(V7.intervals).toEqual([0, 4, 7, 10]);
    const bVII = parseRoman('bVII', 0, 'major');
    expect(bVII.rootPc).toBe(10);
    const sharpivdim = parseRoman('#ivdim', 0, 'major');
    expect(sharpivdim.rootPc).toBe(6);
    expect(sharpivdim.intervals).toEqual([0, 3, 6]);
  });
  it('resolves numerals against the active scale (VI in minor)', () => {
    const VI = parseRoman('VI', 9, 'naturalMinor'); // A minor -> F major
    expect(VI.rootPc).toBe(5);
  });
});

describe('voice leading', () => {
  it('keeps voices in range and minimizes movement', () => {
    const chords = [
      parseRoman('i', 9, 'naturalMinor'),
      parseRoman('VI', 9, 'naturalMinor'),
      parseRoman('III', 9, 'naturalMinor'),
      parseRoman('VII', 9, 'naturalMinor'),
    ];
    const voicings = voiceLead(chords, 53, 74);
    expect(voicings).toHaveLength(4);
    for (const v of voicings) {
      expect(v.length).toBeGreaterThanOrEqual(3);
      for (const p of v) {
        expect(p).toBeGreaterThanOrEqual(53);
        expect(p).toBeLessThanOrEqual(74);
      }
    }
    // total movement between consecutive voicings should be modest
    for (let i = 1; i < voicings.length; i++) {
      const a = voicings[i - 1];
      const b = voicings[i];
      const move = b.reduce((sum, p, idx) => sum + Math.abs(p - (a[idx] ?? p)), 0);
      expect(move).toBeLessThanOrEqual(24);
    }
  });
});

describe('notes helpers', () => {
  it('maps names and octaves', () => {
    expect(keyToPc('C')).toBe(0);
    expect(keyToPc('F#')).toBe(6);
    expect(midiNote(0, 4)).toBe(60);
  });
});
