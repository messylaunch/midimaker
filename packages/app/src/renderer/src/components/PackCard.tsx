import { useEffect, useState } from 'react';
import type { CollectionRecord, PackRecord, PartName } from '@shared/types';
import { player } from '../preview/player';
import { PianoRoll, invalidatePianoRoll } from './PianoRoll';

/** Ink glyphs for the four billing lines - drawn in the world's own grammar. */
const GLYPHS: Record<PartName, JSX.Element> = {
  chords: (
    <svg className="glyph" viewBox="0 0 16 14" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2.6" fill="currentColor" />
      <rect x="1" y="6" width="14" height="2.6" fill="currentColor" />
      <rect x="1" y="10" width="14" height="2.6" fill="currentColor" />
    </svg>
  ),
  melody: (
    <svg className="glyph" viewBox="0 0 16 14" aria-hidden="true">
      <path d="M1 10 L5 4 L8 8 L11 3 L15 7" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="square" />
    </svg>
  ),
  counterMelody: (
    <svg className="glyph" viewBox="0 0 16 14" aria-hidden="true">
      <rect x="1" y="8" width="3.4" height="3.4" fill="currentColor" />
      <rect x="6.3" y="4" width="3.4" height="3.4" fill="currentColor" />
      <rect x="11.6" y="8" width="3.4" height="3.4" fill="currentColor" />
    </svg>
  ),
  bass: (
    <svg className="glyph" viewBox="0 0 16 14" aria-hidden="true">
      <rect x="1" y="8" width="14" height="4.4" fill="currentColor" />
      <rect x="1" y="4" width="7" height="2.4" fill="currentColor" />
    </svg>
  ),
};

const PART_LABELS: { part: PartName; label: string }[] = [
  { part: 'chords', label: 'Chords' },
  { part: 'melody', label: 'Melody' },
  { part: 'counterMelody', label: 'CounterMelody' },
  { part: 'bass', label: 'Bass' },
];

interface Props {
  pack: PackRecord;
  collections: CollectionRecord[];
  onRefresh: () => Promise<void>;
  onToast: (t: string) => void;
  onPreview: (p: PackRecord) => void;
}

