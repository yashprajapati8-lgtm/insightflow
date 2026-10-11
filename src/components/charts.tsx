"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import type { Review } from "@/lib/types";
import { fmt, pct } from "./ui";

/** Horizontal bar that animates its width. */
export function Bar({ value, className, delay = 0 }: { value: number; className?: string; delay?: number }) {
  return (
    <motion.div
      className={clsx("h-full rounded-[3px]", className)}
      initial={{ width: 0 }}
      animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.8, 0.2, 1] }}
    />
  );
}

/** A donut made of stroked circle arcs. Values are shares that sum to 1. */
export function Donut({
  parts,
  label,
  center,
  size = 96,
}: {
  parts: { value: number; color: string }[];
  label: string;
  center: string;
  size?: number;
}) {
  const r = 40;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label} className="block size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="14" />
        {parts.map((p, i) => {
          const len = p.value * C;
          const el = (
            <motion.circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${C}`}
              initial={{ strokeDashoffset: -offset + len }}
              animate={{ strokeDashoffset: -offset }}
              transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.2, 0.8, 0.2, 1] }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold text-neg">{center}</span>
    </div>
  );
}

/** Weekly volume and negative share, drawn only from real dates. */
export function TrendChart({ reviews }: { reviews: Review[] }) {
  const buckets = new Map<string, { all: number; neg: number }>();
  for (const r of reviews)
    for (const d of r.dates ?? []) {
      const t = new Date(d);
      if (Number.isNaN(t.getTime())) continue;
      const monday = new Date(t);
      monday.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const b = buckets.get(key) ?? { all: 0, neg: 0 };
      b.all += 1;
      if (r.analysis.sentiment === "negative") b.neg += 1;
      buckets.set(key, b);
    }
  const weeks = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (weeks.length < 2) return null;
  const W = 560;
  const H = 180;
  const max = Math.max(...weeks.map((w) => w[1].all));
  const x = (i: number) => 32 + (i * (W - 48)) / (weeks.length - 1);
  const y = (v: number) => H - 24 - (v / max) * (H - 48);
  const yp = (p: number) => H - 24 - p * (H - 48);
  const line = weeks.map((w, i) => `${i ? "L" : "M"}${x(i)} ${y(w[1].all)}`).join(" ");
  const negLine = weeks.map((w, i) => `${i ? "L" : "M"}${x(i)} ${yp(w[1].neg / (w[1].all || 1))}`).join(" ");
  const last = weeks[weeks.length - 1][1];
  const first = weeks[0][1];
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Feedback per week and share negative" className="w-full">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="32" x2={W - 16} y1={yp(g)} y2={yp(g)} stroke="var(--line-soft)" />
        ))}
        <motion.path d={line} fill="none" stroke="var(--bar-2)" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
        <motion.path d={negLine} fill="none" stroke="var(--neg)" strokeWidth="2" strokeDasharray="5 4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.2 }} />
        <text x="32" y={H - 6} fontSize="11" fill="var(--ink-2)">{weeks[0][0]}</text>
        <text x={W - 16} y={H - 6} fontSize="11" fill="var(--ink-2)" textAnchor="end">{weeks[weeks.length - 1][0]}</text>
      </svg>
      <figcaption className="flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-bar-2" />Reports per week, {fmt(first.all)} to {fmt(last.all)}</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-neg" />Share negative, {pct(first.neg / (first.all || 1))} to {pct(last.neg / (last.all || 1))}</span>
      </figcaption>
    </figure>
  );
}

export const SENT_COLOR = {
  negative: "var(--neg)",
  mixed: "var(--mix)",
  neutral: "var(--neu)",
  positive: "var(--pos)",
} as const;
