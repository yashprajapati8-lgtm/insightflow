import { NextResponse } from "next/server";
import { adaptionConfigured, download, extractRows } from "@/lib/adaption";
import { parseAnalysis } from "@/lib/parse";
import { withIssue } from "@/lib/rules";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Downloads the finished run and returns validated analyses keyed by review text. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!adaptionConfigured()) return NextResponse.json({ error: "Adaption is not connected." }, { status: 501 });
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    const rows = extractRows(await download(id));
    let invalid = 0;
    const results = rows.flatMap((r) => {
      const a = parseAnalysis(r.completion);
      if (!a) {
        invalid++;
        return [];
      }
      return [{ id: r.id, review: r.review, analysis: withIssue(r.review, a) }];
    });
    return NextResponse.json({ results, invalid, total: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Download failed." }, { status: 502 });
  }
}
