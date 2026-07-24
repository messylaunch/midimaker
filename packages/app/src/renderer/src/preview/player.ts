/**
 * Preview player.
 *
 * Two output modes:
 *  1. Built-in synth (WebAudio) - selectable instrument per part (808 sub,
 *     finger bass, keys, pad, e-piano, lead, pluck, bell). No samples needed.
 *  2. Live MIDI out (WebMIDI) - streams the preview to any MIDI port so FL
 *     Studio / ElectraX / hardware plays the notes with real sounds.
 *     Parts map to channels: 1 Chords, 2 Melody, 3 CounterMelody, 4 Bass.
 *
 * Supports play/stop, per-part solo & mute, 8-bar loop, and preview tempo
 * independent of the pack BPM.
 */

import type { NoteEvent, PackNotes, PartName } from '@shared/types';

const PPQ = 480;
const TOTAL_TICKS = PPQ * 4 * 8;

export const PART_ORDER: PartName[] = ['chords', 'melody', 'counterMelody', 'bass'];
export const PART_CHANNEL: Record<PartName, number> = { chords: 0, melody: 1, counterMelody: 2, bass: 3 };

export type InstrumentId =
  | 'keys' | 'pad' | 'epiano'
  | 'lead' | 'pluck' | 'bell' | 'saw'
  | 'sub808' | 'fingerBass' | 'reeseBass';

export const INSTRUMENTS: { id: InstrumentId; name: string; for: 'melodic' | 'bass' | 'both' }[] = [
  { id: 'keys', name: 'Keys', for: 'melodic' },
  { id: 'pad', name: 'Soft Pad', for: 'melodic' },
  { id: 'epiano', name: 'E-Piano', for: 'melodic' },
  { id: 'lead', name: 'Analog Lead', for: 'melodic' },
  { id: 'pluck', name: 'Pluck', for: 'melodic' },
  { id: 'bell', name: 'Bell', for: 'melodic' },
  { id: 'saw', name: 'Saw Stack', for: 'melodic' },
  { id: 'sub808', name: '808 Sub', for: 'bass' },
  { id: 'fingerBass', name: 'Finger Bass', for: 'bass' },
  { id: 'reeseBass', name: 'Reese Bass', for: 'bass' },
];

export interface MidiOutInfo {
  id: string;
  name: string;
}

export interface PlayerState {
  playing: boolean;
  packId: string | null;
  tempo: number;
  loop: boolean;
  muted: Record<PartName, boolean>;
  solo: PartName | null;
  position: number; // 0..1 within the 8 bars
  instruments: Record<PartName, InstrumentId>;
  midiOutId: string | null; // null = built-in synth
  midiOuts: MidiOutInfo[];
  midiSupported: boolean;
}

type Listener = (s: PlayerState) => void;

