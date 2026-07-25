import { useMemo, useState } from 'react';
import type { CollectionRecord, PackRecord, PackSettings } from '@shared/types';
import { GENRES, MOODS, scaleById } from '@midimaker/engine';
import { PackCard } from './PackCard';
import type { SmartView } from './Sidebar';

/** One-click dopamine: fully random (but musically coherent) settings. */
function surpriseSettings(): PackSettings {
  const r = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const genre = GENRES[r(0, GENRES.length - 1)];
  const [scaleId] = genre.scales[r(0, genre.scales.length - 1)];
  const minor = scaleById(scaleId).minor;
  const moods = MOODS.filter((m) => m.tonality === 'any' || (m.tonality === 'minor') === minor);
  return {
    seed: Math.floor(Math.random() * 0xffffffff) >>> 0,
    genre: genre.id,
    mood: moods[r(0, moods.length - 1)].id,
    bpm: r(genre.bpmRange[0], genre.bpmRange[1]),
    key: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][r(0, 11)],
    scale: scaleId,
    energy: r(3, 9),
    complexity: r(2, 8),
    rhythmicDensity: r(3, 8),
    melodicMovement: r(3, 8),
    chordComplexity: r(2, 7),
    experimental: r(1, 4),
    syncopation: r(2, 8),
    noteLength: r(3, 8),
    humanize: r(1, 5),
    familiarity: (['familiar', 'balanced', 'balanced'] as const)[r(0, 2)],
    era: genre.eras,
  };
}

interface Props {
  packs: PackRecord[];
  collections: CollectionRecord[];
  smartView: SmartView;
  onRefresh: () => Promise<void>;
  onToast: (t: string) => void;
  onPreview: (p: PackRecord) => void;
}

type SortKey = 'newest' | 'oldest' | 'name' | 'bpm' | 'energy' | 'complexity' | 'rating';

