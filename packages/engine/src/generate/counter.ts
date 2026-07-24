/**
 * Countermelody generator.
 *
 * Complements the melody instead of copying it: fills gaps (call/answer),
 * plays sustained harmony thirds/sixths, runs a register-separated ostinato,
 * or echoes prior melody bars - then runs a collision pass that removes or
 * re-pitches notes clashing with the melody (minor 2nds, unisons, tritones
 * on simultaneous attacks).
 */

import { BAR_TICKS, PPQ, SIXTEENTH, TOTAL_TICKS, type NoteEvent, type PackSettings } from '../types.js';
import type { GenreProfile, MoodProfile } from '../profiles/index.js';
import { fitToRange, nearestOctave, pitchClassOf } from '../theory/notes.js';
import { stepInScale } from '../theory/scales.js';
import { chance, clamp, pick, weightedPick, type Rng } from '../rng.js';
import { chordAt, type HarmonyContext } from './harmony.js';

export function renderCounter(
  harmony: HarmonyContext,
  melody: NoteEvent[],
  settings: PackSettings,
  genre: GenreProfile,
  mood: MoodProfile,
  rng: Rng
): { notes: NoteEvent[]; style: string } {
  const style = weightedPick(
    rng,
    genre.counter.styles.map(([s]) => s),
    genre.counter.styles.map(([, w]) => w)
  );
  const [rLo, rHi] = genre.counter.range;
  const lo = clamp(rLo + mood.registerDelta, 43, 96);
  const hi = clamp(rHi + mood.registerDelta, lo + 12, 103);
  const baseVel = clamp(72 + mood.velocityDelta + (settings.energy - 5) * 2, 30, 110);

  let notes: NoteEvent[] = [];
  switch (style) {
    case 'gapFill':
      notes = gapFill(harmony, melody, settings, rng, lo, hi, baseVel);
      break;
    case 'padHarm':
      notes = padHarm(harmony, melody, rng, lo, hi, baseVel);
      break;
    case 'ostinato':
      notes = ostinato(harmony, settings, rng, lo, hi, baseVel);
      break;
    case 'echo':
      notes = echo(harmony, melody, rng, lo, hi, baseVel);
      break;
    default:
      notes = gapFill(harmony, melody, settings, rng, lo, hi, baseVel);
  }

  notes = resolveCollisions(notes, melody, harmony, lo, hi);

  // styles like echo/gapFill can legally produce nothing against a dense
  // melody - fall back so the part always exists
  if (notes.length === 0) {
    notes = resolveCollisions(ostinato(harmony, settings, rng, lo, hi, baseVel), melody, harmony, lo, hi);
  }
  if (notes.length === 0) {
    // last resort: one low chord-root pad per chord, register-separated
    notes = harmony.chords.map((ch) => ({
      start: ch.start,
      dur: ch.dur - 40,
      pitch: fitToRange(nearestOctave(ch.rootPc, lo + 4), lo, hi),
      vel: baseVel - 12,
    }));
  }

  notes = notes
    .filter((n) => n.start >= 0 && n.start < TOTAL_TICKS)
    .map((n) => ({ ...n, dur: Math.max(50, Math.min(n.dur, TOTAL_TICKS - n.start)) }))
    .sort((a, b) => a.start - b.start);
  return { notes, style };
}

/* ---------------- styles ---------------- */

