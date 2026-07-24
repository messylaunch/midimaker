/**
 * Melody generator.
 *
 * Builds a 2-bar rhythmic motif, then develops it across 8 bars using a
 * phrase plan (repetition with variation, sequences, call-and-response,
 * cadence). Pitches follow a contour line, target chord tones on strong
 * beats, use passing/neighbor/tension notes intentionally, cap intervals by
 * complexity, recover from leaps stepwise, and always end on a stable tone.
 */

import { BAR_TICKS, PPQ, SIXTEENTH, TOTAL_TICKS, type NoteEvent, type PackSettings } from '../types.js';
import type { GenreProfile, MoodProfile } from '../profiles/index.js';
import { fitToRange, nearestOctave, pitchClassOf } from '../theory/notes.js';
import { snapToScale, stepInScale } from '../theory/scales.js';
import { chance, clamp, pick, weightedPick, type Rng } from '../rng.js';
import { chordAt, type HarmonyContext } from './harmony.js';

const SEG_BARS = 2;
const SEG_SLOTS = SEG_BARS * 16; // 32 sixteenth slots per segment
const SEG_TICKS = SEG_BARS * BAR_TICKS;

interface Onset {
  slot: number;
  durSlots: number;
}

type SegOp = { op: 'new' | 'repeat' | 'vary' | 'contrast' | 'response' | 'seqUp' | 'seqDown' | 'cadence'; ref?: number };

const PLANS: Record<string, SegOp[]> = {
  AABB: [{ op: 'new' }, { op: 'repeat', ref: 0 }, { op: 'contrast' }, { op: 'cadence', ref: 2 }],
  ABAB1: [{ op: 'new' }, { op: 'contrast' }, { op: 'repeat', ref: 0 }, { op: 'cadence', ref: 1 }],
  AA1AA2: [{ op: 'new' }, { op: 'vary', ref: 0 }, { op: 'repeat', ref: 0 }, { op: 'cadence', ref: 0 }],
  callResponse: [{ op: 'new' }, { op: 'response', ref: 0 }, { op: 'vary', ref: 0 }, { op: 'cadence', ref: 1 }],
  motifDev: [{ op: 'new' }, { op: 'seqUp', ref: 0 }, { op: 'seqDown', ref: 0 }, { op: 'cadence', ref: 0 }],
};

interface Segment {
  onsets: Onset[];
  pitches: number[];
}

