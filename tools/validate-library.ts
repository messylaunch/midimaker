/**
 * Standalone library validator: re-checks every pack in MIDI-Library from
 * disk (parse, 8-bar length, shared bpm/key/scale across the four parts,
 * collisions) and prints a summary. Run any time with:
 *   npm run validate:library
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PART_FILES, scaleByName, validatePackFiles, type PartName,
} from '../packages/engine/src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.resolve(ROOT, process.argv[2] ?? 'MIDI-Library');

let packs = 0;
let okCount = 0;
let warnCount = 0;
const failures: string[] = [];

for (const entry of fs.readdirSync(LIB).sort()) {
  const dir = path.join(LIB, entry);
  if (!fs.statSync(dir).isDirectory()) continue;
  const metaFile = path.join(dir, 'metadata.json');
  if (!fs.existsSync(metaFile)) continue;
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  if (meta.generationMethod === 'imported') continue;
  packs++;

  const files = {} as Record<PartName, Uint8Array>;
  for (const part of Object.keys(PART_FILES) as PartName[]) {
    const f = path.join(dir, PART_FILES[part]);
    files[part] = fs.existsSync(f) ? new Uint8Array(fs.readFileSync(f)) : new Uint8Array();
  }
  let scaleId = 'major';
  try {
    scaleId = scaleByName(meta.scale).id;
  } catch {
    /* keep default */
  }
  const result = validatePackFiles(files, {
    bpm: meta.bpm,
    key: meta.key,
    scale: scaleId,
    experimental: meta.experimentalAmount,
    progression: meta.progression,
  });
  if (result.ok) okCount++;
  else failures.push(`${entry}: ${result.errors.join('; ')}`);
  if (result.warnings.length) warnCount++;
}

console.log(`Validated ${packs} packs: ${okCount} ok, ${failures.length} failed, ${warnCount} with warnings`);
if (failures.length) {
  console.error(failures.slice(0, 40).join('\n'));
  process.exit(1);
}
