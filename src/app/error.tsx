"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, RefreshCw } from "lucide-react";

/** Shown instead of a blank "Application error" page. Offers a reload, and a reset if saved data is the cause. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const stale = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(`${error?.name} ${error?.message}`);
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-5 py-16 text-center text-ink">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-neg-bg text-neg-fg">
        <AlertTriangle size={22} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{stale ? "A new version is available" : "Something went wrong on this page"}</h1>
        <p className="max-w-[48ch] text-ink-2">
          {stale
            ? "InsightFlow was updated while this tab was open. Reload to get the latest version."
            : "Reload to try again. If it keeps happening, reset the workspace: it clears what this browser saved and opens the sample."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => (stale ? window.location.reload() : reset())}
          className="raised inline-flex h-11 items-center gap-2 rounded-xl px-5 font-semibold hover:brightness-105"
        >
          <RefreshCw size={16} /> {stale ? "Reload" : "Try again"}
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem("insightflow-v1");
            } catch {}
            window.location.href = "/app";
          }}
          className="glass lift inline-flex h-11 items-center gap-2 rounded-xl px-5 font-medium"
        >
          <RotateCcw size={16} /> Reset the workspace
        </button>
        <Link href="/" className="inline-flex h-11 items-center px-3 text-[14px] text-ink-2 underline underline-offset-4">
          Home
        </Link>
      </div>
    </main>
  );
}