/** Notes placed in melody gaps >= 1 beat: short answering runs toward the next melody entry. */
function gapFill(
  harmony: HarmonyContext,
  melody: NoteEvent[],
  settings: PackSettings,
  rng: Rng,
  lo: number,
  hi: number,
  baseVel: number
): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const sorted = [...melody].sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number; nextPitch: number | null }[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.start - cursor >= PPQ) gaps.push({ start: cursor, end: m.start, nextPitch: m.pitch });
    cursor = Math.max(cursor, m.start + m.dur);
  }
  if (TOTAL_TICKS - cursor >= PPQ) gaps.push({ start: cursor, end: TOTAL_TICKS, nextPitch: null });

  for (const gap of gaps) {
    if (!chance(rng, 0.75)) continue; // don't fill every gap - space matters
    const len = gap.end - gap.start;
    const nNotes = len >= PPQ * 2 ? (chance(rng, 0.5) ? 3 : 2) : chance(rng, 0.4) ? 2 : 1;
    const ch = chordAt(harmony, gap.start);
    const chordPcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
    const anchor = gap.nextPitch !== null ? gap.nextPitch - 12 : Math.round((lo + hi) / 2);
    let pitch = fitToRange(nearestChordTonePc(anchor, chordPcs), lo, hi);
    const stepDur = Math.max(SIXTEENTH * 2, Math.min(PPQ, Math.floor(len / (nNotes + 0.5) / SIXTEENTH) * SIXTEENTH));
    // leave a breath after the melody stops
    let t = gap.start + (chance(rng, 0.6) ? SIXTEENTH * 2 : 0);
    for (let i = 0; i < nNotes && t + stepDur <= gap.end; i++) {
      notes.push({ start: t, dur: stepDur - 25, pitch, vel: baseVel - 4 + Math.round(rng() * 6) });
      const dir = gap.nextPitch !== null && gap.nextPitch - 12 > pitch ? 1 : gap.nextPitch !== null ? -1 : chance(rng, 0.5) ? 1 : -1;
      pitch = fitToRange(stepInScale(pitch, dir, harmony.keyPc, harmony.scaleId), lo, hi);
      t += stepDur;
    }
  }
  return notes;
}

/** Long harmony notes (3rds/6ths region below the melody's bar anchor). */
function padHarm(
  harmony: HarmonyContext,
  melody: NoteEvent[],
  rng: Rng,
  lo: number,
  hi: number,
  baseVel: number
): NoteEvent[] {
  const notes: NoteEvent[] = [];
  for (let bar = 0; bar < 8; bar += 1) {
    const barStart = bar * BAR_TICKS;
    const ch = chordAt(harmony, barStart);
    const chordPcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
    const melInBar = melody.filter((m) => m.start >= barStart && m.start < barStart + BAR_TICKS);
    const anchor = melInBar.length ? melInBar.reduce((a, b) => (b.dur > a.dur ? b : a)).pitch : (lo + hi) / 2 + 6;
    // aim a 3rd/6th below the melody anchor, snapped to a chord tone
    const offset = chance(rng, 0.6) ? -3 : -8;
    let pitch = fitToRange(nearestChordTonePc(anchor + offset, chordPcs), lo, hi);
    const dur = chance(rng, 0.3) ? BAR_TICKS * 2 - 60 : BAR_TICKS - 60;
    notes.push({ start: barStart, dur, pitch, vel: baseVel - 10 });
    if (dur > BAR_TICKS) bar += 1;
  }
  return notes;
}

/** 1-bar rhythmic cell repeated every bar on current chord tones. */
function ostinato(
  harmony: HarmonyContext,
  settings: PackSettings,
  rng: Rng,
  lo: number,
  hi: number,
  baseVel: number
): NoteEvent[] {
  const notes: NoteEvent[] = [];
  // build the cell: 2-4 onsets on an 8th grid (one bar)
  const nOnsets = 2 + Math.floor(rng() * 3);
  const slots = new Set<number>([0]);
  let guard = 0;
  while (slots.size < nOnsets && guard++ < 40) {
    const s = Math.floor(rng() * 8);
    if (chance(rng, s % 2 === 0 ? 0.8 : 0.35 + settings.syncopation * 0.04)) slots.add(s);
  }
  const cell = [...slots].sort((a, b) => a - b);
  const degreeSeq = cell.map((_, i) => (i === 0 ? 0 : pick(rng, [0, 1, 2, 2, 1]))); // chord-tone index per onset
  const center = Math.round((lo + hi) / 2);

  for (let bar = 0; bar < 8; bar++) {
    const barStart = bar * BAR_TICKS;
    const ch = chordAt(harmony, barStart);
    const chordPcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
    for (let i = 0; i < cell.length; i++) {
      const t = barStart + cell[i] * (PPQ / 2);
      const pc = chordPcs[degreeSeq[i] % chordPcs.length];
      const pitch = fitToRange(nearestOctave(pc, center), lo, hi);
      notes.push({ start: t, dur: PPQ / 2 - 40, pitch, vel: baseVel - 8 + (cell[i] % 2 === 0 ? 4 : -2) });
    }
  }
  return notes;
}