export function renderMelody(
  harmony: HarmonyContext,
  settings: PackSettings,
  genre: GenreProfile,
  mood: MoodProfile,
  rng: Rng
): { notes: NoteEvent[]; plan: string } {
  const planName = weightedPick(
    rng,
    genre.melody.phrasePlans.map(([p]) => p),
    genre.melody.phrasePlans.map(([, w]) => w)
  );
  if (planName === 'longNotes') {
    return { notes: renderLongNotes(harmony, settings, genre, mood, rng), plan: planName };
  }
  const plan = PLANS[planName] ?? PLANS.AABB;

  const [rLo, rHi] = genre.melody.range;
  const lo = clamp(rLo + mood.registerDelta, 48, 100);
  const hi = clamp(rHi + mood.registerDelta, lo + 12, 108);
  const center = Math.round((lo + hi) / 2);
  const contourName = weightedPick(
    rng,
    genre.melody.contours.map(([c]) => c),
    genre.melody.contours.map(([, w]) => w)
  );
  const span = 4 + settings.melodicMovement * 0.8; // semitone breadth of the contour line

  const baseVel = clamp(84 + mood.velocityDelta + (settings.energy - 5) * 2, 35, 118);
  const segments: Segment[] = [];
  const notes: NoteEvent[] = [];
  let prevPitch = center;
  let leapToRecover = 0;
  let pendingResolution = false;

  for (let si = 0; si < 4; si++) {
    const step = plan[si];
    const segStart = si * SEG_TICKS;
    const isCadence = step.op === 'cadence';
    const ref = step.ref !== undefined ? segments[step.ref] : undefined;

    // ---- rhythm ----
    let onsets: Onset[];
    switch (step.op) {
      case 'new':
        onsets = makeMotifRhythm(rng, settings, genre);
        break;
      case 'contrast': {
        onsets = makeMotifRhythm(rng, settings, genre);
        break;
      }
      case 'repeat':
        onsets = ref!.onsets.map((o) => ({ ...o }));
        break;
      case 'vary':
      case 'response': {
        onsets = ref!.onsets.map((o) => ({ ...o }));
        // small rhythmic variation: nudge or drop/add one onset
        if (onsets.length > 3 && chance(rng, 0.5)) onsets.splice(1 + Math.floor(rng() * (onsets.length - 2)), 1);
        else if (chance(rng, 0.5)) {
          const slot = 2 * Math.floor(rng() * 16);
          if (!onsets.some((o) => o.slot === slot)) onsets.push({ slot, durSlots: 1 });
        }
        onsets.sort((a, b) => a.slot - b.slot);
        break;
      }
      case 'seqUp':
      case 'seqDown':
        onsets = ref!.onsets.map((o) => ({ ...o }));
        break;
      case 'cadence': {
        onsets = ref!.onsets.map((o) => ({ ...o }));
        // thin the tail and leave room for a longer final note
        onsets = onsets.filter((o) => o.slot <= 26);
        if (onsets.length === 0) onsets = [{ slot: 0, durSlots: 4 }];
        const last = onsets[onsets.length - 1];
        last.durSlots = Math.max(last.durSlots, 4);
        break;
      }
      default:
        onsets = makeMotifRhythm(rng, settings, genre);
    }
    fixOverlaps(onsets);

    // ---- pitches ----
    const pitches: number[] = [];
    const segU = (o: Onset) => o.slot / SEG_SLOTS;
    for (let oi = 0; oi < onsets.length; oi++) {
      const o = onsets[oi];
      const tick = segStart + o.slot * SIXTEENTH;
      const ch = chordAt(harmony, tick);
      const chordPcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
      const globalU = tick / TOTAL_TICKS;
      const target = center + contourOffset(contourName, segU(o), globalU) * (span / 5);
      const isLast = si === 3 && oi === onsets.length - 1;
      const strong = o.slot % 8 === 0 || (o.slot % 4 === 0 && chance(rng, 0.6));

      let pitch: number;

      if ((step.op === 'repeat' || step.op === 'seqUp' || step.op === 'seqDown') && ref && ref.pitches[oi] !== undefined) {
        // reuse reference pitches (transposed for sequences), re-snap strong beats
        const shift = step.op === 'seqUp' ? 1 : step.op === 'seqDown' ? -1 : 0;
        pitch = shift === 0 ? ref.pitches[oi] : stepInScale(ref.pitches[oi], shift, harmony.keyPc, harmony.scaleId);
        if (strong && !chordPcs.includes(pitchClassOf(pitch))) {
          pitch = nearestChordTone(pitch, chordPcs);
        }
      } else if (step.op === 'vary' && ref && ref.pitches[oi] !== undefined && !chance(rng, 0.3)) {
        pitch = ref.pitches[oi];
        if (strong && !chordPcs.includes(pitchClassOf(pitch))) pitch = nearestChordTone(pitch, chordPcs);
      } else {
        pitch = choosePitch({
          rng, settings, harmony, chordPcs, prevPitch, target, strong,
          pendingResolution, leapToRecover, lo, hi,
        });
      }

      if (isLast) {
        // cadence: land on a stable tone of the final chord, approached by step
        const stablePcs = [chordPcs[0], chordPcs[1] ?? chordPcs[0], chordPcs[2] ?? chordPcs[0]];
        const weights = [5, 3, 2];
        const targetPc = weightedPick(rng, stablePcs, weights);
        pitch = fitToRange(nearestOctave(targetPc, prevPitch), lo, hi);
        if (Math.abs(pitch - prevPitch) > 4 && pitches.length > 0) {
          // pull the approach closer for a stepwise landing
          const appr = stepInScale(pitch, pitch > prevPitch ? -1 : 1, harmony.keyPc, harmony.scaleId);
          pitches[pitches.length - 1] = fitToRange(appr, lo, hi);
        }
      }

      pitch = fitToRange(Math.round(pitch), lo, hi);
      const interval = pitch - prevPitch;
      leapToRecover = Math.abs(interval) >= 7 ? -Math.sign(interval) : 0;
      pendingResolution = !chordPcs.includes(pitchClassOf(pitch)) && !inScalePc(pitch, harmony);
      prevPitch = pitch;
      pitches.push(pitch);
    }

    // response phrases end stable and a bit lower than the call
    if (step.op === 'response' && pitches.length > 0 && ref && ref.pitches.length > 0) {
      const callEnd = ref.pitches[ref.pitches.length - 1];
      const ch = chordAt(harmony, segStart + onsets[onsets.length - 1].slot * SIXTEENTH);
      const chordPcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
      let landing = nearestChordTone(callEnd - 3, chordPcs);
      landing = fitToRange(landing, lo, hi);
      pitches[pitches.length - 1] = landing;
      prevPitch = landing;
    }

    segments.push({ onsets, pitches });

    // emit notes
    for (let oi = 0; oi < onsets.length; oi++) {
      const o = onsets[oi];
      const start = segStart + o.slot * SIXTEENTH;
      const nextSlot = oi + 1 < onsets.length ? onsets[oi + 1].slot : SEG_SLOTS + 2;
      const maxDur = (nextSlot - o.slot) * SIXTEENTH - 20;
      const dur = Math.min(o.durSlots * SIXTEENTH - 20, maxDur, TOTAL_TICKS - start - 10);
      const strongAccent = o.slot % 8 === 0 ? 6 : o.slot % 4 === 0 ? 2 : -3;
      notes.push({
        start,
        dur: Math.max(50, dur),
        pitch: pitches[oi],
        vel: clamp(baseVel + strongAccent + Math.round((rng() - 0.5) * 6), 30, 127),
      });
    }
  }

  return { notes, plan: planName };
}

