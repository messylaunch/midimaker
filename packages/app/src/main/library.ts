/**
 * Library manager: owns the MIDI-Library folder on disk.
 * Every pack is a real folder with four real .mid files + metadata.json -
 * that is what makes OS-native drag-and-drop into FL Studio work.
 */

import fs from 'fs';
import path from 'path';
import { parseMidi, scaleByName, type PackMetadata, type PartName } from '@midimaker/engine';
import type { PackNotes, PackRecord, ImportResult } from '../shared/types';
import { all, get, run } from './db';

export const PART_FILE_NAMES: Record<PartName, string> = {
  chords: 'Chords.mid',
  melody: 'Melody.mid',
  counterMelody: 'CounterMelody.mid',
  bass: 'Bass.mid',
};

let libraryRoot = '';

export function setLibraryRoot(dir: string): void {
  libraryRoot = dir;
  fs.mkdirSync(libraryRoot, { recursive: true });
}

export function getLibraryRoot(): string {
  return libraryRoot;
}

export function packDir(packId: string): string {
  const row = get<{ dirName: string }>('SELECT dirName FROM packs WHERE packId = ?', [packId]);
  if (!row) throw new Error(`Unknown pack: ${packId}`);
  return path.join(libraryRoot, row.dirName);
}

/* ---------------- scanning ---------------- */

/** Sync the DB index with the folders on disk. */
export function scanLibrary(): void {
  const seen = new Set<string>();
  if (!fs.existsSync(libraryRoot)) return;
  for (const entry of fs.readdirSync(libraryRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(libraryRoot, entry.name);
    const metaFile = path.join(dir, 'metadata.json');
    if (!fs.existsSync(metaFile)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as PackMetadata;
      if (!meta.packId) continue;
      seen.add(meta.packId);
      upsertPack(meta, entry.name);
    } catch (e) {
      console.warn(`Skipping ${entry.name}: bad metadata.json`, e);
    }
  }
  // drop index rows whose folders vanished
  for (const row of all<{ packId: string }>('SELECT packId FROM packs')) {
    if (!seen.has(row.packId)) run('DELETE FROM packs WHERE packId = ?', [row.packId]);
  }
}

export function upsertPack(meta: PackMetadata, dirName: string): void {
  const parts = Object.values(meta.parts ?? {}).length
    ? Object.keys(meta.parts)
    : ['chords', 'melody', 'counterMelody', 'bass'];
  run(
    `INSERT INTO packs (packId, dirName, name, genre, mood, bpm, key, scale, timeSignature, bars,
       energy, complexity, rhythmicDensity, experimentalAmount, era, generationMethod, seed,
       progression, phrasePlan, noteDensity, createdAt, parts)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(packId) DO UPDATE SET
       dirName=excluded.dirName, name=excluded.name, genre=excluded.genre, mood=excluded.mood,
       bpm=excluded.bpm, key=excluded.key, scale=excluded.scale, timeSignature=excluded.timeSignature,
       bars=excluded.bars, energy=excluded.energy, complexity=excluded.complexity,
       rhythmicDensity=excluded.rhythmicDensity, experimentalAmount=excluded.experimentalAmount,
       era=excluded.era, generationMethod=excluded.generationMethod, seed=excluded.seed,
       progression=excluded.progression, phrasePlan=excluded.phrasePlan,
       noteDensity=excluded.noteDensity, parts=excluded.parts`,
    [
      meta.packId, dirName, meta.name, meta.genre ?? '', meta.mood ?? '', meta.bpm ?? 0,
      meta.key ?? '', meta.scale ?? '', meta.timeSignature ?? '4/4', meta.bars ?? 8,
      meta.energy ?? 5, meta.complexity ?? 5, meta.rhythmicDensity ?? 5,
      meta.experimentalAmount ?? 2, JSON.stringify(meta.eraInspiration ?? []),
      meta.generationMethod ?? 'unknown', meta.seed ?? 0,
      meta.progression ?? '', meta.phrasePlan ?? '', meta.noteDensity ?? 0,
      meta.createdAt ?? new Date().toISOString(), JSON.stringify(parts),
    ]
  );
}

/* ---------------- listing ---------------- */

interface PackRow {
  packId: string; dirName: string; name: string; genre: string; mood: string;
  bpm: number; key: string; scale: string; timeSignature: string; bars: number;
  energy: number; complexity: number; rhythmicDensity: number; experimentalAmount: number;
  era: string; generationMethod: string; seed: number; progression: string;
  phrasePlan: string; noteDensity: number; createdAt: string; favorite: number;
  rating: number; lastUsedAt: string | null; parts: string;
}

export function listPacks(): PackRecord[] {
  return all<PackRow>('SELECT * FROM packs ORDER BY createdAt DESC').map(rowToRecord);
}

export function getPack(packId: string): PackRecord {
  const row = get<PackRow>('SELECT * FROM packs WHERE packId = ?', [packId]);
  if (!row) throw new Error(`Unknown pack: ${packId}`);
  return rowToRecord(row);
}

function rowToRecord(r: PackRow): PackRecord {
  return {
    packId: r.packId,
    dirName: r.dirName,
    name: r.name,
    genre: r.genre,
    mood: r.mood,
    bpm: r.bpm,
    key: r.key,
    scale: r.scale,
    timeSignature: r.timeSignature,
    bars: r.bars,
    energy: r.energy,
    complexity: r.complexity,
    rhythmicDensity: r.rhythmicDensity,
    experimentalAmount: r.experimentalAmount,
    eraInspiration: safeJson(r.era, []),
    generationMethod: r.generationMethod,
    seed: r.seed,
    progression: r.progression || undefined,
    phrasePlan: r.phrasePlan || undefined,
    noteDensity: r.noteDensity || undefined,
    createdAt: r.createdAt,
    favorite: !!r.favorite,
    rating: r.rating,
    lastUsedAt: r.lastUsedAt ?? undefined,
    parts: safeJson(r.parts, ['chords', 'melody', 'counterMelody', 'bass']),
  };
}

function safeJson<T>(s: string, dflt: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return dflt;
  }
}

