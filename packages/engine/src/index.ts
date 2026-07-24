/**
 * @midimaker/engine - public API.
 * See ENGINE.md for the input/output contract (kept stable for the future
 * JUCE VST3 port).
 */

export * from './types.js';
export * from './rng.js';
export * from './theory/notes.js';
export * from './theory/scales.js';
export * from './theory/chords.js';
export * from './profiles/index.js';
export * from './midi/writer.js';
export * from './midi/parser.js';
export * from './generate/harmony.js';
export * from './generate/pack.js';
export * from './dedup/signature.js';
export * from './validate.js';
export * from './naming.js';

import { writeMidi } from './midi/writer.js';
import type { GeneratedPack, PackMetadata, PartName } from './types.js';

export const PART_FILES: Record<PartName, string> = {
  chords: 'Chords.mid',
  melody: 'Melody.mid',
  counterMelody: 'CounterMelody.mid',
  bass: 'Bass.mid',
};

const PART_PROGRAMS: Record<PartName, number> = {
  chords: 4, // electric piano
  melody: 80, // square lead
  counterMelody: 81, // saw lead
  bass: 38, // synth bass
};

/** Render all four parts of a generated pack to MIDI bytes. */
export function packToMidiFiles(pack: GeneratedPack): Record<PartName, Uint8Array> {
  const out = {} as Record<PartName, Uint8Array>;
  (Object.keys(PART_FILES) as PartName[]).forEach((part, i) => {
    out[part] = writeMidi(pack.parts[part], {
      bpm: pack.settings.bpm,
      trackName: PART_FILES[part].replace('.mid', ''),
      program: PART_PROGRAMS[part],
      channel: i,
    });
  });
  return out;
}

/** Build the metadata.json contents for a generated pack. */
export function packMetadata(pack: GeneratedPack, packId: string, name: string, scaleName: string): PackMetadata {
  const s = pack.settings;
  const totalNotes = Object.values(pack.parts).reduce((n, p) => n + p.length, 0);
  return {
    packId,
    name,
    genre: s.genre,
    mood: s.mood,
    bpm: s.bpm,
    key: s.key,
    scale: scaleName,
    timeSignature: '4/4',
    bars: 8,
    energy: s.energy,
    complexity: s.complexity,
    rhythmicDensity: s.rhythmicDensity,
    experimentalAmount: s.experimental,
    eraInspiration: s.era ?? [],
    generationMethod: 'controlled-procedural',
    seed: s.seed,
    progression: pack.progression.join('-'),
    phrasePlan: pack.phrasePlan,
    noteDensity: Math.round((totalNotes / 8) * 10) / 10,
    parts: {
      chords: 'Chords.mid',
      melody: 'Melody.mid',
      counterMelody: 'CounterMelody.mid',
      bass: 'Bass.mid',
    },
  };
}
