import { useMemo, useState } from 'react';
import type { CollectionRecord, PackRecord, PackSettings, SongAnalysis } from '@shared/types';
import { GENRES, chordNameToRoman, keyToPc } from '@midimaker/engine';
import { analyzeSong } from '../analysis/analyze';
import { PackCard } from './PackCard';

interface Props {
  collections: CollectionRecord[];
  onRefresh: () => Promise<void>;
  onToast: (t: string) => void;
  onPreview: (p: PackRecord) => void;
}

type Zone = 'close' | 'inspired' | 'vibe';

function zoneOf(similarity: number): Zone {
  if (similarity >= 67) return 'close';
  if (similarity >= 34) return 'inspired';
  return 'vibe';
}

const ZONE_INFO: Record<Zone, { title: string; desc: string }> = {
  close: {
    title: 'Close to the song',
    desc: 'Uses the chords actually heard in the track (bar by bar) plus its exact tempo, key, energy and density. Melodies are still original — closest legal cousin, not a copy.',
  },
  inspired: {
    title: 'Inspired by it',
    desc: 'Keeps the song\'s tempo, key, energy and density, but draws fresh chord progressions from the genre\'s own vocabulary.',
  },
  vibe: {
    title: 'Just the vibe',
    desc: 'Keeps the key and tempo as a starting point, then lets the generator roam — more surprise, more variation, further from the source.',
  },
};

