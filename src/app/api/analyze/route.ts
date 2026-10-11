import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeBatch, liveModel } from "@/lib/llm";
import { analyzeWithRules, withIssue } from "@/lib/rules";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ texts: z.array(z.string().min(1).max(4000)).min(1).max(25) });

/**
 * Live analysis for single reviews and quick results on import.
 * Never fails the request: if the model is missing, slow or returns bad output,
 * the rule baseline answers and the result is marked as such.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Send { texts: string[] } with 1 to 25 reviews." }, { status: 400 });
  }
  const { texts } = parsed.data;
  const fallback = () => texts.map((t) => ({ analysis: analyzeWithRules(t), engine: "rules" as const }));

  if (!liveModel()) {
    return NextResponse.json({ results: fallback(), note: "No live model key is configured, so the rule baseline answered." });
  }
  try {
    const { results, model } = await analyzeBatch(texts);
    const out = texts.map((t, i) => {
      const r = results.find((x) => x.index === i);
      if (!r) return { analysis: analyzeWithRules(t), engine: "rules" as const };
      const a: Analysis = {
        sentiment: r.sentiment,
        aspects: r.aspects,
        severity: r.sentiment === "positive" || r.sentiment === "neutral" ? "none" : r.severity,
        complaint: r.sentiment === "positive" ? null : r.complaint,
        issueId: r.issueId ?? null,
      };
      return { analysis: withIssue(t, a), engine: "llm" as const };
    });
    return NextResponse.json({ results: out, model });
  } catch (e) {
    const reason = e instanceof Error && e.name === "TimeoutError" ? "The live model timed out" : "The live model failed";
    return NextResponse.json({ results: fallback(), note: `${reason}, so the rule baseline answered.` });
  }
}
