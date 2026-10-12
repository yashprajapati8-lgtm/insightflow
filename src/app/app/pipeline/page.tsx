"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileUp, Layers, Sparkles, ShieldCheck, Calculator, Play, Loader2, Download } from "lucide-react";
import Papa from "papaparse";
import { PageHeader } from "@/components/AppShell";
import { Panel, Button, fmt, pct } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { analyzeWithRules } from "@/lib/rules";
import gold from "@/data/gold.json";
import type { Analysis, Review } from "@/lib/types";

type Stage = { name: string; who: string; result: string; what: string; facts: [string, string][]; icon: React.ElementType };
type JobView = { state: "idle" | "uploading" | "processing" | "running" | "done" | "failed"; percent: number; message: string };

export default function PipelinePage() {
  const reviews = useStore((s) => s.reviews);
  const meta = useStore((s) => s.meta);
  const weights = useStore((s) => s.weights);
  const job = useStore((s) => s.adaptionJob);
  const setJob = useStore((s) => s.setAdaptionJob);
  const updateAnalyses = useStore((s) => s.updateAnalyses);
  const toast = useToast((s) => s.show);
  const [picked, setPicked] = useState(2);
  const [config, setConfig] = useState<{ adaption: boolean; allowRuns?: boolean; liveModel: string | null } | null>(null);
  const [view, setView] = useState<JobView>({ state: job ? "processing" : "idle", percent: 0, message: "" });
  const adaptStarted = useRef(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch("/api/adaption/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ adaption: false, allowRuns: false, liveModel: null }));
  }, []);

  const stats = useMemo(() => {
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
    const normSet = new Set(reviews.map((r) => norm(r.text)));
    const engines = { adaption: 0, llm: 0, rules: 0 };
    let invalid = 0;
    for (const r of reviews) engines[r.engine]++;
    for (const r of reviews) if (!r.analysis.aspects.length) invalid++;
    return { nearDupes: reviews.length - normSet.size, engines, invalid, corrected: reviews.filter((r) => r.corrected).length };
  }, [reviews]);

  const goldScore = useMemo(() => scoreGold(reviews), [reviews]);

  /** Saves Adaption's labels as a CSV, so they can be built into the shipped sample (npm run build:sample). */
  function downloadLabels() {
    const rows = reviews
      .filter((r) => r.engine === "adaption")
      .map((r) => ({ id: r.id, review: r.text, completion: JSON.stringify(r.analysis) }));
    const blob = new Blob([Papa.unparse(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "adaption-output.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Downloaded ${fmt(rows.length)} Adaption labels`);
  }

  const finish = useCallback(
    async (datasetId: string) => {
      const res = await fetch(`/api/adaption/result?id=${encodeURIComponent(datasetId)}`).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      const byText = new Map(reviews.map((r) => [r.text.trim().toLowerCase(), r.id]));
      const byId = new Set(reviews.map((r) => r.id));
      const updates = (res.results as { id?: string; review: string; analysis: Analysis }[])
        .map((x) => ({ id: x.id && byId.has(x.id) ? x.id : byText.get(x.review.trim().toLowerCase()), analysis: x.analysis }))
        .filter((x): x is { id: string; analysis: Analysis } => !!x.id)
        .map((x) => ({ ...x, engine: "adaption" as const, provisional: false }));
      updateAnalyses(updates);
      setJob(null);
      setView({ state: "done", percent: 100, message: `${fmt(updates.length)} reviews now use Adaption's labels. ${res.invalid ? `${res.invalid} rows were invalid and kept their previous label.` : ""}` });
      toast("Adaption run finished. Priorities updated.");
    },
    [reviews, updateAnalyses, setJob, toast],
  );

  // Poll a running job, including one started before a page refresh.
  useEffect(() => {
    if (!job) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await fetch(`/api/adaption/status?id=${encodeURIComponent(job.datasetId)}`).then((r) => r.json());
        if (stop) return;
        if (s.error) throw new Error(s.error);
        if (s.status === "awaiting_input" && !adaptStarted.current) {
          adaptStarted.current = true;
          const a = await fetch(`/api/adaption/adapt?id=${encodeURIComponent(job.datasetId)}`, { method: "POST" }).then((r) => r.json());
          if (a.error) throw new Error(a.error);
          setView({ state: "running", percent: 0, message: `Run started. Adaption estimates about ${Math.max(1, Math.round(a.estimatedMinutes ?? 1))} minutes plus queue time.` });
        } else if (s.status === "succeeded") {
          await finish(job.datasetId);
          return;
        } else if (s.status === "failed") {
          setJob(null);
          setView({ state: "failed", percent: 0, message: s.error_data?.message ?? "Adaption reported the run failed." });
          return;
        } else {
          const p = s.progress?.percent ?? 0;
          setView((v) => ({
            state: s.status === "running" ? "running" : "processing",
            percent: p,
            message:
              s.status === "running"
                ? `Analyzing ${fmt(s.progress?.processed_rows ?? 0)} of ${fmt(s.progress?.total_rows ?? job.reviewIds.length)} reviews.`
                : v.message || "Adaption is preparing the dataset. Queue time can be long; you can leave this page.",
          }));
        }
      } catch (e) {
        if (!stop) setView({ state: "failed", percent: 0, message: e instanceof Error ? e.message : "Lost contact with Adaption." });
        return;
      }
      if (!stop) timer = setTimeout(tick, 5000);
    };
    let timer = setTimeout(tick, 500);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [job, finish, setJob]);

  async function start() {
    if (stats.engines.adaption > 0 && !confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 5000);
      return;
    }
    setConfirming(false);
    setView({ state: "uploading", percent: 0, message: `Uploading ${fmt(reviews.length)} distinct reviews.` });
    adaptStarted.current = false;
    try {
      const res = await fetch("/api/adaption/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviews: reviews.map((r) => ({ id: r.id, text: r.text })) }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setJob({ datasetId: res.datasetId, startedAt: new Date().toISOString(), reviewIds: reviews.map((r) => r.id) });
      setView({ state: "processing", percent: 0, message: "Uploaded. Adaption is preparing the dataset." });
    } catch (e) {
      setView({ state: "failed", percent: 0, message: e instanceof Error ? e.message : "Upload failed." });
    }
  }

  const busy = view.state === "uploading" || view.state === "processing" || view.state === "running";
  const allAdaption = stats.engines.adaption === reviews.length;
  const analyzeResult = allAdaption
    ? `${fmt(reviews.length)} labeled by Adaption`
    : stats.engines.adaption
      ? `${fmt(stats.engines.adaption)} of ${fmt(reviews.length)} by Adaption`
      : "Waiting for an Adaption run";

  const stages: Stage[] = [
    {
      name: "Import",
      who: "in your browser",
      result: `${fmt(meta.rows)} rows`,
      icon: FileUp,
      what: "The CSV is read in the browser. The feedback text column is detected automatically; category, date and source columns are used when present.",
      facts: [
        ["Rows read", fmt(meta.rows)],
        ["Category column", meta.hasCategory ? "Yes" : "No"],
        ["Date column", meta.hasDates ? "Yes, trends on" : "No, trends stay off"],
        ["Dataset", meta.name],
      ],
    },
    {
      name: "Clean",
      who: "our code",
      result: `${fmt(reviews.length)} distinct`,
      icon: Layers,
      what: "Exact repeats are grouped so each distinct review is analyzed once, and the repeat count is kept as volume. Nothing is deleted.",
      facts: [
        ["Repeats grouped", `${fmt(meta.rows - reviews.length)} rows, ${pct((meta.rows - reviews.length) / (meta.rows || 1))}`],
        ["Distinct reviews", fmt(reviews.length)],
        ["Differ only in punctuation", `${fmt(stats.nearDupes)} reviews, kept separate`],
        ["Sent for analysis", `${fmt(reviews.length)}, not ${fmt(meta.rows)}`],
      ],
    },
    {
      name: "Analyze",
      who: "Adaption, batch",
      result: analyzeResult,
      icon: Sparkles,
      what: "The distinct reviews go to Adaption's Adaptive Data API as one job. Each review is the row's context and one universal instruction asks for sentiment, aspects, severity, the main complaint and the matching issue, as JSON. A blueprint enforces strict JSON. A live model gives provisional labels for single reviews in seconds; Adaption's batch result replaces them.",
      facts: [
        ["Labeled by Adaption", fmt(stats.engines.adaption)],
        ["Labeled by the live model", fmt(stats.engines.llm)],
        ["Rule baseline, waiting", fmt(stats.engines.rules)],
        ["Recipes", "Rephrasing and deduplication off, so reviews are not changed"],
      ],
    },
    {
      name: "Validate",
      who: "our code",
      result: "Checked before use",
      icon: ShieldCheck,
      what: "Every answer is parsed and checked against the expected shape. An invalid row keeps its previous label, so a broken answer never reaches the dashboard. People can correct any label on the Feedback page.",
      facts: [
        ["Shape check", "Sentiment, aspects, severity, complaint, issue"],
        ["Corrected by you", fmt(stats.corrected)],
        ["Hand-labeled check set", goldScore ? `${gold.length} reviews` : "Not added yet"],
        ["Unknown issue ids", "Mapped by the rule baseline"],
      ],
    },
    {
      name: "Score",
      who: "our code, no AI",
      result: "Issues ranked",
      icon: Calculator,
      what: "Issues are ranked by a fixed, adjustable formula. The AI never produces a number: every count and score is computed, and each one opens the reviews behind it.",
      facts: [
        ["Formula", `volume ${weights.volume} + negativity ${weights.negativity} + severity ${weights.severity}`],
        ["Momentum", meta.hasDates ? `On, weight ${weights.momentum}` : "Off, the data has no dates"],
        ["Severity", "Money lost 1.0, order unusable 0.7, delay 0.4"],
        ["Act now", "Score 85 or higher"],
      ],
    },
  ];
  const cur = stages[picked];
  const example = reviews.find((r) => r.analysis.sentiment === "mixed") ?? reviews[0];

  return (
    <div className="flex flex-col gap-5 px-5 py-7 lg:px-8">
      <PageHeader
        title="Pipeline"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <JobBadge view={view} configured={config?.adaption} />
            {stats.engines.adaption > 0 && (
              <Button onClick={downloadLabels} title="CSV with id, review and Adaption's JSON answer">
                <Download size={15} /> Download Adaption labels
              </Button>
            )}
            {config?.allowRuns !== false && (
              <Button variant="primary" onClick={start} disabled={busy || !config?.adaption}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {confirming
                  ? "Confirm: this uses credits"
                  : stats.engines.adaption > 0
                    ? "Run again (uses credits)"
                    : "Run Adaption on this dataset"}
              </Button>
            )}
          </div>
        }
      >
        How {fmt(meta.rows)} raw rows become the analysis in this app. Select a stage to see what it did to this dataset.
      </PageHeader>

      {(view.message || confirming || config?.adaption === false || (config?.adaption && config.allowRuns === false)) && (
        <p className={`text-[13px] ${view.state === "failed" ? "text-neg-fg" : "text-ink-2"}`} role="status">
          {confirming
            ? `${fmt(stats.engines.adaption)} reviews already have Adaption labels. A new run spends credits again; click once more within 5 seconds to confirm.`
            : config?.adaption === false
              ? "Adaption is not connected on this deployment. The labels shown were produced by Adaption ahead of time and built into the sample."
              : config?.allowRuns === false && !view.message
                ? "The labels shown were produced by an Adaption batch run. New runs are turned off on this public demo to protect credits."
                : view.message}
        </p>
      )}

      <Panel className="overflow-x-auto p-4">
        <ol className="grid min-w-[860px] grid-cols-5 gap-0">
          {stages.map((s, i) => {
            const on = i === picked;
            const Icon = s.icon;
            const running = i === 2 && busy;
            const pending = i === 2 && !running && stats.engines.adaption === 0;
            return (
              <li key={s.name} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setPicked(i)}
                  aria-pressed={on}
                  className={`flex flex-1 flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-colors ${
                    on ? "border-attn/60 bg-attn-soft shadow-[inset_0_1px_0_var(--glass-hi)]" : "border-line bg-well hover:border-ink-3"
                  }`}
                >
                  <span className="flex items-center justify-between text-xs text-ink-2">
                    <span className="flex items-center gap-1.5">
                      <Icon size={14} aria-hidden /> Stage {i + 1}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${running ? "bg-attn text-on-attn" : pending ? "bg-attn-soft text-attn-text" : "bg-pos-bg text-pos-fg"}`}>
                      {running ? "Running" : pending ? "Pending" : "Done"}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold">{s.name}</span>
                  <span className="text-[13px] text-ink-2">{s.result}</span>
                  <span className="mt-1 h-1 overflow-hidden rounded bg-line-soft">
                    <span
                      className={`block h-full transition-[width] duration-500 ${running || pending ? "bg-attn" : "bg-pos"}`}
                      style={{ width: running ? `${Math.max(6, view.percent)}%` : pending ? `${(stats.engines.adaption / (reviews.length || 1)) * 100}%` : "100%" }}
                    />
                  </span>
                </button>
                {i < stages.length - 1 && (
                  <span aria-hidden className="flex w-5 items-center justify-center text-ink-3">
                    <ChevronRight size={14} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-ink-2">
              Stage {picked + 1}, {cur.who}
            </span>
            <h2 className="text-xl font-semibold tracking-[-0.01em]">{cur.name}</h2>
            <p className="max-w-[68ch]">{cur.what}</p>
          </div>
          <dl className="grid grid-cols-[minmax(0,190px)_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-line-soft pt-4 text-[13px]">
            {cur.facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-2">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {picked === 2 && example && (
            <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
              <h3 className="text-sm font-semibold">One row through this stage</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-ink-2">Input: the review, as context</span>
                  <blockquote className="quote well rounded-2xl p-3.5 text-[15px] leading-relaxed">“{example.text}”</blockquote>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-ink-2">
                    Output, {example.engine === "adaption" ? "from Adaption" : example.engine === "llm" ? "from the live model" : "from the rule baseline until Adaption runs"}
                  </span>
                  <pre className="overflow-x-auto rounded-2xl bg-[#0f1116]/90 p-3.5 text-xs leading-relaxed whitespace-pre-wrap text-[#e6eaf1] shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
                    {JSON.stringify(example.analysis, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel className="flex flex-col gap-4 p-6" aria-labelledby="acc-h">
          <div className="flex flex-col gap-1">
            <h2 id="acc-h" className="text-base font-semibold">
              Is the AI right?
            </h2>
            <p className="text-[13px] text-ink-2">
              Checked against reviews labeled by hand, including the mixed and tricky ones. The rule baseline is the floor any
              AI must beat.
            </p>
          </div>
          {goldScore ? (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-ink-2">
                  <th className="border-b border-line py-2 font-medium">Check</th>
                  <th className="border-b border-line py-2 text-right font-medium">Rule baseline</th>
                  <th className="border-b border-line py-2 text-right font-medium">Current labels</th>
                </tr>
              </thead>
              <tbody>
                {goldScore.map((g) => (
                  <tr key={g.label}>
                    <td className="border-b border-line-soft py-2.5">{g.label}</td>
                    <td className="border-b border-line-soft py-2.5 text-right">{g.rules}</td>
                    <td className="border-b border-line-soft py-2.5 text-right font-semibold">{g.current}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="well rounded-2xl px-4 py-6 text-center text-[13px] text-ink-2">
              The hand-labeled check set has not been added yet, so no accuracy is claimed.
            </p>
          )}
          <Link href="/app/feedback" className="text-[13px] font-medium underline underline-offset-4">
            Correct a label on the Feedback page
          </Link>
        </Panel>
      </div>
    </div>
  );
}

function JobBadge({ view, configured }: { view: JobView; configured?: boolean }) {
  const map: Record<JobView["state"], [string, string]> = {
    idle: [configured ? "Adaption connected" : "Adaption not connected", configured ? "bg-pos-bg text-pos-fg" : "bg-line-soft text-ink-2"],
    uploading: ["Uploading", "bg-attn-soft text-attn-text"],
    processing: ["Adaption job queued", "bg-attn-soft text-attn-text"],
    running: [`Adaption running, ${Math.round(view.percent)}%`, "bg-attn-soft text-attn-text"],
    done: ["Last run complete", "bg-pos-bg text-pos-fg"],
    failed: ["Run failed", "bg-neg-bg text-neg-fg"],
  };
  const [label, cls] = map[view.state];
  return <span className={`inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium ${cls}`}>{label}</span>;
}

type GoldItem = { text: string; sentiment: string; severity: string };

function scoreGold(reviews: Review[]) {
  const items = gold as GoldItem[];
  if (!items.length) return null;
  const byText = new Map(reviews.map((r) => [r.text.trim().toLowerCase(), r]));
  let n = 0;
  const hit = { rs: 0, rv: 0, cs: 0, cv: 0, mixed: 0, rm: 0, cm: 0 };
  for (const g of items) {
    const r = byText.get(g.text.trim().toLowerCase());
    if (!r) continue;
    n++;
    const base = analyzeWithRules(r.text);
    if (base.sentiment === g.sentiment) hit.rs++;
    if (base.severity === g.severity) hit.rv++;
    if (r.analysis.sentiment === g.sentiment) hit.cs++;
    if (r.analysis.severity === g.severity) hit.cv++;
    if (g.sentiment === "mixed") {
      hit.mixed++;
      if (base.sentiment === "mixed") hit.rm++;
      if (r.analysis.sentiment === "mixed") hit.cm++;
    }
  }
  if (!n) return null;
  return [
    { label: "Sentiment correct", rules: pct(hit.rs / n), current: pct(hit.cs / n) },
    { label: "Severity correct", rules: pct(hit.rv / n), current: pct(hit.cv / n) },
    { label: "Mixed reviews caught", rules: `${hit.rm} of ${hit.mixed}`, current: `${hit.cm} of ${hit.mixed}` },
    { label: "Reviews checked", rules: String(n), current: String(n) },
  ];
}
