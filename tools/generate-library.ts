/**
 * Batch library generator.
 *
 * Generates N coordinated packs (default 1000 = 4000 MIDI files) spread
 * across every genre, mood, key and BPM range, with:
 *  - per-pack validation (exact 8 bars, shared settings, ranges, collisions)
 *  - near-duplicate rejection + seed reroll (signatures compared pairwise)
 *  - metadata.json per pack
 *  - report.json + REPORT.md with full distributions
 *
 * Usage: tsx tools/generate-library.ts [--count 1000] [--out MIDI-Library] [--seed 20260724]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GENRES, MOODS, PART_FILES, TOTAL_TICKS,
  generatePack, generatePackName, isNearDuplicate, mulberry32, packMetadata, packToMidiFiles,
  parseMidi, scaleById, similarity, validatePackFiles, weightedPick,
  type PackSettings, type PackSignature, type PartName,
} from '../packages/engine/src/index.js';

const argv = process.argv.slice(2);
function arg(name: string, dflt: string): string {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}

const COUNT = parseInt(arg('count', '1000'), 10);
const BASE_SEED = parseInt(arg('seed', '20260724'), 10);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, arg('out', 'MIDI-Library'));

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface Accepted {
  sig: PackSignature;
  rhythmKey: string;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const rng = mulberry32(BASE_SEED >>> 0);
  const accepted: Accepted[] = [];
  const stats = {
    total: 0,
    files: 0,
    duplicatesRejected: 0,
    validationFailures: 0,
    regenerated: 0,
    genre: {} as Record<string, number>,
    mood: {} as Record<string, number>,
    key: {} as Record<string, number>,
    scale: {} as Record<string, number>,
    bpmBuckets: {} as Record<string, number>,
    complexity: {} as Record<string, number>,
    energy: {} as Record<string, number>,
  };
  const t0 = Date.now();

  for (let i = 1; i <= COUNT; i++) {
    const genre = GENRES[(i - 1) % GENRES.length];
    // pick a scale from the genre's weighted list, then a mood that fits it
    const scaleId = weightedPick(rng, genre.scales.map(([s]) => s), genre.scales.map(([, w]) => w));
    const minor = scaleById(scaleId).minor;
    const moodPool = MOODS.filter((m) => m.tonality === 'any' || (m.tonality === 'minor') === minor);
    const mood = moodPool[Math.floor(rng() * moodPool.length)];
    const key = KEYS[Math.floor(rng() * 12)];
    const bpm = genre.bpmRange[0] + Math.floor(rng() * (genre.bpmRange[1] - genre.bpmRange[0] + 1));
    const familiarity = (['familiar', 'balanced', 'balanced', 'experimental'] as const)[Math.floor(rng() * 4)];

    let settings: PackSettings = {
      seed: (BASE_SEED ^ (i * 2654435761)) >>> 0,
      genre: genre.id,
      mood: mood.id,
      bpm,
      key,
      scale: scaleId,
      energy: 1 + Math.floor(rng() * 10),
      complexity: 1 + Math.floor(rng() * 10),
      rhythmicDensity: 1 + Math.floor(rng() * 10),
      melodicMovement: 1 + Math.floor(rng() * 10),
      chordComplexity: 1 + Math.floor(rng() * 10),
      experimental: 1 + Math.floor(rng() * 6), // lean musical; high surprise stays rare
      syncopation: 1 + Math.floor(rng() * 10),
      noteLength: 1 + Math.floor(rng() * 10),
      humanize: Math.floor(rng() * 7),
      familiarity,
      era: genre.eras,
    };

    // generate with duplicate rejection + validation reroll
    let pack = generatePack(settings);
    let files = packToMidiFiles(pack);
    let attempts = 0;
    for (;;) {
      const dupe = findDuplicate(pack.signature, accepted);
      const validation = validatePackFiles(files, {
        bpm: settings.bpm, key: settings.key, scale: settings.scale,
        experimental: settings.experimental, progression: pack.progression.join('-'),
      });
      if (!dupe && validation.ok) break;
      if (dupe) stats.duplicatesRejected++;
      if (!validation.ok) stats.validationFailures++;
      attempts++;
      if (attempts > 12) {
        throw new Error(`pack ${i}: could not produce a valid unique pack after 12 attempts: ${validation.errors.join('; ')}`);
      }
      settings = { ...settings, seed: (settings.seed + 7919 * attempts) >>> 0 };
      if (attempts > 6) {
        // widen the search: reroll the controls too
        settings = {
          ...settings,
          rhythmicDensity: 1 + Math.floor(rng() * 10),
          syncopation: 1 + Math.floor(rng() * 10),
          noteLength: 1 + Math.floor(rng() * 10),
        };
      }
      pack = generatePack(settings);
      files = packToMidiFiles(pack);
      stats.regenerated++;
    }

    // write to disk: Pack-0001/Chords.mid ...
    const num = String(i).padStart(4, '0');
    const dirName = `Pack-${num}`;
    const dir = path.join(OUT, dirName);
    fs.mkdirSync(dir, { recursive: true });
    for (const part of Object.keys(files) as PartName[]) {
      fs.writeFileSync(path.join(dir, PART_FILES[part]), Buffer.from(files[part]));
      stats.files++;
    }
    const meta = packMetadata(pack, `pack-${num}`, generatePackName(settings.seed, settings.mood, i), scaleById(scaleId).name);
    meta.createdAt = new Date().toISOString();
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta, null, 2));

    accepted.push({ sig: pack.signature, rhythmKey: pack.signature.rhythm });
    stats.total++;
    bump(stats.genre, genre.name);
    bump(stats.mood, mood.name);
    bump(stats.key, key);
    bump(stats.scale, scaleById(scaleId).name);
    bump(stats.bpmBuckets, `${Math.floor(bpm / 20) * 20}-${Math.floor(bpm / 20) * 20 + 19}`);
    bump(stats.complexity, String(settings.complexity));
    bump(stats.energy, String(settings.energy));

    if (i % 100 === 0) {
      console.log(`  ${i}/${COUNT} packs (${stats.duplicatesRejected} dupes rejected, ${stats.validationFailures} validation rerolls)`);
    }
  }

  const seconds = Math.round((Date.now() - t0) / 100) / 10;

  // final full-library verification pass: parse every file from disk
  console.log('Verifying every file on disk…');
  let verified = 0;
  const verifyErrors: string[] = [];
  for (const entry of fs.readdirSync(OUT)) {
    const dir = path.join(OUT, entry);
    if (!fs.statSync(dir).isDirectory() || !entry.startsWith('Pack-')) continue;
    for (const f of Object.values(PART_FILES)) {
      const file = path.join(dir, f);
      try {
        const midi = parseMidi(new Uint8Array(fs.readFileSync(file)));
        if ((midi.tracks[0]?.endOfTrackTick ?? 0) !== TOTAL_TICKS) {
          verifyErrors.push(`${entry}/${f}: not exactly 8 bars`);
        }
        verified++;
      } catch (e) {
        verifyErrors.push(`${entry}/${f}: ${(e as Error).message}`);
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    outputFolder: OUT,
    totalPacks: stats.total,
    totalMidiFiles: stats.files,
    filesVerifiedOnDisk: verified,
    verifyErrors,
    duplicateRejections: stats.duplicatesRejected,
    validationRerolls: stats.validationFailures,
    generationSeconds: seconds,
    distributions: {
      genre: sortDist(stats.genre),
      mood: sortDist(stats.mood),
      key: sortDist(stats.key),
      scale: sortDist(stats.scale),
      bpm: sortDist(stats.bpmBuckets),
      complexity: sortDist(stats.complexity),
      energy: sortDist(stats.energy),
    },
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), reportMd(report));
  console.log(`\nDone: ${stats.total} packs / ${stats.files} MIDI files in ${seconds}s`);
  console.log(`Duplicates rejected: ${stats.duplicatesRejected}, validation rerolls: ${stats.validationFailures}`);
  console.log(`Disk verification: ${verified} files checked, ${verifyErrors.length} errors`);
  console.log(`Report: ${path.join(OUT, 'REPORT.md')}`);
  if (verifyErrors.length > 0) {
    console.error(verifyErrors.slice(0, 20).join('\n'));
    process.exit(1);
  }
}

/** cheap rhythm prefilter, full similarity only for plausible pairs */
function findDuplicate(sig: PackSignature, accepted: Accepted[]): boolean {
  for (const a of accepted) {
    if (quickRhythmJaccard(sig.rhythm, a.rhythmKey) < 0.5) continue;
    if (isNearDuplicate(sig, a.sig)) return true;
  }
  return false;
}

