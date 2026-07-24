/** Types shared between the Electron main process and the renderer. */

import type { NoteEvent, PackSettings, PartName } from '@midimaker/engine';

export type { NoteEvent, PackSettings, PartName };

/** One library pack as shown in the UI (metadata + user data merged). */
export interface PackRecord {
  packId: string;
  dirName: string;
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
  progression?: string;
  phrasePlan?: string;
  noteDensity?: number;
  createdAt: string;
  favorite: boolean;
  rating: number;
  lastUsedAt?: string;
  parts: string[]; // available part names
}

export interface CollectionRecord {
  id: number;
  name: string;
  packIds: string[];
}

export interface PackNotes {
  bpm: number;
  parts: Record<PartName, NoteEvent[]>;
}

export interface GenerateRequest {
  settings: PackSettings;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/** Result of analyzing a dropped song (produced in the renderer). */
export interface SongAnalysis {
  fileName: string;
  bpm: number;
  key: string;
  scale: 'major' | 'naturalMinor';
  keyConfidence: number;
  energy: number; // 1-10
  rhythmicDensity: number; // 1-10
  durationSec: number;
  chordGuesses: string[]; // per-bar chord names for display
}

export interface MidiApi {
  listPacks(): Promise<PackRecord[]>;
  importFolder(): Promise<ImportResult | null>;
  exportParts(packId: string, parts: PartName[]): Promise<string | null>;
  exportPack(packId: string): Promise<string | null>;
  deletePack(packId: string): Promise<void>;
  renamePack(packId: string, newName: string): Promise<PackRecord>;
  updateMeta(packId: string, patch: Partial<PackRecord>): Promise<PackRecord>;
  setFavorite(packId: string, fav: boolean): Promise<void>;
  setRating(packId: string, rating: number): Promise<void>;
  markUsed(packId: string): Promise<void>;
  packNotes(packId: string): Promise<PackNotes>;
  openPackFolder(packId: string): Promise<void>;
  listCollections(): Promise<CollectionRecord[]>;
  createCollection(name: string): Promise<CollectionRecord>;
  deleteCollection(id: number): Promise<void>;
  addToCollection(id: number, packId: string): Promise<void>;
  removeFromCollection(id: number, packId: string): Promise<void>;
  generatePack(settings: PackSettings): Promise<PackRecord>;
  regeneratePart(packId: string, part: PartName): Promise<PackRecord>;
  startDrag(packId: string, parts: PartName[]): void;
  libraryDir(): Promise<string>;
}

declare global {
  interface Window {
    api: MidiApi;
  }
}
