import LZString from "lz-string";
import type { RankedIssue, Review, TrackedIssue, DatasetMeta } from "./types";
import { praiseThemes } from "./derive";
import { ACT_NOW } from "./scoring";

export interface ReportSnapshot {
  v: 1;
  audience: "Leadership" | "Team";
  preparedAt: string;
  dataset: { name: string; rows: number; distinct: number; hasDates: boolean };
  summary: string;
  risks: { name: string; rows: number; score: number; owner: string; status: string }[];
  resolved: string[];
  actions: { text: string; owner: string }[];
  working: { topic: string; rows: number; quote: string; count: number }[];
  notes: { issue: string; text: string }[];
  sections: Record<SectionKey, boolean>;
}

export type SectionKey = "summary" | "risks" | "actions" | "working" | "notes" | "data";
export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  risks: "Open risks",
  actions: "Recommended actions",
  working: "What is working",
  notes: "Team notes",
  data: "About this data",
};

const n = (x: number) => Math.round(x).toLocaleString("en-US");

/** The summary is assembled from computed numbers, so it cannot state anything the data does not support. */
function summaryOf(ranked: RankedIssue[], reviews: Review[]) {
  const urgent = ranked.filter((r) => r.score >= ACT_NOW);
  const most = [...ranked].sort((a, b) => b.rows - a.rows)[0];
  const rows = reviews.reduce((s, r) => s + r.count, 0);
  const neg = reviews.filter((r) => r.analysis.sentiment === "negative").reduce((s, r) => s + r.count, 0);
  const parts: string[] = [];
  parts.push(`${Math.round((neg / (rows || 1)) * 100)}% of ${n(rows)} reports are negative.`);
  if (urgent.length) {
    parts.push(
      `${urgent.length === 1 ? "One issue needs" : `${urgent.length} issues need`} action now: ${urgent
        .map((u) => `${u.name.toLowerCase()} (${n(u.rows)} reports)`)
        .join(" and ")}.`,
    );
  }
  if (most && urgent[0] && most.id !== urgent[0].id) {
    parts.push(`${most.name} has the most reports, ${n(most.rows)}, but ranks lower because of its severity.`);
  }
  return parts.join(" ");
}

export function buildReport(args: {
  audience: "Leadership" | "Team";
  sections: Record<SectionKey, boolean>;
  ranked: RankedIssue[];
  reviews: Review[];
  tracker: Record<string, TrackedIssue>;
  meta: DatasetMeta;
}): ReportSnapshot {
  const { audience, sections, ranked, reviews, tracker, meta } = args;
  const tracked = ranked.filter((r) => tracker[r.id]);
  const open = tracked.filter((r) => tracker[r.id].status !== "Resolved");
  const pool = open.length ? open : ranked.filter((r) => r.score >= ACT_NOW);
  const list = audience === "Leadership" ? pool.slice(0, 3) : pool;
  return {
    v: 1,
    audience,
    preparedAt: new Date().toISOString(),
    dataset: { name: meta.name, rows: meta.rows, distinct: meta.distinct, hasDates: meta.hasDates },
    summary: summaryOf(ranked, reviews),
    risks: list.map((r) => ({
      name: r.name,
      rows: r.rows,
      score: Math.round(r.score),
      owner: r.owner,
      status: tracker[r.id]?.status ?? "Not tracked",
    })),
    resolved: tracked.filter((r) => tracker[r.id].status === "Resolved").map((r) => r.name),
    actions: list.map((r) => ({ text: r.action, owner: r.owner })),
    working: praiseThemes(reviews)
      .slice(0, audience === "Leadership" ? 2 : 4)
      .map((p) => ({ topic: p.topic, rows: p.rows, quote: p.top?.text ?? "", count: p.top?.count ?? 0 })),
    notes:
      audience === "Team"
        ? tracked.flatMap((r) => tracker[r.id].notes.map((x) => ({ issue: r.name, text: x.text })))
        : [],
    sections: { ...sections, notes: audience === "Team" && sections.notes },
  };
}

export function encodeReport(r: ReportSnapshot) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(r));
}

export function decodeReport(s: string): ReportSnapshot | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const r = JSON.parse(json);
    return r && r.v === 1 ? (r as ReportSnapshot) : null;
  } catch {
    return null;
  }
}
