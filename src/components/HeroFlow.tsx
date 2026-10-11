"use client";

import { motion, useReducedMotion } from "motion/react";

type Props = { rows: number; distinct: number; issues: { name: string; score: number; act: boolean }[] };

/** The landing visual, built from the real sample: rows collapse to distinct reviews, then to ranked issues. */
export function HeroFlow({ rows, distinct, issues }: Props) {
  const reduce = useReducedMotion();
  const t = (d: number) => (reduce ? 0 : d);
  const dense = Array.from({ length: 28 * 28 });
  const sparse = Array.from({ length: 8 * 8 });
  const max = Math.max(...issues.map((i) => i.score));
  const n = (x: number) => x.toLocaleString("en-US");

  return (
    <figure className="relative m-0 overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-attn/20 blur-3xl" />
      <svg viewBox="0 0 640 300" role="img" aria-label={`${n(rows)} reports become ${n(distinct)} distinct reviews, then ${issues.length} ranked issues`} className="relative block w-full">
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: t(0.6) }}>
          {dense.map((_, i) => (
            <circle key={i} cx={6 + (i % 28) * 6} cy={46 + Math.floor(i / 28) * 6} r={1.4} fill="var(--bar-2)" opacity={0.85} />
          ))}
          <text x="0" y="236" fontSize="15" fontWeight="600" fill="var(--ink)">{n(rows)} reports</text>
          <text x="0" y="256" fontSize="13" fill="var(--ink-2)">{Math.round(((rows - distinct) / rows) * 100)}% are repeats</text>
        </motion.g>

        <motion.g initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: t(0.7), duration: t(0.5) }}>
          <path d="M184 128 H214" stroke="var(--ink-3)" strokeWidth="1.5" />
          <path d="M208 122 L216 128 L208 134" stroke="var(--ink-3)" strokeWidth="1.5" fill="none" />
          {sparse.map((_, i) => (
            <motion.circle
              key={i}
              cx={236 + (i % 8) * 11}
              cy={86 + Math.floor(i / 8) * 11}
              r={2.4}
              fill="var(--ink)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: t(0.8 + i * 0.006), duration: t(0.3) }}
            />
          ))}
          <text x="230" y="236" fontSize="15" fontWeight="600" fill="var(--ink)">{n(distinct)} distinct</text>
          <text x="230" y="256" fontSize="13" fill="var(--ink-2)">analyzed once each</text>
          <path d="M338 128 H368" stroke="var(--ink-3)" strokeWidth="1.5" />
          <path d="M362 122 L370 128 L362 134" stroke="var(--ink-3)" strokeWidth="1.5" fill="none" />
        </motion.g>

        <g>
          {issues.map((iss, i) => (
            <motion.rect
              key={iss.name}
              x={386}
              y={40 + i * 17}
              height={11}
              rx={3}
              fill={iss.act ? "var(--attn)" : i < 6 ? "var(--ink)" : "var(--bar-2)"}
              initial={{ width: 0 }}
              animate={{ width: (iss.score / max) * 200 }}
              transition={{ delay: t(1.4 + i * 0.07), duration: t(0.5), ease: [0.2, 0.8, 0.2, 1] }}
            />
          ))}
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: t(2.2), duration: t(0.4) }}>
            {issues.filter((i) => i.act).map((iss, i) => (
              <text key={iss.name} x={386 + (iss.score / max) * 200 + 6} y={49 + i * 17} fontSize="11.5" fontWeight="700" fill="var(--attn-text)">
                {Math.round(iss.score)}
              </text>
            ))}
            <text x="386" y="236" fontSize="15" fontWeight="600" fill="var(--ink)">{issues.length} ranked issues</text>
            <text x="386" y="256" fontSize="13" fill="var(--ink-2)">{issues.filter((i) => i.act).length} need action now</text>
          </motion.g>
        </g>
      </svg>
      <figcaption className="relative mt-3 text-[13px] text-ink-2">
        The Build Battle sample, from raw rows to decisions. Amber marks the issues to act on now.
      </figcaption>
    </figure>
  );
}
