/**
 * Core types for the MIDI generation engine.
 *
 * The engine is pure TypeScript with no Node/Electron/DOM dependencies so it
 * can later be ported into a JUCE VST3 plugin (see ENGINE.md).
 *
 * All time values are in MIDI ticks at PPQ = 480.
 * A bar of 4/4 = 1920 ticks. Eight bars = 15360 ticks exactly.
 */

export const PPQ = 480;
export const BEATS_PER_BAR = 4;
export const BAR_TICKS = PPQ * BEATS_PER_BAR; // 1920
export const TOTAL_BARS = 8;
export const TOTAL_TICKS = BAR_TICKS * TOTAL_BARS; // 15360
export const SIXTEENTH = PPQ / 4; // 120

export type PartName = 'chords' | 'melody' | 'counterMelody' | 'bass';
export const PART_NAMES: PartName[] = ['chords', 'melody', 'counterMelody', 'bass'];

/** A single note. start/dur in ticks, pitch 0-127, vel 1-127. */
export interface NoteEvent {
  start: number;
  dur: number;
  pitch: number;
  vel: number;
}

export type FamiliarityMode = 'familiar' | 'balanced' | 'experimental';

/** Every knob the generator understands. All randomness derives from `seed`. */
export interface PackSettings {
  seed: number;
  genre: string; // profile id, e.g. 'trap'
  mood: string; // mood id, e.g. 'dark'
  bpm: number;
  key: string; // 'C', 'C#', 'D', ... 'B'
  scale: string; // scale id, e.g. 'naturalMinor'
  energy: number; // 1-10
  complexity: number; // 1-10
  rhythmicDensity: number; // 1-10
  melodicMovement: number; // 1-10
  chordComplexity: number; // 1-10
  experimental: number; // 1-10
  syncopation: number; // 1-10
  noteLength: number; // 1-10 (1 = short/staccato bias, 10 = long/sustained bias)
  humanize: number; // 0-10
  familiarity: FamiliarityMode;
  era?: string[];
  /**
   * Optional forced progression (roman tokens, one per bar, cycled to 8
   * bars). Used by Song Drop's "close to the song" mode to reuse the chords
   * actually heard in a dropped track instead of drawing from genre pools.
   */
  progressionOverride?: string[];
}

/** Fingerprint used by the duplicate-detection engine. */
export interface PackSignature {
  /** Melody onsets on the 16th grid across 8 bars, as a hex string (128 bits). */
  rhythm: string;
  /** Successive melodic intervals in semitones. */
  intervals: number[];
  /** Melodic contour: U(p) / D(own) / R(epeat). */
  contour: string;
  /** Melody notes per bar (8 entries). */
  density: number[];
  /** Chord progression as roman numerals, joined with '-'. */
  progression: string;
  /** Classified bass movement style. */
  bassStyle: string;
  /** Phrase plan id used for the melody. */
  phrasePlan: string;
}

export interface GeneratedPack {
  settings: PackSettings;
  parts: Record<PartName, NoteEvent[]>;
  /** Roman numerals of the underlying progression (one entry per chord change). */
  progression: string[];
  phrasePlan: string;
  bassStyle: string;
  chordStyle: string;
  signature: PackSignature;
}

/** Chord placed on the timeline. */
export interface ChordEvent {
  start: number; // ticks
  dur: number; // ticks
  rootPc: number; // 0-11 pitch class
  /** intervals from root in semitones, e.g. [0,4,7] for a major triad */
  intervals: number[];
  roman: string;
  /** voiced pitches used by the chords part (also consulted by other parts) */
  voicing: number[];
}

export interface PackMetadata {
  packId: string;
  name: string;
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  scale: string;
  timeSignature: string;
  bars: number;
  energy: number;
  complexity: number;
  rhythmicDensity: number;
  experimentalAmount: number;
  eraInspiration: string[];
  generationMethod: string;
  seed: number;
  createdAt?: string;
  progression?: string;
  phrasePlan?: string;
  noteDensity?: number;
  parts: Record<string, string>;
}
