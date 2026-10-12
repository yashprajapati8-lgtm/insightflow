"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { SlidersHorizontal, Check, Plus, ArrowUp, ArrowDown, Lightbulb, Quote } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Panel, Button, ActNow, SeverityDot, fmt, pct } from "@/components/ui";
import { useStore } from "@/lib/store";
import { rankIssues, explainRank, ACT_NOW, DEFAULT_WEIGHTS } from "@/lib/scoring";
import { SEVERITY_LABEL } from "@/lib/taxonomy";
import { useEvidence } from "@/lib/evidence";
import { useToast } from "@/lib/toast";
import type { RankedIssue, Weights } from "@/lib/types";

export default function PrioritiesPage() {
  return (
    <Suspense>
      <Priorities />
    </Suspense>
  );
}

function Priorities() {
  const reviews = useStore((s) => s.reviews);
  const weights = useStore((s) => s.weights);
  const setWeights = useStore((s) => s.setWeights);
  const resetWeights = useStore((s) => s.resetWeights);
  const meta = useStore((s) => s.meta);
  const params = useSearchParams();

  const ranked = useMemo(() => rankIssues(reviews, weights), [reviews, weights]);
  const defaultRank = useMemo(() => {
    const m = new Map<string, number>();
    rankIssues(reviews, DEFAULT_WEIGHTS).forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }, [reviews]);

  const [picked, setPicked] = useState<string | null>(params.get("issue"));
  const [open, setOpen] = useState(false);
  const selected = ranked.find((r) => r.id === picked) ?? ranked[0];
  const isDefault = (["volume", "negativity", "severity", "momentum"] as const).every((k) => weights[k] === DEFAULT_WEIGHTS[k]);
  const mostReported = [...ranked].sort((a, b) => b.rows - a.rows)[0];
  const mostReportedRank = ranked.findIndex((r) => r.id === mostReported?.id) + 1;

  return (
    <div className="flex flex-col gap-5 px-5 py-7 lg:px-8">
      <PageHeader title="Priorities">
        {fmt(ranked.length)} issues ranked from {fmt(meta.rows)} rows ({fmt(meta.distinct)} distinct reviews).
        {mostReported && mostReportedRank > 1 && (
          <>
            {" "}
            The most reported issue, {mostReported.name.toLowerCase()}, ranks {mostReportedRank}: lost money outweighs lost
            time.
          </>
        )}
      </PageHeader>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden" aria-label="Ranked issues">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <p className="text-[13px] text-ink-2">
              Score = volume {weights.volume} + negativity {weights.negativity} + severity {weights.severity}
              {meta.hasDates ? ` + momentum ${weights.momentum}` : ". Momentum is off: this data has no dates."}
            </p>
            <Button size="sm" variant={open ? "primary" : "secondary"} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <SlidersHorizontal size={14} /> {open ? "Done" : "Adjust weights"}
            </Button>
          </div>

          {open && (
            <WeightsPanel
              weights={weights}
              hasDates={meta.hasDates}
              onChange={setWeights}
              onReset={resetWeights}
              isDefault={isDefault}
            />
          )}

          <div className="flex gap-4 border-b border-line px-5 py-2 text-xs text-ink-2">
            <Legend className="bg-bar-1" label="Volume" />
            <Legend className="bg-bar-2" label="Negativity" />
            <Legend className="bg-bar-3" label="Severity" />
            {meta.hasDates && <Legend className="bg-attn" label="Momentum" />}
          </div>

          <LayoutGroup>
            <ol>
              {ranked.map((issue, i) => {
                const delta = (defaultRank.get(issue.id) ?? i + 1) - (i + 1);
                const on = issue.id === selected?.id;
                return (
                  <motion.li key={issue.id} layout transition={{ type: "spring", stiffness: 420, damping: 38 }} className="border-b border-line-soft last:border-0">
                    <button
                      type="button"
                      onClick={() => setPicked(issue.id)}
                      aria-pressed={on}
                      className={`grid w-full grid-cols-[30px_minmax(0,1fr)_minmax(70px,140px)_38px] items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                        on ? "bg-surface-2" : "hover:bg-surface-2"
                      }`}
                    >
                      <span className="flex flex-col items-start leading-tight">
                        <span className="text-[13px] text-ink-2">{i + 1}</span>
                        {!isDefault && delta !== 0 && (
                          <span className={`flex items-center text-[11px] font-semibold ${delta > 0 ? "text-pos" : "text-neg"}`}>
                            {delta > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                            {Math.abs(delta)}
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold">{issue.name}</span>
                          {issue.score >= ACT_NOW && <ActNow />}
                        </span>
                        <span className="truncate text-[13px] text-ink-2">
                          {fmt(issue.rows)} reports from {issue.distinct} {issue.distinct === 1 ? "phrasing" : "phrasings"}, {issue.owner}
                        </span>
                      </span>
                      <ScoreBar issue={issue} />
                      <span className="text-right text-base font-semibold">{Math.round(issue.score)}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ol>
          </LayoutGroup>
        </Panel>

        {selected && <IssueDetail issue={selected} all={ranked} />}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function ScoreBar({ issue }: { issue: RankedIssue }) {
  const p = issue.parts;
  return (
    <span aria-hidden className="flex h-2 overflow-hidden rounded bg-line-soft">
      <span className="h-full bg-bar-1 transition-[width] duration-300" style={{ width: `${p.volume}%` }} />
      <span className="h-full bg-bar-2 transition-[width] duration-300" style={{ width: `${p.negativity}%` }} />
      <span className="h-full bg-bar-3 transition-[width] duration-300" style={{ width: `${p.severity}%` }} />
      <span className="h-full bg-attn transition-[width] duration-300" style={{ width: `${p.momentum}%` }} />
    </span>
  );
}

function WeightsPanel({
  weights,
  hasDates,
  onChange,
  onReset,
  isDefault,
}: {
  weights: Weights;
  hasDates: boolean;
  onChange: (w: Partial<Weights>) => void;
  onReset: () => void;
  isDefault: boolean;
}) {
  const sliders: { key: keyof Weights; label: string; hint: string }[] = [
    { key: "volume", label: "Volume", hint: "How many reports" },
    { key: "negativity", label: "Negativity", hint: "Share that is negative" },
    { key: "severity", label: "Severity", hint: "Money lost ranks above lost time" },
    ...(hasDates ? [{ key: "momentum" as const, label: "Momentum", hint: "Growth in the latest period" }] : []),
  ];
  return (
    <div className="well flex flex-col gap-3 border-b border-line px-5 py-4">
      <p className="text-[13px] text-ink-2">Move a slider and the ranking updates. Your business decides what matters most.</p>
      {sliders.map((s) => (
        <label key={s.key} className="grid grid-cols-[96px_minmax(0,1fr)_32px] items-center gap-3 text-[13px]">
          <span className="flex flex-col leading-tight">
            <span className="font-medium">{s.label}</span>
            <span className="text-[11px] text-ink-2">{s.hint}</span>
          </span>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={weights[s.key]}
            onChange={(e) => onChange({ [s.key]: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
            aria-label={`${s.label} weight`}
          />
          <span className="text-right font-semibold">{weights[s.key]}</span>
        </label>
      ))}
      <div className="flex justify-end">
        <Button size="sm" onClick={onReset} disabled={isDefault}>
          Reset to default
        </Button>
      </div>
    </div>
  );
}

function IssueDetail({ issue, all }: { issue: RankedIssue; all: RankedIssue[] }) {
  const show = useEvidence((s) => s.show);
  const tracked = useStore((s) => !!s.tracker[issue.id]);
  const track = useStore((s) => s.track);
  const untrack = useStore((s) => s.untrack);
  const toast = useToast((s) => s.show);
  const rank = all.findIndex((r) => r.id === issue.id) + 1;
  const maxRows = Math.max(...all.map((r) => r.rows));
  const negOnly = issue.reviews.filter((r) => r.analysis.sentiment === "negative");
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
  }, [issue.id]);

  const rows: { label: string; value: number; note: string; onOpen?: () => void }[] = [
    {
      label: "Volume",
      value: issue.parts.volume,
      note: `${fmt(issue.rows)} reports, ${pct(issue.rows / maxRows)} of the most reported issue`,
      onOpen: () => show(issue.name, "", issue.reviews),
    },
    {
      label: "Negativity",
      value: issue.parts.negativity,
      note: `${pct(issue.negativeShare)} of these reports are negative`,
      onOpen: () => show(`${issue.name}: negative`, "", negOnly),
    },
    { label: "Severity", value: issue.parts.severity, note: SEVERITY_LABEL[issue.severity] },
    {
      label: "Momentum",
      value: issue.parts.momentum,
      note: issue.momentum === null ? "Off. Needs dated feedback; this data has none." : `${pct(issue.momentum)} growth signal in the latest period`,
    },
  ];

  return (
    <Panel ref={ref} className="flex flex-col gap-6 p-6 xl:sticky xl:top-6" aria-label="Issue detail">
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <SeverityDot value={issue.severity} />
          {issue.category ?? "Uncategorized"}, owned by {issue.owner}
        </span>
        <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.015em]">{issue.name}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant={tracked ? "secondary" : "primary"}
            onClick={() => {
              if (tracked) {
                untrack(issue.id);
                toast(`Stopped tracking “${issue.name}”`);
              } else {
                track(issue.id);
                toast(`Tracking “${issue.name}”`);
              }
            }}
          >
            {tracked ? <Check size={16} /> : <Plus size={16} />} {tracked ? "Tracked" : "Track issue"}
          </Button>
          <Button onClick={() => show(issue.name, "", issue.reviews)}>View {fmt(issue.rows)} reports</Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line-soft pt-5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[44px] leading-none font-semibold tracking-[-0.03em]">{Math.round(issue.score)}</span>
          <span className="text-ink-2">priority score, rank {rank} of {all.length}</span>
          {issue.score >= ACT_NOW && <ActNow />}
        </div>
        <dl className="grid grid-cols-[92px_36px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-[13px]">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-ink-2">{r.label}</dt>
              <dd className="text-right text-sm font-semibold">
                {r.onOpen ? (
                  <button type="button" onClick={r.onOpen} className="proof">
                    {Math.round(r.value)}
                  </button>
                ) : (
                  Math.round(r.value)
                )}
              </dd>
              <dd className="text-ink-2">{r.note}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line-soft pt-5">
        <h3 className="text-sm font-semibold">Why it ranks here</h3>
        <p className="max-w-[64ch]">{explainRank(issue, all)}</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-line-soft pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Quote size={14} aria-hidden /> What customers said
        </h3>
        {issue.reviews.slice(0, 3).map((r) => (
          <figure key={r.id} className="flex items-baseline gap-3">
            <blockquote className="quote flex-1 text-base leading-relaxed">“{r.text}”</blockquote>
            <figcaption className="text-[13px] text-ink-2">×{fmt(r.count)}</figcaption>
          </figure>
        ))}
        {issue.reviews.length > 3 && (
          <button type="button" onClick={() => show(issue.name, "", issue.reviews)} className="self-start text-[13px] font-medium underline underline-offset-4">
            Show all {issue.reviews.length} phrasings
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 rounded-2xl border border-attn/25 bg-attn-soft p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb size={15} aria-hidden /> Recommended action
        </h3>
        <p className="max-w-[64ch]">{issue.action}</p>
        <p className="text-xs text-ink-2">Based on these {fmt(issue.rows)} reports. Owner: {issue.owner}.</p>
      </div>
    </Panel>
  );
}
