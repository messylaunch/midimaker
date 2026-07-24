/**
 * Bass generator: genre-idiomatic movement built from chord roots and
 * important chord tones - roots, fifths, octaves, approach notes, pedal
 * tones and rhythmic patterns. Never blindly follows the melody.
 */

import { BAR_TICKS, PPQ, SIXTEENTH, TOTAL_TICKS, type NoteEvent, type PackSettings } from '../types.js';
import type { GenreProfile, MoodProfile } from '../profiles/index.js';
import { fitToRange, nearestOctave } from '../theory/notes.js';
import { stepInScale } from '../theory/scales.js';
import { chance, clamp, pick, weightedPick, type Rng } from '../rng.js';
import type { HarmonyContext } from './harmony.js';

const EIGHTH = PPQ / 2;

export function renderBass(
  harmony: HarmonyContext,
  settings: PackSettings,
  genre: GenreProfile,
  mood: MoodProfile,
  rng: Rng
): { notes: NoteEvent[]; style: string } {
  const style = weightedPick(
    rng,
    genre.bass.styles.map(([s]) => s),
    genre.bass.styles.map(([, w]) => w)
  );
  const [lo, hi] = genre.bass.range;
  const center = Math.round((lo + hi) / 2);
  const baseVel = clamp(80 + mood.velocityDelta / 2 + (settings.energy - 5) * 3, 40, 120);
  const notes: NoteEvent[] = [];
  const useApproach = settings.complexity >= 4;

  const chords = harmony.chords;
  for (let ci = 0; ci < chords.length; ci++) {
    const ch = chords[ci];
    const next = chords[ci + 1];
    const end = ch.start + ch.dur;
    const root = fitToRange(nearestOctave(ch.rootPc, center), lo, hi);
    const fifth = fitToRange(root + 7, lo, hi);
    const octave = fitToRange(root + 12, lo, hi + 4);
    const nextRoot = next ? fitToRange(nearestOctave(next.rootPc, root), lo, hi) : root;

    const push = (start: number, dur: number, pitch: number, vel: number) => {
      if (start >= end || start < ch.start - EIGHTH) return;
      notes.push({ start, dur: Math.min(dur, end - start), pitch, vel });
    };

    switch (style) {
      case 'whole': {
        push(ch.start, ch.dur - 30, root, baseVel);
        break;
      }
      case 'halfNotes': {
        for (let t = ch.start; t < end; t += PPQ * 2) {
          const useFifth = t > ch.start && chance(rng, 0.3);
          push(t, PPQ * 2 - 30, useFifth ? fifth : root, baseVel);
        }
        break;
      }
      case 'rootFifth': {
        let i = 0;
        for (let t = ch.start; t + PPQ <= end + 1; t += PPQ, i++) {
          push(t, PPQ * 0.9, i % 2 === 0 ? root : fifth, baseVel + (i % 2 === 0 ? 4 : -4));
        }
        break;
      }
      case 'octave8': {
        let i = 0;
        for (let t = ch.start; t + EIGHTH <= end + 1; t += EIGHTH, i++) {
          push(t, EIGHTH * 0.85, i % 2 === 0 ? root : octave, baseVel + (i % 2 === 0 ? 2 : -6));
        }
        break;
      }
      case 'pump8': {
        let i = 0;
        for (let t = ch.start; t + EIGHTH <= end + 1; t += EIGHTH, i++) {
          push(t, EIGHTH * 0.85, root, baseVel + (i % 2 === 0 ? 4 : -8));
        }
        break;
      }
      case 'danceOffbeat': {
        for (let t = ch.start + EIGHTH; t < end; t += PPQ) {
          push(t, EIGHTH * 0.7, root, baseVel + 2);
        }
        break;
      }
      case 'walk': {
        // quarter-note walk: root -> chord tones -> stepwise approach to next root
        const beats = Math.round(ch.dur / PPQ);
        let cur = root;
        for (let b = 0; b < beats; b++) {
          const t = ch.start + b * PPQ;
          let pitch: number;
          if (b === 0) {
            pitch = root;
          } else if (b === beats - 1 && next) {
            // approach next root by step (scale or chromatic)
            const dir = nextRoot > cur ? -1 : 1; // land from opposite side
            pitch = chance(rng, 0.5) ? nextRoot + dir : stepInScale(nextRoot, dir, harmony.keyPc, harmony.scaleId);
          } else {
            const options = [root, fifth, fitToRange(root + ch.intervals[1], lo, hi), octave];
            pitch = pick(rng, options);
            if (Math.abs(pitch - cur) > 7) pitch = stepInScale(cur, pitch > cur ? 1 : -1, harmony.keyPc, harmony.scaleId);
          }
          pitch = fitToRange(pitch, lo, hi + 4);
          push(t, PPQ * 0.9, pitch, baseVel + (b === 0 ? 4 : 0));
          cur = pitch;
        }
        break;
      }
      case 'trap808': {
        // long root, then sparse syncopated pickups
        const holdBeats = ch.dur >= BAR_TICKS ? 2 + Math.floor(rng() * 2) : 1;
        push(ch.start, PPQ * holdBeats - 30, root, baseVel + 6);
        const pickupOffsets = [PPQ * 2.5, PPQ * 3, PPQ * 3.5, PPQ * 3.75, BAR_TICKS + PPQ * 1.5, BAR_TICKS + PPQ * 3];
        const nPickups = 1 + Math.floor(rng() * Math.min(3, Math.max(1, Math.round(settings.rhythmicDensity / 3))));
        const chosen = new Set<number>();
        for (let k = 0; k < nPickups; k++) chosen.add(pick(rng, pickupOffsets));
        for (const off of chosen) {
          const t = ch.start + off;
          if (t + SIXTEENTH > end) continue;
          const p = chance(rng, 0.25) ? octave : root;
          push(t, chance(rng, 0.4) ? PPQ - 30 : EIGHTH * 0.8, p, baseVel - 4);
        }
        break;
      }
      case 'halfTime': {
        push(ch.start, PPQ * 2 - 30, root, baseVel + 4);
        const t2 = ch.start + PPQ * (chance(rng, 0.5) ? 2.5 : 3);
        if (t2 + EIGHTH <= end) push(t2, PPQ * 0.9, chance(rng, 0.3) ? fifth : root, baseVel - 6);
        break;
      }
      case 'funk16': {
        // syncopated 16th pattern per bar: beat 1 anchored, ghosts + octaves
        for (let bar = Math.floor(ch.start / BAR_TICKS); bar * BAR_TICKS < end; bar++) {
          const barStart = Math.max(bar * BAR_TICKS, ch.start);
          const slots = [0, 3, 6, 8, 10, 11, 14];
          push(barStart, SIXTEENTH * 1.6, root, baseVel + 8);
          for (const s of slots) {
            if (s === 0) continue;
            if (!chance(rng, 0.28 + settings.rhythmicDensity * 0.03)) continue;
            const t = bar * BAR_TICKS + s * SIXTEENTH;
            if (t < ch.start || t + SIXTEENTH > end) continue;
            const ghost = chance(rng, 0.35);
            const p = chance(rng, 0.3) ? octave : chance(rng, 0.2) ? fifth : root;
            push(t, SIXTEENTH * 0.8, p, ghost ? baseVel - 28 : baseVel);
          }
        }
        break;
      }
      case 'reggaeDrop': {
        // skip beat 1 - weight on 2 and 3
        for (let bar = Math.floor(ch.start / BAR_TICKS); bar * BAR_TICKS < end; bar++) {
          const b = bar * BAR_TICKS;
          if (b + PPQ >= ch.start && b + PPQ < end) push(b + PPQ, PPQ * 0.9, root, baseVel + 4);
          if (b + PPQ * 2 >= ch.start && b + PPQ * 2 < end) push(b + PPQ * 2, PPQ * 0.9, chance(rng, 0.4) ? fifth : root, baseVel);
          if (chance(rng, 0.5) && b + PPQ * 3.5 + EIGHTH <= end) push(b + PPQ * 3.5, EIGHTH * 0.8, root, baseVel - 8);
        }
        break;
      }
      case 'tumbao': {
        // latin tumbao: short root on 1, anticipation on and-of-2 held, next-root anticipation on 4
        for (let bar = Math.floor(ch.start / BAR_TICKS); bar * BAR_TICKS < end; bar++) {
          const b = bar * BAR_TICKS;
          if (b >= ch.start) push(b, EIGHTH * 0.7, root, baseVel);
          const t2 = b + PPQ * 1.5;
          if (t2 >= ch.start && t2 < end) push(t2, PPQ * 1.5 - 30, chance(rng, 0.3) ? fifth : root, baseVel + 4);
          const t4 = b + PPQ * 3;
          const isLastBarOfChord = end - b <= BAR_TICKS;
          if (t4 < end) push(t4, PPQ - 30, isLastBarOfChord && next ? nextRoot : root, baseVel - 2);
        }
        break;
      }
      default: {
        push(ch.start, ch.dur - 30, root, baseVel);
      }
    }

    // approach note into the next chord (complexity >= 4, most styles)
    if (useApproach && next && !['trap808', 'walk', 'tumbao', 'whole'].includes(style) && chance(rng, 0.4)) {
      const t = end - EIGHTH;
      const dir = chance(rng, 0.5) ? 1 : -1;
      const appr = chance(rng, 0.5) ? nextRoot - dir : stepInScale(nextRoot, -dir, harmony.keyPc, harmony.scaleId);
      // replace anything at that slot
      for (let k = notes.length - 1; k >= 0; k--) {
        if (notes[k].start >= t) notes.splice(k, 1);
        else if (notes[k].start + notes[k].dur > t) notes[k].dur = t - notes[k].start;
      }
      notes.push({ start: t, dur: EIGHTH * 0.85, pitch: fitToRange(appr, lo, hi + 4), vel: baseVel - 6 });
    }
  }

  const clipped = notes
    .filter((n) => n.start >= 0 && n.start < TOTAL_TICKS)
    .map((n) => ({ ...n, dur: Math.max(40, Math.min(n.dur, TOTAL_TICKS - n.start)), pitch: clamp(n.pitch, 0, 127), vel: clamp(Math.round(n.vel), 1, 127) }));
  clipped.sort((a, b) => a.start - b.start);
  return { notes: clipped, style };
}
