import { NextResponse } from "next/server";
import { z } from "zod";
import { adaptionConfigured, adaptionRunsAllowed, createAndUpload } from "@/lib/adaption";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  reviews: z.array(z.object({ id: z.string(), text: z.string().min(1).max(4000) })).min(1).max(5000),
});

export async function POST(req: Request) {
  if (!adaptionConfigured()) {
    return NextResponse.json({ error: "Adaption is not connected. Add ADAPTION_API_KEY to the server environment." }, { status: 501 });
  }
  if (!adaptionRunsAllowed()) {
    return NextResponse.json({ error: "New Adaption runs are turned off on this deployment to protect credits." }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send { reviews: [{ id, text }] }." }, { status: 400 });
  try {
    const datasetId = await createAndUpload(parsed.data.reviews);
    return NextResponse.json({ datasetId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Adaption upload failed." }, { status: 502 });
  }
}
