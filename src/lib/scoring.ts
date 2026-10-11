import type { RankedIssue, Review, Weights } from "./types";
import { ISSUES, OTHER_ISSUE, SEVERITY_WEIGHT, issueById } from "./taxonomy";

export const DEFAULT_WEIGHTS: Weights = { volume: 35, negativity: 30, severity: 25, momentum: 10 };
export const ACT_NOW = 85;

/**
 * Momentum: how much of an issue's reports fall in the most recent third of the
 * dataset's time range. 0 = no recent growth, 1 = all reports are recent.
 * Returns null when the data has no dates, so it is never invented.
 */
function momentumOf(reviews: Review[], range: { min: number; max: number } | null): number | null {
  if (!range || range.max <= range.min) return null;
  const cut = range.max - (range.max - range.min) / 3;
  let recent = 0;
  let all = 0;
  for (const r of reviews) {
    for (const d of r.dates ?? []) {
      const t = Date.parse(d);
      if (Number.isNaN(t)) continue;
      all++;
      if (t >= cut) recent++;
    }
  }
  if (all === 0) return null;
  const share = recent / all;
  return Math.max(0, Math.min(1, (share - 1 / 3) / (2 / 3)));
}

export function dateRange(reviews: Review[]) {
  let min = Infinity;
  let max = -Infinity;
  for (const r of reviews)
    for (const d of r.dates ?? []) {
      const t = Date.parse(d);
      if (Number.isNaN(t)) continue;
      if (t < min) min = t;
      if (t > max) max = t;
    }
  return Number.isFinite(min) ? { min, max } : null;
}

/** Ranks issues. Every number here is computed in code; the AI only labels reviews. */
export function rankIssues(reviews: Review[], w: Weights): RankedIssue[] {
  const byIssue = new Map<string, Review[]>();
  for (const r of reviews) {
    const id = r.analysis.issueId;
    if (!id) continue;
    const list = byIssue.get(id) ?? [];
    list.push(r);
    byIssue.set(id, list);
  }
  const range = dateRange(reviews);
  const maxRows = Math.max(1, ...[...byIssue.values()].map((l) => l.reduce((s, r) => s + r.count, 0)));

  const ranked: RankedIssue[] = [];
  for (const [id, list] of byIssue) {
    const def = issueById(id) ?? OTHER_ISSUE;
    const rows = list.reduce((s, r) => s + r.count, 0);
    const negRows = list.reduce(
      (s, r) => s + (r.analysis.sentiment === "negative" ? r.count : r.analysis.sentiment === "mixed" ? r.count * 0.5 : 0),
      0,
    );
    const momentum = momentumOf(list, range);
    const useMomentum = momentum !== null;
    const total = w.volume + w.negativity + w.severity + (useMomentum ? w.momentum : 0) || 1;
    const vol = rows / maxRows;
    const neg = negRows / rows;
    const sev = SEVERITY_WEIGHT[def.severity];
    const parts = {
      volume: (100 * w.volume * vol) / total,
      negativity: (100 * w.negativity * neg) / total,
      severity: (100 * w.severity * sev) / total,
      momentum: useMomentum ? (100 * w.momentum * (momentum as number)) / total : 0,
    };
    const cats = new Map<string, number>();
    for (const r of list) if (r.category) cats.set(r.category, (cats.get(r.category) ?? 0) + r.count);
    const category = [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    ranked.push({
      id,
      name: def.name,
      owner: def.owner,
      category,
      rows,
      distinct: list.length,
      negativeShare: neg,
      severity: def.severity,
      parts,
      score: parts.volume + parts.negativity + parts.severity + parts.momentum,
      momentum,
      reviews: [...list].sort((a, b) => b.count - a.count),
      action: def.action,
    });
  }
  return ranked.sort((a, b) => b.score - a.score);
}

/** A one-sentence explanation of a rank, built from the numbers, not written by a model. */
export function explainRank(issue: RankedIssue, all: RankedIssue[]): string {
  const rank = all.findIndex((i) => i.id === issue.id) + 1;
  const mostReported = [...all].sort((a, b) => b.rows - a.rows)[0];
  const neg = Math.round(issue.negativeShare * 100);
  const sevText: Record<string, string> = {
    critical: "describes money lost, the highest severity tier",
    high: "leaves the order unusable, the high severity tier",
    medium: "costs customers time rather than money, the medium tier",
    low: "is a minor annoyance, the lowest tier",
  };
  const parts: string[] = [];
  parts.push(`${issue.rows.toLocaleString("en-US")} reports, ${neg}% negative, and it ${sevText[issue.severity]}.`);
  if (mostReported && mostReported.id === issue.id && rank > 1) {
    parts.push(`It is the most reported issue, but severity places it at rank ${rank}.`);
  } else if (mostReported && mostReported.id !== issue.id && rank < all.findIndex((i) => i.id === mostReported.id) + 1) {
    parts.push(
      `It ranks above "${mostReported.name}", which has more reports (${mostReported.rows.toLocaleString("en-US")}), because its severity is higher.`,
    );
  }
  if (issue.momentum !== null && issue.momentum > 0.3) parts.push("Reports are growing in the most recent period.");
  return parts.join(" ");
}

export const ALL_ISSUE_IDS = [...ISSUES.map((i) => i.id), OTHER_ISSUE.id];
