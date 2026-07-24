import { useEffect, useState } from 'react';
import { PART_ORDER, player } from '../preview/player';

const SHORT: Record<string, string> = {
  chords: 'CH',
  melody: 'MEL',
  counterMelody: 'CTR',
  bass: 'BAS',
};

export function PreviewBar({ packName }: { packName: string | null }) {
  const [s, setS] = useState(player.state);
  useEffect(() => player.onChange(setS), []);

  if (!s.packId) {
    return (
      <div className="preview-bar">
        <span className="hint">Preview: pick a pack and press ▶ - solo/mute each part, loop the 8 bars, change the preview tempo.</span>
      </div>
    );
  }

  return (
    <div className="preview-bar">
      <button onClick={() => (s.playing ? player.stop() : player.play())}>
        {s.playing ? '■' : '▶'}
      </button>
      <span className="title">{packName ?? s.packId}</span>
      <div className="progress">
        <div style={{ width: `${Math.round(s.position * 100)}%` }} />
      </div>
      <div className="pb-parts">
        <span className="pm-lab">SOLO</span>
        {PART_ORDER.map((part) => (
          <button
            key={part}
            className={s.solo === part ? 'on-solo' : ''}
            style={{ fontSize: 10, padding: '2px 6px' }}
            onClick={() => player.toggleSolo(part)}
          >
            {SHORT[part]}
          </button>
        ))}
      </div>
      <div className="pb-parts">
        <span className="pm-lab">MUTE</span>
        {PART_ORDER.map((part) => (
          <button
            key={part}
            className={s.muted[part] ? 'on-mute' : ''}
            style={{ fontSize: 10, padding: '2px 6px' }}
            onClick={() => player.toggleMute(part)}
          >
            {SHORT[part]}
          </button>
        ))}
      </div>
      <div className="tempo-ctl">
        <span>{s.tempo} BPM</span>
        <input
          type="range"
          min={60}
          max={200}
          value={s.tempo}
          onChange={(e) => player.setTempo(Number(e.target.value))}
        />
      </div>
      <button className={s.loop ? '' : 'ghost'} title="Loop the 8 bars" onClick={() => player.setLoop(!s.loop)}>
        🔁
      </button>
    </div>
  );
}
