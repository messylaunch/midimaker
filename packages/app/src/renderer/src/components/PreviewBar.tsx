import { useEffect, useState } from 'react';
import type { PartName } from '@shared/types';
import { INSTRUMENTS, PART_ORDER, player, type InstrumentId } from '../preview/player';

const SHORT: Record<string, string> = {
  chords: 'CH',
  melody: 'MEL',
  counterMelody: 'CTR',
  bass: 'BAS',
};
const FULL: Record<PartName, string> = {
  chords: 'Chords',
  melody: 'Melody',
  counterMelody: 'CounterMelody',
  bass: 'Bass',
};

export function PreviewBar({ packName }: { packName: string | null }) {
  const [s, setS] = useState(player.state);
  const [soundsOpen, setSoundsOpen] = useState(false);
  useEffect(() => player.onChange(setS), []);
  useEffect(() => {
    void player.refreshMidiOuts();
  }, []);

  if (!s.packId) {
    return (
      <div className="preview-bar">
        <span className="hint">
          Preview: pick a pack and press ▶ — solo/mute parts, loop the 8 bars, change tempo, pick preview sounds,
          or route live MIDI into FL Studio.
        </span>
      </div>
    );
  }

  const instrumentOptions = (part: PartName) =>
    INSTRUMENTS.filter((i) => (part === 'bass' ? i.for !== 'melodic' : i.for !== 'bass'));

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
        <input type="range" min={60} max={200} value={s.tempo} onChange={(e) => player.setTempo(Number(e.target.value))} />
      </div>
      <button className={s.loop ? '' : 'ghost'} title="Loop the 8 bars" onClick={() => player.setLoop(!s.loop)}>
        🔁
      </button>

      {/* output routing: built-in synth or a live MIDI port (FL Studio / ElectraX) */}
      <div className="tempo-ctl" title="Route the preview to a MIDI port. In FL Studio: enable the port under MIDI input, then each part arrives on its own channel (1 Chords, 2 Melody, 3 Counter, 4 Bass).">
        <span>Out</span>
        <select
          value={s.midiOutId ?? ''}
          onMouseDown={() => void player.refreshMidiOuts()}
          onChange={(e) => player.setMidiOut(e.target.value || null)}
          style={{ maxWidth: 150 }}
        >
          <option value="">Built-in synth</option>
          {s.midiOuts.map((o) => (
            <option key={o.id} value={o.id}>
              MIDI: {o.name}
            </option>
          ))}
        </select>
      </div>

      <div className="menu-wrap">
        <button className={soundsOpen ? '' : 'ghost'} onClick={() => setSoundsOpen(!soundsOpen)} title="Built-in preview sounds">
          🎛 Sounds
        </button>
        {soundsOpen && (
          <div className="menu" style={{ minWidth: 230 }} onMouseLeave={() => setSoundsOpen(false)}>
            {s.midiOutId && (
              <div className="sub">MIDI out is active — sounds come from your instrument. Ch 1 Chords · 2 Melody · 3 Counter · 4 Bass</div>
            )}
            {PART_ORDER.map((part) => (
              <div key={part} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                <span style={{ width: 96, fontSize: 12 }}>{FULL[part]}</span>
                <select
                  value={s.instruments[part]}
                  onChange={(e) => player.setInstrument(part, e.target.value as InstrumentId)}
                  style={{ flex: 1, fontSize: 12 }}
                >
                  {instrumentOptions(part).map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