/* ---------------- mutations ---------------- */

export function deletePack(packId: string): void {
  const dir = packDir(packId);
  fs.rmSync(dir, { recursive: true, force: true });
  run('DELETE FROM packs WHERE packId = ?', [packId]);
  run('DELETE FROM collection_packs WHERE packId = ?', [packId]);
}

export function renamePack(packId: string, newName: string): PackRecord {
  updateMetadataFile(packId, { name: newName });
  run('UPDATE packs SET name = ? WHERE packId = ?', [newName, packId]);
  return getPack(packId);
}

export function updateMeta(packId: string, patch: Partial<PackRecord>): PackRecord {
  const allowed: (keyof PackRecord)[] = [
    'name', 'genre', 'mood', 'bpm', 'key', 'scale', 'energy', 'complexity',
    'rhythmicDensity', 'experimentalAmount', 'eraInspiration',
  ];
  const metaPatch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) metaPatch[k === 'eraInspiration' ? 'eraInspiration' : k] = patch[k];
  }
  updateMetadataFile(packId, metaPatch);
  const current = getPack(packId);
  const merged = { ...current, ...patch };
  run(
    `UPDATE packs SET name=?, genre=?, mood=?, bpm=?, key=?, scale=?, energy=?, complexity=?,
     rhythmicDensity=?, experimentalAmount=?, era=? WHERE packId=?`,
    [
      merged.name, merged.genre, merged.mood, merged.bpm, merged.key, merged.scale,
      merged.energy, merged.complexity, merged.rhythmicDensity, merged.experimentalAmount,
      JSON.stringify(merged.eraInspiration), packId,
    ]
  );
  return getPack(packId);
}

function updateMetadataFile(packId: string, patch: Record<string, unknown>): void {
  const dir = packDir(packId);
  const file = path.join(dir, 'metadata.json');
  const meta = JSON.parse(fs.readFileSync(file, 'utf-8'));
  Object.assign(meta, patch);
  fs.writeFileSync(file, JSON.stringify(meta, null, 2));
}

export function setFavorite(packId: string, fav: boolean): void {
  run('UPDATE packs SET favorite = ? WHERE packId = ?', [fav ? 1 : 0, packId]);
}

export function setRating(packId: string, rating: number): void {
  run('UPDATE packs SET rating = ? WHERE packId = ?', [Math.max(0, Math.min(5, rating)), packId]);
}

export function markUsed(packId: string): void {
  run('UPDATE packs SET lastUsedAt = ? WHERE packId = ?', [new Date().toISOString(), packId]);
}

/* ---------------- files / export / import ---------------- */

export function partFilePath(packId: string, part: PartName): string {
  return path.join(packDir(packId), PART_FILE_NAMES[part]);
}

export function exportParts(packId: string, parts: PartName[], destDir: string): void {
  const record = getPack(packId);
  for (const part of parts) {
    const src = partFilePath(packId, part);
    const dst = path.join(destDir, `${sanitize(record.name)} - ${PART_FILE_NAMES[part]}`);
    fs.copyFileSync(src, dst);
  }
  markUsed(packId);
}

export function exportPack(packId: string, destDir: string): string {
  const record = getPack(packId);
  const target = path.join(destDir, sanitize(record.name));
  fs.mkdirSync(target, { recursive: true });
  const src = packDir(packId);
  for (const f of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, f), path.join(target, f));
  }
  markUsed(packId);
  return target;
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Pack';
}

