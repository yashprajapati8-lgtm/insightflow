"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { GripVertical, Link2, Printer, StickyNote } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Panel, Button, ButtonLink, Segmented, ActNow, EmptyState, fmt } from "@/components/ui";
import { ReportView } from "@/components/ReportView";
import { useStore } from "@/lib/store";
import { rankIssues, ACT_NOW } from "@/lib/scoring";
import { useToast } from "@/lib/toast";
import { buildReport, encodeReport, SECTION_LABELS, type SectionKey } from "@/lib/report";
import type { RankedIssue, TrackStatus } from "@/lib/types";

const STATUSES: TrackStatus[] = ["Open", "Investigating", "Fixing", "Resolved"];

export default function TrackerPage() {
  const [tab, setTab] = useState<"Tracker" | "Report">("Tracker");
  const tracker = useStore((s) => s.tracker);
  const list = Object.values(tracker);
  const count = (st: TrackStatus) => list.filter((t) => t.status === st).length;
  return (
    <div className="flex flex-col gap-5 px-5 py-7 lg:px-8">
      <PageHeader
        title="Tracker and report"
        actions={<Segmented label="Tracker or report" size="md" options={["Tracker", "Report"] as const} value={tab} onChange={setTab} />}
      >
        {list.length
          ? `${list.length} issues tracked: ${count("Open")} open, ${count("Investigating")} investigating, ${count("Fixing")} being fixed, ${count("Resolved")} resolved.`
          : "Track issues from Priorities to follow them to resolution."}
      </PageHeader>
      {tab === "Tracker" ? <Board /> : <Report />}
    </div>
  );
}

