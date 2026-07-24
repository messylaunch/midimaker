/**
 * Rule-profile schema for the knowledge system.
 *
 * Profiles are generalized statistical/structural descriptions of genres,
 * moods and eras (phrase lengths, rhythmic density, chord functions, bass
 * movement styles, register ranges...). They contain NO copied melodies -
 * only weighted tendencies. All stored as editable JSON so more preset
 * libraries can be added later without touching engine code.
 */

/** [value, weight] tuple as stored in JSON. */
export type Weighted<T> = [T, number];

export interface ProgressionPool {
  established: string[][];
  variation: string[][];
  surprise: string[][];
}

export interface GenreProfile {
  id: string;
  name: string;
  bpmRange: [number, number];
  eras: string[];
  /** swing amount 0..0.5 applied to offbeat 16ths */
  swing: number;
  scales: Weighted<string>[];
  /** bars-per-chord patterns, cycled until 8 bars are filled */
  harmonicRhythms: Weighted<number[]>[];
  progressions: {
    major?: ProgressionPool;
    minor?: ProgressionPool;
  };
  chords: {
    range: [number, number];
    styles: Weighted<string>[];
  };
  bass: {
    range: [number, number];
    styles: Weighted<string>[];
  };
  melody: {
    range: [number, number];
    /** target fraction of silence in the melody (0-1) */
    restRatio: number;
    /** onsets per bar at rhythmicDensity = 5 */
    baseDensity: number;
    /** 0-1 baseline tendency toward offbeat placement */
    syncopation: number;
    phrasePlans: Weighted<string>[];
    contours: Weighted<string>[];
  };
  counter: {
    range: [number, number];
    styles: Weighted<string>[];
  };
}

export interface MoodProfile {
  id: string;
  name: string;
  /** 'minor' | 'major' | 'any' - which tonality the mood prefers */
  tonality: 'minor' | 'major' | 'any';
  /** extra weight multipliers for specific scales */
  scaleBoost: Record<string, number>;
  /** -3..+3 added to effective rhythmic density */
  densityDelta: number;
  /** -20..+20 added to base velocity */
  velocityDelta: number;
  /** semitone shift applied to melody/counter register centers */
  registerDelta: number;
  /** multiplier on chord extension probability */
  extensionBias: number;
  /** -2..+2 nudge to energy behaviour */
  energyDelta: number;
}

export interface EraProfile {
  id: string;
  name: string;
  bpmNudge: number;
  humanizeNudge: number;
}
