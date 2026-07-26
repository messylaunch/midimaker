import { useCallback, useRef, useState } from 'react';

/**
 * Rotary knob with a live number readout - drag up/down, scroll wheel, or
 * double-click to reset. 270° arc with a glowing value ring.
 */
interface Props {
  label: string;
  min: number;
  max: number;
  value: number;
  defaultValue?: number;
  onChange: (v: number) => void;
  /** display formatter, e.g. bpm shows raw number */
  format?: (v: number) => string;
  size?: number;
}

const START_ANGLE = -135;
const SWEEP = 270;

export function Knob({ label, min, max, value, defaultValue, onChange, format, size = 56 }: Props) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startVal: number } | null>(null);

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, Math.round(v))),
    [min, max]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startVal: value };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const delta = drag.current.startY - e.clientY;
    const range = max - min;
    onChange(clamp(drag.current.startVal + (delta / 140) * range));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const onWheel = (e: React.WheelEvent) => {
    const step = Math.max(1, Math.round((max - min) / 40));
    onChange(clamp(value + (e.deltaY < 0 ? step : -step)));
  };
  const onDoubleClick = () => {
    if (defaultValue !== undefined) onChange(clamp(defaultValue));
  };

  const r = size / 2 - 5;
  const cx = size / 2;
  const cy = size / 2;
  const frac = (value - min) / Math.max(1, max - min);
  const valueAngle = START_ANGLE + SWEEP * frac;

  return (
    <div
      className={`knob ${dragging ? 'dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      title={`${label}: drag up/down · scroll · double-click resets`}
    >
      <svg width={size} height={size}>
        <path className="track" d={arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP)} fill="none" strokeWidth={4.5} strokeLinecap="round" />
        <path
          className="value-arc"
          d={arcPath(cx, cy, r, START_ANGLE, Math.max(START_ANGLE + 0.01, valueAngle))}
          fill="none"
          strokeWidth={4.5}
          strokeLinecap="round"
        />
        <line
          x1={cx + Math.cos(rad(valueAngle - 90)) * (r - 9)}
          y1={cy + Math.sin(rad(valueAngle - 90)) * (r - 9)}
          x2={cx + Math.cos(rad(valueAngle - 90)) * (r - 3)}
          y2={cy + Math.sin(rad(valueAngle - 90)) * (r - 3)}
          stroke="var(--cream)"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <text className="knob-num" x={cx} y={cy + 4.5} textAnchor="middle">
          {format ? format(value) : value}
        </text>
      </svg>
      <span className="knob-label">{label}</span>
    </div>
  );
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = { x: cx + Math.cos(rad(a0 - 90)) * r, y: cy + Math.sin(rad(a0 - 90)) * r };
  const p1 = { x: cx + Math.cos(rad(a1 - 90)) * r, y: cy + Math.sin(rad(a1 - 90)) * r };
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}
