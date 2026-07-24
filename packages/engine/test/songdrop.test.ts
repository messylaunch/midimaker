import { describe, expect, it } from 'vitest';
import { chordNameToRoman, romanizeChord } from '../src/theory/chords.js';
import { generatePack } from '../src/generate/pack.js';
import { packToMidiFiles } from '../src/index.js';
import { validatePackFiles } from '../src/validate.js';
import type { PackSettings } from '../src/types.js';

describe('chord romanization (song drop)', () => {
  it('maps diatonic chords in major', () => {
    expect(chordNameToRoman('C', 0, 'major')).toBe('I');
    expect(chordNameToRoman('Am', 0, 'major')).toBe('vi');
    expect(chordNameToRoman('F', 0, 'major')).toBe('IV');
    expect(chordNameToRoman('G', 0, 'major')).toBe('V');
    expect(chordNameToRoman('Dm', 0, 'major')).toBe('ii');
  });
  it('maps borrowed roots with accidentals', () => {
    expect(chordNameToRoman('Bb', 0, 'major')).toBe('bVII');
    expect(chordNameToRoman('Ab', 0, 'major')).toBe('bVI');
  });
  it('maps chords relative to a minor key', () => {
    // A natural minor: F major is the 6th degree
    expect(chordNameToRoman('F', 9, 'naturalMinor')).toBe('VI');
    expect(chordNameToRoman('Em', 9, 'naturalMinor')).toBe('v');
    expect(chordNameToRoman('G', 9, 'naturalMinor')).toBe('VII');
  });
  it('romanize is consistent with quality casing', () => {
    expect(romanizeChord(5, false, 0, 'major')).toBe('IV');
    expect(romanizeChord(5, true, 0, 'major')).toBe('iv');
  });
  it('rejects garbage names', () => {
    expect(chordNameToRoman('??', 0, 'major')).toBeNull();
  });
});

describe('progression override', () => {
  const base: PackSettings = {
    seed: 777,
    genre: 'rnb',
    mood: 'warm',
    bpm: 92,
    key: 'C',
    scale: 'major',
    energy: 5,
    complexity: 5,
    rhythmicDensity: 5,
    melodicMovement: 5,
    chordComplexity: 4,
    experimental: 2,
    syncopation: 5,
    noteLength: 5,
    humanize: 2,
    familiarity: 'balanced',
  };

  it('uses the forced chords bar by bar', () => {
    const pack = generatePack({
      ...base,
      progressionOverride: ['I', 'V', 'vi', 'IV', 'I', 'V', 'vi', 'IV'],
    });
    expect(pack.progression).toEqual(['I', 'V', 'vi', 'IV', 'I', 'V', 'vi', 'IV']);
    const files = packToMidiFiles(pack);
    const result = validatePackFiles(files, {
      bpm: base.bpm, key: base.key, scale: base.scale,
      experimental: base.experimental, progression: pack.progression.join('-'),
    });
    expect(result.errors).toHaveLength(0);
  });

  it('merges repeated bars and survives junk tokens', () => {
    const pack = generatePack({
      ...base,
      progressionOverride: ['I', 'I', '???', 'IV'],
    });
    // '???' dropped, repeats merged, still a valid 8-bar pack
    expect(pack.progression.length).toBeGreaterThan(0);
    expect(pack.parts.melody.length).toBeGreaterThan(0);
  });

  it('stays deterministic with an override', () => {
    const s = { ...base, progressionOverride: ['i', 'VI', 'III', 'VII'], scale: 'naturalMinor', key: 'A' };
    const a = packToMidiFiles(generatePack(s));
    const b = packToMidiFiles(generatePack(s));
    expect(Buffer.from(a.melody).equals(Buffer.from(b.melody))).toBe(true);
  });
});
