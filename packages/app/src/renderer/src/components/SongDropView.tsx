import { useState } from 'react';
import type { CollectionRecord, PackRecord, PackSettings, SongAnalysis } from '@shared/types';
import { GENRES } from '@midimaker/engine';
import { analyzeSong } from '../analysis/analyze';
import { PackCard } from './PackCard';

interface Props {
  collections: CollectionRecord[];
  onRefresh: () => Promise<void>;
  onToast: (t: string) => void;
  onPreview: (p: PackRecord) => void;
}

export function SongDropView(p: Props) {
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<{ f: number; stage: string } | null>(null);
  const [analysis, setAnalysis] = useState<SongAnalysis | null>(null);
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('warm');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PackRecord[]>([]);

  const handleFile = async (file: File) => {
    setAnalysis(null);
    setResults([]);
    try {
      const a = await analyzeSong(file, (f, stage) => setProgress({ f, stage }));
      setProgress(null);
      setAnalysis(a);
      // suggest a mood from what we heard
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

  const generateFromAnalysis = async () => {
    if (!analysis) return;
    setBusy(true);
    try {
      const settings: PackSettings = {
        seed: Math.floor(Math.random() * 0xffffffff) >>> 0,
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
      const pack = await window.api.generatePack(settings);
      setResults((r) => [pack, ...r]);
      await p.onRefresh();
      p.onToast(`Generated "${pack.name}" from the song's vitals`);
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
          Drop a song → the app hears its tempo, key, energy and density → generates original MIDI packs to match.
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
                <div className="hint">Rough chord colors heard in the opening bars:</div>
                <div className="chord-strip">
                  {analysis.chordGuesses.map((c, i) => (
                    <span key={i} className="chord-chip">{c}</span>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
              <label className="hint">Generate as</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                {GENRES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select value={mood} onChange={(e) => setMood(e.target.value)}>
                {['dark', 'sad', 'emotional', 'chill', 'warm', 'dreamy', 'romantic', 'nostalgic', 'uplifting', 'happy', 'energetic', 'aggressive', 'mysterious', 'epic'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button className="primary" disabled={busy} onClick={generateFromAnalysis}>
                {busy ? <span className="spin">◌</span> : '✨'} Generate matching pack
              </button>
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
