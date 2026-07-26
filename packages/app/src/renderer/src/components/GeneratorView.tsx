import { useMemo, useState } from 'react';
import type { CollectionRecord, PackRecord, PackSettings } from '@shared/types';
import { GENRES, MOODS, SCALES } from '@midimaker/engine';
import { PackCard } from './PackCard';
import { Knob } from './Knob';

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
        <b>Press Room</b>
        <span className="hint">Every pull of the press prints a coordinated 8-bar pack: Chords + Melody + CounterMelody + Bass, one key.</span>
      </div>
      <div className="content">
        <div className="gen-layout">
          <div className="gen-panel">
            <div className="press-head full">
              Set the plates
              <small>Genre · mood · key · ink amounts</small>
            </div>
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

            <div className="full knob-grid">
              <Knob label="BPM" min={40} max={220} value={bpm} defaultValue={120} onChange={setBpm} size={62} />
              <Knob label="Energy" min={1} max={10} value={energy} defaultValue={5} onChange={setEnergy} />
              <Knob label="Complexity" min={1} max={10} value={complexity} defaultValue={5} onChange={setComplexity} />
              <Knob label="Density" min={1} max={10} value={density} defaultValue={5} onChange={setDensity} />
              <Knob label="Movement" min={1} max={10} value={movement} defaultValue={5} onChange={setMovement} />
              <Knob label="Chords" min={1} max={10} value={chordComplexity} defaultValue={4} onChange={setChordComplexity} />
              <Knob label="Experiment" min={1} max={10} value={experimental} defaultValue={2} onChange={setExperimental} />
              <Knob label="Syncopate" min={1} max={10} value={syncopation} defaultValue={5} onChange={setSyncopation} />
              <Knob label="Note Len" min={1} max={10} value={noteLength} defaultValue={5} onChange={setNoteLength} />
              <Knob label="Humanize" min={0} max={10} value={humanize} defaultValue={3} onChange={setHumanize} />
            </div>

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
              <button onClick={() => setSeed(randomSeed())}>Roll seed</button>
            </div>

            <div className="control full">
              <button className="primary" disabled={busy} onClick={() => generate(seed)} title="Generates a new pack and saves it to the library">
                {busy ? <span className="spin">◌</span> : null} Pull a print
              </button>
            </div>
            <div className="control full">
              <button disabled={busy} onClick={() => generate(randomSeed())}>
                ↻ Pull with a fresh seed
              </button>
            </div>
          </div>

          <div className="gen-result">
            {result ? (
              <div className="fresh-print" key={result.packId}>
                <p className="hint" style={{ marginBottom: 12 }}>
                  Fresh off the press, saved to the library. Same seed + same settings reprints this exact pack, forever.
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
              </div>
            ) : (
              <div className="empty">
                Set the plates, twist the ink knobs, then <b>Pull a print</b>.<br />
                The duplicate detector quietly rerolls any pull that lands too close to a recent one.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

