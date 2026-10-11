"use client";

import { create } from "zustand";
import type { Review } from "./types";

/** A global drawer that shows the reviews behind any number in the app. */
interface EvidenceState {
  open: boolean;
  title: string;
  subtitle: string;
  reviews: Review[];
  show: (title: string, subtitle: string, reviews: Review[]) => void;
  close: () => void;
}

export const useEvidence = create<EvidenceState>((set) => ({
  open: false,
  title: "",
  subtitle: "",
  reviews: [],
  show: (title, subtitle, reviews) =>
    set({ open: true, title, subtitle, reviews: [...reviews].sort((a, b) => b.count - a.count) }),
  close: () => set({ open: false }),
}));