function Board() {
  const reviews = useStore((s) => s.reviews);
  const weights = useStore((s) => s.weights);
  const tracker = useStore((s) => s.tracker);
  const setStatus = useStore((s) => s.setStatus);
  const addNote = useStore((s) => s.addNote);
  const untrack = useStore((s) => s.untrack);
  const toast = useToast((s) => s.show);
  const ranked = useMemo(() => rankIssues(reviews, weights), [reviews, weights]);
  const byId = new Map(ranked.map((r) => [r.id, r]));
  const items = Object.values(tracker)
    .map((t) => ({ t, issue: byId.get(t.issueId) }))
    .filter((x): x is { t: (typeof x)["t"]; issue: RankedIssue } => !!x.issue);
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<TrackStatus | null>(null);
  const [draft, setDraft] = useState("");
  const current = items.find((x) => x.t.issueId === sel) ?? items[0];

  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState title="Nothing tracked yet" body="Open Priorities, pick an issue and select Track issue. It appears here as Open.">
          <ButtonLink href="/app/priorities" variant="primary">
            Go to Priorities
          </ButtonLink>
        </EmptyState>
      </Panel>
    );
  }

  const move = (id: string, st: TrackStatus) => {
    const before = tracker[id]?.status;
    setStatus(id, st);
    setSel(id);
    if (before !== st) toast(`Moved to ${st}`);
  };

  return (
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-label="Issue board" className="flex flex-col gap-3">
        <p className="text-[13px] text-ink-2">Drag a card to change its status, or select it and use the status buttons.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((st) => {
            const cards = items.filter((x) => x.t.status === st).sort((a, b) => b.issue.score - a.issue.score);
            return (
              <div
                key={st}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (over !== st) setOver(st);
                }}
                onDragLeave={() => setOver((o) => (o === st ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || drag;
                  if (id) move(id, st);
                  setDrag(null);
                  setOver(null);
                }}
                className={`flex min-h-[320px] flex-col gap-2 rounded-xl border p-2.5 transition-colors ${
                  over === st ? "border-dashed border-ink-3 bg-surface-2" : "border-line bg-line-soft/60"
                }`}
              >
                <div className="flex items-center justify-between px-1.5 pt-0.5 pb-1.5">
                  <h2 className="text-[13px] font-semibold">{st}</h2>
                  <span className="text-xs text-ink-2">{cards.length}</span>
                </div>
                {cards.map(({ t, issue }) => {
                  const on = current?.t.issueId === t.issueId;
                  return (
                    <motion.button
                      layout
                      layoutId={`card-${t.issueId}`}
                      key={t.issueId}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        const ev = e as unknown as React.DragEvent;
                        ev.dataTransfer?.setData("text/plain", t.issueId);
                        setDrag(t.issueId);
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setOver(null);
                      }}
                      onClick={() => setSel(t.issueId)}
                      aria-pressed={on}
                      className={`flex cursor-grab flex-col gap-1.5 rounded-lg border bg-surface p-3 text-left shadow-card active:cursor-grabbing ${
                        on ? "border-ink" : "border-line hover:border-ink-3"
                      } ${drag === t.issueId ? "opacity-40" : ""}`}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-ink-2">
                        <span className="flex items-center gap-1">
                          <GripVertical size={12} aria-hidden /> {issue.owner}
                        </span>
                        <span className="text-[13px] font-semibold text-ink">{Math.round(issue.score)}</span>
                      </span>
                      <span className="text-sm leading-snug font-semibold">{issue.name}</span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                        {fmt(issue.rows)} reports
                        {issue.score >= ACT_NOW && st !== "Resolved" && <ActNow />}
                        {t.notes.length > 0 && (
                          <span className="flex items-center gap-1">
                            <StickyNote size={11} /> {t.notes.length}
                          </span>
                        )}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {current && (
        <Panel className="flex flex-col gap-5 p-5 2xl:sticky 2xl:top-6" aria-label="Issue detail">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-ink-2">
              Score {Math.round(current.issue.score)}, owned by {current.issue.owner}
            </span>
            <h2 className="text-lg leading-snug font-semibold">{current.issue.name}</h2>
            <Link href={`/app/priorities?issue=${current.issue.id}`} className="text-[13px] underline underline-offset-4">
              See the evidence in Priorities
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span id="status-l" className="text-[13px] font-semibold">
              Status
            </span>
            <div role="radiogroup" aria-labelledby="status-l" className="grid grid-cols-2 gap-1.5">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={current.t.status === st}
                  onClick={() => move(current.t.issueId, st)}
                  className={`h-9 rounded-md border text-[13px] font-medium transition-colors ${
                    current.t.status === st ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
            <h3 className="text-[13px] font-semibold">Notes</h3>
            {current.t.notes.length === 0 && <p className="text-[13px] text-ink-2">No notes yet. Add what the team found or decided.</p>}
            {current.t.notes.map((n, i) => (
              <p key={i} className="rounded-md bg-surface-2 px-3 py-2 text-[13px]">
                {n.text} <span className="text-ink-2">{time(n.at)}</span>
              </p>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                addNote(current.t.issueId, draft);
                setDraft("");
              }}
            >
              <label className="flex-1">
                <span className="sr-only">New note</span>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a note"
                  className="h-9 w-full rounded-md border border-line bg-surface px-3 text-[13px] outline-none focus:border-ink-3"
                />
              </label>
              <Button type="submit" size="sm" variant="primary" className="h-9">
                Add
              </Button>
            </form>
          </div>
          <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
            <h3 className="text-[13px] font-semibold">Activity</h3>
            <ol className="flex flex-col gap-1.5">
              {current.t.log.slice(0, 6).map((l, i) => (
                <li key={i} className="flex justify-between gap-3 text-[13px]">
                  <span>{l.text}</span>
                  <span className="shrink-0 text-ink-2">{time(l.at)}</span>
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={() => {
              untrack(current.t.issueId);
              setSel(null);
              toast("Removed from the tracker");
            }}
            className="self-start text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            Stop tracking
          </button>
        </Panel>
      )}
    </div>
  );
}

function time(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Report() {
  const reviews = useStore((s) => s.reviews);
  const weights = useStore((s) => s.weights);
  const tracker = useStore((s) => s.tracker);
  const meta = useStore((s) => s.meta);
  const toast = useToast((s) => s.show);
  const [audience, setAudience] = useState<"Leadership" | "Team">("Leadership");
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    summary: true,
    risks: true,
    actions: true,
    working: true,
    notes: true,
    data: true,
  });
  const ranked = useMemo(() => rankIssues(reviews, weights), [reviews, weights]);
  const report = useMemo(
    () => buildReport({ audience, sections, ranked, reviews, tracker, meta }),
    [audience, sections, ranked, reviews, tracker, meta],
  );

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Panel className="no-print flex flex-col gap-5 p-5 lg:sticky lg:top-6" aria-label="Report settings">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Written for</span>
          <Segmented label="Written for" options={["Leadership", "Team"] as const} value={audience} onChange={setAudience} />
          <p className="text-xs text-ink-2">
            {audience === "Leadership" ? "Short: the top 3 risks, actions and strengths." : "Full: every tracked issue and the team notes."}
          </p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold">Sections</legend>
          {(Object.keys(SECTION_LABELS) as SectionKey[]).map((k) => (
            <label key={k} className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={sections[k]}
                onChange={() => setSections((s) => ({ ...s, [k]: !s[k] }))}
                className="size-4 accent-[var(--primary)]"
              />
              {SECTION_LABELS[k]}
              {k === "notes" && audience === "Leadership" && <span className="text-xs text-ink-2">(team only)</span>}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
          <Button
            variant="primary"
            onClick={async () => {
              const url = `${window.location.origin}/report#${encodeReport(report)}`;
              try {
                await navigator.clipboard.writeText(url);
                toast("Link copied. It opens a read-only copy of this report.");
              } catch {
                window.prompt("Copy this link", url);
              }
            }}
          >
            <Link2 size={15} /> Copy share link
          </Button>
          <Button onClick={() => window.open(`/report?print=1#${encodeReport(report)}`, "_blank")}>
            <Printer size={15} /> Save as PDF
          </Button>
          <p className="text-xs text-ink-2">The link holds the whole report, so it works without an account.</p>
        </div>
      </Panel>
      <ReportView r={report} />
    </div>
  );
}