const KEY_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function LibraryView(p: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [fGenre, setFGenre] = useState('');
  const [fMood, setFMood] = useState('');
  const [fKey, setFKey] = useState('');
  const [fScale, setFScale] = useState('');
  const [fEra, setFEra] = useState('');
  const [fMethod, setFMethod] = useState('');
  const [fFav, setFFav] = useState(false);
  const [bpmMin, setBpmMin] = useState('');
  const [bpmMax, setBpmMax] = useState('');
  const [fEnergy, setFEnergy] = useState('');
  const [fComplexity, setFComplexity] = useState('');
  const [fDensity, setFDensity] = useState('');

  const genres = useMemo(() => uniq(p.packs.map((x) => x.genre)), [p.packs]);
  const moods = useMemo(() => uniq(p.packs.map((x) => x.mood)), [p.packs]);
  const scales = useMemo(() => uniq(p.packs.map((x) => x.scale)), [p.packs]);
  const eras = useMemo(() => uniq(p.packs.flatMap((x) => x.eraInspiration)), [p.packs]);
  const methods = useMemo(() => uniq(p.packs.map((x) => x.generationMethod)), [p.packs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = p.packs.filter((x) => {
      if (q && !`${x.name} ${x.genre} ${x.mood} ${x.key} ${x.scale}`.toLowerCase().includes(q)) return false;
      if (fGenre && x.genre !== fGenre) return false;
      if (fMood && x.mood !== fMood) return false;
      if (fKey && x.key !== fKey) return false;
      if (fScale && x.scale !== fScale) return false;
      if (fEra && !x.eraInspiration.includes(fEra)) return false;
      if (fMethod && x.generationMethod !== fMethod) return false;
      if (fFav && !x.favorite) return false;
      if (bpmMin && x.bpm < Number(bpmMin)) return false;
      if (bpmMax && x.bpm > Number(bpmMax)) return false;
      if (fEnergy && x.energy !== Number(fEnergy)) return false;
      if (fComplexity && x.complexity !== Number(fComplexity)) return false;
      if (fDensity && x.rhythmicDensity !== Number(fDensity)) return false;
      return true;
    });
    const cmp: Record<SortKey, (a: PackRecord, b: PackRecord) => number> = {
      newest: (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
      oldest: (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
      name: (a, b) => a.name.localeCompare(b.name),
      bpm: (a, b) => a.bpm - b.bpm,
      energy: (a, b) => b.energy - a.energy,
      complexity: (a, b) => b.complexity - a.complexity,
      rating: (a, b) => b.rating - a.rating,
    };
    return [...list].sort(cmp[sort]);
  }, [p.packs, search, sort, fGenre, fMood, fKey, fScale, fEra, fMethod, fFav, bpmMin, bpmMax, fEnergy, fComplexity, fDensity]);

  const doImport = async () => {
    const result = await window.api.importFolder();
    if (result) {
      p.onToast(`Imported ${result.imported} pack(s)${result.errors.length ? `, ${result.errors.length} error(s)` : ''}`);
      await p.onRefresh();
    }
  };

  const [surprising, setSurprising] = useState(false);
  const surprise = async () => {
    setSurprising(true);
    try {
      const pack = await window.api.generatePack(surpriseSettings());
      await p.onRefresh();
      p.onToast(`🎲 "${pack.name}" — ${pack.genre} · ${pack.mood} · ${pack.bpm} BPM`);
      p.onPreview(pack);
    } catch (e) {
      p.onToast(`Surprise failed: ${(e as Error).message}`);
    } finally {
      setSurprising(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <input type="text" placeholder="Search packs… (name, genre, mood, key)" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A-Z</option>
          <option value="bpm">BPM</option>
          <option value="energy">Energy</option>
          <option value="complexity">Complexity</option>
          <option value="rating">Rating</option>
        </select>
        <button onClick={() => setShowFilters(!showFilters)}>{showFilters ? 'Hide filters' : 'Filters'}</button>
        <button onClick={surprise} disabled={surprising} title="Generate and preview a random pack">
          {surprising ? <span className="spin">◌</span> : '🎲'} Surprise me
        </button>
        <button className="primary" onClick={doImport}>Import MIDI Folder</button>
        <span className="stats">{filtered.length} of {p.packs.length} packs</span>
      </div>

      {showFilters && (
        <div className="filters">
          <select value={fGenre} onChange={(e) => setFGenre(e.target.value)}>
            <option value="">Genre: all</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={fMood} onChange={(e) => setFMood(e.target.value)}>
            <option value="">Mood: all</option>
            {moods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fKey} onChange={(e) => setFKey(e.target.value)}>
            <option value="">Key: all</option>
            {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={fScale} onChange={(e) => setFScale(e.target.value)}>
            <option value="">Scale: all</option>
            {scales.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fEra} onChange={(e) => setFEra(e.target.value)}>
            <option value="">Era: all</option>
            {eras.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
          </select>
          <select value={fMethod} onChange={(e) => setFMethod(e.target.value)}>
            <option value="">Method: all</option>
            {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="range-filter">
            BPM <input type="number" placeholder="min" value={bpmMin} onChange={(e) => setBpmMin(e.target.value)} />
            – <input type="number" placeholder="max" value={bpmMax} onChange={(e) => setBpmMax(e.target.value)} />
          </div>
          <select value={fEnergy} onChange={(e) => setFEnergy(e.target.value)}>
            <option value="">Energy: all</option>
            {range10().map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={fComplexity} onChange={(e) => setFComplexity(e.target.value)}>
            <option value="">Complexity: all</option>
            {range10().map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={fDensity} onChange={(e) => setFDensity(e.target.value)}>
            <option value="">Density: all</option>
            {range10().map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 5, alignItems: 'center', color: 'var(--dim)', fontSize: 12 }}>
            <input type="checkbox" checked={fFav} onChange={(e) => setFFav(e.target.checked)} /> Favorites only
          </label>
        </div>
      )}

      <div className="content">
        {filtered.length === 0 ? (
          <div className="empty">
            No packs here yet.<br />
            Generate some in the <b>Generator</b> tab or click <b>Import MIDI Folder</b>.
          </div>
        ) : (
          <div className="pack-grid">
            {filtered.map((pack) => (
              <PackCard
                key={pack.packId}
                pack={pack}
                collections={p.collections}
                onRefresh={p.onRefresh}
                onToast={p.onToast}
                onPreview={p.onPreview}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))].sort();
}
function range10(): number[] {
  return Array.from({ length: 10 }, (_, i) => i + 1);
}