/** Parse the pack's real MIDI files for the preview player. */
export function packNotes(packId: string): PackNotes {
  const dir = packDir(packId);
  const record = getPack(packId);
  const parts = {} as PackNotes['parts'];
  let bpm = record.bpm || 120;
  for (const part of Object.keys(PART_FILE_NAMES) as PartName[]) {
    const file = path.join(dir, PART_FILE_NAMES[part]);
    if (!fs.existsSync(file)) {
      parts[part] = [];
      continue;
    }
    const midi = parseMidi(new Uint8Array(fs.readFileSync(file)));
    // merge all tracks (imported files may be format 1)
    const notes = midi.tracks.flatMap((t) => t.notes);
    // rescale foreign PPQs to our 480 grid
    const scaleF = midi.ppq !== 480 ? 480 / midi.ppq : 1;
    parts[part] = notes.map((n) => ({
      start: Math.round(n.start * scaleF),
      dur: Math.round(n.dur * scaleF),
      pitch: n.pitch,
      vel: n.vel,
    }));
    if (midi.bpm) bpm = midi.bpm;
  }
  return { bpm, parts };
}

/**
 * Import packs from a user folder. Two shapes are supported:
 *  - folders containing Chords/Melody/CounterMelody/Bass .mid (+ optional metadata.json)
 *  - loose .mid files (each becomes a single-part pack under its own folder)
 */
export function importFolder(srcDir: string): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  const packDirs = entries.filter((e) => e.isDirectory());
  for (const e of packDirs) {
    try {
      const src = path.join(srcDir, e.name);
      const files = fs.readdirSync(src);
      const midFiles = files.filter((f) => f.toLowerCase().endsWith('.mid'));
      if (midFiles.length === 0) {
        result.skipped++;
        continue;
      }
      const id = nextImportId();
      const dirName = id;
      const dst = path.join(libraryRoot, dirName);
      fs.mkdirSync(dst, { recursive: true });

      // map files onto the canonical four names where possible
      const mapping: Record<string, string> = {};
      for (const part of Object.values(PART_FILE_NAMES)) {
        const found = midFiles.find((f) => f.toLowerCase() === part.toLowerCase());
        if (found) mapping[found] = part;
      }
      let idx = 0;
      for (const f of midFiles) {
        const target = mapping[f] ?? f;
        fs.copyFileSync(path.join(src, f), path.join(dst, target));
        idx++;
      }

      let meta: PackMetadata;
      const metaFile = path.join(src, 'metadata.json');
      if (fs.existsSync(metaFile)) {
        meta = { ...(JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as PackMetadata), packId: id };
      } else {
        meta = inferMetadata(id, e.name, dst);
      }
      fs.writeFileSync(path.join(dst, 'metadata.json'), JSON.stringify(meta, null, 2));
      upsertPack(meta, dirName);
      result.imported++;
    } catch (err) {
      result.errors.push(`${e.name}: ${(err as Error).message}`);
    }
  }

  // loose .mid files -> single-part packs
  const looseMids = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.mid'));
  for (const e of looseMids) {
    try {
      const id = nextImportId();
      const dst = path.join(libraryRoot, id);
      fs.mkdirSync(dst, { recursive: true });
      fs.copyFileSync(path.join(srcDir, e.name), path.join(dst, e.name));
      const meta = inferMetadata(id, e.name.replace(/\.mid$/i, ''), dst);
      fs.writeFileSync(path.join(dst, 'metadata.json'), JSON.stringify(meta, null, 2));
      upsertPack(meta, id);
      result.imported++;
    } catch (err) {
      result.errors.push(`${e.name}: ${(err as Error).message}`);
    }
  }
  return result;
}

function inferMetadata(packId: string, name: string, dir: string): PackMetadata {
  // read tempo from the first parseable midi file
  let bpm = 120;
  let bars = 8;
  const partsMap: Record<string, string> = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.mid')) continue;
    const canonical = (Object.entries(PART_FILE_NAMES) as [PartName, string][]).find(
      ([, v]) => v.toLowerCase() === f.toLowerCase()
    );
    partsMap[canonical ? canonical[0] : f] = f;
    try {
      const midi = parseMidi(new Uint8Array(fs.readFileSync(path.join(dir, f))));
      if (midi.bpm) bpm = Math.round(midi.bpm);
      const barTicks = midi.ppq * 4;
      bars = Math.max(1, Math.round(midi.totalTicks / barTicks));
    } catch {
      /* keep defaults */
    }
  }
  return {
    packId,
    name,
    genre: 'imported',
    mood: 'unknown',
    bpm,
    key: 'C',
    scale: 'Major',
    timeSignature: '4/4',
    bars,
    energy: 5,
    complexity: 5,
    rhythmicDensity: 5,
    experimentalAmount: 2,
    eraInspiration: [],
    generationMethod: 'imported',
    seed: 0,
    createdAt: new Date().toISOString(),
    parts: partsMap,
  };
}

let importCounter = 0;
function nextImportId(): string {
  importCounter++;
  return `import-${Date.now().toString(36)}-${importCounter}`;
}

/** Resolve the engine scale id from a display name stored in metadata. */
export function scaleIdFromName(name: string): string {
  try {
    return scaleByName(name).id;
  } catch {
    return 'major';
  }
}
