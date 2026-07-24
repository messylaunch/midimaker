import { useEffect, useState } from 'react';
import type { CollectionRecord, PackRecord, PartName } from '@shared/types';
import { player } from '../preview/player';

const PART_LABELS: { part: PartName; label: string; icon: string }[] = [
  { part: 'chords', label: 'Chords', icon: '🎹' },
  { part: 'melody', label: 'Melody', icon: '🎵' },
  { part: 'counterMelody', label: 'CounterMelody', icon: '🎶' },
  { part: 'bass', label: 'Bass', icon: '🎸' },
];

interface Props {
  pack: PackRecord;
  collections: CollectionRecord[];
  onRefresh: () => Promise<void>;
  onToast: (t: string) => void;
  onPreview: (p: PackRecord) => void;
}

export function PackCard({ pack, collections, onRefresh, onToast, onPreview }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [playerState, setPlayerState] = useState(player.state);

  useEffect(() => player.onChange(setPlayerState), []);
  const isCurrent = playerState.packId === pack.packId;
  const isPlaying = isCurrent && playerState.playing;

  /**
   * Native OS drag: preventDefault on the HTML5 event and hand off to
   * Electron's startDrag with the real file path(s) - this is what lets the
   * file land in FL Studio / Explorer / Finder as a genuine .mid file.
   */
  const dragPart = (part: PartName) => (e: React.DragEvent) => {
    e.preventDefault();
    window.api.startDrag(pack.packId, [part]);
  };
  const dragAll = (e: React.DragEvent) => {
    e.preventDefault();
    window.api.startDrag(pack.packId, availableParts());
  };

  const availableParts = (): PartName[] =>
    PART_LABELS.map((p) => p.part).filter((part) => pack.parts.includes(part));

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
    <div className={`pack-card ${isPlaying ? 'playing' : ''}`}>
      <div className="pack-head" draggable onDragStart={dragAll} title="Drag the whole pack (all four .mid files)">
        <div className="pack-title">{pack.name}</div>
        <button
          className={`fav ${pack.favorite ? 'on' : ''}`}
          title="Favorite"
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
        {pack.eraInspiration.slice(0, 2).map((e) => (
          <span key={e} className="badge">{e}</span>
        ))}
      </div>

      <div className="pack-meta">
        Energy {pack.energy}/10 · Complexity {pack.complexity}/10 · Density {pack.rhythmicDensity}/10
        <br />
        Seed {pack.seed} · {new Date(pack.createdAt).toLocaleDateString()}
        {pack.progression ? <> · {pack.progression}</> : null}
      </div>

      <div className="parts">
        {PART_LABELS.filter(({ part }) => pack.parts.includes(part)).map(({ part, label, icon }) => (
          <div key={part} className="part-row" draggable onDragStart={dragPart(part)} title={`Drag ${label}.mid into FL Studio`}>
            <span>{icon}</span>
            <span>{label}</span>
            {isCurrent && (
              <span className="pm">
                <button
                  className={playerState.solo === part ? 'on-solo' : ''}
                  onClick={() => player.toggleSolo(part)}
                  title="Solo"
                >
                  S
                </button>
                <button
                  className={playerState.muted[part] ? 'on-mute' : ''}
                  onClick={() => player.toggleMute(part)}
                  title="Mute"
                >
                  M
                </button>
              </span>
            )}
            <span className="drag-hint">drag ⇢</span>
          </div>
        ))}
      </div>

      <div className="pack-actions">
        <button onClick={() => (isPlaying ? player.stop() : onPreview(pack))}>
          {isPlaying ? '■ Stop' : '▶ Preview'}
        </button>
        <span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`star ${pack.rating >= n ? 'on' : ''}`}
              onClick={() => act(async () => window.api.setRating(pack.packId, pack.rating === n ? 0 : n))}
            >
              ★
            </button>
          ))}
        </span>
        <span className="spacer" />
        <div className="menu-wrap">
          <button className="ghost" onClick={() => setMenuOpen(!menuOpen)}>⋯</button>
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
                  <div className="sub">Regenerate one part</div>
                  {PART_LABELS.map(({ part, label }) => (
                    <button
                      key={part}
                      onClick={() => act(async () => window.api.regeneratePart(pack.packId, part), `${label} regenerated - other parts untouched`)}
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
