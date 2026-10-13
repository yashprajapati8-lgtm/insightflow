/**
 * Builds public/synthetic-dated-example.csv: a SYNTHETIC file with dates, so the trend chart and the
 * momentum part of the priority score can be demonstrated. The Build Battle dataset has no dates.
 *
 * - Review texts and categories come from the sample, unchanged. Counts are scaled down to about a fifth.
 * - Each row gets a date in the 12 weeks before 11 Oct 2026, with a known pattern planted:
 *     website crashes at checkout rise sharply in the last weeks, delivery delays fall
 *     (as if a fix shipped), everything else stays flat.
 * - The file name says "synthetic", and the app labels it as an example wherever it is offered.
 *
 * Run: npm run build:example
 */
import { readFileSync, writeFileSync } from "node:fs";
import Papa from "papaparse";
import type { Review } from "../src/lib/types";

let seed = 20261013;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const DAYS = 84;
const END = Date.UTC(2026, 9, 11); // 11 Oct 2026
const START = END - (DAYS - 1) * 86400000;

// Relative weight over time t in [0, 1] for each issue; flat by default.
const SHAPE: Record<string, (t: number) => number> = {
  "checkout-crash": (t) => 0.25 + 2.2 * t * t,
  "delivery-delay": (t) => 0.12 + 2.2 * (1 - t) * (1 - t),
};

function pickDay(shape: (t: number) => number) {
  // Rejection sampling against the shape's maximum.
  const max = Math.max(...Array.from({ length: 21 }, (_, i) => shape(i / 20)));
  for (;;) {
    const d = Math.floor(rand() * DAYS);
    if (rand() * max <= shape(d / (DAYS - 1))) return d;
  }
}

const sample = JSON.parse(readFileSync("src/data/sample.json", "utf8")) as { reviews: Review[] };
const SOURCES = ["App review", "Email", "Survey", "Chat"];
const rows: { review: string; category: string; date: string; source: string }[] = [];

for (const r of sample.reviews) {
  const n = Math.max(r.count >= 3 ? 1 : 0, Math.round(r.count / 5));
  const shape = SHAPE[r.analysis.issueId ?? ""] ?? (() => 1);
  for (let k = 0; k < n; k++) {
    const day = pickDay(shape);
    const date = new Date(START + day * 86400000).toISOString().slice(0, 10);
    rows.push({ review: r.text, category: r.category ?? "", date, source: SOURCES[Math.floor(rand() * SOURCES.length)] });
  }
}
rows.sort((a, b) => a.date.localeCompare(b.date));
writeFileSync("public/synthetic-dated-example.csv", Papa.unparse(rows));
console.log(`Synthetic dated example: ${rows.length} rows, ${new Set(rows.map((r) => r.review)).size} distinct reviews.`);
