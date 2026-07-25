import { useEffect, useRef, useState } from 'react';
import type { PartName } from '@shared/types';
import { INSTRUMENTS, PART_ORDER, player, type InstrumentId } from '../preview/player';

/** Live output visualizer: real FFT bars for the built-in synth, a tempo-synced pulse when routing MIDI out. */
function Visualizer({ playing }: { playing: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      let levels = player.getLevels();
      if (levels.length === 0 && playing) {
        // MIDI-out mode: synth is silent, animate a beat-locked pulse instead
        const s = player.state;
        const beats = s.position * 32;
        const beatEnv = 1 - (beats - Math.floor(beats));
        levels = Array.from({ length: 14 }, (_, i) => beatEnv * (0.35 + 0.65 * Math.abs(Math.sin(beats * 0.9 + i * 0.6))));
      }
      const bands = levels.length || 14;
      const bw = w / bands;
      for (let i = 0; i < bands; i++) {
        const v = levels[i] ?? 0.04;
        const bh = Math.max(2 * dpr, v * (h - 4 * dpr));
        const grad = ctx.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, 'rgba(139, 92, 255, 0.9)');
        grad.addColorStop(1, 'rgba(47, 226, 189, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(i * bw + 1.2 * dpr, h - bh, bw - 2.4 * dpr, bh);
      }
      if (playing) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return <canvas className="viz" ref={ref} />;
}

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
      <button className={`play-btn ${s.playing ? 'playing' : ''}`} onClick={() => (s.playing ? player.stop() : player.play())} title="Play/Stop (Space)">
        {s.playing ? '■' : '▶'}
      </button>
      <Visualizer playing={s.playing} />
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
