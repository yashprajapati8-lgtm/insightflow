import { NextResponse } from "next/server";
import { adaptionConfigured, getStatus } from "@/lib/adaption";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!adaptionConfigured()) return NextResponse.json({ error: "Adaption is not connected." }, { status: 501 });
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    return NextResponse.json(await getStatus(id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Status check failed." }, { status: 502 });
  }
}