export function SongDropView(p: Props) {
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<{ f: number; stage: string } | null>(null);
  const [analysis, setAnalysis] = useState<SongAnalysis | null>(null);
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('warm');
  const [similarity, setSimilarity] = useState(80);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PackRecord[]>([]);

  const zone = zoneOf(similarity);

  const romanized = useMemo(() => {
    if (!analysis) return [];
    const keyPc = keyToPc(analysis.key);
    return analysis.chordGuesses
      .map((name) => chordNameToRoman(name, keyPc, analysis.scale))
      .filter((r): r is string => r !== null);
  }, [analysis]);

  const handleFile = async (file: File) => {
    setAnalysis(null);
    setResults([]);
    try {
      const a = await analyzeSong(file, (f, stage) => setProgress({ f, stage }));
      setProgress(null);
      setAnalysis(a);
      setMood(a.scale === 'naturalMinor' ? (a.energy >= 7 ? 'aggressive' : 'dark') : a.energy >= 7 ? 'energetic' : 'warm');
      p.onToast(`Heard: ${a.bpm} BPM, ${a.key} ${a.scale === 'naturalMinor' ? 'minor' : 'major'}`);
    } catch (e) {
      setProgress(null);
      p.onToast(`Could not analyze that file: ${(e as Error).message}`);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const pickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.wav,.ogg,.flac,.m4a';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) void handleFile(f);
    };
    input.click();
  };

  /** Map the similarity slider + analysis onto generator settings. */
  const buildSettings = (): PackSettings => {
    if (!analysis) throw new Error('no analysis');
    const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    const looseness = (100 - similarity) / 100; // 0 = clone the vitals, 1 = roam
    const base: PackSettings = {
      seed,
      genre,
      mood,
      bpm: analysis.bpm,
      key: analysis.key,
      scale: analysis.scale,
      energy: analysis.energy,
      complexity: 5,
      rhythmicDensity: analysis.rhythmicDensity,
      melodicMovement: 5,
      chordComplexity: 4,
      experimental: 2,
      syncopation: 5,
      noteLength: 5,
      humanize: 3,
      familiarity: 'balanced',
      era: GENRES.find((g) => g.id === genre)?.eras ?? [],
    };
    if (zone === 'close') {
      return {
        ...base,
        progressionOverride: romanized.length >= 2 ? romanized : undefined,
        familiarity: 'familiar',
        experimental: 1,
        complexity: 4,
        humanize: 2,
        syncopation: 4,
      };
    }
    if (zone === 'inspired') {
      return base;
    }
    // vibe: keep key/tempo as anchors, loosen everything else
    const drift = Math.round(looseness * 3);
    return {
      ...base,
      familiarity: 'experimental',
      experimental: Math.min(10, 4 + drift),
      complexity: Math.min(10, 5 + drift),
      rhythmicDensity: Math.max(1, Math.min(10, analysis.rhythmicDensity + (seed % 5) - 2)),
      energy: Math.max(1, Math.min(10, analysis.energy + (seed % 3) - 1)),
    };
  };

  const generateFromAnalysis = async () => {
    if (!analysis) return;
    setBusy(true);
    try {
      const pack = await window.api.generatePack(buildSettings());
      setResults((r) => [pack, ...r]);
      await p.onRefresh();
      p.onToast(`Generated "${pack.name}" — ${ZONE_INFO[zone].title.toLowerCase()}`);
    } catch (e) {
      p.onToast(`Generation failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <b>Song Drop</b>
        <span className="hint">
          Drop a song → the app hears its tempo, key, chords, energy and density → generates original MIDI to match.
          It never copies the song's melody.
        </span>
      </div>
      <div className="content">
        <div
          className={`dropzone ${over ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={pickFile}
        >
          {progress ? (
            <>
              <div style={{ fontSize: 15, marginBottom: 6 }}>
                <span className="spin">◌</span> {progress.stage}
              </div>
              <div className="progress" style={{ maxWidth: 320, margin: '0 auto' }}>
                <div style={{ width: `${Math.round(progress.f * 100)}%` }} />
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🎧</div>
              Drop an audio file here (mp3 / wav / flac / m4a)<br />
              or click to browse
            </>
          )}
        </div>

        {analysis && (
          <>
            <h3 style={{ marginBottom: 4 }}>What the app heard in “{analysis.fileName}”</h3>
            <div className="analysis-grid">
              <div className="stat"><div className="k">Tempo</div><div className="v">{analysis.bpm} BPM</div></div>
              <div className="stat"><div className="k">Key</div><div className="v">{analysis.key} {analysis.scale === 'naturalMinor' ? 'minor' : 'major'}</div></div>
              <div className="stat"><div className="k">Energy</div><div className="v">{analysis.energy}/10</div></div>
              <div className="stat"><div className="k">Density</div><div className="v">{analysis.rhythmicDensity}/10</div></div>
              <div className="stat"><div className="k">Length</div><div className="v">{Math.floor(analysis.durationSec / 60)}:{String(analysis.durationSec % 60).padStart(2, '0')}</div></div>
            </div>
            {analysis.chordGuesses.length > 0 && (
              <>
                <div className="hint">Chords heard in the opening bars (used bar-by-bar in “Close to the song” mode):</div>
                <div className="chord-strip">
                  {analysis.chordGuesses.map((c, i) => (
                    <span key={i} className="chord-chip">
                      {c}
                      {romanized[i] ? <span style={{ opacity: 0.55 }}> · {romanized[i]}</span> : null}
                    </span>
                  ))}
                </div>
              </>
            )}

            <div className="gen-panel" style={{ width: 560, marginBottom: 18 }}>
              <div className="control full">
                <label>
                  How close to the song? <b>{ZONE_INFO[zone].title}</b>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={similarity}
                  onChange={(e) => setSimilarity(Number(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--dim)' }}>
                  <span>Just the vibe</span>
                  <span>Inspired by it</span>
                  <span>Close to the song</span>
                </div>
                <div className="hint" style={{ marginTop: 4 }}>{ZONE_INFO[zone].desc}</div>
              </div>
              <div className="control">
                <label>Generate as</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                  {GENRES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="control">
                <label>Mood</label>
                <select value={mood} onChange={(e) => setMood(e.target.value)}>
                  {['dark', 'sad', 'emotional', 'chill', 'warm', 'dreamy', 'romantic', 'nostalgic', 'uplifting', 'happy', 'energetic', 'aggressive', 'mysterious', 'epic'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="control full">
                <button className="primary" disabled={busy} onClick={generateFromAnalysis}>
                  {busy ? <span className="spin">◌</span> : '✨'} Generate matching pack
                </button>
              </div>
            </div>
          </>
        )}

        {results.length > 0 && (
          <div className="pack-grid">
            {results.map((pack) => (
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
