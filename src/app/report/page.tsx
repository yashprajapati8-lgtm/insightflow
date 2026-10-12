"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { ReportView } from "@/components/ReportView";
import { decodeReport, type ReportSnapshot } from "@/lib/report";

export default function SharedReportPage() {
  const [report, setReport] = useState<ReportSnapshot | null | undefined>(undefined);

  useEffect(() => {
    const r = decodeReport(window.location.hash.slice(1));
    setReport(r);
    if (r && new URLSearchParams(window.location.search).get("print") === "1") {
      setTimeout(() => window.print(), 400);
    }
  }, []);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="no-print mx-auto mb-5 flex max-w-[820px] items-center justify-between gap-3">
        <Link href="/" className="text-sm font-bold">
          InsightFlow
        </Link>
        {report && (
          <button
            type="button"
            onClick={() => window.print()}
            className="glass inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-medium"
          >
            <Printer size={15} /> Save as PDF
          </button>
        )}
      </div>
      {report === undefined && <div className="skeleton mx-auto h-[600px] max-w-[820px]" />}
      {report === null && (
        <div className="mx-auto flex max-w-[520px] flex-col items-center gap-3 py-20 text-center">
          <h1 className="text-xl font-semibold">This report link is incomplete</h1>
          <p className="text-ink-2">The link may have been cut off when it was copied. Ask for it again, or open the sample workspace.</p>
          <Link href="/app" className="font-medium underline underline-offset-4">
            Open the sample workspace
          </Link>
        </div>
      )}
      {report && <ReportView r={report} />}
    </div>
  );
}
