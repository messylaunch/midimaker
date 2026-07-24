import { describe, expect, it } from 'vitest';
import { vlq, writeMidi } from '../src/midi/writer.js';
import { parseMidi } from '../src/midi/parser.js';
import { TOTAL_TICKS, PPQ, type NoteEvent } from '../src/types.js';

describe('vlq encoding', () => {
  it('encodes canonical values', () => {
    expect(vlq(0)).toEqual([0x00]);
    expect(vlq(0x40)).toEqual([0x40]);
    expect(vlq(0x7f)).toEqual([0x7f]);
    expect(vlq(0x80)).toEqual([0x81, 0x00]);
    expect(vlq(0x2000)).toEqual([0xc0, 0x00]);
    expect(vlq(0x3fff)).toEqual([0xff, 0x7f]);
    expect(vlq(0x4000)).toEqual([0x81, 0x80, 0x00]);
  });
  it('rejects negatives', () => {
    expect(() => vlq(-1)).toThrow();
  });
});

describe('writer -> parser round trip', () => {
  const notes: NoteEvent[] = [
    { start: 0, dur: 480, pitch: 60, vel: 90 },
    { start: 480, dur: 240, pitch: 64, vel: 80 },
    { start: 960, dur: 960, pitch: 67, vel: 100 },
    { start: 14400, dur: 900, pitch: 72, vel: 70 },
  ];

  it('preserves notes, tempo, time signature and exact 8-bar length', () => {
    const bytes = writeMidi(notes, { bpm: 124, trackName: 'Melody', program: 80 });
    const parsed = parseMidi(bytes);
    expect(parsed.ppq).toBe(PPQ);
    expect(parsed.bpm).toBeCloseTo(124, 0);
    expect(parsed.timeSignature).toBe('4/4');
    expect(parsed.tracks).toHaveLength(1);
    expect(parsed.tracks[0].name).toBe('Melody');
    expect(parsed.tracks[0].endOfTrackTick).toBe(TOTAL_TICKS);
    const round = parsed.tracks[0].notes;
    expect(round).toHaveLength(notes.length);
    for (let i = 0; i < notes.length; i++) {
      expect(round[i].start).toBe(notes[i].start);
      expect(round[i].pitch).toBe(notes[i].pitch);
      expect(round[i].vel).toBe(notes[i].vel);
      expect(round[i].dur).toBe(notes[i].dur);
    }
  });

  it('clips notes that would extend past 8 bars', () => {
    const bytes = writeMidi([{ start: 15000, dur: 5000, pitch: 60, vel: 90 }], { bpm: 120, trackName: 't' });
    const parsed = parseMidi(bytes);
    const n = parsed.tracks[0].notes[0];
    expect(n.start + n.dur).toBeLessThanOrEqual(TOTAL_TICKS);
    expect(parsed.tracks[0].endOfTrackTick).toBe(TOTAL_TICKS);
  });
});