/** stable tiny hash so each pack keeps its ink run + tilt between renders */
function hashOf(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function PackCard({ pack, collections, onRefresh, onToast, onPreview }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [playerState, setPlayerState] = useState(player.state);
  const [rollVersion, setRollVersion] = useState(0);

  useEffect(() => player.onChange(setPlayerState), []);
  const isCurrent = playerState.packId === pack.packId;
  const isPlaying = isCurrent && playerState.playing;

  const h = hashOf(pack.packId);
  const inkClass = ['ink-coral', 'ink-black', 'ink-olive'][h % 3];
  const tiltClass = ['tilt-a', 'tilt-b', ''][h % 3];

  const dragPart = (part: PartName) => (e: React.DragEvent) => {
    e.preventDefault();
    window.api.startDrag(pack.packId, [part]);
  };
  const dragAll = (e: React.DragEvent) => {
    e.preventDefault();
    window.api.startDrag(pack.packId, availableParts());
  };
  const availableParts = (): PartName[] => PART_LABELS.map((p) => p.part).filter((part) => pack.parts.includes(part));

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setMenuOpen(false);
    try {
      await fn();
      if (msg) onToast(msg);
      await onRefresh();
    } catch (e) {
      onToast(`Error: ${(e as Error).message}`);
    }
  };

  return (
    <div className={`pack-card ${inkClass} ${tiltClass} ${isPlaying ? 'playing' : ''}`}>
      <div className="pack-head" draggable onDragStart={dragAll} title="Drag the whole pack (all four .mid files)">
        <div className="pack-title">{pack.name}</div>
        <button
          className={`fav ${pack.favorite ? 'on' : ''}`}
          title={pack.favorite ? 'Unfavorite' : 'Favorite'}
          onClick={() => act(async () => window.api.setFavorite(pack.packId, !pack.favorite))}
        >
          {pack.favorite ? '♥' : '♡'}
        </button>
      </div>

      <div className="badges">
        <span className="badge genre">{pack.genre}</span>
        <span className="badge mood">{pack.mood}</span>
        <span className="badge">{pack.bpm} BPM</span>
        <span className="badge">{pack.key} {pack.scale}</span>
        {pack.eraInspiration.slice(0, 1).map((e) => (
          <span key={e} className="badge">{e}</span>
        ))}
      </div>

      <PianoRoll packId={pack.packId} version={rollVersion} />

      <div className="pack-meta">
        Energy {pack.energy} · Complexity {pack.complexity} · Density {pack.rhythmicDensity} · Seed {pack.seed}
        {pack.progression ? <> · {pack.progression}</> : null}
      </div>

      <div className="parts">
        {PART_LABELS.filter(({ part }) => pack.parts.includes(part)).map(({ part, label }) => (
          <div key={part} className="part-row" draggable onDragStart={dragPart(part)} title={`Drag ${label}.mid into FL Studio`}>
            {GLYPHS[part]}
            <span>{label}</span>
            {isCurrent && (
              <span className="pm">
                <button className={playerState.solo === part ? 'on-solo' : ''} onClick={() => player.toggleSolo(part)} title="Solo">
                  S
                </button>
                <button className={playerState.muted[part] ? 'on-mute' : ''} onClick={() => player.toggleMute(part)} title="Mute">
                  M
                </button>
              </span>
            )}
            <span className="drag-hint">DRAG →</span>
          </div>
        ))}
      </div>

      <div className="pack-actions">
        <button className="play-card" onClick={() => (isPlaying ? player.stop() : onPreview(pack))}>
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>
        <span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`star ${pack.rating >= n ? 'on' : ''}`}
              title={`Rate ${n}/5`}
              onClick={() => act(async () => window.api.setRating(pack.packId, pack.rating === n ? 0 : n))}
            >
              ★
            </button>
          ))}
        </span>
        <span className="spacer" />
        <div className="menu-wrap">
          <button className="ghost" style={{ color: 'inherit' }} onClick={() => setMenuOpen(!menuOpen)} title="Pack actions">
            ⋯
          </button>
          {menuOpen && (
            <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
              <button onClick={() => act(async () => {
                const dir = await window.api.exportPack(pack.packId);
                if (dir) onToast(`Pack exported to ${dir}`);
              })}>
                Export pack…
              </button>
              <button onClick={() => act(async () => {
                const dir = await window.api.exportParts(pack.packId, availableParts());
                if (dir) onToast(`Parts exported to ${dir}`);
              })}>
                Export all parts…
              </button>
              <button onClick={() => act(async () => window.api.openPackFolder(pack.packId))}>Open folder</button>
              <button
                onClick={() => {
                  const name = prompt('Rename pack', pack.name);
                  if (name) void act(async () => window.api.renamePack(pack.packId, name), 'Renamed');
                }}
              >
                Rename…
              </button>
              <button
                onClick={() => {
                  const genre = prompt('Genre', pack.genre) ?? pack.genre;
                  const mood = prompt('Mood', pack.mood) ?? pack.mood;
                  const bpm = Number(prompt('BPM', String(pack.bpm)) ?? pack.bpm);
                  void act(async () => window.api.updateMeta(pack.packId, { genre, mood, bpm }), 'Metadata updated');
                }}
              >
                Edit metadata…
              </button>
              {pack.generationMethod !== 'imported' && (
                <>
                  <div className="sub">Reprint one part</div>
                  {PART_LABELS.map(({ part, label }) => (
                    <button
                      key={part}
                      onClick={() =>
                        act(async () => {
                          await window.api.regeneratePart(pack.packId, part);
                          invalidatePianoRoll(pack.packId);
                          setRollVersion((v) => v + 1);
                        }, `${label} reprinted - other parts untouched`)
                      }
                    >
                      ↻ {label}
                    </button>
                  ))}
                </>
              )}
              {collections.length > 0 && <div className="sub">Add to collection</div>}
              {collections.map((c) => (
                <button key={c.id} onClick={() => act(async () => window.api.addToCollection(c.id, pack.packId), `Added to ${c.name}`)}>
                  + {c.name}
                </button>
              ))}
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`Delete "${pack.name}" and its files?`)) {
                    void act(async () => window.api.deletePack(pack.packId), 'Pack deleted');
                  }
                }}
              >
                Delete pack
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
