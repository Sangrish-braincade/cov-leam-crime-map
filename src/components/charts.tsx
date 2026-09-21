"use client";

import { useState } from "react";
import { month, num } from "@/lib/format";

export type BarItem = { key: string; label: string; value: number; note?: string; muted?: boolean; onClick?: () => void; action?: string };

/** Thin horizontal bars with the value in text — the value is never colour-only. */
export function BarList({ items, max, unit }: { items: BarItem[]; max?: number; unit?: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="barlist">
      {items.map((it) => {
        const body = (
          <>
            <span className="barlist-label">{it.label}</span>
            <span className="barlist-value mono">
              {num(it.value)}
              {it.note ? <span className="barlist-note"> {it.note}</span> : null}
            </span>
            <span className="barlist-track" aria-hidden="true">
              <span className="barlist-fill" style={{ width: `${Math.max(it.value > 0 ? 1.5 : 0, (100 * it.value) / top)}%` }} />
            </span>
          </>
        );
        return (
          <li key={it.key} className={it.muted ? "muted" : ""}>
            {it.onClick ? (
              <button type="button" onClick={it.onClick} title={it.action}>
                {body}
              </button>
            ) : (
              <div>{body}</div>
            )}
          </li>
        );
      })}
      {unit ? <li className="barlist-unit">{unit}</li> : null}
    </ul>
  );
}

/** Small monthly bar chart with the selected range picked out. */
export function MonthBars({ months, values, range, label }: { months: readonly string[]; values: ArrayLike<number>; range: [number, number]; label: string }) {
  const n = months.length;
  const vals = Array.from(values);
  const max = Math.max(1, ...vals);
  const [hover, setHover] = useState<number | null>(null);
  const H = 44;
  return (
    <figure className="monthbars">
      <svg
        viewBox={`0 0 ${n * 10} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${vals.map((v, i) => `${month(months[i])} ${v}`).join(", ")}`}
        onPointerMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - b.left) / b.width) * n))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {vals.map((v, i) => {
          const h = Math.max(v > 0 ? 1.5 : 0, (v / max) * (H - 2));
          return <rect key={i} x={i * 10 + 1} y={H - h} width={8} height={h} rx={1.2} className={`bar ${i >= range[0] && i <= range[1] ? "in" : ""} ${hover === i ? "hover" : ""}`} />;
        })}
        <line x1={0} x2={n * 10} y1={H} y2={H} className="axis" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        {hover !== null ? (
          <>
            <strong>{month(months[hover])}</strong> <span className="mono">{num(vals[hover])}</span>
          </>
        ) : (
          <>
            <span>{month(months[0])}</span>
            <span>{month(months[n - 1])}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
