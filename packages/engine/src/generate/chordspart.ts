/**
 * Renders the Chords part (NoteEvents) from the harmony timeline using a
 * genre-weighted rhythm style. Styles are intentionally simple, idiomatic
 * comping patterns - not random note spam.
 */

import { BAR_TICKS, PPQ, SIXTEENTH, TOTAL_TICKS, type NoteEvent, type PackSettings } from '../types.js';
import type { GenreProfile, MoodProfile } from '../profiles/index.js';
import { chance, clamp, weightedPick, type Rng } from '../rng.js';
import type { HarmonyContext } from './harmony.js';

const EIGHTH = PPQ / 2;
const RELEASE_GAP = 20; // small gap so repeated chords re-trigger cleanly

export function renderChordsPart(
  harmony: HarmonyContext,
  settings: PackSettings,
  genre: GenreProfile,
  mood: MoodProfile,
  rng: Rng
): { notes: NoteEvent[]; style: string } {
  const style = weightedPick(
    rng,
    genre.chords.styles.map(([s]) => s),
    genre.chords.styles.map(([, w]) => w)
  );
  const baseVel = clamp(70 + mood.velocityDelta + (settings.energy - 5) * 3, 30, 115);
  const notes: NoteEvent[] = [];

  // seeded per-pack patterns reused across bars for consistency
  const pluckPattern = makeOnsetPattern(rng, 8, 3 + Math.round(settings.rhythmicDensity / 3), 0.35);
  const funkPattern = makeOnsetPattern(rng, 16, 4 + Math.round(settings.rhythmicDensity / 2), 0.6);

  for (const ch of harmony.chords) {
    const end = ch.start + ch.dur;
    switch (style) {
      case 'sustain': {
        for (const p of ch.voicing) notes.push({ start: ch.start, dur: ch.dur - RELEASE_GAP, pitch: p, vel: baseVel });
        break;
      }
      case 'pad': {
        // re-attack at each bar boundary within the chord
        for (let t = ch.start; t < end; t = nextBar(t)) {
          const segEnd = Math.min(nextBar(t), end);
          for (const p of ch.voicing) notes.push({ start: t, dur: segEnd - t - RELEASE_GAP, pitch: p, vel: baseVel - 4 });
        }
        break;
      }
      case 'pulse4': {
        for (let t = ch.start; t + PPQ <= end + 1; t += PPQ) {
          const accent = Math.round((t - ch.start) / PPQ) % 2 === 0 ? 4 : -4;
          for (const p of ch.voicing) notes.push({ start: t, dur: PPQ * 0.85, pitch: p, vel: baseVel + accent });
        }
        break;
      }
      case 'pulse8': {
        for (let t = ch.start; t + EIGHTH <= end + 1; t += EIGHTH) {
          const onBeat = Math.round((t - ch.start) / EIGHTH) % 2 === 0;
          for (const p of ch.voicing) notes.push({ start: t, dur: EIGHTH * 0.8, pitch: p, vel: baseVel + (onBeat ? 4 : -6) });
        }
        break;
      }
      case 'stabsOffbeat': {
        for (let t = ch.start + EIGHTH; t < end; t += PPQ) {
          for (const p of ch.voicing) notes.push({ start: t, dur: EIGHTH * 0.55, pitch: p, vel: baseVel + 4 });
        }
        break;
      }
      case 'stabs24': {
        for (let bar = barOf(ch.start); bar * BAR_TICKS < end; bar++) {
          for (const beat of [1, 3]) {
            const t = bar * BAR_TICKS + beat * PPQ;
            if (t >= ch.start && t < end) {
              for (const p of ch.voicing) notes.push({ start: t, dur: PPQ * 0.5, pitch: p, vel: baseVel + 6 });
            }
          }
        }
        break;
      }
      case 'skank': {
        for (let t = ch.start + EIGHTH; t < end; t += PPQ) {
          for (const p of ch.voicing) notes.push({ start: t, dur: EIGHTH * 0.35, pitch: p, vel: baseVel });
        }
        break;
      }
      case 'pluck8': {
        for (let bar = barOf(ch.start); bar * BAR_TICKS < end; bar++) {
          for (let s = 0; s < 8; s++) {
            if (!pluckPattern[s]) continue;
            const t = bar * BAR_TICKS + s * EIGHTH;
            if (t < ch.start || t >= end) continue;
            for (const p of ch.voicing) notes.push({ start: t, dur: EIGHTH * 0.7, pitch: p, vel: baseVel + (s % 2 === 0 ? 2 : -4) });
          }
        }
        break;
      }
      case 'funk16': {
        for (let bar = barOf(ch.start); bar * BAR_TICKS < end; bar++) {
          for (let s = 0; s < 16; s++) {
            if (!funkPattern[s]) continue;
            const t = bar * BAR_TICKS + s * SIXTEENTH;
            if (t < ch.start || t >= end) continue;
            const ghost = s % 4 !== 0 && chance(rng, 0.25);
            for (const p of ch.voicing) {
              notes.push({ start: t, dur: SIXTEENTH * 0.8, pitch: p, vel: ghost ? baseVel - 22 : baseVel + 6 });
            }
          }
        }
        break;
      }
      case 'arp8': {
        // arpeggiate the voicing in 8ths, up (and back down when it fits)
        const seq = [...ch.voicing, ...[...ch.voicing].reverse().slice(1, -1)];
        let idx = 0;
        for (let t = ch.start; t + EIGHTH <= end + 1; t += EIGHTH) {
          notes.push({ start: t, dur: EIGHTH * 0.9, pitch: seq[idx % seq.length], vel: baseVel - 2 + (idx % 2 === 0 ? 4 : 0) });
          idx++;
        }
        break;
      }
      default: {
        for (const p of ch.voicing) notes.push({ start: ch.start, dur: ch.dur - RELEASE_GAP, pitch: p, vel: baseVel });
      }
    }
  }

  // clip + sanity
  const clipped = notes
    .filter((n) => n.start >= 0 && n.start < TOTAL_TICKS)
    .map((n) => ({ ...n, dur: Math.max(40, Math.min(n.dur, TOTAL_TICKS - n.start)) }));
  return { notes: clipped, style };
}

function nextBar(t: number): number {
  return (Math.floor(t / BAR_TICKS) + 1) * BAR_TICKS;
}
function barOf(t: number): number {
  return Math.floor(t / BAR_TICKS);
}

/** Seeded boolean onset pattern of `slots` slots with roughly `count` onsets. */
function makeOnsetPattern(rng: Rng, slots: number, count: number, offbeatBias: number): boolean[] {
  const pattern = new Array<boolean>(slots).fill(false);
  pattern[0] = true;
  let placed = 1;
  let guard = 0;
  while (placed < Math.min(count, slots) && guard++ < 100) {
    const s = Math.floor(rng() * slots);
    if (pattern[s]) continue;
    const isOffbeat = slots === 8 ? s % 2 === 1 : s % 4 !== 0;
    if (isOffbeat && rng() > offbeatBias + 0.35) continue;
    pattern[s] = true;
    placed++;
  }
  return pattern;
}
