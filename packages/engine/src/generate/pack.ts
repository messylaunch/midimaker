/**
 * Pack orchestrator: builds one coordinated 8-bar pack (Chords, Melody,
 * CounterMelody, Bass) from a single seed. Fully deterministic: the same
 * settings + seed always produce byte-identical MIDI.
 *
 * Part order matters musically: harmony first, then chords rendering, then
 * melody over the harmony, then countermelody against the melody, then bass
 * under everything.
 */

import {
  PPQ, SIXTEENTH, TOTAL_TICKS,
  type GeneratedPack, type NoteEvent, type PackSettings, type PartName,
} from '../types.js';
import { genreById, moodById } from '../profiles/index.js';
import { clamp, deriveSeed, jitter, mulberry32 } from '../rng.js';
import { buildHarmony } from './harmony.js';
import { renderChordsPart } from './chordspart.js';
import { renderMelody } from './melody.js';
import { renderCounter } from './counter.js';
import { renderBass } from './bass.js';
import { computeSignature } from '../dedup/signature.js';

/**
 * Optional per-part seed offsets: used by "regenerate one part" to reroll a
 * single part while every other part stays byte-identical.
 */
export type PartSeeds = Partial<Record<PartName, number>>;

export function generatePack(rawSettings: PackSettings, partSeeds: PartSeeds = {}): GeneratedPack {
  const settings = sanitizeSettings(rawSettings);
  const genre = genreById(settings.genre);
  const mood = moodById(settings.mood);

  const rngHarmony = mulberry32(deriveSeed(settings.seed, 'harmony'));
  const rngChords = mulberry32(deriveSeed(settings.seed + (partSeeds.chords ?? 0), 'chords'));
  const rngMelody = mulberry32(deriveSeed(settings.seed + (partSeeds.melody ?? 0), 'melody'));
  const rngCounter = mulberry32(deriveSeed(settings.seed + (partSeeds.counterMelody ?? 0), 'counter'));
  const rngBass = mulberry32(deriveSeed(settings.seed + (partSeeds.bass ?? 0), 'bass'));
  const humanRngFor = (part: PartName) =>
    mulberry32(deriveSeed(settings.seed + (partSeeds[part] ?? 0), 'humanize:' + part));

  const harmony = buildHarmony(settings, genre, rngHarmony);
  const chordsR = renderChordsPart(harmony, settings, genre, mood, rngChords);
  const melodyR = renderMelody(harmony, settings, genre, mood, rngMelody);
  const counterR = renderCounter(harmony, melodyR.notes, settings, genre, mood, rngCounter);
  const bassR = renderBass(harmony, settings, genre, mood, rngBass);

  const parts: Record<PartName, NoteEvent[]> = {
    chords: chordsR.notes,
    melody: melodyR.notes,
    counterMelody: counterR.notes,
    bass: bassR.notes,
  };

  // swing (genre feel) then humanization (timing/velocity jitter);
  // each part gets its own humanize stream so rerolling one part never
  // perturbs the others
  for (const name of Object.keys(parts) as PartName[]) {
    let notes = applySwing(parts[name], genre.swing);
    notes = humanize(notes, settings.humanize, humanRngFor(name));
    notes = finalizeNotes(notes);
    parts[name] = notes;
  }

  const signature = computeSignature(parts, harmony.chords.map((c) => c.roman), melodyR.plan, bassR.style);

  return {
    settings,
    parts,
    progression: harmony.chords.map((c) => c.roman),
    phrasePlan: melodyR.plan,
    bassStyle: bassR.style,
    chordStyle: chordsR.style,
    signature,
  };
}

export function sanitizeSettings(s: PackSettings): PackSettings {
  const c = (v: number, lo: number, hi: number, dflt: number) =>
    Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : dflt;
  return {
    ...s,
    seed: Number.isFinite(s.seed) ? Math.abs(Math.round(s.seed)) >>> 0 : 1,
    bpm: c(s.bpm, 40, 220, 120),
    energy: c(s.energy, 1, 10, 5),
    complexity: c(s.complexity, 1, 10, 5),
    rhythmicDensity: c(s.rhythmicDensity, 1, 10, 5),
    melodicMovement: c(s.melodicMovement, 1, 10, 5),
    chordComplexity: c(s.chordComplexity, 1, 10, 4),
    experimental: c(s.experimental, 1, 10, 2),
    syncopation: c(s.syncopation, 1, 10, 5),
    noteLength: c(s.noteLength, 1, 10, 5),
    humanize: c(s.humanize, 0, 10, 3),
    familiarity: s.familiarity ?? 'balanced',
  };
}

/** Shift offbeat 8ths/16ths later for a swing feel. Subtle by design. */
function applySwing(notes: NoteEvent[], swing: number): NoteEvent[] {
  if (swing <= 0) return notes;
  const shift8 = Math.round(swing * PPQ * 0.5);
  const shift16 = Math.round(swing * PPQ * 0.25);
  return notes.map((n) => {
    const inBeat = n.start % PPQ;
    let delta = 0;
    if (inBeat === PPQ / 2) delta = shift8;
    else if (inBeat === SIXTEENTH || inBeat === SIXTEENTH * 3) delta = shift16;
    return delta ? { ...n, start: n.start + delta, dur: Math.max(40, n.dur - delta) } : n;
  });
}

function humanize(notes: NoteEvent[], amount: number, rng: () => number): NoteEvent[] {
  if (amount <= 0) return notes;
  const t = amount * 3; // max +-30 ticks at 10
  const v = amount * 2.5;
  return notes.map((n) => {
    const isDownbeatBarOne = n.start === 0;
    const dt = isDownbeatBarOne ? 0 : Math.round(jitter(rng, t));
    return {
      ...n,
      start: Math.max(0, n.start + dt),
      vel: clamp(Math.round(n.vel + jitter(rng, v)), 20, 127),
    };
  });
}

function finalizeNotes(notes: NoteEvent[]): NoteEvent[] {
  return notes
    .filter((n) => n.start >= 0 && n.start < TOTAL_TICKS && n.dur > 0)
    .map((n) => ({
      start: Math.round(n.start),
      dur: Math.max(30, Math.min(Math.round(n.dur), TOTAL_TICKS - Math.round(n.start))),
      pitch: clamp(Math.round(n.pitch), 0, 127),
      vel: clamp(Math.round(n.vel), 1, 127),
    }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}