export class PreviewPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private notes: PackNotes | null = null;
  private schedulerId: number | null = null;
  private startCtxTime = 0;
  private nextIdx: Record<PartName, number> = { chords: 0, melody: 0, counterMelody: 0, bass: 0 };
  private loopCount = 0;
  private listeners = new Set<Listener>();
  private raf: number | null = null;
  private liveNodes = new Set<AudioNode>();
  private midiAccess: MIDIAccess | null = null;

  state: PlayerState = {
    playing: false,
    packId: null,
    tempo: 120,
    loop: true,
    muted: { chords: false, melody: false, counterMelody: false, bass: false },
    solo: null,
    position: 0,
    instruments: { chords: 'keys', melody: 'lead', counterMelody: 'pluck', bass: 'sub808' },
    midiOutId: null,
    midiOuts: [],
    midiSupported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  };

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(): void {
    for (const fn of this.listeners) fn({ ...this.state });
  }

  /* ---------------- MIDI out ---------------- */

  async refreshMidiOuts(): Promise<void> {
    if (!this.state.midiSupported) return;
    try {
      this.midiAccess ??= await navigator.requestMIDIAccess({ sysex: false });
      const outs: MidiOutInfo[] = [];
      this.midiAccess.outputs.forEach((o) => outs.push({ id: o.id, name: o.name ?? o.id }));
      this.state.midiOuts = outs;
      if (this.state.midiOutId && !outs.some((o) => o.id === this.state.midiOutId)) {
        this.state.midiOutId = null;
      }
    } catch {
      this.state.midiSupported = false;
    }
    this.emit();
  }

  setMidiOut(id: string | null): void {
    const wasPlaying = this.state.playing;
    if (wasPlaying) this.stop();
    this.state.midiOutId = id;
    this.emit();
    if (wasPlaying) this.play();
  }

  private midiPort(): MIDIOutput | null {
    if (!this.midiAccess || !this.state.midiOutId) return null;
    return this.midiAccess.outputs.get(this.state.midiOutId) ?? null;
  }

  private allNotesOff(): void {
    const port = this.midiPort();
    if (!port) return;
    for (let ch = 0; ch < 4; ch++) {
      port.send([0xb0 | ch, 123, 0]); // all notes off
      port.send([0xb0 | ch, 64, 0]); // sustain off
    }
  }

  /* ---------------- transport ---------------- */

  async load(packId: string, notes: PackNotes): Promise<void> {
    this.stop();
    this.notes = notes;
    this.state.packId = packId;
    this.state.tempo = Math.round(notes.bpm) || 120;
    this.emit();
  }

  play(): void {
    if (!this.notes) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 5;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    this.startCtxTime = this.ctx.currentTime + 0.1;
    this.nextIdx = { chords: 0, melody: 0, counterMelody: 0, bass: 0 };
    this.loopCount = 0;
    this.state.playing = true;
    this.emit();
    this.schedulerTick();
    this.schedulerId = window.setInterval(() => this.schedulerTick(), 40);
    const tick = () => {
      if (!this.state.playing || !this.ctx) return;
      const loopSec = this.loopSeconds();
      const t = (this.ctx.currentTime - this.startCtxTime + loopSec) % loopSec;
      this.state.position = Math.max(0, t / loopSec);
      this.emit();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    for (const node of this.liveNodes) {
      try {
        node.disconnect();
      } catch {
        /* already gone */
      }
    }
    this.liveNodes.clear();
    this.allNotesOff();
    this.state.playing = false;
    this.state.position = 0;
    this.emit();
  }

  setTempo(bpm: number): void {
    const wasPlaying = this.state.playing;
    if (wasPlaying) this.stop();
    this.state.tempo = Math.min(220, Math.max(40, Math.round(bpm)));
    this.emit();
    if (wasPlaying) this.play();
  }

  setLoop(loop: boolean): void {
    this.state.loop = loop;
    this.emit();
  }

  setInstrument(part: PartName, id: InstrumentId): void {
    this.state.instruments[part] = id;
    this.emit();
  }

  toggleMute(part: PartName): void {
    this.state.muted[part] = !this.state.muted[part];
    this.emit();
  }

  toggleSolo(part: PartName): void {
    this.state.solo = this.state.solo === part ? null : part;
    this.emit();
  }

  private audible(part: PartName): boolean {
    return this.state.solo ? this.state.solo === part : !this.state.muted[part];
  }

  private secPerTick(): number {
    return 60 / this.state.tempo / PPQ;
  }
  private loopSeconds(): number {
    return TOTAL_TICKS * this.secPerTick();
  }

  private schedulerTick(): void {
    if (!this.ctx || !this.notes || !this.state.playing) return;
    const horizon = this.ctx.currentTime + 0.25;
    const loopSec = this.loopSeconds();
    const base = this.startCtxTime + this.loopCount * loopSec;

    for (const part of PART_ORDER) {
      const list = this.notes.parts[part] ?? [];
      while (this.nextIdx[part] < list.length) {
        const n = list[this.nextIdx[part]];
        const when = base + n.start * this.secPerTick();
        if (when > horizon) break;
        if (when >= this.ctx.currentTime - 0.02 && this.audible(part)) {
          this.scheduleNote(part, n, when);
        }
        this.nextIdx[part]++;
      }
    }

    const allDone = PART_ORDER.every((p) => this.nextIdx[p] >= (this.notes!.parts[p]?.length ?? 0));
    if (allDone) {
      const loopEnd = base + loopSec;
      if (this.state.loop && loopEnd < horizon + 0.3) {
        this.loopCount++;
        this.nextIdx = { chords: 0, melody: 0, counterMelody: 0, bass: 0 };
      } else if (!this.state.loop && this.ctx.currentTime > loopEnd + 0.4) {
        this.stop();
      }
    }
  }

  private scheduleNote(part: PartName, n: NoteEvent, when: number): void {
    const dur = Math.max(0.05, n.dur * this.secPerTick());
    const port = this.midiPort();
    if (port) {
      // live MIDI: timestamps in DOMHighRes ms
      const nowMs = performance.now();
      const deltaMs = (when - this.ctx!.currentTime) * 1000;
      const ch = PART_CHANNEL[part];
      const vel = Math.max(1, Math.min(127, n.vel));
      port.send([0x90 | ch, n.pitch & 0x7f, vel], nowMs + deltaMs);
      port.send([0x80 | ch, n.pitch & 0x7f, 0x40], nowMs + deltaMs + dur * 1000);
      return;
    }
    this.synthNote(part, n, when, dur);
  }

  /* ---------------- built-in instruments ---------------- */

  private synthNote(part: PartName, n: NoteEvent, when: number, dur: number): void {
    const ctx = this.ctx!;
    const inst = this.state.instruments[part];
    const freq = 440 * Math.pow(2, (n.pitch - 69) / 12);
    const vel = n.vel / 127;

    const out = ctx.createGain();
    out.connect(this.master!);
    this.liveNodes.add(out);
    const cleanup = () => this.liveNodes.delete(out);
    window.setTimeout(cleanup, (when - ctx.currentTime + dur + 1.2) * 1000);

    const env = (g: GainNode, peak: number, a: number, d: number, s: number, r: number) => {
      const sus = Math.max(0.0001, peak * s);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak, when + a);
      g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), when + a + d);
      g.gain.setValueAtTime(Math.max(sus, 0.0001), when + Math.max(a + d, dur - r));
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur + r);
    };
    const osc = (type: OscillatorType, f: number, detune = 0): OscillatorNode => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.start(when);
      o.stop(when + dur + 1.1);
      return o;
    };
    const lp = (cut: number, q = 0.5): BiquadFilterNode => {
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = cut;
      flt.Q.value = q;
      return flt;
    };

    switch (inst) {
      case 'sub808': {
        // sine sub with a fast pitch drop + soft clip for weight
        const o = osc('sine', freq * 2);
        o.frequency.setValueAtTime(freq * 2.2, when);
        o.frequency.exponentialRampToValueAtTime(freq, when + 0.06);
        const shaper = ctx.createWaveShaper();
        shaper.curve = softClipCurve(2.2);
        const g = ctx.createGain();
        env(g, vel * 0.5, 0.004, 0.12, 0.8, 0.12);
        o.connect(shaper); shaper.connect(g); g.connect(out);
        // click transient for attack definition
        const click = osc('triangle', freq * 4);
        const cg = ctx.createGain();
        env(cg, vel * 0.12, 0.001, 0.03, 0, 0.02);
        click.connect(cg); cg.connect(out);
        break;
      }
      case 'fingerBass': {
        const o1 = osc('sawtooth', freq);
        const o2 = osc('square', freq * 0.5);
        const flt = lp(900 + vel * 900, 1.1);
        flt.frequency.setValueAtTime(500 + vel * 2200, when);
        flt.frequency.exponentialRampToValueAtTime(400, when + 0.18);
        const g = ctx.createGain();
        env(g, vel * 0.34, 0.003, 0.14, 0.45, 0.07);
        o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(out);
        break;
      }
      case 'reeseBass': {
        const o1 = osc('sawtooth', freq, -14);
        const o2 = osc('sawtooth', freq, 14);
        const flt = lp(650, 0.8);
        const g = ctx.createGain();
        env(g, vel * 0.3, 0.01, 0.1, 0.7, 0.1);
        o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(out);
        break;
      }
      case 'keys': {
        const o1 = osc('sawtooth', freq, -6);
        const o2 = osc('sawtooth', freq, 6);
        const flt = lp(1800 + vel * 1200, 0.4);
        flt.frequency.setValueAtTime(2600 + vel * 1600, when);
        flt.frequency.exponentialRampToValueAtTime(1100, when + 0.35);
        const g = ctx.createGain();
        env(g, vel * 0.11, 0.006, 0.4, 0.5, 0.18);
        o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(out);
        break;
      }
      case 'pad': {
        const o1 = osc('sawtooth', freq, -9);
        const o2 = osc('sawtooth', freq, 9);
        const o3 = osc('triangle', freq * 2, 3);
        const flt = lp(1000, 0.3);
        const g = ctx.createGain();
        env(g, vel * 0.09, 0.35, 0.4, 0.85, 0.5);
        o1.connect(flt); o2.connect(flt); o3.connect(flt); flt.connect(g); g.connect(out);
        break;
      }
      case 'epiano': {
        const o1 = osc('sine', freq);
        const o2 = osc('sine', freq * 2);
        const o3 = osc('sine', freq * 14.1); // tine sparkle
        const g1 = ctx.createGain();
        const g2 = ctx.createGain();
        const g3 = ctx.createGain();
        env(g1, vel * 0.16, 0.003, 0.7, 0.25, 0.2);
        env(g2, vel * 0.06, 0.003, 0.35, 0.12, 0.15);
        env(g3, vel * vel * 0.02, 0.001, 0.06, 0, 0.04);
        o1.connect(g1); o2.connect(g2); o3.connect(g3);
        g1.connect(out); g2.connect(out); g3.connect(out);
        break;
      }
      case 'lead': {
        const o1 = osc('sawtooth', freq, -7);
        const o2 = osc('sawtooth', freq, 7);
        const o3 = osc('square', freq * 0.5);
        const flt = lp(2600 + vel * 2200, 0.7);
        const g = ctx.createGain();
        env(g, vel * 0.12, 0.008, 0.15, 0.7, 0.12);
        o1.connect(flt); o2.connect(flt); o3.connect(flt); flt.connect(g); g.connect(out);
        break;
      }
      case 'pluck': {
        const o1 = osc('triangle', freq);
        const o2 = osc('sawtooth', freq, 5);
        const flt = lp(3200, 0.6);
        flt.frequency.setValueAtTime(3800, when);
        flt.frequency.exponentialRampToValueAtTime(700, when + 0.16);
        const g = ctx.createGain();
        env(g, vel * 0.16, 0.002, 0.16, 0.08, 0.08);
        o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(out);
        break;
      }
      case 'bell': {
        const o1 = osc('sine', freq);
        const o2 = osc('sine', freq * 2.76);
        const o3 = osc('sine', freq * 5.4);
        const g1 = ctx.createGain();
        const g2 = ctx.createGain();
        const g3 = ctx.createGain();
        env(g1, vel * 0.14, 0.002, 0.9, 0.12, 0.4);
        env(g2, vel * 0.05, 0.002, 0.4, 0.04, 0.3);
        env(g3, vel * 0.025, 0.002, 0.2, 0, 0.2);
        o1.connect(g1); o2.connect(g2); o3.connect(g3);
        g1.connect(out); g2.connect(out); g3.connect(out);
        break;
      }
      case 'saw':
      default: {
        const o1 = osc('sawtooth', freq, -5);
        const o2 = osc('sawtooth', freq, 5);
        const flt = lp(2400, 0.5);
        const g = ctx.createGain();
        env(g, vel * 0.11, 0.005, 0.2, 0.6, 0.12);
        o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(out);
      }
    }
  }
}

function softClipCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

export const player = new PreviewPlayer();
