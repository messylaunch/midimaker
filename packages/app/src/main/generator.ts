/**
 * Generator service: runs the engine, writes real files into the library and
 * indexes the new pack. Also handles "regenerate one part" - the other three
 * parts stay byte-identical thanks to per-part seed streams in the engine.
 */

import fs from 'fs';
import path from 'path';
import {
  generatePack, packToMidiFiles, packMetadata, generatePackName, validatePackFiles,
  scaleById, isNearDuplicate, computeSignature,
  type PackSettings, type PartName, type PackSignature,
} from '@midimaker/engine';
import type { PackRecord } from '../shared/types';
import { getLibraryRoot, getPack, upsertPack, packDir, PART_FILE_NAMES, scaleIdFromName } from './library';
import { all, run } from './db';

/** Signatures of recent generations, used to reject near-duplicates live. */
const recentSignatures: PackSignature[] = [];
const MAX_RECENT = 400;

let genCounter = 0;

export function generateAndSave(settings: PackSettings): PackRecord {
  // try a few seeds if the duplicate detector complains
  let pack = generatePack(settings);
  let attempts = 0;
  while (attempts < 5 && recentSignatures.some((s) => isNearDuplicate(pack.signature, s))) {
    settings = { ...settings, seed: (settings.seed + 7919 * (attempts + 1)) >>> 0 };
    pack = generatePack(settings);
    attempts++;
  }

  const files = packToMidiFiles(pack);
  const scaleName = scaleById(settings.scale).name;
  const validation = validatePackFiles(files, {
    bpm: settings.bpm,
    key: settings.key,
    scale: settings.scale,
    experimental: settings.experimental,
    progression: pack.progression.join('-'),
  });
  if (!validation.ok) {
    throw new Error(`Generated pack failed validation: ${validation.errors.join('; ')}`);
  }

  genCounter++;
  const packId = `gen-${Date.now().toString(36)}-${genCounter}`;
  const dirName = packId;
  const dir = path.join(getLibraryRoot(), dirName);
  fs.mkdirSync(dir, { recursive: true });
  for (const part of Object.keys(files) as PartName[]) {
    fs.writeFileSync(path.join(dir, PART_FILE_NAMES[part]), Buffer.from(files[part]));
  }

  const name = generatePackName(settings.seed, settings.mood, countPacks() + 1);
  const meta = packMetadata(pack, packId, name, scaleName);
  meta.createdAt = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta, null, 2));
  upsertPack(meta, dirName);

  recentSignatures.push(pack.signature);
  if (recentSignatures.length > MAX_RECENT) recentSignatures.shift();
  return getPack(packId);
}

export function regeneratePart(packId: string, part: PartName): PackRecord {
  const record = getPack(packId);
  if (record.generationMethod === 'imported') {
    throw new Error('Cannot regenerate parts of an imported pack');
  }
  const dir = packDir(packId);
  const metaFile = path.join(dir, 'metadata.json');
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));

  const settings: PackSettings = {
    seed: record.seed,
    genre: record.genre,
    mood: record.mood,
    bpm: record.bpm,
    key: record.key,
    scale: scaleIdFromName(record.scale),
    energy: record.energy,
    complexity: record.complexity,
    rhythmicDensity: record.rhythmicDensity,
    melodicMovement: meta.melodicMovement ?? 5,
    chordComplexity: meta.chordComplexity ?? 4,
    experimental: record.experimentalAmount,
    syncopation: meta.syncopation ?? 5,
    noteLength: meta.noteLength ?? 5,
    humanize: meta.humanize ?? 3,
    familiarity: meta.familiarity ?? 'balanced',
    era: record.eraInspiration,
  };

  const prevPartSeeds = (meta.partSeeds ?? {}) as Partial<Record<PartName, number>>;
  const partSeeds = { ...prevPartSeeds, [part]: ((prevPartSeeds[part] ?? 0) + 1) | 0 };
  const pack = generatePack(settings, partSeeds);
  const files = packToMidiFiles(pack);

  // overwrite only the regenerated part's file
  fs.writeFileSync(path.join(dir, PART_FILE_NAMES[part]), Buffer.from(files[part]));
  meta.partSeeds = partSeeds;
  meta.progression = pack.progression.join('-');
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  run('UPDATE packs SET progression = ? WHERE packId = ?', [meta.progression, packId]);
  return getPack(packId);
}

function countPacks(): number {
  return (all<{ n: number }>('SELECT COUNT(*) AS n FROM packs')[0]?.n as number) ?? 0;
}
