import { useEffect, useRef } from 'react';
import type { PackNotes, PartName } from '@shared/types';

/**
 * Mini piano-roll thumbnail: all four parts of a pack drawn color-coded on
 * one canvas so producers can see the MIDI before pressing play. Notes are
 * fetched lazily (only when the card scrolls into view) and cached.
 */

const TOTAL_TICKS = 480 * 4 * 8;

const PART_COLORS: Record<PartName, string> = {
  chords: 'rgba(139, 92, 255, 0.42)',
  melody: 'rgba(255, 255, 255, 0.92)',
  counterMelody: 'rgba(47, 226, 189, 0.75)',
  bass: 'rgba(255, 184, 77, 0.85)',
};
const DRAW_ORDER: PartName[] = ['chords', 'counterMelody', 'bass', 'melody'];

const cache = new Map<string, PackNotes>();
const pending = new Map<string, Promise<PackNotes>>();

export function invalidatePianoRoll(packId: string): void {
  cache.delete(packId);
  pending.delete(packId);
}

async function fetchNotes(packId: string): Promise<PackNotes> {
  const hit = cache.get(packId);
  if (hit) return hit;
  let p = pending.get(packId);
  if (!p) {
    p = window.api.packNotes(packId).then((n) => {
      cache.set(packId, n);
      pending.delete(packId);
      return n;
    });
    pending.set(packId, p);
  }
  return p;
}

export function PianoRoll({ packId, version }: { packId: string; version?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const draw = (notes: PackNotes) => {
      if (cancelled || !canvasRef.current) return;
      const c = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth * dpr;
      const h = c.clientHeight * dpr;
      if (w === 0) return;
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // faint bar grid
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let bar = 1; bar < 8; bar++) {
        ctx.fillRect(Math.round((bar / 8) * w), 0, 1, h);
      }

      let minP = 127;
      let maxP = 0;
      for (const part of DRAW_ORDER) {
        for (const n of notes.parts[part] ?? []) {
          if (n.pitch < minP) minP = n.pitch;
          if (n.pitch > maxP) maxP = n.pitch;
        }
      }
      if (minP > maxP) return;
      minP -= 2;
      maxP += 2;
      const span = maxP - minP;
      const rowH = Math.max(1.5 * dpr, Math.min(3 * dpr, h / span));

      for (const part of DRAW_ORDER) {
        ctx.fillStyle = PART_COLORS[part];
        for (const n of notes.parts[part] ?? []) {
          const x = (n.start / TOTAL_TICKS) * w;
          const nw = Math.max(1.5 * dpr, (n.dur / TOTAL_TICKS) * w - 0.5);
          const y = h - ((n.pitch - minP) / span) * h - rowH / 2;
          ctx.fillRect(x, y, nw, rowH);
        }
      }
    };

    const load = () => {
      fetchNotes(packId)
        .then(draw)
        .catch(() => {
          /* thumbnail is best-effort */
        });
    };

    // lazy: only fetch when visible
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          load();
          io.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    io.observe(canvas);

    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [packId, version]);

  return <canvas className="pianoroll" ref={canvasRef} />;
}
