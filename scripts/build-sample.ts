/**
 * Builds src/data/sample.json from data/sample.csv.
 *
 * 1. Groups exact repeats so each distinct review is analyzed once, keeping its count.
 * 2. Uses Adaption's batch output (data/adaption-output.csv, columns: id, completion) when present.
 * 3. Falls back to the deterministic rules for any review Adaption did not return.
 *
 * Run: npm run build:sample
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import Papa from "papaparse";
import { analyzeWithRules, withIssue } from "../src/lib/rules";
import { parseAnalysis } from "../src/lib/parse";
import type { Review } from "../src/lib/types";

type Row = { review: string; category: string };

const csv = readFileSync("data/sample.csv", "utf8");
const rows = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true }).data;

const groups = new Map<string, { text: string; category: string; count: number }>();
for (const r of rows) {
  const text = (r.review ?? "").trim();
  if (!text) continue;
  const g = groups.get(text);
  if (g) g.count += 1;
  else groups.set(text, { text, category: (r.category ?? "").trim(), count: 1 });
}

const distinct = [...groups.values()].sort((a, b) => b.count - a.count);

// Optional Adaption results, keyed by review id (r001...).
const adaption = new Map<string, string>();
if (existsSync("data/adaption-output.csv")) {
  const out = Papa.parse<Record<string, string>>(readFileSync("data/adaption-output.csv", "utf8"), {
    header: true,
    skipEmptyLines: true,
  }).data;
  for (const o of out) if (o.id && o.completion) adaption.set(o.id, o.completion);
}

let fromAdaption = 0;
const reviews: Review[] = distinct.map((g, i) => {
  const id = `r${String(i + 1).padStart(3, "0")}`;
  const raw = adaption.get(id);
  const parsed = raw ? parseAnalysis(raw) : null;
  if (parsed) fromAdaption++;
  return {
    id,
    text: g.text,
    category: g.category || null,
    count: g.count,
    source: "sample",
    analysis: parsed ? withIssue(g.text, parsed) : analyzeWithRules(g.text),
    engine: parsed ? "adaption" : "rules",
    provisional: !parsed,
  };
});

writeFileSync(
  "src/data/sample.json",
  JSON.stringify({ name: "Build Battle sample", rows: rows.length, reviews }, null, 0),
);

// The distinct reviews, ready to upload to Adaption as one batch job.
writeFileSync(
  "data/adaption-input.csv",
  Papa.unparse(reviews.map((r) => ({ id: r.id, review: r.text }))),
);

console.log(
  `rows ${rows.length}, distinct ${reviews.length}, from Adaption ${fromAdaption}, from rules ${reviews.length - fromAdaption}`,
);
