"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Pencil, Upload, Sparkles, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Panel, Button, ButtonLink, Segmented, SentimentChip, EmptyState, fmt } from "@/components/ui";
import { useStore } from "@/lib/store";
import { revealDetail, backToRow } from "@/lib/reveal";
import { ISSUES, OTHER_ISSUE, SEVERITY_LABEL, issueById } from "@/lib/taxonomy";
import { useEvidence } from "@/lib/evidence";
import { useToast } from "@/lib/toast";
import type { Analysis, Review, Sentiment, Severity } from "@/lib/types";

const SENTS = ["All", "Negative", "Mixed", "Positive"] as const;
const PAGE = 60;
const ENGINE_LABEL = { adaption: "Analyzed by Adaption", llm: "Analyzed by the live model", rules: "Labeled by the rule baseline" };

export default function FeedbackPage() {
  return (
    <Suspense>
      <Feedback />
    </Suspense>
  );
}

function Feedback() {
  const reviews = useStore((s) => s.reviews);
  const meta = useStore((s) => s.meta);
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [sent, setSent] = useState<(typeof SENTS)[number]>("All");
  const [cat, setCat] = useState("All");
  const [src, setSrc] = useState("All");
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<string | null>(params.get("id"));

  const categories = useMemo(() => [...new Set(reviews.map((r) => r.category).filter(Boolean))] as string[], [reviews]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return reviews.filter((r) => {
      if (sent !== "All" && r.analysis.sentiment !== sent.toLowerCase()) return false;
      if (cat !== "All" && r.category !== cat) return false;
      if (src !== "All" && r.source !== src) return false;
      if (!needle) return true;
      const issue = issueById(r.analysis.issueId)?.name ?? "";
      return `${r.text} ${issue} ${r.category ?? ""}`.toLowerCase().includes(needle);
    });
  }, [reviews, q, sent, cat, src]);

  const selected = reviews.find((r) => r.id === picked) ?? shown[0];
  const clear = () => {
    setQ("");
    setSent("All");
    setCat("All");
    setSrc("All");
  };

  return (
    <div className="flex flex-col gap-5 px-5 py-7 lg:px-8">
      <PageHeader
        title="Feedback"
        actions={
          <ButtonLink href="/app/add" variant="primary">
            <Upload size={16} /> Add feedback
          </ButtonLink>
        }
      >
        Showing {fmt(shown.length)} of {fmt(reviews.length)} distinct reviews ({fmt(meta.rows)} rows, repeats grouped).
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-ink-3">
          <Search size={16} className="text-ink-2" aria-hidden />
          <span className="sr-only">Search feedback</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search reviews, issues or categories"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
        </label>
        <Segmented label="Sentiment" options={SENTS} value={sent} onChange={setSent} size="md" />
        <select
          aria-label="Category"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-10 rounded-xl border border-line bg-surface px-2 text-[13px]"
        >
          <option value="All">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Source"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          className="h-10 rounded-xl border border-line bg-surface px-2 text-[13px]"
        >
          <option value="All">All sources</option>
          <option value="sample">Sample dataset</option>
          <option value="csv">CSV import</option>
          <option value="manual">Added in app</option>
        </select>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden" aria-label="Feedback list">
          <div className="hidden grid-cols-[minmax(0,1fr)_96px_minmax(0,170px)_60px] gap-3 border-b border-line px-5 py-2.5 text-xs text-ink-2 md:grid">
            <span>Review</span>
            <span>Sentiment</span>
            <span>Issue</span>
            <span className="text-right">Repeats</span>
          </div>
          {shown.length === 0 ? (
            <EmptyState title="No feedback matches these filters" body="Try a different word, or clear the filters.">
              <Button onClick={clear}>Clear filters</Button>
            </EmptyState>
          ) : (
            <ul>
              {shown.slice(0, limit).map((r) => {
                const on = r.id === selected?.id;
                const issue = issueById(r.analysis.issueId);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(r.id);
                        revealDetail();
                      }}
                      data-row={r.id}
                      aria-pressed={on}
                      className={`grid w-full grid-cols-1 gap-2 border-b border-line-soft px-5 py-3.5 text-left transition-colors md:grid-cols-[minmax(0,1fr)_96px_minmax(0,170px)_60px] md:items-center md:gap-3 ${
                        on ? "bg-surface-2" : "hover:bg-surface-2"
                      }`}
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="quote text-[15px] leading-normal">{r.text}</span>
                        <span className="text-xs text-ink-2">
                          {r.category ?? "Uncategorized"}
                          {r.provisional && r.source !== "sample" ? ", provisional" : ""}
                          {r.corrected ? ", corrected by you" : ""}
                          {r.engine === "adaption" && !r.corrected && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-pos/30 bg-pos-bg px-2 py-px text-[11px] font-semibold text-pos-fg">
                              <Sparkles size={10} aria-hidden /> Adaption confirmed
                            </span>
                          )}
                        </span>
                      </span>
                      <span>
                        <SentimentChip value={r.analysis.sentiment} />
                      </span>
                      <span className={`text-[13px] ${issue ? "" : "text-ink-2"}`}>{issue?.name ?? "Praise, no issue"}</span>
                      <span className="text-[13px] font-semibold md:text-right">{r.count > 1 ? `×${fmt(r.count)}` : "1"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {limit < shown.length && (
            <div className="px-5 py-3">
              <Button size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, shown.length - limit)} more
              </Button>
            </div>
          )}
        </Panel>

        {selected && <ReviewDetail key={selected.id} review={selected} />}
      </div>
    </div>
  );
}

