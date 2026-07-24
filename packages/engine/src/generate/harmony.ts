/**
 * Harmony builder: picks a progression (familiarity-weighted), applies chord
 * complexity upgrades, lays chords on the 8-bar timeline with a genre
 * harmonic rhythm, and voice-leads the chord voicings.
 */

import { BAR_TICKS, PPQ, TOTAL_TICKS, type ChordEvent, type PackSettings } from '../types.js';
import { keyToPc } from '../theory/notes.js';
import { scaleById } from '../theory/scales.js';
import { parseRoman, upgradeToken, voiceLead } from '../theory/chords.js';
import { progressionPool, type GenreProfile } from '../profiles/index.js';
import { chance, pick, weightedIndex, weightedPick, type Rng } from '../rng.js';

export interface HarmonyContext {
  chords: ChordEvent[];
  progression: string[];
  keyPc: number;
  scaleId: string;
  minor: boolean;
}

const FAMILIARITY_WEIGHTS: Record<string, [number, number, number]> = {
  familiar: [0.8, 0.15, 0.05],
  balanced: [0.65, 0.25, 0.1],
  experimental: [0.5, 0.3, 0.2],
};

export function buildHarmony(settings: PackSettings, genre: GenreProfile, rng: Rng): HarmonyContext {
  const keyPc = keyToPc(settings.key);
  const scale = scaleById(settings.scale);

  // forced progression (Song Drop "close to the song"): one token per bar,
  // exactly as heard - no pool draw, no upgrades, no anticipation pushes
  if (settings.progressionOverride && settings.progressionOverride.length > 0) {
    const barTokens: string[] = [];
    for (let bar = 0; bar < 8; bar++) {
      barTokens.push(settings.progressionOverride[bar % settings.progressionOverride.length]);
    }
    const slots = barTokens
      .map((token, bar) => ({ token, start: bar * BAR_TICKS, dur: BAR_TICKS }))
      .filter((s) => {
        try {
          parseRoman(s.token, keyPc, settings.scale);
          return true;
        } catch {
          return false;
        }
      });
    if (slots.length > 0) {
      const merged: typeof slots = [];
      for (const s of slots) {
        const last = merged[merged.length - 1];
        if (last && last.token === s.token && last.start + last.dur === s.start) last.dur += s.dur;
        else merged.push({ ...s });
      }
      const parsed = merged.map((s) => parseRoman(s.token, keyPc, settings.scale));
      const [cLo, cHi] = genre.chords.range;
      const voicings = voiceLead(parsed, cLo, cHi);
      const events: ChordEvent[] = merged.map((s, idx) => ({
        start: s.start,
        dur: s.dur,
        rootPc: parsed[idx].rootPc,
        intervals: parsed[idx].intervals,
        roman: s.token,
        voicing: voicings[idx] ?? [],
      }));
      return {
        chords: events,
        progression: merged.map((s) => s.token),
        keyPc,
        scaleId: settings.scale,
        minor: scale.minor,
      };
    }
    // every override token failed to parse - fall through to normal path
  }

  const pool = progressionPool(genre, scale.minor);

  // familiarity + experimental knob decide which pool we draw from
  let [wEst, wVar, wSur] = FAMILIARITY_WEIGHTS[settings.familiarity] ?? FAMILIARITY_WEIGHTS.balanced;
  const expShift = ((settings.experimental - 1) / 9) * 0.15;
  wEst = Math.max(0.2, wEst - expShift);
  wSur += expShift;
  const category = (['established', 'variation', 'surprise'] as const)[weightedIndex(rng, [wEst, wVar, wSur])];
  const candidates = pool[category].length > 0 ? pool[category] : pool.established;
  let tokens = [...pick(rng, candidates)];

  // chord-complexity upgrades (7ths / 9ths / sus colors), keeping dominants dominant
  tokens = tokens.map((t) => {
    const degree = parseRoman(t, keyPc, settings.scale).degree;
    const isDominantish = degree === 5 && !t.startsWith('b') && !t.startsWith('#');
    return upgradeToken(t, settings.chordComplexity, isDominantish, rng);
  });

  // harmonic rhythm: bars-per-chord pattern cycled across 8 bars
  const hrPattern = weightedPick(
    rng,
    genre.harmonicRhythms.map(([p]) => p),
    genre.harmonicRhythms.map(([, w]) => w)
  );

  const slots: { token: string; start: number; dur: number }[] = [];
  let cursor = 0;
  let i = 0;
  while (cursor < TOTAL_TICKS - 1) {
    const bars = hrPattern[i % hrPattern.length];
    const dur = Math.round(bars * BAR_TICKS);
    const token = tokens[i % tokens.length];
    slots.push({ token, start: cursor, dur: Math.min(dur, TOTAL_TICKS - cursor) });
    cursor += dur;
    i++;
  }

  // merge immediate repeats of the same chord into one longer slot
  const merged: typeof slots = [];
  for (const s of slots) {
    const last = merged[merged.length - 1];
    if (last && last.token === s.token && last.start + last.dur === s.start) {
      last.dur += s.dur;
    } else {
      merged.push({ ...s });
    }
  }

  // anticipation pushes: at high syncopation, some chord changes arrive an 8th early
  if (settings.syncopation >= 7) {
    for (let k = 1; k < merged.length; k++) {
      if (chance(rng, 0.35)) {
        const push = PPQ / 2;
        if (merged[k - 1].dur > push * 2) {
          merged[k].start -= push;
          merged[k].dur += push;
          merged[k - 1].dur -= push;
        }
      }
    }
  }

  const parsed = merged.map((s) => parseRoman(s.token, keyPc, settings.scale));
  const [chLo, chHi] = genre.chords.range;
  const voicings = voiceLead(parsed, chLo, chHi);

  const events: ChordEvent[] = merged.map((s, idx) => ({
    start: s.start,
    dur: s.dur,
    rootPc: parsed[idx].rootPc,
    intervals: parsed[idx].intervals,
    roman: s.token,
    voicing: voicings[idx] ?? [],
  }));

  return { chords: events, progression: tokens, keyPc, scaleId: settings.scale, minor: scale.minor };
}

/** The chord sounding at a given tick (clamps to first/last). */
export function chordAt(harmony: HarmonyContext, tick: number): ChordEvent {
  const list = harmony.chords;
  for (let i = list.length - 1; i >= 0; i--) {
    if (tick >= list[i].start) return list[i];
  }
  return list[0];
}
