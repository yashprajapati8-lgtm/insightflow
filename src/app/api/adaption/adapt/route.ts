import { NextResponse } from "next/server";
import { adapt, adaptionConfigured, adaptionRunsAllowed } from "@/lib/adaption";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const estimate = url.searchParams.get("estimate") === "1";
  if (!adaptionConfigured()) return NextResponse.json({ error: "Adaption is not connected." }, { status: 501 });
  if (!adaptionRunsAllowed()) {
    return NextResponse.json({ error: "New Adaption runs are turned off on this deployment to protect credits." }, { status: 403 });
  }
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    return NextResponse.json(await adapt(id, estimate));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Starting the run failed." }, { status: 502 });
  }
}
