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
const weekOf = (d: string) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  const monday = new Date(t);
  monday.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
};

/**
 * Weekly reports, plus the issue rising fastest and the one falling fastest, compared across the
 * first and last third of the period. Everything here is counted from the dates in the data.
 */
export function TrendChart({ reviews, names = {} }: { reviews: Review[]; names?: Record<string, string> }) {
  const total = new Map<string, number>();
  const neg = new Map<string, number>();
  const byIssue = new Map<string, Map<string, number>>();
  for (const r of reviews)
    for (const d of r.dates ?? []) {
      const k = weekOf(d);
      if (!k) continue;
      total.set(k, (total.get(k) ?? 0) + 1);
      if (r.analysis.sentiment === "negative") neg.set(k, (neg.get(k) ?? 0) + 1);
      const id = r.analysis.issueId;
      if (id && id !== "other" && r.analysis.sentiment !== "positive") {
        const m = byIssue.get(id) ?? new Map<string, number>();
        m.set(k, (m.get(k) ?? 0) + 1);
        byIssue.set(id, m);
      }
    }
  const weeks = [...total.keys()].sort();
  if (weeks.length < 2) return null;

  // Compare the first and last third of the weeks for every issue with enough reports.
  const third = Math.max(1, Math.floor(weeks.length / 3));
  const head = weeks.slice(0, third);
  const tail = weeks.slice(-third);
  const sum = (m: Map<string, number>, ws: string[]) => ws.reduce((s, w) => s + (m.get(w) ?? 0), 0);
  const moves = [...byIssue.entries()]
    .map(([id, m]) => ({ id, m, first: sum(m, head), last: sum(m, tail) }))
    .filter((x) => x.first + x.last >= 8)
    .map((x) => ({ ...x, ratio: (x.last + 1) / (x.first + 1) }));
  const up = [...moves].sort((a, b) => b.ratio - a.ratio)[0];
  const down = [...moves].sort((a, b) => a.ratio - b.ratio)[0];
  const series = [
    up && up.ratio >= 1.5 ? { ...up, color: "var(--neg)", label: "Rising fastest" } : null,
    down && down.ratio <= 0.67 && down.id !== up?.id ? { ...down, color: "var(--pos)", label: "Falling fastest" } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);

  const W = 560;
  const H = 190;
  const x = (i: number) => 36 + (i * (W - 52)) / (weeks.length - 1);
  const maxTotal = Math.max(...weeks.map((w) => total.get(w) ?? 0), 1);
  const maxIssue = Math.max(1, ...series.flatMap((s) => weeks.map((w) => s.m.get(w) ?? 0)));
  const yT = (v: number) => H - 26 - (v / maxTotal) * (H - 52);
  const yI = (v: number) => H - 26 - (v / maxIssue) * (H - 52);
  const path = (vals: number[], y: (v: number) => number) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const totalVals = weeks.map((w) => total.get(w) ?? 0);
  const first = { all: totalVals[0], neg: neg.get(weeks[0]) ?? 0 };
  const lastW = weeks[weeks.length - 1];
  const last = { all: totalVals[totalVals.length - 1], neg: neg.get(lastW) ?? 0 };
  const label = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <figure className="flex flex-col gap-2.5">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Reports per week, with the fastest rising and falling issues" className="w-full">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="36" x2={W - 16} y1={H - 26 - g * (H - 52)} y2={H - 26 - g * (H - 52)} stroke="var(--line-soft)" />
        ))}
        <motion.path
          d={`${path(totalVals, yT)} L${x(weeks.length - 1)} ${H - 26} L${x(0)} ${H - 26} Z`}
          fill="var(--bar-2)"
          opacity={0.12}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.12 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path d={path(totalVals, yT)} fill="none" stroke="var(--bar-2)" strokeWidth="1.5" opacity={0.7} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
        {series.map((s, i) => {
          const vals = weeks.map((w) => s.m.get(w) ?? 0);
          return (
            <g key={s.id}>
              <motion.path
                d={path(vals, yI)}
                fill="none"
                stroke={s.color}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: 0.3 + i * 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              />
              <motion.circle
                cx={x(weeks.length - 1)}
                cy={yI(vals[vals.length - 1])}
                r="4"
                fill={s.color}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.2 + i * 0.25 }}
              />
            </g>
          );
        })}
        <text x="36" y={H - 8} fontSize="11" fill="var(--ink-2)">{label(weeks[0])}</text>
        <text x={W - 16} y={H - 8} fontSize="11" fill="var(--ink-2)" textAnchor="end">{label(lastW)}</text>
      </svg>
      <figcaption className="flex flex-col gap-1.5 text-xs text-ink-2">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-2">
            <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} />
            <span>
              <span className="font-semibold text-ink">{s.label}:</span> {names[s.id] ?? s.id}, {fmt(s.first)} reports in the first
              {" "}{third === 1 ? "week" : `${third} weeks`}, {fmt(s.last)} in the last {third === 1 ? "week" : `${third} weeks`}
            </span>
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-bar-2/40" />
          All reports per week, {fmt(first.all)} to {fmt(last.all)}. Share negative {pct(first.neg / (first.all || 1))} to{" "}
          {pct(last.neg / (last.all || 1))}.
        </span>
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