/* ------------------------------------------------------------------ */

function makeMotifRhythm(rng: Rng, settings: PackSettings, genre: GenreProfile): Onset[] {
  const m = genre.melody;
  const densityFactor = 0.55 + 0.09 * settings.rhythmicDensity + (settings.energy - 5) * 0.02;
  let targetOnsets = clamp(Math.round(m.baseDensity * SEG_BARS * densityFactor), 2, 16);
  const sync = clamp(m.syncopation + (settings.syncopation - 5) * 0.06, 0, 0.95);

  // slot weights: strong beats favored, offbeats scale with syncopation
  const weights: number[] = [];
  for (let s = 0; s < SEG_SLOTS; s++) {
    if (s % 8 === 0) weights.push(10);
    else if (s % 4 === 0) weights.push(6);
    else if (s % 2 === 0) weights.push(1.5 + 4 * sync);
    else weights.push(0.3 + 2.5 * sync * (settings.rhythmicDensity / 10));
  }

  const chosen = new Set<number>();
  if (chance(rng, 0.85)) chosen.add(0);
  let guard = 0;
  while (chosen.size < targetOnsets && guard++ < 300) {
    const s = weightedIndexLocal(rng, weights);
    if (chosen.has(s)) {
      weights[s] *= 0.3;
      continue;
    }
    chosen.add(s);
  }

  const slots = [...chosen].sort((a, b) => a - b);
  const maxDurSlots = 1 + Math.round(settings.noteLength * 1.1);
  const onsets: Onset[] = slots.map((slot, i) => {
    const gap = (i + 1 < slots.length ? slots[i + 1] : SEG_SLOTS) - slot;
    let durSlots: number;
    if (settings.noteLength <= 3) durSlots = Math.max(1, Math.min(2, gap - 1));
    else if (settings.noteLength >= 8) durSlots = Math.min(gap, maxDurSlots);
    else durSlots = Math.max(1, Math.min(gap - (chance(rng, 0.4) ? 1 : 0), maxDurSlots));
    return { slot, durSlots };
  });

  // enforce the genre rest ratio: total sounding time <= (1 - restRatio) * segment
  const maxSounding = Math.floor((1 - genre.melody.restRatio) * SEG_SLOTS);
  let sounding = onsets.reduce((s, o) => s + o.durSlots, 0);
  while (sounding > maxSounding && onsets.length > 2) {
    // shorten longest, then drop weakest offbeat onset
    const longest = onsets.reduce((a, b) => (b.durSlots > a.durSlots ? b : a));
    if (longest.durSlots > 2) {
      longest.durSlots -= 1;
    } else {
      const idx = onsets.findIndex((o) => o.slot % 4 !== 0);
      onsets.splice(idx >= 0 ? idx : onsets.length - 1, 1);
    }
    sounding = onsets.reduce((s, o) => s + o.durSlots, 0);
  }
  return onsets;
}

