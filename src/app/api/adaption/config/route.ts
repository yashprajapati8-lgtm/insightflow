import { NextResponse } from "next/server";
import { adaptionConfigured } from "@/lib/adaption";
import { liveModel } from "@/lib/llm";

export const dynamic = "force-dynamic";

/** Tells the UI which engines are available, without exposing any key. */
export function GET() {
  return NextResponse.json({ adaption: adaptionConfigured(), liveModel: liveModel()?.name ?? null });
}
