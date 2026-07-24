/**
 * Standard MIDI File (SMF) writer - format 0, one track, PPQ 480.
 * Pure function: notes in, Uint8Array out. No dependencies.
 *
 * Every file written covers EXACTLY `TOTAL_TICKS` (8 bars of 4/4): the
 * End-of-Track meta event is pinned to tick 15360 so DAWs (FL Studio
 * included) see a clean 8-bar clip regardless of where the last note ends.
 */

import { PPQ, TOTAL_TICKS, type NoteEvent } from '../types.js';

export interface WriteOptions {
  bpm: number;
  trackName: string;
  /** GM program number 0-127 (cosmetic; FL Studio users route to their own instruments). */
  program?: number;
  /** MIDI channel 0-15. */
  channel?: number;
  /** total length in ticks; defaults to 8 bars */
  totalTicks?: number;
}

interface RawEvent {
  tick: number;
  /** sort order within same tick: note-offs before note-ons to avoid stuck overlaps */
  order: number;
  bytes: number[];
}

export function writeMidi(notes: NoteEvent[], opts: WriteOptions): Uint8Array {
  const channel = opts.channel ?? 0;
  const totalTicks = opts.totalTicks ?? TOTAL_TICKS;
  const events: RawEvent[] = [];

  // Meta: track name
  events.push({ tick: 0, order: 0, bytes: [0xff, 0x03, ...vlq(opts.trackName.length), ...strBytes(opts.trackName)] });
  // Meta: time signature 4/4 (nn=4, dd=2 -> denominator 2^2, cc=24, bb=8)
  events.push({ tick: 0, order: 1, bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] });
  // Meta: tempo
  const usPerQn = Math.round(60_000_000 / opts.bpm);
  events.push({
    tick: 0,
    order: 2,
    bytes: [0xff, 0x51, 0x03, (usPerQn >> 16) & 0xff, (usPerQn >> 8) & 0xff, usPerQn & 0xff],
  });
  if (opts.program !== undefined) {
    events.push({ tick: 0, order: 3, bytes: [0xc0 | channel, opts.program & 0x7f] });
  }

  for (const n of notes) {
    const start = Math.max(0, Math.round(n.start));
    const end = Math.min(totalTicks, Math.round(n.start + n.dur));
    if (end <= start) continue;
    const pitch = Math.max(0, Math.min(127, Math.round(n.pitch)));
    const vel = Math.max(1, Math.min(127, Math.round(n.vel)));
    events.push({ tick: start, order: 10, bytes: [0x90 | channel, pitch, vel] });
    events.push({ tick: end, order: 5, bytes: [0x80 | channel, pitch, 0x40] });
  }

  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track: number[] = [];
  let lastTick = 0;
  for (const ev of events) {
    track.push(...vlq(ev.tick - lastTick), ...ev.bytes);
    lastTick = ev.tick;
  }
  // End of track pinned at exactly totalTicks
  track.push(...vlq(totalTicks - lastTick), 0xff, 0x2f, 0x00);

  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00, // format 0
    0x00, 0x01, // one track
    (PPQ >> 8) & 0xff, PPQ & 0xff,
  ];
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    (track.length >> 24) & 0xff,
    (track.length >> 16) & 0xff,
    (track.length >> 8) & 0xff,
    track.length & 0xff,
  ];
  return Uint8Array.from([...header, ...trackHeader, ...track]);
}

/** Variable-length quantity encoding. */
export function vlq(value: number): number[] {
  if (value < 0) throw new Error(`negative delta: ${value}`);
  const bytes = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function strBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0x7f);
  return out;
}