function fixOverlaps(onsets: Onset[]): void {
  onsets.sort((a, b) => a.slot - b.slot);
  for (let i = 0; i + 1 < onsets.length; i++) {
    const gap = onsets[i + 1].slot - onsets[i].slot;
    if (onsets[i].durSlots > gap) onsets[i].durSlots = Math.max(1, gap);
  }
  const last = onsets[onsets.length - 1];
  if (last && last.slot + last.durSlots > SEG_SLOTS + 4) last.durSlots = SEG_SLOTS + 4 - last.slot;
}

interface PitchArgs {
  rng: Rng;
  settings: PackSettings;
  harmony: HarmonyContext;
  chordPcs: number[];
  prevPitch: number;
  target: number;
  strong: boolean;
  pendingResolution: boolean;
  leapToRecover: number;
  lo: number;
  hi: number;
}

function choosePitch(a: PitchArgs): number {
  const { rng, settings, harmony, chordPcs, prevPitch, target, strong, lo, hi } = a;
  const cap = settings.complexity <= 3 ? 5 : settings.complexity <= 7 ? 9 : 12;

  // resolve pending tension stepwise
  if (a.pendingResolution) {
    const up = stepInScale(prevPitch, 1, harmony.keyPc, harmony.scaleId);
    const down = stepInScale(prevPitch, -1, harmony.keyPc, harmony.scaleId);
    const cands = [up, down].filter((p) => p >= lo && p <= hi);
    if (cands.length) return cands.reduce((x, y) => (Math.abs(x - target) < Math.abs(y - target) ? x : y));
  }

  // leap recovery: step back in the opposite direction
  if (a.leapToRecover !== 0 && chance(rng, 0.8)) {
    return clampRange(stepInScale(prevPitch, a.leapToRecover, harmony.keyPc, harmony.scaleId), lo, hi);
  }

  // note repetition (motivic, stronger at low melodic movement)
  if (chance(rng, clamp(0.3 - settings.melodicMovement * 0.02, 0.05, 0.3))) {
    return prevPitch;
  }

  if (strong) {
    // chord-tone targeting on strong beats
    const stability = [5, 3, 4, 2, 1.5]; // root, 3rd, 5th, 7th, ext
    const cands: { pitch: number; w: number }[] = [];
    chordPcs.forEach((pc, i) => {
      const near = nearestOctave(pc, prevPitch);
      for (const p of [near, near + 12, near - 12]) {
        if (p < lo || p > hi) continue;
        if (Math.abs(p - prevPitch) > cap) continue;
        const distPenalty = 1 / (1 + Math.abs(p - target) * 0.35 + Math.abs(p - prevPitch) * 0.15);
        cands.push({ pitch: p, w: (stability[Math.min(i, 4)] ?? 1) * distPenalty });
      }
    });
    if (cands.length === 0) return clampRange(nearestChordTone(prevPitch, chordPcs), lo, hi);
    return weightedPick(rng, cands.map((c) => c.pitch), cands.map((c) => c.w));
  }

  // weak beats: passing / neighbor / tension notes
  const tensionProb = clamp(0.04 + (settings.complexity - 1) * 0.012 + (settings.experimental - 1) * 0.02, 0, 0.35);
  if (chance(rng, tensionProb)) {
    // chromatic neighbor (resolved on the next note via pendingResolution)
    const dir = target > prevPitch ? 1 : -1;
    return clampRange(prevPitch + dir, lo, hi);
  }
  // scale step toward the contour target (1-2 steps)
  const dir = target > prevPitch ? 1 : target < prevPitch ? -1 : chance(rng, 0.5) ? 1 : -1;
  const steps = chance(rng, clamp(settings.melodicMovement * 0.05, 0.1, 0.5)) ? 2 : 1;
  let p = stepInScale(prevPitch, dir * steps, harmony.keyPc, harmony.scaleId);
  if (Math.abs(p - prevPitch) > cap) p = stepInScale(prevPitch, dir, harmony.keyPc, harmony.scaleId);
  return clampRange(p, lo, hi);
}

function clampRange(p: number, lo: number, hi: number): number {
  return fitToRange(p, lo, hi);
}