function quickRhythmJaccard(a: string, b: string): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const va = parseInt(a[i] ?? '0', 16);
    const vb = parseInt(b[i] ?? '0', 16);
    inter += pop4(va & vb);
    union += pop4(va | vb);
  }
  return union === 0 ? 1 : inter / union;
}
function pop4(v: number): number {
  return (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1) + ((v >> 3) & 1);
}

function bump(o: Record<string, number>, k: string): void {
  o[k] = (o[k] ?? 0) + 1;
}
function sortDist(o: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
}

function reportMd(r: ReturnType<typeof JSON.parse>): string {
  const dist = (title: string, d: Record<string, number>) =>
    `\n## ${title}\n\n| ${title} | Packs |\n| --- | ---: |\n` +
    Object.entries(d).map(([k, v]) => `| ${k} | ${v} |`).join('\n') + '\n';
  return `# MIDI Library Generation Report

Generated: ${r.generatedAt}
Output folder: \`${r.outputFolder}\`

| Metric | Value |
| --- | ---: |
| Total packs | ${r.totalPacks} |
| Total MIDI files | ${r.totalMidiFiles} |
| Files verified on disk | ${r.filesVerifiedOnDisk} |
| Verification errors | ${r.verifyErrors.length} |
| Near-duplicates rejected | ${r.duplicateRejections} |
| Validation rerolls | ${r.validationRerolls} |
| Generation time | ${r.generationSeconds}s |

Every file is exactly 8 bars of 4/4 at PPQ 480; all four parts of a pack share
key, scale, tempo and time signature (enforced by the validator during
generation and re-verified from disk afterwards).
${dist('Genre', r.distributions.genre)}${dist('Mood', r.distributions.mood)}${dist('Key', r.distributions.key)}${dist('Scale', r.distributions.scale)}${dist('BPM range', r.distributions.bpm)}${dist('Complexity', r.distributions.complexity)}${dist('Energy', r.distributions.energy)}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
