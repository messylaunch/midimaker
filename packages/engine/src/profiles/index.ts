/** Profile loader: bundles the built-in JSON knowledge base. */

import type { EraProfile, GenreProfile, MoodProfile, ProgressionPool } from './types.js';
import genresJson from './genres.json';
import moodsJson from './moods.json';
import erasJson from './eras.json';
import defaultsJson from './defaults.json';

export * from './types.js';

export const GENRES: GenreProfile[] = genresJson as unknown as GenreProfile[];
export const MOODS: MoodProfile[] = moodsJson as unknown as MoodProfile[];
export const ERAS: EraProfile[] = erasJson as unknown as EraProfile[];

const DEFAULT_POOLS = defaultsJson as unknown as { major: ProgressionPool; minor: ProgressionPool };

export function genreById(id: string): GenreProfile {
  const g = GENRES.find((g) => g.id === id);
  if (!g) throw new Error(`Unknown genre profile: ${id}`);
  return g;
}

export function moodById(id: string): MoodProfile {
  const m = MOODS.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown mood profile: ${id}`);
  return m;
}

export function eraById(id: string): EraProfile | undefined {
  return ERAS.find((e) => e.id === id);
}

/** Progression pool for a genre + tonality, falling back to the shared defaults. */
export function progressionPool(genre: GenreProfile, minor: boolean): ProgressionPool {
  const pool = minor ? genre.progressions.minor : genre.progressions.major;
  return pool ?? (minor ? DEFAULT_POOLS.minor : DEFAULT_POOLS.major);
}
