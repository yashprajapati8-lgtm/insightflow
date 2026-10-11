"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEvidence } from "@/lib/evidence";
import { SentimentChip, fmt } from "./ui";

const PAGE = 40;

export function EvidenceDrawer() {
  const { open, title, subtitle, reviews, close } = useEvidence();
  const [limit, setLimit] = useState(PAGE);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setLimit(PAGE);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const rows = reviews.reduce((s, r) => s + r.count, 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-[560px] flex-col border-l border-line bg-surface shadow-pop"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] text-ink-2">Evidence</span>
                <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
                <p className="text-[13px] text-ink-2">
                  {subtitle || `${fmt(rows)} reports from ${fmt(reviews.length)} distinct reviews`}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close evidence"
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface-2"
              >
                <X size={18} />
              </button>
            </header>
            <ol className="flex-1 overflow-y-auto">
              {reviews.slice(0, limit).map((r) => (
                <li key={r.id} className="flex flex-col gap-2 border-b border-line-soft px-6 py-4">
                  <p className="quote text-[15px] leading-relaxed">“{r.text}”</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                    <SentimentChip value={r.analysis.sentiment} />
                    <span className="font-semibold text-ink">×{fmt(r.count)}</span>
                    {r.category && <span>{r.category}</span>}
                    {r.provisional && <span>Provisional</span>}
                    {r.corrected && <span>Corrected by you</span>}
                  </div>
                </li>
              ))}
              {reviews.length === 0 && <li className="px-6 py-10 text-center text-ink-2">No reviews behind this number.</li>}
            </ol>
            {limit < reviews.length && (
              <div className="border-t border-line px-6 py-3">
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + PAGE)}
                  className="text-[13px] font-medium underline underline-offset-4"
                >
                  Show {Math.min(PAGE, reviews.length - limit)} more of {fmt(reviews.length - limit)}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