/** Echo sparse melody bars one bar later, transposed down, thinned. */
function echo(
  harmony: HarmonyContext,
  melody: NoteEvent[],
  rng: Rng,
  lo: number,
  hi: number,
  baseVel: number
): NoteEvent[] {
  const notes: NoteEvent[] = [];
  for (let bar = 1; bar < 8; bar++) {
    const srcStart = (bar - 1) * BAR_TICKS;
    const dstStart = bar * BAR_TICKS;
    const src = melody.filter((m) => m.start >= srcStart && m.start < srcStart + BAR_TICKS);
    const dstMel = melody.filter((m) => m.start >= dstStart && m.start < dstStart + BAR_TICKS);
    // only echo into bars where the melody is sparser than the source
    if (src.length === 0 || dstMel.length > Math.max(2, src.length / 2)) continue;
    const keep = src.filter((_, i) => i % 2 === 0 || chance(rng, 0.4)); // thin
    for (const m of keep) {
      const t = m.start - srcStart + dstStart;
      if (t + m.dur > TOTAL_TICKS) continue;
      const ch = chordAt(harmony, t);
      const chordPcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
      let pitch = fitToRange(m.pitch - 12, lo, hi);
      if (!chordPcs.includes(pitchClassOf(pitch)) && chance(rng, 0.5)) pitch = fitToRange(nearestChordTonePc(pitch, chordPcs), lo, hi);
      notes.push({ start: t, dur: m.dur, pitch, vel: Math.max(25, baseVel - 16) });
    }
  }
  return notes;
}

/* ---------------- collision handling ---------------- */

function resolveCollisions(
  counter: NoteEvent[],
  melody: NoteEvent[],
  harmony: HarmonyContext,
  lo: number,
  hi: number
): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (const c of counter) {
    const overlapping = melody.filter((m) => m.start < c.start + c.dur && m.start + m.dur > c.start);
    let bad = false;
    let fixed = { ...c };
    for (const m of overlapping) {
      const ivPc = Math.abs(((fixed.pitch - m.pitch) % 12 + 12) % 12);
      const clash = ivPc === 1 || ivPc === 11 || (ivPc === 6 && sameOnset(fixed, m)) || (ivPc === 0 && sameOnset(fixed, m));
      if (!clash) continue;
      // try re-pitching to the nearest chord tone that doesn't clash
      const ch = chordAt(harmony, fixed.start);
      const chordPcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
      const candidate = chordPcs
        .map((pc) => fitToRange(nearestOctave(pc, fixed.pitch), lo, hi))
        .find((p) => {
          const iv2 = Math.abs(((p - m.pitch) % 12 + 12) % 12);
          return iv2 !== 1 && iv2 !== 11 && !(iv2 === 0 && sameOnset(fixed, m));
        });
      if (candidate !== undefined) {
        fixed = { ...fixed, pitch: candidate };
      } else {
        bad = true;
        break;
      }
    }
    if (!bad) out.push(fixed);
  }
  return out;
}

function sameOnset(a: NoteEvent, b: NoteEvent): boolean {
  return Math.abs(a.start - b.start) < SIXTEENTH / 2;
}

function nearestChordTonePc(pitch: number, chordPcs: number[]): number {
  let best = pitch;
  let bestD = Infinity;
  for (const pc of chordPcs) {
    const cand = nearestOctave(pc, pitch);
    const d = Math.abs(cand - pitch);
    if (d < bestD) {
      bestD = d;
      best = cand;
    }
  }
  return best;
}
