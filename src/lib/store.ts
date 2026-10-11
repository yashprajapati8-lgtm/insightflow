"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import sample from "@/data/sample.json";
import type { Analysis, DatasetMeta, Review, TrackStatus, TrackedIssue, Weights } from "./types";
import { DEFAULT_WEIGHTS } from "./scoring";

const SAMPLE_REVIEWS = (sample as { reviews: Review[] }).reviews;
const SAMPLE_META: DatasetMeta = {
  name: "Build Battle sample",
  rows: (sample as { rows: number }).rows,
  distinct: SAMPLE_REVIEWS.length,
  hasDates: false,
  hasCategory: true,
  importedAt: "2026-10-11T10:00:00.000Z",
};

const now = () => new Date().toISOString();

const SEED_TRACKER: Record<string, TrackedIssue> = {
  "never-received": {
    issueId: "never-received",
    status: "Open",
    notes: [],
    log: [{ text: "Added because its score is 85 or higher", at: SAMPLE_META.importedAt }],
  },
  "checkout-crash": {
    issueId: "checkout-crash",
    status: "Open",
    notes: [],
    log: [{ text: "Added because its score is 85 or higher", at: SAMPLE_META.importedAt }],
  },
};

export type CountMode = "rows" | "distinct";

interface State {
  meta: DatasetMeta;
  reviews: Review[];
  weights: Weights;
  countMode: CountMode;
  tracker: Record<string, TrackedIssue>;
  /** The last Adaption job started from this browser, if any. */
  adaptionJob: { datasetId: string; startedAt: string; reviewIds: string[] } | null;

  setWeights: (w: Partial<Weights>) => void;
  resetWeights: () => void;
  setCountMode: (m: CountMode) => void;

  loadDataset: (meta: DatasetMeta, reviews: Review[]) => void;
  resetToSample: () => void;
  addReview: (r: Review) => void;
  updateAnalyses: (updates: { id: string; analysis: Analysis; engine: Review["engine"]; provisional: boolean }[]) => void;
  correctReview: (id: string, analysis: Analysis) => void;

  track: (issueId: string) => void;
  untrack: (issueId: string) => void;
  setStatus: (issueId: string, status: TrackStatus) => void;
  addNote: (issueId: string, text: string) => void;

  setAdaptionJob: (job: State["adaptionJob"]) => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      meta: SAMPLE_META,
      reviews: SAMPLE_REVIEWS,
      weights: DEFAULT_WEIGHTS,
      countMode: "rows",
      tracker: SEED_TRACKER,
      adaptionJob: null,

      setWeights: (w) => set((s) => ({ weights: { ...s.weights, ...w } })),
      resetWeights: () => set({ weights: DEFAULT_WEIGHTS }),
      setCountMode: (countMode) => set({ countMode }),

      loadDataset: (meta, reviews) => set({ meta, reviews, tracker: {}, adaptionJob: null }),
      resetToSample: () =>
        set({ meta: SAMPLE_META, reviews: SAMPLE_REVIEWS, tracker: SEED_TRACKER, weights: DEFAULT_WEIGHTS, adaptionJob: null }),
      addReview: (r) =>
        set((s) => {
          const existing = s.reviews.find((x) => x.text.trim().toLowerCase() === r.text.trim().toLowerCase());
          if (existing) {
            return {
              reviews: s.reviews.map((x) => (x === existing ? { ...x, count: x.count + 1 } : x)),
              meta: { ...s.meta, rows: s.meta.rows + 1 },
            };
          }
          return {
            reviews: [r, ...s.reviews],
            meta: { ...s.meta, rows: s.meta.rows + 1, distinct: s.meta.distinct + 1 },
          };
        }),
      updateAnalyses: (updates) =>
        set((s) => {
          const byId = new Map(updates.map((u) => [u.id, u]));
          return {
            reviews: s.reviews.map((r) => {
              const u = byId.get(r.id);
              if (!u || r.corrected) return r;
              return { ...r, analysis: u.analysis, engine: u.engine, provisional: u.provisional };
            }),
          };
        }),
      correctReview: (id, analysis) =>
        set((s) => ({
          reviews: s.reviews.map((r) => (r.id === id ? { ...r, analysis, corrected: true, provisional: false } : r)),
        })),

      track: (issueId) =>
        set((s) =>
          s.tracker[issueId]
            ? s
            : {
                tracker: {
                  ...s.tracker,
                  [issueId]: { issueId, status: "Open", notes: [], log: [{ text: "Tracked from Priorities", at: now() }] },
                },
              },
        ),
      untrack: (issueId) =>
        set((s) => {
          const next = { ...s.tracker };
          delete next[issueId];
          return { tracker: next };
        }),
      setStatus: (issueId, status) =>
        set((s) => {
          const t = s.tracker[issueId];
          if (!t || t.status === status) return s;
          return {
            tracker: { ...s.tracker, [issueId]: { ...t, status, log: [{ text: `Moved to ${status}`, at: now() }, ...t.log] } },
          };
        }),
      addNote: (issueId, text) =>
        set((s) => {
          const t = s.tracker[issueId];
          if (!t || !text.trim()) return s;
          return {
            tracker: {
              ...s.tracker,
              [issueId]: {
                ...t,
                notes: [...t.notes, { text: text.trim(), at: now() }],
                log: [{ text: "Note added", at: now() }, ...t.log],
              },
            },
          };
        }),

      setAdaptionJob: (adaptionJob) => set({ adaptionJob }),
    }),
    {
      name: "insightflow-v1",
      storage: createJSONStorage(() => localStorage),
      // The sample is shipped with the app, so only store it when the user changed the data.
      partialize: (s) => ({
        meta: s.meta,
        reviews: s.meta.name === SAMPLE_META.name && s.reviews === SAMPLE_REVIEWS ? undefined : s.reviews,
        weights: s.weights,
        countMode: s.countMode,
        tracker: s.tracker,
        adaptionJob: s.adaptionJob,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, reviews: p.reviews ?? current.reviews };
      },
    },
  ),
);

export const SAMPLE = { meta: SAMPLE_META, reviews: SAMPLE_REVIEWS };