function nearestChordTone(pitch: number, chordPcs: number[]): number {
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

function inScalePc(pitch: number, harmony: HarmonyContext): boolean {
  return snapToScale(pitch, harmony.keyPc, harmony.scaleId) === pitch;
}

function contourOffset(name: string, segU: number, globalU: number): number {
  const u = segU * 0.5 + globalU * 0.5;
  switch (name) {
    case 'arch': return Math.sin(Math.PI * u) * 5;
    case 'valley': return -Math.sin(Math.PI * u) * 5;
    case 'rampUp': return (u - 0.3) * 7;
    case 'rampDown': return (0.7 - u) * 7;
    case 'wave': return Math.sin(Math.PI * 2 * u) * 4;
    case 'flat': return 0;
    default: return Math.sin(Math.PI * u) * 4;
  }
}

function weightedIndexLocal(rng: Rng, weights: number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/* ---------------- long-note melody style ---------------- */

function renderLongNotes(
  harmony: HarmonyContext,
  settings: PackSettings,
  genre: GenreProfile,
  mood: MoodProfile,
  rng: Rng
): NoteEvent[] {
  const [rLo, rHi] = genre.melody.range;
  const lo = clamp(rLo + mood.registerDelta, 48, 100);
  const hi = clamp(rHi + mood.registerDelta, lo + 12, 108);
  const center = Math.round((lo + hi) / 2);
  const baseVel = clamp(80 + mood.velocityDelta + (settings.energy - 5) * 2, 35, 115);
  const notes: NoteEvent[] = [];
  let prev = center;

  for (let bar = 0; bar < 8; bar++) {
    const barStart = bar * BAR_TICKS;
    const ch = chordAt(harmony, barStart);
    const chordPcs = ch.intervals.map((iv) => (ch.rootPc + iv) % 12);
    const arc = Math.sin(Math.PI * (bar / 7)) * 6;
    const target = center + arc;

    const two = chance(rng, 0.35 + settings.rhythmicDensity * 0.02);
    const durBeats = two ? 2 : pick(rng, [3, 4]);
    // color tones (9th/6th) show up at higher complexity
    const useColor = settings.complexity > 5 && chance(rng, 0.2);
    let pitch = useColor
      ? fitToRange(nearestOctave((ch.rootPc + pick(rng, [2, 9])) % 12, prev), lo, hi)
      : nearestChordTone(Math.round(target), chordPcs);
    pitch = fitToRange(pitch, lo, hi);
    if (Math.abs(pitch - prev) > 9) pitch = nearestChordTone(prev + Math.sign(pitch - prev) * 4, chordPcs);
    pitch = fitToRange(pitch, lo, hi);

    notes.push({ start: barStart, dur: durBeats * PPQ - 40, pitch, vel: baseVel });
    prev = pitch;

    if (two) {
      const t2 = barStart + 2 * PPQ;
      const ch2 = chordAt(harmony, t2);
      const pcs2 = ch2.intervals.map((iv) => (ch2.rootPc + iv) % 12);
      let p2 = nearestChordTone(stepInScale(pitch, chance(rng, 0.5) ? 1 : -1, harmony.keyPc, harmony.scaleId), pcs2);
      p2 = fitToRange(p2, lo, hi);
      notes.push({ start: t2, dur: 2 * PPQ - 60, pitch: p2, vel: baseVel - 5 });
      prev = p2;
    } else if (chance(rng, 0.3) && bar < 7) {
      // pickup 8th into the next bar
      const t = barStart + BAR_TICKS - PPQ / 2;
      const nextCh = chordAt(harmony, barStart + BAR_TICKS);
      const nextPcs = nextCh.intervals.map((iv) => (nextCh.rootPc + iv) % 12);
      const lead = stepInScale(nearestChordTone(prev, nextPcs), -1, harmony.keyPc, harmony.scaleId);
      notes.push({ start: t, dur: PPQ / 2 - 30, pitch: fitToRange(lead, lo, hi), vel: baseVel - 10 });
    }
  }
  // end stable: force last note onto root/5th of final chord
  const last = notes[notes.length - 1];
  const finalCh = harmony.chords[harmony.chords.length - 1];
  const stable = [finalCh.rootPc, (finalCh.rootPc + (finalCh.intervals[2] ?? 7)) % 12];
  last.pitch = fitToRange(nearestOctave(pick(rng, stable), last.pitch), lo, hi);
  return notes;
}
