/**
 * Standard MIDI File parser (formats 0 and 1) - pure, dependency-free.
 * Used for importing user MIDI folders, previewing packs and validating
 * everything the writer produces (round-trip tested).
 */

import type { NoteEvent } from '../types.js';

export interface ParsedTrack {
  name: string;
  notes: NoteEvent[];
  lastTick: number;
  endOfTrackTick: number;
}

export interface ParsedMidi {
  format: number;
  ppq: number;
  bpm: number | null;
  timeSignature: string | null;
  tracks: ParsedTrack[];
  /** max end-of-track tick across tracks */
  totalTicks: number;
}

export function parseMidi(data: Uint8Array): ParsedMidi {
  const r = new Reader(data);
  if (r.str(4) !== 'MThd') throw new Error('Not a MIDI file (missing MThd)');
  const headerLen = r.u32();
  const format = r.u16();
  const ntrks = r.u16();
  const division = r.u16();
  if (division & 0x8000) throw new Error('SMPTE time division not supported');
  r.skip(headerLen - 6);

  const out: ParsedMidi = {
    format,
    ppq: division,
    bpm: null,
    timeSignature: null,
    tracks: [],
    totalTicks: 0,
  };

  for (let t = 0; t < ntrks; t++) {
    if (r.eof()) break;
    if (r.str(4) !== 'MTrk') throw new Error(`Track ${t}: missing MTrk`);
    const len = r.u32();
    const end = r.pos + len;
    const track: ParsedTrack = { name: '', notes: [], lastTick: 0, endOfTrackTick: 0 };
    const open = new Map<number, { start: number; vel: number }[]>(); // key: channel<<8|pitch
    let tick = 0;
    let running = 0;

    while (r.pos < end) {
      tick += r.vlq();
      let status = r.u8();
      if (status < 0x80) {
        // running status
        r.back();
        status = running;
        if (status === 0) throw new Error('Bad running status');
      } else if (status < 0xf0) {
        running = status;
      }

      if (status === 0xff) {
        const type = r.u8();
        const mlen = r.vlq();
        const dataStart = r.pos;
        if (type === 0x03) {
          track.name = r.strLen(mlen);
        } else if (type === 0x51 && mlen === 3) {
          const us = (r.u8() << 16) | (r.u8() << 8) | r.u8();
          if (out.bpm === null && us > 0) out.bpm = Math.round((60_000_000 / us) * 100) / 100;
        } else if (type === 0x58 && mlen >= 2) {
          const nn = r.u8();
          const dd = r.u8();
          if (out.timeSignature === null) out.timeSignature = `${nn}/${1 << dd}`;
        } else if (type === 0x2f) {
          track.endOfTrackTick = tick;
        }
        r.pos = dataStart + mlen;
      } else if (status === 0xf0 || status === 0xf7) {
        const slen = r.vlq();
        r.skip(slen);
      } else {
        const kind = status & 0xf0;
        const ch = status & 0x0f;
        if (kind === 0x90) {
          const pitch = r.u8();
          const vel = r.u8();
          const key = (ch << 8) | pitch;
          if (vel > 0) {
            if (!open.has(key)) open.set(key, []);
            open.get(key)!.push({ start: tick, vel });
          } else {
            closeNote(open, key, tick, track);
          }
        } else if (kind === 0x80) {
          const pitch = r.u8();
          r.u8(); // release velocity
          closeNote(open, (ch << 8) | pitch, tick, track);
        } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) {
          r.skip(2);
        } else if (kind === 0xc0 || kind === 0xd0) {
          r.skip(1);
        } else {
          throw new Error(`Unhandled status 0x${status.toString(16)} at ${r.pos}`);
        }
        track.lastTick = Math.max(track.lastTick, tick);
      }
    }
    // close any dangling notes at end-of-track
    for (const [key, list] of open) {
      for (const o of list) {
        track.notes.push({
          start: o.start,
          dur: Math.max(1, (track.endOfTrackTick || tick) - o.start),
          pitch: key & 0xff,
          vel: o.vel,
        });
      }
    }
    track.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    if (track.endOfTrackTick === 0) track.endOfTrackTick = tick;
    out.tracks.push(track);
    out.totalTicks = Math.max(out.totalTicks, track.endOfTrackTick, track.lastTick);
    r.pos = end;
  }
  return out;
}

function closeNote(
  open: Map<number, { start: number; vel: number }[]>,
  key: number,
  tick: number,
  track: ParsedTrack
) {
  const list = open.get(key);
  if (!list || list.length === 0) return;
  const o = list.shift()!;
  track.notes.push({ start: o.start, dur: Math.max(1, tick - o.start), pitch: key & 0xff, vel: o.vel });
}

class Reader {
  pos = 0;
  constructor(private d: Uint8Array) {}
  eof() {
    return this.pos >= this.d.length;
  }
  u8() {
    return this.d[this.pos++];
  }
  back() {
    this.pos--;
  }
  u16() {
    return (this.u8() << 8) | this.u8();
  }
  u32() {
    return (this.u16() << 16) | this.u16();
  }
  skip(n: number) {
    this.pos += n;
  }
  str(n: number) {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8());
    return s;
  }
  strLen(n: number) {
    return this.str(n);
  }
  vlq() {
    let v = 0;
    for (;;) {
      const b = this.u8();
      v = (v << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return v;
    }
  }
}
