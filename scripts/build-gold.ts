/**
 * Turns your hand labels (data/gold-labels.csv) into src/data/gold.json,
 * which the Pipeline page uses to measure accuracy. Run: npm run build:gold
 */
import { readFileSync, writeFileSync } from "node:fs";
import Papa from "papaparse";

const SENT = ["positive", "negative", "mixed", "neutral"];
const SEV = ["critical", "high", "medium", "low", "none"];
const rows = Papa.parse<Record<string, string>>(readFileSync("data/gold-labels.csv", "utf8"), { header: true, skipEmptyLines: true }).data;
const gold = rows
  .map((r) => ({ text: r.text?.trim(), sentiment: r.sentiment?.trim().toLowerCase(), severity: r.severity?.trim().toLowerCase() }))
  .filter((r) => r.text && SENT.includes(r.sentiment) && SEV.includes(r.severity));
writeFileSync("src/data/gold.json", JSON.stringify(gold, null, 1));
console.log(`${gold.length} labeled reviews written, ${rows.length - gold.length} skipped (blank or invalid labels)`);
