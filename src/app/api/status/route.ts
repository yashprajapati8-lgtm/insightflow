import { NextResponse } from "next/server";
import sample from "@/data/sample.json";
import { adaptionConfigured, adaptionRunsAllowed } from "@/lib/adaption";
import { liveModel } from "@/lib/llm";
import type { Review } from "@/lib/types";

export const dynamic = "force-dynamic";

/** What this deployment runs on, without exposing any key: engines connected and who labeled the sample. */
export function GET() {
  const reviews = (sample as { reviews: Review[] }).reviews;
  const engines: Record<string, number> = {};
  for (const r of reviews) engines[r.engine] = (engines[r.engine] ?? 0) + 1;
  return NextResponse.json({
    sample: { distinct: reviews.length, rows: (sample as { rows: number }).rows, labeledBy: engines },
    adaption: { connected: adaptionConfigured(), newRunsAllowed: adaptionRunsAllowed() },
    liveModel: liveModel()?.name ?? null,
  });
}
