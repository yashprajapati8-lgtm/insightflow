import { z } from "zod";
import type { Analysis } from "./types";
import { ISSUES } from "./taxonomy";

const SENT = ["positive", "negative", "mixed", "neutral"] as const;
const SEV = ["critical", "high", "medium", "low", "none"] as const;

/** The JSON shape every model (live or Adaption) must return for one review. */
export const AnalysisSchema = z.object({
  sentiment: z.enum(SENT),
  aspects: z
    .array(z.object({ topic: z.string().min(1).max(40), sentiment: z.enum(["positive", "negative", "neutral"]) }))
    .max(6),
  severity: z.enum(SEV),
  complaint: z.string().max(80).nullable(),
  issueId: z.string().nullable().optional(),
});

/** Parse and validate a model's raw text output. Returns null when it is unusable. */
export function parseAnalysis(raw: string): Analysis | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    const res = AnalysisSchema.safeParse(obj);
    if (!res.success) return null;
    const a = res.data;
    const issueId = a.issueId && ISSUES.some((i) => i.id === a.issueId) ? a.issueId : null;
    return {
      sentiment: a.sentiment,
      aspects: a.aspects,
      severity: a.sentiment === "positive" ? "none" : a.severity,
      complaint: a.sentiment === "positive" ? null : a.complaint,
      issueId,
    };
  } catch {
    return null;
  }
}
