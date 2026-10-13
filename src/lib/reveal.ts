"use client";

/**
 * On layouts where a detail panel sits below its list (narrower than 1280px), bring it into view after
 * a pick, so tapping a row never looks like it did nothing. "Back to the list" returns to the row.
 */
const narrow = () => typeof window !== "undefined" && !window.matchMedia("(min-width: 1280px)").matches;
const behavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

export function revealDetail(id = "detail") {
  if (!narrow()) return;
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: behavior(), block: "start" }));
}

export function backToRow(rowId: string) {
  const el = document.querySelector<HTMLElement>(`[data-row="${CSS.escape(rowId)}"]`);
  el?.scrollIntoView({ behavior: behavior(), block: "center" });
  el?.focus({ preventScroll: true });
}

export const isNarrow = narrow;
