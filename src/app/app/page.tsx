"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Filter, Gauge, ListOrdered, PieChart, TrendingUp, Database } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Panel, PanelHeader, Segmented, Stat, ActNow, ButtonLink, fmt, pct } from "@/components/ui";
import { Bar, Donut, TrendChart, SENT_COLOR } from "@/components/charts";
import { Table } from "@/components/Table";
import { useStore } from "@/lib/store";
import { rankIssues, ACT_NOW } from "@/lib/scoring";
import { byCategory, sentimentTotals, weightOf } from "@/lib/derive";
import { useEvidence } from "@/lib/evidence";
import type { Review, Sentiment } from "@/lib/types";
import { SEVERITY_WEIGHT } from "@/lib/taxonomy";

const SENT_FILTERS = ["All", "Negative", "Mixed", "Positive"] as const;

export default function OverviewPage() {
  const all = useStore((s) => s.reviews);
  const weights = useStore((s) => s.weights);
  const meta = useStore((s) => s.meta);
  const mode = useStore((s) => s.countMode);
  const setMode = useStore((s) => s.setCountMode);
  const show = useEvidence((s) => s.show);

  const [cat, setCat] = useState("All");
  const [sent, setSent] = useState<(typeof SENT_FILTERS)[number]>("All");
  const [funnelView, setFunnelView] = useState<"Bars" | "Table">("Bars");
  const [sentView, setSentView] = useState<"Diverging" | "Pie" | "Table">("Diverging");
  const [issueView, setIssueView] = useState<"Bars" | "Table">("Bars");

  const categories = useMemo(() => [...new Set(all.map((r) => r.category).filter(Boolean))] as string[], [all]);

  const reviews = useMemo(
    () =>
      all.filter(
        (r) =>
          (cat === "All" || r.category === cat) &&
          (sent === "All" || r.analysis.sentiment === (sent.toLowerCase() as Sentiment)),
      ),
    [all, cat, sent],
  );

  const d = useMemo(() => {
    const ranked = rankIssues(reviews, weights);
    const rankAll = rankIssues(all, weights);
    const totals = sentimentTotals(reviews, mode);
    const rows = reviews.reduce((s, r) => s + r.count, 0);
    const neg = reviews.filter((r) => r.analysis.sentiment === "negative");
    const negOrMixed = reviews.filter((r) => r.analysis.sentiment === "negative" || r.analysis.sentiment === "mixed");
    const inIssues = reviews.filter((r) => r.analysis.issueId && r.analysis.issueId !== "other");
    const highSev = inIssues.filter((r) => SEVERITY_WEIGHT[r.analysis.severity] >= 0.7);
    const actIds = new Set(rankAll.filter((i) => i.score >= ACT_NOW).map((i) => i.id));
    const actNow = reviews.filter((r) => r.analysis.issueId && actIds.has(r.analysis.issueId));
    const w = (l: Review[]) => l.reduce((s, r) => s + weightOf(r, mode), 0);
    const funnel = [
      { label: "Feedback received", list: reviews },
      { label: "Negative or mixed", list: negOrMixed },
      { label: "Grouped into ranked issues", list: inIssues },
      { label: "In critical or high severity issues", list: highSev },
      { label: "In issues that need action now", list: actNow, act: true },
    ].map((f) => ({ ...f, value: w(f.list) }));
    const present = new Set(ranked.map((r) => r.id));
    const actCount = rankAll.filter((i) => i.score >= ACT_NOW && present.has(i.id)).length;
    return { ranked, rankAll, totals, rows, neg, funnel, actCount };
  }, [reviews, all, weights, mode]);

  const top = d.rankAll.filter((i) => i.score >= ACT_NOW);
  const mostReported = [...d.rankAll].sort((a, b) => b.rows - a.rows)[0];
  const cats = byCategory(reviews, mode);
  const unit = mode === "rows" ? "reports" : "distinct reviews";
  const funnelMax = d.funnel[0].value || 1;
  const mostIssues = [...d.ranked].sort((a, b) => b.rows - a.rows).slice(0, 6);
  const filtered = cat !== "All" || sent !== "All";

  return (
    <div className="flex flex-col gap-[22px] px-5 py-7 lg:px-9 lg:py-8">
      <PageHeader
        title="Overview"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <Filter size={14} aria-hidden />
              <span className="sr-only">Category</span>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="glass h-10 rounded-full px-3.5 text-[13px] text-ink"
              >
                <option value="All">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <Segmented label="Sentiment" options={SENT_FILTERS} value={sent} onChange={setSent} />
            <Segmented
              label="Count by"
              options={[
                { value: "rows", label: "Reports" },
                { value: "distinct", label: "Distinct reviews" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        }
      />

      {/* The finding: written from computed numbers, not by a model. */}
      {top.length > 0 && !filtered ? (
        <Panel tone="attn" lift className="relative overflow-hidden p-7">
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex max-w-[76ch] flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] text-ink-2">
                <ActNow /> {top.length} {top.length === 1 ? "issue needs" : "issues need"} action now
              </span>
              <p className="text-[22px] leading-snug font-semibold tracking-[-0.015em]">
                {top
                  .map((i) => `${fmt(i.rows)} customers reported “${i.name.toLowerCase()}”`)
                  .join(", and ")}
                .
              </p>
              {mostReported && top[0] && mostReported.id !== top[0].id && (
                <p className="text-ink-2">
                  {mostReported.name} has the most reports ({fmt(mostReported.rows)}), but it ranks lower because it costs
                  customers time, not money.
                </p>
              )}
            </div>
            <ButtonLink href="/app/priorities" variant="primary">
              See priorities <ArrowRight size={16} />
            </ButtonLink>
          </div>
        </Panel>
      ) : null}

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-[18px]">
        <Stat
          label="Feedback"
          value={fmt(mode === "rows" ? d.rows : reviews.length)}
          note={mode === "rows" ? `${fmt(reviews.length)} distinct reviews` : `distinct, in ${fmt(d.rows)} rows`}
          onOpen={() => show("All feedback", "", reviews)}
          meter={1}
        />
        <Stat
          label="Negative"
          value={pct(d.totals.negative / (d.totals.all || 1))}
          note={`${fmt(d.totals.negative)} ${unit}`}
          onOpen={() => show("Negative feedback", "", d.neg)}
          meter={d.totals.negative / (d.totals.all || 1)}
          meterClass="bg-neg"
        />
        <Stat
          label="Issues found"
          value={fmt(d.ranked.length)}
          note={`across ${fmt(cats.length)} categories`}
          meter={d.ranked.length ? 1 : 0}
          meterClass="bg-bar-2"
        />
        <Stat
          label="Need action now"
          value={fmt(d.actCount)}
          accent={d.actCount > 0 ? <ActNow /> : undefined}
          note={`score ${ACT_NOW} or higher`}
          onOpen={() => show("Issues that need action now", "", top.flatMap((i) => i.reviews))}
          meter={d.actCount / (d.ranked.length || 1)}
          meterClass="bg-attn"
        />
      </section>

      <div className="grid gap-[18px] xl:grid-cols-2">
        <Panel className="flex flex-col gap-5 p-6" aria-labelledby="funnel-h">
          <PanelHeader
            id="funnel-h"
            icon={<Gauge size={17} />}
            title="From feedback to decisions"
            subtitle={`How ${fmt(d.funnel[0].value)} ${unit} narrow to the issues that need action.`}
            actions={<Segmented label="View funnel as" options={["Bars", "Table"] as const} value={funnelView} onChange={setFunnelView} />}
          />
          {funnelView === "Bars" ? (
            <ol className="well flex flex-col gap-3.5 rounded-2xl p-4">
              {d.funnel.map((f, i) => (
                <li key={f.label} className="flex flex-col gap-1">
                  <span className="text-[13px] text-ink-2">{f.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 rounded-full bg-line-soft">
                      <Bar value={f.value / funnelMax} delay={i * 0.06} className={f.act ? "glow-attn rounded-full bg-attn" : "rounded-full bg-bar-1"} />
                    </div>
                    <button type="button" onClick={() => show(f.label, "", f.list)} className="proof w-16 text-right font-semibold">
                      {fmt(f.value)}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Table
              head={["Stage", unit[0].toUpperCase() + unit.slice(1), "Share"]}
              rows={d.funnel.map((f) => [f.label, fmt(f.value), pct(f.value / funnelMax)])}
            />
          )}
        </Panel>

        <Panel className="flex flex-col gap-5 p-6" aria-labelledby="sent-h">
          <PanelHeader
            id="sent-h"
            icon={<PieChart size={17} />}
            title="Sentiment by category"
            subtitle={
              sentView === "Diverging"
                ? "Negative to the left of the line, positive to the right."
                : sentView === "Pie"
                  ? "Share of each sentiment, overall and per category."
                  : "Exact shares per category."
            }
            actions={<Segmented label="View sentiment as" options={["Diverging", "Pie", "Table"] as const} value={sentView} onChange={setSentView} />}
          />
          <SentimentSummary totals={d.totals} />
          {sentView === "Diverging" && (
            <div className="well flex flex-col gap-1 rounded-2xl p-2.5">
              {cats.map((c) => {
                const n = c.negative / (c.all || 1);
                const p = c.positive / (c.all || 1);
                const m = (c.mixed + c.neutral) / (c.all || 1);
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => show(c.name, "", c.list)}
                    className="grid grid-cols-[minmax(0,140px)_1fr_2px_1fr] items-center gap-x-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="truncate text-[13px]">{c.name}</span>
                    <span className="flex items-center justify-end gap-2">
                      <span className="w-9 text-right text-xs text-ink-2">{pct(n)}</span>
                      <span className="flex h-3.5 flex-1 flex-row-reverse">
                        <span className="h-full bg-neu" style={{ width: `${(m / 2) * 100}%` }} />
                        <span className="h-full rounded-l-full bg-neg transition-[width] duration-500" style={{ width: `${n * 100}%` }} />
                      </span>
                    </span>
                    <span aria-hidden className="h-6 bg-ink-3" />
                    <span className="flex items-center gap-2">
                      <span className="flex h-3.5 flex-1">
                        <span className="h-full bg-neu" style={{ width: `${(m / 2) * 100}%` }} />
                        <span className="h-full rounded-r-full bg-pos transition-[width] duration-500" style={{ width: `${p * 100}%` }} />
                      </span>
                      <span className="w-9 text-xs text-ink-2">{pct(p)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {sentView === "Pie" && (
            <div className="well grid grid-cols-3 gap-4 rounded-2xl p-4 sm:grid-cols-5">
              {[{ name: "All feedback", ...d.totals, list: reviews }, ...cats].map((c, i) => (
                <button key={c.name} type="button" onClick={() => show(c.name, "", c.list)} className="flex flex-col items-center gap-2">
                  <Donut
                    label={`${c.name}: ${pct(c.negative / (c.all || 1))} negative`}
                    center={pct(c.negative / (c.all || 1))}
                    parts={(["negative", "mixed", "neutral", "positive"] as const).map((s) => ({
                      value: c[s] / (c.all || 1),
                      color: SENT_COLOR[s],
                    }))}
                  />
                  <span className={i === 0 ? "text-center text-xs font-semibold" : "text-center text-xs text-ink-2"}>{c.name}</span>
                </button>
              ))}
            </div>
          )}
          {sentView === "Table" && (
            <Table
              head={["Category", "Negative", "Mixed", "Positive", unit[0].toUpperCase() + unit.slice(1)]}
              rows={cats.map((c) => [
                c.name,
                pct(c.negative / (c.all || 1)),
                pct((c.mixed + c.neutral) / (c.all || 1)),
                pct(c.positive / (c.all || 1)),
                fmt(c.all),
              ])}
            />
          )}
        </Panel>

        <Panel className="flex flex-col gap-4 p-6" aria-labelledby="most-h">
          <PanelHeader
            id="most-h"
            icon={<ListOrdered size={17} />}
            title="Most reported issues"
            subtitle="Sorted by reports. The priority rank shows why volume alone misleads."
            actions={<Segmented label="View issues as" options={["Bars", "Table"] as const} value={issueView} onChange={setIssueView} />}
          />
          {issueView === "Bars" ? (
            <ol className="well flex flex-col rounded-2xl p-1.5">
              {mostIssues.map((i, idx) => {
                const rank = d.rankAll.findIndex((x) => x.id === i.id) + 1;
                return (
                  <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_minmax(40px,90px)_44px_92px] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
                    <button type="button" onClick={() => show(i.name, "", i.reviews)} className="text-left leading-snug font-medium hover:underline">
                      {i.name}
                    </button>
                    <span className="h-2 overflow-hidden rounded-full bg-line-soft">
                      <Bar value={i.rows / (mostIssues[0]?.rows || 1)} delay={idx * 0.05} className="rounded-full bg-bar-2" />
                    </span>
                    <span className="text-right font-semibold">{fmt(mode === "rows" ? i.rows : i.distinct)}</span>
                    <Link
                      href={`/app/priorities?issue=${i.id}`}
                      className={
                        rank <= top.length
                          ? "glow-attn justify-self-end rounded-full bg-attn px-2.5 py-0.5 text-xs font-semibold text-on-attn"
                          : "justify-self-end rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2"
                      }
                    >
                      Priority {rank}
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Table
              head={["Issue", "Reports", "Distinct", "Priority"]}
              rows={mostIssues.map((i) => [i.name, fmt(i.rows), fmt(i.distinct), String(d.rankAll.findIndex((x) => x.id === i.id) + 1)])}
            />
          )}
        </Panel>

        <Panel className="flex flex-col gap-4 p-6" aria-labelledby="trend-h">
          <PanelHeader
            id="trend-h"
            icon={<TrendingUp size={17} />}
            title="Feedback over time"
            subtitle={meta.hasDates ? "Weekly reports and the share that is negative." : "Trends need a date on each review."}
          />
          {meta.hasDates ? (
            <TrendChart reviews={reviews} />
          ) : (
            <div className="well flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center">
              <p className="font-semibold">This dataset has no dates, so no trend is shown</p>
              <p className="max-w-[46ch] text-[13px] text-ink-2">
                InsightFlow does not invent a timeline. Import a CSV with a date column and this chart shows how each issue
                grows or shrinks week by week.
              </p>
              <ButtonLink href="/app/add" size="sm" variant="primary">
                Import dated feedback
              </ButtonLink>
            </div>
          )}
        </Panel>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <Database size={14} aria-hidden />
        {fmt(meta.rows - meta.distinct)} of the {fmt(meta.rows)} rows ({pct((meta.rows - meta.distinct) / (meta.rows || 1))})
        repeat one of {fmt(meta.distinct)} distinct reviews. Counts above {mode === "rows" ? "include" : "exclude"} repeats.
        <Link href="/app/pipeline" className="font-medium text-ink underline underline-offset-4">
          See how the data was prepared
        </Link>
      </p>
    </div>
  );
}

function SentimentSummary({ totals }: { totals: Record<Sentiment, number> & { all: number } }) {
  const a = totals.all || 1;
  const order: Sentiment[] = ["negative", "mixed", "neutral", "positive"];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
        {order.map((s) => (
          <span key={s} style={{ width: `${(totals[s] / a) * 100}%`, background: SENT_COLOR[s] }} />
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[13px]">
        <span>
          <strong className="text-neg">{pct(totals.negative / a)} negative</strong>{" "}
          <span className="text-ink-2">{fmt(totals.negative)}</span>
        </span>
        <span className="text-ink-2">{pct((totals.mixed + totals.neutral) / a)} mixed or neutral</span>
        <span>
          <strong className="text-pos">{pct(totals.positive / a)} positive</strong>{" "}
          <span className="text-ink-2">{fmt(totals.positive)}</span>
        </span>
      </div>
    </div>
  );
}
