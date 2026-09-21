"use client";

import { useMemo, useRef, useState } from "react";
import { month, monthShort, num, range as fmtRange } from "@/lib/format";

type Props = {
  months: readonly string[];
  values: ArrayLike<number>;
  range: [number, number];
  playing: boolean;
  onRange: (r: [number, number]) => void;
  onPlay: () => void;
};

const H = 64;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * mag).find((s) => s >= v) ?? 10 * mag;
}

export default function Timeline({ months, values, range, playing, onRange, onPlay }: Props) {
  const n = months.length;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => niceMax(Math.max(1, ...Array.from(values))), [values]);
  const [r0, r1] = range;
  const presets: { label: string; r: [number, number] }[] = [
    { label: "Latest month", r: [n - 1, n - 1] },
    { label: "3 months", r: [n - 3, n - 1] },
    { label: "12 months", r: [n - 12, n - 1] },
    { label: `All ${n}`, r: [0, n - 1] },
  ];

  const indexAt = (clientX: number) => {
    const box = svg.current!.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - box.left) / box.width) * n)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const len = r1 - r0;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const d = e.key === "ArrowLeft" ? -1 : 1;
      if (e.shiftKey) onRange([r0, Math.max(r0, Math.min(n - 1, r1 + d))]);
      else {
        const a = Math.max(0, Math.min(n - 1 - len, r0 + d));
        onRange([a, a + len]);
      }
    }
  };

  const total = Array.from(values).slice(r0, r1 + 1).reduce((s, v) => s + v, 0);
  // label the first month only when the first January isn't close enough to collide with it
  const firstJan = months.findIndex((m) => m.endsWith("-01"));

  return (
    <section className="timeline" aria-label="Time range">
      <div className="timeline-head">
        <button type="button" className={`play ${playing ? "on" : ""}`} onClick={onPlay} aria-pressed={playing} aria-label={playing ? "Stop playback" : "Play month by month"}>
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" /></svg>
          )}
          <span>{playing ? "Stop" : "Play"}</span>
        </button>
        <div className="timeline-range">
          <strong>{fmtRange(months, r0, r1)}</strong>
          <span className="mono">{num(total)} reports</span>
        </div>
        <div className="presets" role="group" aria-label="Quick ranges">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={p.r[0] === r0 && p.r[1] === r1 ? "on" : ""}
              aria-pressed={p.r[0] === r0 && p.r[1] === r1}
              onClick={() => onRange(p.r)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="timeline-chart">
        <svg
          ref={svg}
          viewBox={`0 0 ${n * 10} ${H}`}
          preserveAspectRatio="none"
          tabIndex={0}
          role="slider"
          aria-label="Months shown on the map. Drag across bars to choose a range; arrow keys move it, Shift+arrow resizes."
          aria-valuemin={0}
          aria-valuemax={n - 1}
          aria-valuenow={r1}
          aria-valuetext={fmtRange(months, r0, r1)}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            const i = indexAt(e.clientX);
            drag.current = i;
            onRange([i, i]);
          }}
          onPointerMove={(e) => {
            const i = indexAt(e.clientX);
            setHover(i);
            if (drag.current !== null) onRange([Math.min(drag.current, i), Math.max(drag.current, i)]);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => setHover(null)}
        >
          {[0.5, 1].map((t) => (
            <line key={t} x1={0} x2={n * 10} y1={H - H * t} y2={H - H * t} className="grid" vectorEffect="non-scaling-stroke" />
          ))}
          {Array.from(values).map((v, i) => {
            const h = Math.max(v > 0 ? 1.5 : 0, (v / max) * (H - 4));
            const inRange = i >= r0 && i <= r1;
            return (
              <rect
                key={months[i]}
                x={i * 10 + 1}
                y={H - h}
                width={8}
                height={h}
                rx={1.2}
                className={`bar ${inRange ? "in" : ""} ${hover === i ? "hover" : ""}`}
              />
            );
          })}
          <line x1={0} x2={n * 10} y1={H} y2={H} className="axis" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="timeline-labels" aria-hidden="true">
          {months.map((m, i) =>
            m.endsWith("-01") || (i === 0 && firstJan >= 7) ? (
              <span key={m} style={{ left: `${((i + 0.5) / n) * 100}%` }}>
                {monthShort(m)}
              </span>
            ) : null,
          )}
        </div>
        <div className="timeline-ymax mono" aria-hidden="true">{num(max)}</div>
        {hover !== null && (
          <div className="timeline-tip" style={{ left: `${((hover + 0.5) / n) * 100}%` }}>
            <strong>{month(months[hover])}</strong> {num(values[hover])}
          </div>
        )}
      </div>
    </section>
  );
}