function ReviewDetail({ review }: { review: Review }) {
  const correct = useStore((s) => s.correctReview);
  const toast = useToast((s) => s.show);
  const show = useEvidence((s) => s.show);
  const reviews = useStore((s) => s.reviews);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Analysis>(review.analysis);
  const a = review.analysis;
  const issue = issueById(a.issueId);
  const sameIssue = reviews.filter((r) => r.analysis.issueId && r.analysis.issueId === a.issueId);
  const labelMismatch =
    review.category && /fraud|scam/i.test(review.category) && a.sentiment === "positive"
      ? "Labeled fraud, but the review is positive"
      : null;

  return (
    <Panel id="detail" className="flex scroll-mt-20 flex-col gap-5 p-6 xl:sticky xl:top-6" aria-label="Review detail">
      <BackToList rowId={review.id} />
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <Sparkles size={14} aria-hidden /> {ENGINE_LABEL[review.engine]}
        </span>
        <blockquote className="quote text-lg leading-relaxed">“{review.text}”</blockquote>
        <span className="text-[13px] text-ink-2">
          {review.count > 1 ? `This exact review appears ${fmt(review.count)} times.` : "Appears once."}
        </span>
      </div>

      {review.provisional && review.source !== "sample" && (
        <p className="rounded-2xl border border-dashed border-attn/40 bg-attn-soft px-3.5 py-2.5 text-[13px]">
          Provisional result. The Adaption batch run confirms or replaces it.
        </p>
      )}

      {!editing ? (
        <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-t border-line-soft pt-5 text-[13px]">
          <dt className="text-ink-2">Sentiment</dt>
          <dd>
            <SentimentChip value={a.sentiment} />
          </dd>
          <dt className="text-ink-2">Severity</dt>
          <dd>{SEVERITY_LABEL[a.severity]}</dd>
          <dt className="text-ink-2">Main complaint</dt>
          <dd>{a.complaint ?? "None"}</dd>
          <dt className="text-ink-2">Issue</dt>
          <dd>
            {issue ? (
              <button type="button" className="proof" onClick={() => show(issue.name, "", sameIssue)}>
                {issue.name}
              </button>
            ) : (
              "No issue, counted as praise"
            )}
          </dd>
          <dt className="text-ink-2">Category</dt>
          <dd>
            {review.category ?? "Uncategorized"}
            {labelMismatch && <span className="block text-attn-text">{labelMismatch}</span>}
          </dd>
        </dl>
      ) : (
        <div className="flex flex-col gap-3 border-t border-line-soft pt-5 text-[13px]">
          <Field label="Sentiment">
            <select
              value={draft.sentiment}
              onChange={(e) => setDraft({ ...draft, sentiment: e.target.value as Sentiment })}
              className="h-9 w-full rounded-xl border border-line bg-surface px-2"
            >
              {["negative", "mixed", "neutral", "positive"].map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select
              value={draft.severity}
              onChange={(e) => setDraft({ ...draft, severity: e.target.value as Severity })}
              className="h-9 w-full rounded-xl border border-line bg-surface px-2"
            >
              {(["critical", "high", "medium", "low", "none"] as Severity[]).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Issue">
            <select
              value={draft.issueId ?? ""}
              onChange={(e) => setDraft({ ...draft, issueId: e.target.value || null })}
              className="h-9 w-full rounded-xl border border-line bg-surface px-2"
            >
              <option value="">No issue (praise)</option>
              {[...ISSUES, OTHER_ISSUE].map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-line-soft pt-5">
        <h3 className="text-sm font-semibold">Sentiment by aspect</h3>
        {a.aspects.map((x) => (
          <div key={x.topic} className="flex items-center justify-between gap-3 text-[13px]">
            <span>{x.topic}</span>
            <SentimentChip value={x.sentiment} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line-soft pt-5">
        {editing ? (
          <>
            <Button
              variant="primary"
              onClick={() => {
                const fixed: Analysis = {
                  ...draft,
                  issueId: draft.sentiment === "positive" || draft.sentiment === "neutral" ? null : draft.issueId,
                  severity: draft.sentiment === "positive" || draft.sentiment === "neutral" ? "none" : draft.severity,
                };
                correct(review.id, fixed);
                setEditing(false);
                toast("Correction saved. Priorities updated.");
              }}
            >
              Save correction
            </Button>
            <Button
              onClick={() => {
                setDraft(review.analysis);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} /> Correct the labels
          </Button>
        )}
      </div>
      <p className="text-xs text-ink-2">Corrections update every count and score, and are kept in this browser.</p>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
      <span className="text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function BackToList({ rowId }: { rowId: string }) {
  return (
    <button
      type="button"
      onClick={() => backToRow(rowId)}
      className="-mt-1 inline-flex w-fit items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink xl:hidden"
    >
      <ArrowUp size={14} aria-hidden /> Back to the list
    </button>
  );
}
