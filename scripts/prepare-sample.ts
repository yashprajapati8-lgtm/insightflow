/**
 * Runs before `next build` (see package.json). Fetches the latest finished Adaption run for the sample
 * and builds its labels into src/data/sample.json, so every visitor sees Adaption's analysis.
 *
 * - Only downloads results that already exist: it lists datasets and downloads the newest succeeded
 *   InsightFlow run of sample size. It never starts a run, so it uses no credits.
 * - Needs ADAPTION_API_KEY (set on Vercel; read from .env.local when run locally).
 * - Never fails the build: on any problem it logs why and keeps the committed sample.json.
 *
 * Run locally: npm run prepare:sample
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import Papa from "papaparse";

try {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
} catch {
  // Not fatal: the key may come from the environment instead.
}

const KEY = process.env.ADAPTION_API_KEY;
const BASE = "https://api.prod.adaptionlabs.ai/api/v1";
const OUT = "data/adaption-output.csv";

async function call(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res;
}

type Listed = { dataset_id: string; name?: string; status: string; row_count?: number; created_at: string };

/** Same logic as extractRows in src/lib/adaption.ts (that module is server-only, so it cannot be imported here). */
function extractRows(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
  return parsed
    .map((row) => {
      const cells = Object.entries(row);
      const json = cells.find(([, v]) => typeof v === "string" && v.includes("{") && v.includes("sentiment"));
      const review =
        row.review ??
        cells.find(([k]) => /review|context/i.test(k))?.[1] ??
        cells.filter(([, v]) => v && v !== json?.[1]).sort((a, b) => b[1].length - a[1].length)[0]?.[1];
      return { id: row.id ?? "", review: review ?? "", completion: json?.[1] ?? "" };
    })
    .filter((r) => r.completion);
}

async function main() {
  if (!KEY) {
    console.log("[prepare-sample] No ADAPTION_API_KEY, keeping the committed sample.");
    return;
  }
  const lists: Listed[] = [];
  for (const query of ["?status=succeeded&q=insightflow&limit=50", "?status=succeeded&limit=50"]) {
    const body = (await (await call(`/datasets${query}`)).json()) as { datasets?: Listed[] };
    lists.push(...(body.datasets ?? []));
    if (lists.length) break;
  }
  const candidates = lists
    .filter((d) => d.status === "succeeded" && (d.row_count === undefined || (d.row_count >= 250 && d.row_count <= 400)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const d of candidates) {
    try {
      const csv = await (await call(`/datasets/${encodeURIComponent(d.dataset_id)}/download?fileFormat=csv`)).text();
      const rows = extractRows(csv);
      if (rows.length < 250) {
        console.log(`[prepare-sample] ${d.dataset_id} has only ${rows.length} answers, trying an older run.`);
        continue;
      }
      writeFileSync(OUT, Papa.unparse(rows.map((r) => ({ id: r.id, review: r.review, completion: r.completion }))));
      console.log(`[prepare-sample] Downloaded ${rows.length} Adaption answers from run ${d.dataset_id} (${d.created_at}).`);
      return;
    } catch (e) {
      console.log(`[prepare-sample] Could not download ${d.dataset_id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("[prepare-sample] No finished InsightFlow run found, keeping the committed sample.");
}

main()
  .catch((e) => console.log(`[prepare-sample] Skipped: ${e instanceof Error ? e.message : e}`))
  .finally(() => {
    if (!existsSync(OUT)) return;
    const before = readFileSync("src/data/sample.json", "utf8");
    try {
      execSync("npx tsx scripts/build-sample.ts", { stdio: "inherit" });
      const after = JSON.parse(readFileSync("src/data/sample.json", "utf8")) as { reviews: { engine: string }[] };
      const n = after.reviews.filter((r) => r.engine === "adaption").length;
      if (n === 0) {
        writeFileSync("src/data/sample.json", before);
        console.log("[prepare-sample] No usable Adaption labels, restored the committed sample.");
      } else console.log(`[prepare-sample] ${n} of ${after.reviews.length} sample reviews now carry Adaption's labels.`);
    } catch (e) {
      writeFileSync("src/data/sample.json", before);
      console.log(`[prepare-sample] Building the sample failed, keeping the committed one: ${e instanceof Error ? e.message : e}`);
    }
  });
