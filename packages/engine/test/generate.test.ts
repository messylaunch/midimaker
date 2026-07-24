import { describe, expect, it } from 'vitest';
import { generatePack } from '../src/generate/pack.js';
import { packToMidiFiles } from '../src/index.js';
import { validatePackFiles } from '../src/validate.js';
import { computeSignature, similarity } from '../src/dedup/signature.js';
import { scaleById } from '../src/theory/scales.js';
import { GENRES, MOODS } from '../src/profiles/index.js';
import { TOTAL_TICKS, PART_NAMES, type PackSettings } from '../src/types.js';

function settingsFor(seed: number, genre = 'trap', overrides: Partial<PackSettings> = {}): PackSettings {
  return {
    seed,
    genre,
    mood: 'dark',
    bpm: 140,
    key: 'F#',
    scale: 'naturalMinor',
    energy: 7,
    complexity: 5,
    rhythmicDensity: 6,
    melodicMovement: 5,
    chordComplexity: 4,
    experimental: 2,
    syncopation: 5,
    noteLength: 5,
    humanize: 3,
    familiarity: 'balanced',
    era: ['2010s', 'Modern'],
    ...overrides,
  };
}

describe('generatePack', () => {
  it('is fully deterministic: same seed -> byte-identical MIDI', () => {
    const a = packToMidiFiles(generatePack(settingsFor(184729)));
    const b = packToMidiFiles(generatePack(settingsFor(184729)));
    for (const part of PART_NAMES) {
      expect(Buffer.from(a[part]).equals(Buffer.from(b[part]))).toBe(true);
    }
  });

  it('produces different music for different seeds', () => {
    const a = generatePack(settingsFor(1));
    const b = generatePack(settingsFor(2));
    const sim = similarity(a.signature, b.signature);
    expect(sim).toBeLessThan(0.95);
  });

  it('regenerates a single part while keeping the rest identical', () => {
    const base = packToMidiFiles(generatePack(settingsFor(42)));
    const rerolled = packToMidiFiles(generatePack(settingsFor(42), { melody: 999 }));
    expect(Buffer.from(base.chords).equals(Buffer.from(rerolled.chords))).toBe(true);
    expect(Buffer.from(base.bass).equals(Buffer.from(rerolled.bass))).toBe(true);
    expect(Buffer.from(base.melody).equals(Buffer.from(rerolled.melody))).toBe(false);
  });

  it('every part stays inside 8 bars and has notes', () => {
    for (const seed of [7, 77, 777]) {
      const pack = generatePack(settingsFor(seed));
      for (const part of PART_NAMES) {
        const notes = pack.parts[part];
        expect(notes.length).toBeGreaterThan(0);
        for (const n of notes) {
          expect(n.start).toBeGreaterThanOrEqual(0);
          expect(n.start + n.dur).toBeLessThanOrEqual(TOTAL_TICKS);
        }
      }
    }
  });

  it('detects pure transposition as a near-duplicate', () => {
    const a = generatePack(settingsFor(500));
    // literal transposition of every part up 3 semitones
    const transposedParts = Object.fromEntries(
      Object.entries(a.parts).map(([k, notes]) => [k, notes.map((n) => ({ ...n, pitch: n.pitch + 3 }))])
    ) as typeof a.parts;
    const sigB = computeSignature(transposedParts, a.progression, a.phrasePlan, a.bassStyle);
    expect(similarity(a.signature, sigB)).toBeGreaterThanOrEqual(0.95);
  });

  it('same seed in a different key still reads as clearly related', () => {
    const a = generatePack(settingsFor(500, 'trap', { key: 'F#' }));
    const b = generatePack(settingsFor(500, 'trap', { key: 'C' }));
    expect(similarity(a.signature, b.signature)).toBeGreaterThan(0.65);
  });
});

describe('validation across the matrix', () => {
  it('generated packs validate for every genre profile', () => {
    let checked = 0;
    for (const genre of GENRES) {
      const mood = MOODS[checked % MOODS.length];
      const scaleWeights = genre.scales;
      const scaleId = scaleWeights[0][0];
      const bpm = Math.round((genre.bpmRange[0] + genre.bpmRange[1]) / 2);
      const s = settingsFor(1000 + checked * 13, genre.id, {
        mood: mood.id,
        scale: scaleId,
        bpm,
        key: ['C', 'F#', 'A', 'D#'][checked % 4],
        complexity: 1 + (checked % 10),
        rhythmicDensity: 1 + ((checked * 3) % 10),
        syncopation: 1 + ((checked * 7) % 10),
        noteLength: 1 + ((checked * 5) % 10),
      });
      const pack = generatePack(s);
      const files = packToMidiFiles(pack);
      const result = validatePackFiles(files, {
        bpm: s.bpm,
        key: s.key,
        scale: s.scale,
        experimental: s.experimental,
        progression: pack.progression.join('-'),
      });
      expect(result.errors, `genre ${genre.id}: ${result.errors.join('; ')}`).toHaveLength(0);
      checked++;
    }
    expect(checked).toBe(GENRES.length);
  });

  it('rejects a file that is not 8 bars', () => {
    const pack = generatePack(settingsFor(9));
    const files = packToMidiFiles(pack);
    // corrupt: truncate the melody EOT by rewriting with wrong length
    const bad = { ...files, melody: files.melody.slice(0, files.melody.length - 10) };
    const result = validatePackFiles(bad as typeof files, { bpm: 140, key: 'F#', scale: 'naturalMinor' });
    expect(result.ok).toBe(false);
  });
});

describe('variety', () => {
  it('200 sequential seeds contain no near-duplicate pairs above threshold', () => {
    const sigs = [];
    for (let seed = 1; seed <= 200; seed++) {
      const genre = GENRES[seed % GENRES.length];
      const scaleId = genre.scales[seed % genre.scales.length][0];
      const s = settingsFor(seed * 31 + 7, genre.id, {
        scale: scaleId,
        mood: MOODS[seed % MOODS.length].id,
        bpm: genre.bpmRange[0] + (seed % (genre.bpmRange[1] - genre.bpmRange[0] + 1)),
        complexity: 1 + (seed % 10),
        rhythmicDensity: 1 + ((seed * 3) % 10),
      });
      sigs.push(generatePack(s).signature);
    }
    let dupes = 0;
    for (let i = 0; i < sigs.length; i++) {
      for (let j = i + 1; j < sigs.length; j++) {
        if (similarity(sigs[i], sigs[j]) >= 0.82) dupes++;
      }
    }
    // allow a tiny number of borderline pairs out of 19,900 comparisons
    expect(dupes).toBeLessThanOrEqual(5);
  }, 120_000);
});
