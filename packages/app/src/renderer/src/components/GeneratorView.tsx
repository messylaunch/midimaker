import { useMemo, useState } from 'react';
import type { CollectionRecord, PackRecord, PackSettings } from '@shared/types';
import { GENRES, MOODS, SCALES } from '@midimaker/engine';
import { PackCard } from './PackCard';

const KEY_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface Props {
  collections: CollectionRecord[];
  onRefresh: () => Promise<void>;
  onToast: (t: string) => void;
  onPreview: (p: PackRecord) => void;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function GeneratorView(p: Props) {
  const [genre, setGenre] = useState('trap');
  const [mood, setMood] = useState('dark');
  const [bpm, setBpm] = useState(140);
  const [key, setKey] = useState('F#');
  const [tonality, setTonality] = useState<'major' | 'minor'>('minor');
  const [scale, setScale] = useState('naturalMinor');
  const [energy, setEnergy] = useState(7);
  const [complexity, setComplexity] = useState(5);
  const [density, setDensity] = useState(6);
  const [movement, setMovement] = useState(5);
  const [chordComplexity, setChordComplexity] = useState(4);
  const [experimental, setExperimental] = useState(2);
  const [syncopation, setSyncopation] = useState(5);
  const [noteLength, setNoteLength] = useState(5);
  const [humanize, setHumanize] = useState(3);
  const [familiarity, setFamiliarity] = useState<PackSettings['familiarity']>('balanced');
  const [seed, setSeed] = useState(randomSeed());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PackRecord | null>(null);

  const genreProfile = useMemo(() => GENRES.find((g) => g.id === genre), [genre]);
  const scaleOptions = useMemo(
    () => Object.values(SCALES).filter((s) => (tonality === 'minor' ? s.minor : !s.minor)),
    [tonality]
  );

  const buildSettings = (s: number): PackSettings => ({
    seed: s,
    genre,
    mood,
    bpm,
    key,
    scale,
    energy,
    complexity,
    rhythmicDensity: density,
    melodicMovement: movement,
    chordComplexity,
    experimental,
    syncopation,
    noteLength,
    humanize,
    familiarity,
    era: genreProfile?.eras ?? [],
  });

  const generate = async (s: number) => {
    setBusy(true);
    try {
      const pack = await window.api.generatePack(buildSettings(s));
      setResult(pack);
      setSeed(s);
      await p.onRefresh();
      p.onToast(`Generated "${pack.name}" (seed ${pack.seed})`);
    } catch (e) {
      p.onToast(`Generation failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <b>Generator</b>
        <span className="hint">Coordinated 8-bar pack: Chords + Melody + CounterMelody + Bass, all in the same key.</span>
      </div>
      <div className="content">
        <div className="gen-layout">
          <div className="gen-panel">
            <div className="control">
              <label>Genre</label>
              <select value={genre} onChange={(e) => {
                setGenre(e.target.value);
                const g = GENRES.find((x) => x.id === e.target.value);
                if (g) setBpm(Math.round((g.bpmRange[0] + g.bpmRange[1]) / 2));
              }}>
                {GENRES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="control">
              <label>Mood</label>
              <select value={mood} onChange={(e) => setMood(e.target.value)}>
                {MOODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="control">
              <label>Key</label>
              <select value={key} onChange={(e) => setKey(e.target.value)}>
                {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="control">
              <label>Major / Minor</label>
              <select
                value={tonality}
                onChange={(e) => {
                  const t = e.target.value as 'major' | 'minor';
                  setTonality(t);
                  setScale(t === 'minor' ? 'naturalMinor' : 'major');
                }}
              >
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </div>
            <div className="control full">
              <label>Scale / Mode</label>
              <select value={scale} onChange={(e) => setScale(e.target.value)}>
                {scaleOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <Slider label="BPM" min={40} max={220} value={bpm} onChange={setBpm} />
            <Slider label="Energy" min={1} max={10} value={energy} onChange={setEnergy} />
            <Slider label="Complexity" min={1} max={10} value={complexity} onChange={setComplexity} />
            <Slider label="Rhythmic density" min={1} max={10} value={density} onChange={setDensity} />
            <Slider label="Melodic movement" min={1} max={10} value={movement} onChange={setMovement} />
            <Slider label="Chord complexity" min={1} max={10} value={chordComplexity} onChange={setChordComplexity} />
            <Slider label="Experimental" min={1} max={10} value={experimental} onChange={setExperimental} />
            <Slider label="Syncopation" min={1} max={10} value={syncopation} onChange={setSyncopation} />
            <Slider label="Note length" min={1} max={10} value={noteLength} onChange={setNoteLength} />
            <Slider label="Humanization" min={0} max={10} value={humanize} onChange={setHumanize} />

            <div className="control full">
              <label>Familiar ↔ Surprise</label>
              <select value={familiarity} onChange={(e) => setFamiliarity(e.target.value as PackSettings['familiarity'])}>
                <option value="familiar">Familiar (80% established / 15% variation / 5% surprise)</option>
                <option value="balanced">Balanced (65% / 25% / 10%)</option>
                <option value="experimental">Experimental (50% / 30% / 20%)</option>
              </select>
            </div>

            <div className="control">
              <label>Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Math.abs(Math.floor(Number(e.target.value))) >>> 0)}
              />
            </div>
            <div className="control">
              <label>&nbsp;</label>
              <button onClick={() => setSeed(randomSeed())}>🎲 New seed</button>
            </div>

            <div className="control full">
              <button className="primary" disabled={busy} onClick={() => generate(seed)}>
                {busy ? <span className="spin">◌</span> : '✨'} Generate pack
              </button>
            </div>
            <div className="control full">
              <button disabled={busy} onClick={() => generate(randomSeed())}>
                ↻ Generate with random seed
              </button>
            </div>
          </div>

          <div className="gen-result">
            {result ? (
              <>
                <p className="hint" style={{ marginBottom: 10 }}>
                  Saved to the library. Same seed + same settings always rebuilds this exact pack.
                </p>
                <PackCard
                  pack={result}
                  collections={p.collections}
                  onRefresh={async () => {
                    await p.onRefresh();
                    const packs = await window.api.listPacks();
                    setResult(packs.find((x) => x.packId === result.packId) ?? null);
                  }}
                  onToast={p.onToast}
                  onPreview={p.onPreview}
                />
              </>
            ) : (
              <div className="empty">
                Set the controls and press <b>Generate pack</b>.<br />
                Duplicate detection quietly rerolls seeds that come out too close to recent results.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="control">
      <label>
        {label} <b>{value}</b>
      </label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
