export type Sentiment = "positive" | "negative" | "mixed" | "neutral";
export type Severity = "critical" | "high" | "medium" | "low" | "none";
export type Engine = "adaption" | "llm" | "rules";
export type Source = "sample" | "csv" | "manual";

export interface Aspect {
  topic: string;
  sentiment: Exclude<Sentiment, "mixed">;
}

export interface Analysis {
  sentiment: Sentiment;
  aspects: Aspect[];
  severity: Severity;
  complaint: string | null;
  issueId: string | null;
}

/** One distinct piece of feedback. Exact repeats are grouped into `count`. */
export interface Review {
  id: string;
  text: string;
  category: string | null;
  count: number;
  source: Source;
  channel?: string;
  /** ISO date strings for every occurrence, when the import had a date column. */
  dates?: string[];
  analysis: Analysis;
  engine: Engine;
  /** True until a batch (Adaption) result confirms a live or rule-based label. */
  provisional: boolean;
  /** Set when a person corrected the labels. */
  corrected?: boolean;
}

export interface IssueDef {
  id: string;
  name: string;
  owner: string;
  severity: Exclude<Severity, "none">;
  complaint: string;
  action: string;
  match: RegExp;
}

export interface Weights {
  volume: number;
  negativity: number;
  severity: number;
  momentum: number;
}

export interface RankedIssue {
  id: string;
  name: string;
  owner: string;
  category: string | null;
  rows: number;
  distinct: number;
  negativeShare: number;
  severity: Exclude<Severity, "none">;
  parts: { volume: number; negativity: number; severity: number; momentum: number };
  score: number;
  momentum: number | null;
  reviews: Review[];
  action: string;
}

export type TrackStatus = "Open" | "Investigating" | "Fixing" | "Resolved";

export interface TrackedIssue {
  issueId: string;
  status: TrackStatus;
  notes: { text: string; at: string }[];
  log: { text: string; at: string }[];
}

export interface DatasetMeta {
  name: string;
  rows: number;
  distinct: number;
  hasDates: boolean;
  hasCategory: boolean;
  importedAt: string;
}
