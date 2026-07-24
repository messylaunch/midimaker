/**
 * Pack validation: parses real MIDI bytes back and checks the musical
 * contract - exactly 8 bars, shared tempo/time signature, sane ranges,
 * scale membership, and low collision counts between melody and counter.
 */

import { PPQ, TOTAL_TICKS, type PartName, PART_NAMES } from './types.js';
import { parseMidi } from './midi/parser.js';
import { keyToPc } from './theory/notes.js';
import { inScale } from './theory/scales.js';
import { parseRoman } from './theory/chords.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExpectedMeta {
  bpm: number;
  key: string;
  scale: string;
  experimental?: number; // 1-10, raises allowed chromaticism
  /**
   * Progression roman numerals joined with '-' (as stored in metadata).
   * When provided, chord tones of the actual harmony (including borrowed
   * chords like bII or #ivdim) count as legal notes, not chromatic strays.
   */
  progression?: string;
}

export function validatePackFiles(
  files: Record<PartName, Uint8Array>,
  expected: ExpectedMeta
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const keyPc = keyToPc(expected.key);
  const parsed: Partial<Record<PartName, ReturnType<typeof parseMidi>>> = {};

  for (const part of PART_NAMES) {
    const bytes = files[part];
    if (!bytes || bytes.length === 0) {
      errors.push(`${part}: missing file`);
      continue;
    }
    try {
      const midi = parseMidi(bytes);
      parsed[part] = midi;
      if (midi.ppq !== PPQ) errors.push(`${part}: ppq ${midi.ppq} != ${PPQ}`);
      const eot = midi.tracks[0]?.endOfTrackTick ?? 0;
      if (eot !== TOTAL_TICKS) errors.push(`${part}: length ${eot} ticks != ${TOTAL_TICKS} (8 bars)`);
      if (midi.timeSignature !== '4/4') errors.push(`${part}: time signature ${midi.timeSignature} != 4/4`);
      if (midi.bpm === null || Math.abs(midi.bpm - expected.bpm) > 0.5) {
        errors.push(`${part}: bpm ${midi.bpm} != ${expected.bpm}`);
      }
      const notes = midi.tracks[0]?.notes ?? [];
      if (notes.length === 0) errors.push(`${part}: contains no notes`);
      for (const n of notes) {
        if (n.start < 0 || n.start + n.dur > TOTAL_TICKS + 1) {
          errors.push(`${part}: note outside 8 bars (start ${n.start}, dur ${n.dur})`);
          break;
        }
      }
    } catch (e) {
      errors.push(`${part}: parse failed - ${(e as Error).message}`);
    }
  }

  // legal pitch classes: the scale plus chord tones of the actual harmony
  // (borrowed chords are intentional, not random chromaticism)
  const harmonyPcs = new Set<number>();
  if (expected.progression) {
    for (const token of expected.progression.split('-')) {
      try {
        const ch = parseRoman(token, keyPc, expected.scale);
        for (const iv of ch.intervals) harmonyPcs.add((ch.rootPc + iv) % 12);
      } catch {
        // unknown token - ignore, scale membership still applies
      }
    }
  }
  const isLegal = (pc: number) => inScale(pc, keyPc, expected.scale) || harmonyPcs.has(pc);

  // chromatic tolerance (approach notes, neighbor tones) scales with experimental knob
  const allowedChromatic = 0.08 + (expected.experimental ?? 2) * 0.02;
  for (const part of ['melody', 'counterMelody', 'bass'] as PartName[]) {
    const midi = parsed[part];
    if (!midi) continue;
    const notes = midi.tracks[0]?.notes ?? [];
    if (notes.length === 0) continue;
    const illegal = notes.filter((n) => !isLegal(((n.pitch % 12) + 12) % 12)).length;
    const ratio = illegal / notes.length;
    if (ratio > allowedChromatic + 0.12) {
      errors.push(`${part}: ${(ratio * 100).toFixed(0)}% notes outside ${expected.key} ${expected.scale} + harmony`);
    } else if (ratio > allowedChromatic) {
      warnings.push(`${part}: ${(ratio * 100).toFixed(0)}% chromatic notes`);
    }
  }
  const chordsMidi = parsed.chords;
  if (chordsMidi) {
    const notes = chordsMidi.tracks[0]?.notes ?? [];
    if (notes.length > 0) {
      const illegal = notes.filter((n) => !isLegal(((n.pitch % 12) + 12) % 12)).length;
      if (illegal / notes.length > 0.2) {
        errors.push(`chords: ${((illegal / notes.length) * 100).toFixed(0)}% notes outside scale + harmony`);
      }
    }
  }

  // melody vs counter collision audit: simultaneous minor-2nd clashes
  const mel = parsed.melody?.tracks[0]?.notes ?? [];
  const ctr = parsed.counterMelody?.tracks[0]?.notes ?? [];
  let clashes = 0;
  for (const c of ctr) {
    for (const m of mel) {
      if (m.start < c.start + c.dur && m.start + m.dur > c.start) {
        const iv = Math.abs(((c.pitch - m.pitch) % 12 + 12) % 12);
        if (iv === 1 || iv === 11) clashes++;
      }
    }
  }
  if (clashes > 4) errors.push(`melody/counter: ${clashes} minor-2nd collisions`);
  else if (clashes > 2) warnings.push(`melody/counter: ${clashes} minor-2nd collisions`);

  return { ok: errors.length === 0, errors, warnings };
}
