/**
 * Preview player: a small WebAudio synth. Intentionally simple - each part
 * gets a distinct basic timbre so producers can judge the writing, not the
 * sound design. Supports play/stop, per-part solo & mute, loop, and a
 * preview tempo independent of the pack BPM.
 */

import type { NoteEvent, PackNotes, PartName } from '@shared/types';

const PPQ = 480;
const TOTAL_TICKS = PPQ * 4 * 8;

interface PartVoice {
  type: OscillatorType;
  gain: number;
  cutoff: number;
  detune: number;
  octave: number;
}

const VOICES: Record<PartName, PartVoice> = {
  chords: { type: 'sawtooth', gain: 0.05, cutoff: 1600, detune: 7, octave: 0 },
  melody: { type: 'square', gain: 0.1, cutoff: 3800, detune: 4, octave: 0 },
  counterMelody: { type: 'triangle', gain: 0.11, cutoff: 2800, detune: 0, octave: 0 },
  bass: { type: 'sawtooth', gain: 0.16, cutoff: 700, detune: 0, octave: 0 },
};

export const PART_ORDER: PartName[] = ['chords', 'melody', 'counterMelody', 'bass'];

export interface PlayerState {
  playing: boolean;
  packId: string | null;
  tempo: number;
  loop: boolean;
  muted: Record<PartName, boolean>;
  solo: PartName | null;
  /** 0..1 position within the 8 bars */
  position: number;
}

type Listener = (s: PlayerState) => void;

export class PreviewPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private partGains = new Map<PartName, GainNode>();
  private notes: PackNotes | null = null;
  private schedulerId: number | null = null;
  private startCtxTime = 0;
  private nextNoteIdx: Record<PartName, number> = { chords: 0, melody: 0, counterMelody: 0, bass: 0 };
  private loopCount = 0;
  private listeners = new Set<Listener>();
  private raf: number | null = null;

  state: PlayerState = {
    playing: false,
    packId: null,
    tempo: 120,
    loop: true,
    muted: { chords: false, melody: false, counterMelody: false, bass: false },
    solo: null,
    position: 0,
  };

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn({ ...this.state });
  }

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
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      for (const part of PART_ORDER) {
        const g = this.ctx.createGain();
        g.connect(this.master);
        this.partGains.set(part, g);
      }
    }
    void this.ctx.resume();
    this.applyPartGains();
    this.startCtxTime = this.ctx.currentTime + 0.08;
    this.nextNoteIdx = { chords: 0, melody: 0, counterMelody: 0, bass: 0 };
    this.loopCount = 0;
    this.state.playing = true;
    this.emit();
    this.schedulerTick();
    this.schedulerId = window.setInterval(() => this.schedulerTick(), 40);
    const tick = () => {
      if (!this.state.playing || !this.ctx) return;
      const loopSec = this.loopSeconds();
      const t = (this.ctx.currentTime - this.startCtxTime) % loopSec;
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
    if (this.ctx) {
      // hard-stop by tearing down part gains (scheduled voices are short-lived)
      for (const [part, g] of this.partGains) {
        g.disconnect();
        const ng = this.ctx.createGain();
        ng.connect(this.master!);
        this.partGains.set(part, ng);
      }
    }
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

  toggleMute(part: PartName): void {
    this.state.muted[part] = !this.state.muted[part];
    this.applyPartGains();
    this.emit();
  }

  toggleSolo(part: PartName): void {
    this.state.solo = this.state.solo === part ? null : part;
    this.applyPartGains();
    this.emit();
  }

  private applyPartGains(): void {
    for (const part of PART_ORDER) {
      const g = this.partGains.get(part);
      if (!g) continue;
      const audible = this.state.solo ? this.state.solo === part : !this.state.muted[part];
      g.gain.value = audible ? 1 : 0;
    }
  }

  private secPerTick(): number {
    return 60 / this.state.tempo / PPQ;
  }

  private loopSeconds(): number {
    return TOTAL_TICKS * this.secPerTick();
  }

  /** Look-ahead scheduler: schedules everything within the next 200ms. */
  private schedulerTick(): void {
    if (!this.ctx || !this.notes || !this.state.playing) return;
    const horizon = this.ctx.currentTime + 0.2;
    const loopSec = this.loopSeconds();

    for (const part of PART_ORDER) {
      const list = this.notes.parts[part] ?? [];
      let idx = this.nextNoteIdx[part];
      for (;;) {
        if (idx >= list.length) {
          if (!this.state.loop) break;
          // wrap to next loop iteration
          idx = 0;
          this.loopCountForPart(part);
        }
        const n = list[idx];
        const when = this.startCtxTime + this.loopBase(part) + n.start * this.secPerTick();
        if (when > horizon) break;
        if (when >= this.ctx.currentTime - 0.02) this.scheduleNote(part, n, when);
        idx++;
        this.nextNoteIdx[part] = idx;
      }
    }
    // single shared loop counter advance (all parts share the loop length)
    if (PART_ORDER.every((p) => this.nextNoteIdx[p] >= (this.notes!.parts[p]?.length ?? 0))) {
      if (this.state.loop) {
        this.loopCount++;
        this.nextNoteIdx = { chords: 0, melody: 0, counterMelody: 0, bass: 0 };
      } else if (this.ctx.currentTime > this.startCtxTime + loopSec + 0.5) {
        this.stop();
      }
    }
  }

  // per-part wrap bookkeeping is shared via loopCount
  private loopCountForPart(_part: PartName): void {
    /* handled collectively in schedulerTick */
  }

  private loopBase(_part: PartName): number {
    return this.loopCount * this.loopSeconds();
  }

  private scheduleNote(part: PartName, n: NoteEvent, when: number): void {
    if (!this.ctx) return;
    const v = VOICES[part];
    const dur = Math.max(0.05, n.dur * this.secPerTick());
    const freq = 440 * Math.pow(2, (n.pitch + v.octave * 12 - 69) / 12);
    const out = this.partGains.get(part)!;

    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = v.cutoff;
    filter.Q.value = 0.4;
    gain.connect(filter);
    filter.connect(out);

    const vel = (n.vel / 127) * v.gain;
    const attack = part === 'chords' ? 0.02 : 0.004;
    const release = part === 'bass' ? 0.06 : 0.12;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vel, when + attack);
    gain.gain.setValueAtTime(vel, when + Math.max(attack, dur - release));
    gain.gain.linearRampToValueAtTime(0.0001, when + dur);

    const oscs: OscillatorNode[] = [];
    const o1 = this.ctx.createOscillator();
    o1.type = v.type;
    o1.frequency.value = freq;
    oscs.push(o1);
    if (v.detune > 0) {
      const o2 = this.ctx.createOscillator();
      o2.type = v.type;
      o2.frequency.value = freq;
      o2.detune.value = v.detune;
      oscs.push(o2);
    }
    for (const o of oscs) {
      o.connect(gain);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  }
}

export const player = new PreviewPlayer();
