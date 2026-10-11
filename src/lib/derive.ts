"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { rankIssues } from "./scoring";
import type { Review, Sentiment } from "./types";

export const SENTIMENTS: Sentiment[] = ["negative", "mixed", "neutral", "positive"];

export function weightOf(r: Review, mode: "rows" | "distinct") {
  return mode === "rows" ? r.count : 1;
}

export function sentimentTotals(reviews: Review[], mode: "rows" | "distinct") {
  const t: Record<Sentiment, number> = { negative: 0, mixed: 0, neutral: 0, positive: 0 };
  let all = 0;
  for (const r of reviews) {
    const w = weightOf(r, mode);
    t[r.analysis.sentiment] += w;
    all += w;
  }
  return { ...t, all };
}

export function byCategory(reviews: Review[], mode: "rows" | "distinct") {
  const m = new Map<string, Review[]>();
  for (const r of reviews) {
    const c = r.category ?? "Uncategorized";
    const l = m.get(c) ?? [];
    l.push(r);
    m.set(c, l);
  }
  return [...m.entries()]
    .map(([name, list]) => ({ name, list, ...sentimentTotals(list, mode) }))
    .sort((a, b) => b.negative / (b.all || 1) - a.negative / (a.all || 1));
}

/** Positive themes, for "What is working". */
export function praiseThemes(reviews: Review[]) {
  const m = new Map<string, { rows: number; top: Review | null }>();
  for (const r of reviews) {
    for (const a of r.analysis.aspects) {
      if (a.sentiment !== "positive") continue;
      const cur = m.get(a.topic) ?? { rows: 0, top: null };
      cur.rows += r.count;
      if (!cur.top || r.count > cur.top.count) cur.top = r;
      m.set(a.topic, cur);
    }
  }
  return [...m.entries()].map(([topic, v]) => ({ topic, ...v })).sort((a, b) => b.rows - a.rows);
}

export function useDerived() {
  const reviews = useStore((s) => s.reviews);
  const weights = useStore((s) => s.weights);
  const meta = useStore((s) => s.meta);
  const countMode = useStore((s) => s.countMode);
  return useMemo(() => {
    const ranked = rankIssues(reviews, weights);
    const rows = reviews.reduce((s, r) => s + r.count, 0);
    return {
      reviews,
      meta,
      weights,
      countMode,
      ranked,
      rows,
      distinct: reviews.length,
      repeats: rows - reviews.length,
      totals: sentimentTotals(reviews, countMode),
      totalsRows: sentimentTotals(reviews, "rows"),
      categories: byCategory(reviews, countMode),
      provisional: reviews.filter((r) => r.provisional).length,
      engines: {
        adaption: reviews.filter((r) => r.engine === "adaption").length,
        llm: reviews.filter((r) => r.engine === "llm").length,
        rules: reviews.filter((r) => r.engine === "rules").length,
      },
    };
  }, [reviews, weights, meta, countMode]);
}
