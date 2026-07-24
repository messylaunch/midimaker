/**
 * Library index database. Real SQLite via sql.js (WASM build) - chosen over
 * a native module so `npm install` never needs a compiler toolchain on the
 * user's machine (important for Windows producers). The DB is an index/cache;
 * each pack's metadata.json on disk stays the source of truth for musical
 * fields, while user fields (favorites, ratings, collections, recents) live
 * only here.
 */

import initSqlJs, { type Database } from 'sql.js';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require_ = createRequire(import.meta.url);

let db: Database | null = null;
let dbPath = '';
let saveTimer: NodeJS.Timeout | null = null;

export async function openDb(file: string): Promise<void> {
  dbPath = file;
  const wasmPath = path.join(path.dirname(require_.resolve('sql.js')), 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const existing = fs.existsSync(file) ? fs.readFileSync(file) : null;
  db = existing ? new SQL.Database(existing) : new SQL.Database();
  migrate();
  scheduleSave();
}

function migrate(): void {
  d().run(`
    CREATE TABLE IF NOT EXISTS packs (
      packId TEXT PRIMARY KEY,
      dirName TEXT NOT NULL,
      name TEXT NOT NULL,
      genre TEXT, mood TEXT, bpm INTEGER, key TEXT, scale TEXT,
      timeSignature TEXT, bars INTEGER,
      energy INTEGER, complexity INTEGER, rhythmicDensity INTEGER,
      experimentalAmount INTEGER, era TEXT, generationMethod TEXT,
      seed INTEGER, progression TEXT, phrasePlan TEXT, noteDensity REAL,
      createdAt TEXT, favorite INTEGER DEFAULT 0, rating INTEGER DEFAULT 0,
      lastUsedAt TEXT, parts TEXT
    );
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection_packs (
      collectionId INTEGER NOT NULL,
      packId TEXT NOT NULL,
      UNIQUE(collectionId, packId)
    );
  `);
}

function d(): Database {
  if (!db) throw new Error('DB not opened');
  return db;
}

export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, Buffer.from(d().export()));
    } catch (e) {
      console.error('db save failed', e);
    }
  }, 400);
}

export function run(sql: string, params: (string | number | null)[] = []): void {
  d().run(sql, params);
  scheduleSave();
}

export function all<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = d().prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export function get<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): T | undefined {
  return all<T>(sql, params)[0];
}

export function flushDb(): void {
  if (saveTimer) clearTimeout(saveTimer);
  if (db) {
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, Buffer.from(db.export()));
    } catch (e) {
      console.error('db flush failed', e);
    }
  }
}
