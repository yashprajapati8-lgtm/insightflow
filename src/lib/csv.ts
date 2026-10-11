"use client";

import Papa from "papaparse";
import type { Review } from "./types";
import { analyzeWithRules } from "./rules";

export type Role = "text" | "category" | "date" | "source" | "ignore";

export interface ParsedCsv {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  roles: Record<string, Role>;
}

const TEXT_NAMES = /^(review|feedback|text|comment|comments|message|body|content|response|answer)s?$/i;
const CAT_NAMES = /^(category|topic|type|label|theme|department)$/i;
const DATE_NAMES = /^(date|created|created_at|timestamp|time|submitted|submitted_at|review_date)$/i;
const SRC_NAMES = /^(source|channel|platform|origin)$/i;

function looksLikeDate(values: string[]) {
  const sample = values.filter(Boolean).slice(0, 30);
  return sample.length > 0 && sample.filter((v) => !Number.isNaN(Date.parse(v)) && /\d/.test(v)).length / sample.length > 0.8;
}

/** Finds the feedback text column automatically, plus optional category, date and source. */
export function detectRoles(headers: string[], rows: Record<string, string>[]): Record<string, Role> {
  const roles: Record<string, Role> = {};
  for (const h of headers) roles[h] = "ignore";
  const avgLen = (h: string) => rows.slice(0, 200).reduce((s, r) => s + (r[h]?.length ?? 0), 0) / Math.min(200, rows.length || 1);
  const text = headers.find((h) => TEXT_NAMES.test(h.trim())) ?? [...headers].sort((a, b) => avgLen(b) - avgLen(a))[0];
  if (text) roles[text] = "text";
  for (const h of headers) {
    if (h === text) continue;
    const name = h.trim();
    if (CAT_NAMES.test(name)) roles[h] = "category";
    else if (DATE_NAMES.test(name) || looksLikeDate(rows.slice(0, 50).map((r) => r[h]))) roles[h] = "date";
    else if (SRC_NAMES.test(name)) roles[h] = "source";
  }
  return roles;
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = (res.meta.fields ?? []).filter(Boolean);
        if (headers.length === 0) return reject(new Error("The file has no header row. Add one, for example: review"));
        if (res.data.length === 0) return reject(new Error("The file has a header but no rows."));
        resolve({ fileName: file.name, headers, rows: res.data, roles: detectRoles(headers, res.data) });
      },
      error: (err) => reject(new Error(`Could not read the file: ${err.message}`)),
    });
  });
}

/** Groups exact repeats and applies the rule baseline so the dashboard is usable instantly. */
export function toReviews(csv: ParsedCsv) {
  const col = (role: Role) => Object.entries(csv.roles).find(([, r]) => r === role)?.[0];
  const textCol = col("text");
  const catCol = col("category");
  const dateCol = col("date");
  const srcCol = col("source");
  if (!textCol) throw new Error("Choose which column holds the feedback text.");

  const groups = new Map<string, Review>();
  let empty = 0;
  let used = 0;
  for (const row of csv.rows) {
    const text = (row[textCol] ?? "").trim();
    if (!text) {
      empty++;
      continue;
    }
    used++;
    const key = text.toLowerCase();
    const date = dateCol ? row[dateCol]?.trim() : undefined;
    const iso = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : undefined;
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (iso) g.dates = [...(g.dates ?? []), iso];
      continue;
    }
    groups.set(key, {
      id: `c${groups.size + 1}`,
      text,
      category: catCol ? row[catCol]?.trim() || null : null,
      count: 1,
      source: "csv",
      channel: srcCol ? row[srcCol]?.trim() || undefined : undefined,
      dates: iso ? [iso] : undefined,
      analysis: analyzeWithRules(text),
      engine: "rules",
      provisional: true,
    });
  }
  const reviews = [...groups.values()].sort((a, b) => b.count - a.count);
  return { reviews, used, empty, hasDates: reviews.some((r) => (r.dates?.length ?? 0) > 0), hasCategory: !!catCol };
}
