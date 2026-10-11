"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { UploadCloud, FileSpreadsheet, Check, AlertTriangle, ArrowRight, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Panel, Button, ButtonLink, Segmented, SentimentChip, fmt } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { parseCsvFile, toReviews, type ParsedCsv, type Role } from "@/lib/csv";
import { SEVERITY_LABEL, issueById } from "@/lib/taxonomy";
import { analyzeWithRules } from "@/lib/rules";
import type { Analysis, Review } from "@/lib/types";

type ApiResult = { results: { analysis: Analysis; engine: "llm" | "rules" }[]; note?: string; model?: string };

async function analyzeTexts(texts: string[]): Promise<ApiResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) throw new Error("analyze failed");
  return res.json();
}

export default function AddPage() {
  const [tab, setTab] = useState<"csv" | "one">("csv");
  return (
    <div className="flex max-w-[1100px] flex-col gap-5 px-5 py-7 lg:px-8">
      <PageHeader
        title="Add feedback"
        actions={
          <Segmented
            label="How to add"
            size="md"
            options={[
              { value: "csv", label: "Import a CSV" },
              { value: "one", label: "Add one" },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        Import a file of reviews, surveys or support messages, or add a single piece of feedback.
      </PageHeader>
      {tab === "csv" ? <CsvImport /> : <AddOne />}
    </div>
  );
}

const QUICK_LIMIT = 300;
const BATCH = 25;

function CsvImport() {
  const router = useRouter();
  const loadDataset = useStore((s) => s.loadDataset);
  const resetToSample = useStore((s) => s.resetToSample);
  const toast = useToast((s) => s.show);
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, llm: 0, note: "" });
  const [finished, setFinished] = useState(false);

  const preview = (() => {
    if (!csv) return null;
    try {
      return toReviews(csv);
    } catch {
      return null;
    }
  })();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("That is not a CSV file. Export your feedback as .csv and try again.");
      return;
    }
    try {
      const parsed = await parseCsvFile(file);
      setCsv(parsed);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    }
  }

  async function analyze() {
    if (!csv) return;
    let built;
    try {
      built = toReviews(csv);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the column roles.");
      return;
    }
    const reviews: Review[] = built.reviews;
    setStep(2);
    const targets = reviews.slice(0, QUICK_LIMIT);
    const batches: Review[][] = [];
    for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));
    setProgress({ done: 0, total: targets.length, llm: 0, note: "" });

    let done = 0;
    let llm = 0;
    let note = "";
    // Two batches at a time keeps us under free-tier rate limits.
    for (let i = 0; i < batches.length; i += 2) {
      const pair = batches.slice(i, i + 2);
      const results = await Promise.all(pair.map((b) => analyzeTexts(b.map((r) => r.text)).catch(() => null)));
      pair.forEach((b, j) => {
        const res = results[j];
        b.forEach((r, k) => {
          const out = res?.results[k];
          if (out) {
            r.analysis = out.analysis;
            r.engine = out.engine;
            if (out.engine === "llm") llm++;
          }
        });
        if (res?.note) note = res.note;
        if (!res) note = "The live model could not be reached, so the rule baseline labeled these reviews.";
      });
      done += pair.reduce((s, b) => s + b.length, 0);
      setProgress({ done, total: targets.length, llm, note });
    }

    loadDataset(
      {
        name: csv.fileName.replace(/\.csv$/i, ""),
        rows: built.used,
        distinct: reviews.length,
        hasDates: built.hasDates,
        hasCategory: built.hasCategory,
        importedAt: new Date().toISOString(),
      },
      reviews,
    );
    setFinished(true);
  }

  const steps = ["Choose a file", "Check the columns", "Analyze"];

  return (
    <Panel className="overflow-hidden">
      <ol className="grid grid-cols-3 border-b border-line" aria-label="Steps">
        {steps.map((s, i) => {
          const done = i < step || (i === 2 && finished);
          const cur = i === step && !finished;
          return (
            <li
              key={s}
              aria-current={cur ? "step" : undefined}
              className={`flex items-center gap-2.5 border-b-2 px-4 py-3.5 text-sm sm:px-6 ${cur ? "border-primary font-semibold" : "border-transparent"} ${
                done || cur ? "text-ink" : "text-ink-2"
              }`}
            >
              <span
                className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? "bg-pos text-white" : cur ? "bg-primary text-on-primary" : "bg-line-soft text-ink-2"
                }`}
              >
                {done ? <Check size={13} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <div className="flex flex-col items-center gap-4 p-6 sm:p-10">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              onFile(e.dataTransfer.files[0]);
            }}
            className={`flex w-full max-w-[640px] cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              drag ? "border-primary bg-surface-2" : "border-line hover:border-ink-3"
            }`}
          >
            <UploadCloud size={32} strokeWidth={1.5} aria-hidden />
            <span className="text-base font-semibold">Drop a CSV here, or choose a file</span>
            <span className="max-w-[46ch] text-[13px] text-ink-2">
              One row per piece of feedback. The text column is found automatically. Optional columns: category, date,
              source.
            </span>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="primary" onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet size={16} /> Choose a CSV
            </Button>
          </label>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-[13px] text-neg-fg">
              <AlertTriangle size={14} /> {error}
            </p>
          )}
          <p className="text-[13px] text-ink-2">No file to hand?</p>
          <Button
            onClick={() => {
              resetToSample();
              toast("Sample dataset loaded: 7,000 rows, already analyzed");
              router.push("/app");
            }}
          >
            Use the Build Battle sample, 7,000 rows
          </Button>
        </div>
      )}

      {step === 1 && csv && (
        <div className="flex flex-col gap-5 p-6">
          <p>
            <strong className="font-semibold">{csv.fileName}</strong>{" "}
            <span className="text-ink-2">
              {fmt(csv.rows.length)} rows, {csv.headers.length} columns. Check what each column is used for.
            </span>
          </p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-2">
                  {csv.headers.map((h) => (
                    <th key={h} className="border-b border-line px-3 py-2.5 text-left align-top font-normal">
                      <span className="block font-semibold">{h}</span>
                      <label className="mt-1.5 flex items-center gap-1.5 text-ink-2">
                        Use as
                        <select
                          value={csv.roles[h]}
                          onChange={(e) => {
                            const role = e.target.value as Role;
                            const roles = { ...csv.roles };
                            if (role !== "ignore") for (const k of Object.keys(roles)) if (roles[k] === role) roles[k] = "ignore";
                            roles[h] = role;
                            setCsv({ ...csv, roles });
                          }}
                          className="h-8 rounded-md border border-line bg-surface px-1.5 text-ink"
                        >
                          <option value="text">Feedback text</option>
                          <option value="category">Category</option>
                          <option value="date">Date</option>
                          <option value="source">Source</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csv.rows.slice(0, 4).map((r, i) => (
                  <tr key={i}>
                    {csv.headers.map((h) => (
                      <td key={h} className={`border-b border-line-soft px-3 py-2 ${csv.roles[h] === "text" ? "quote text-sm" : ""}`}>
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview ? (
            <ul className="flex flex-col gap-1.5 rounded-lg bg-surface-2 px-4 py-3 text-[13px]">
              <li>
                <strong className="font-semibold">{fmt(preview.used - preview.reviews.length)} rows repeat earlier ones.</strong>{" "}
                They are grouped and counted, not deleted, so {fmt(preview.reviews.length)} distinct reviews get analyzed.
              </li>
              {preview.empty > 0 && <li>{fmt(preview.empty)} rows have no text and are skipped.</li>}
              <li>
                {preview.hasDates ? (
                  <>
                    <strong className="font-semibold">Dates found.</strong> Trends and momentum turn on.
                  </>
                ) : (
                  <>
                    <strong className="font-semibold">No date column.</strong> Trends stay off rather than being invented.
                  </>
                )}
              </li>
              {preview.reviews.length > QUICK_LIMIT && (
                <li>
                  The {QUICK_LIMIT} most repeated reviews get quick results from the live model. The rest start with the rule
                  baseline until the Adaption batch run finishes.
                </li>
              )}
            </ul>
          ) : (
            <p role="alert" className="text-[13px] text-neg-fg">
              Choose which column holds the feedback text.
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <Button onClick={() => setStep(0)}>Choose another file</Button>
            <Button variant="primary" onClick={analyze} disabled={!preview}>
              Analyze {preview ? fmt(preview.reviews.length) : ""} distinct reviews
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5 p-6">
          <Progress
            label="Quick results from the live model"
            done={progress.done}
            total={progress.total}
            hint="Ready in seconds and marked provisional until the Adaption batch run confirms them."
          />
          {progress.note && <p className="text-[13px] text-attn-text">{progress.note}</p>}
          <ul className="flex flex-col gap-2 border-t border-line-soft pt-4 text-sm">
            <Check2 ok label={`${fmt(preview?.used ?? 0)} rows read`} />
            <Check2 ok label={`Repeats grouped into ${fmt(preview?.reviews.length ?? 0)} distinct reviews`} />
            <Check2 ok={finished} label={`Quick labels ready (${fmt(progress.llm)} by the live model)`} />
            <Check2 ok={false} label="Adaption batch run: start it from the Pipeline page" />
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <ButtonLink href="/app/pipeline" variant="secondary">
              Open Pipeline
            </ButtonLink>
            <ButtonLink href="/app" variant="primary" aria-disabled={!finished} className={finished ? "" : "pointer-events-none opacity-50"}>
              Open the dashboard <ArrowRight size={16} />
            </ButtonLink>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Progress({ label, done, total, hint }: { label: string; done: number; total: number; hint: string }) {
  const share = total ? done / total : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="text-ink-2">
          {done >= total && total > 0 ? "Done, " : ""}
          {fmt(done)} of {fmt(total)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-line-soft" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <motion.div className="h-full bg-primary" animate={{ width: `${share * 100}%` }} transition={{ duration: 0.4 }} />
      </div>
      <span className="text-xs text-ink-2">{hint}</span>
    </div>
  );
}

function Check2({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2.5 ${ok ? "" : "text-ink-2"}`}>
      <span className={`inline-flex size-5 items-center justify-center rounded-full ${ok ? "bg-pos text-white" : "bg-line-soft"}`}>
        {ok && <Check size={12} />}
      </span>
      {label}
    </li>
  );
}

const EXAMPLES = [
  "The app logged me out twice while paying, and I was still charged for the order.",
  "Delivery was a week late, but support refunded the shipping fee without me asking.",
  "Love the new design, setup took two minutes.",
];

function AddOne() {
  const addReview = useStore((s) => s.addReview);
  const reviews = useStore((s) => s.reviews);
  const categories = useMemo(() => [...new Set(reviews.map((r) => r.category).filter(Boolean))] as string[], [reviews]);
  const toast = useToast((s) => s.show);
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("Review");
  const [category, setCategory] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; analysis: Analysis; engine: string; note?: string } | null>(null);
  const [example, setExample] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) {
      setError(true);
      return;
    }
    setBusy(true);
    setResult(null);
    let analysis: Analysis;
    let engine: "llm" | "rules" = "rules";
    let note: string | undefined;
    try {
      const res = await analyzeTexts([t]);
      analysis = res.results[0].analysis;
      engine = res.results[0].engine;
      note = res.note;
    } catch {
      analysis = analyzeWithRules(t);
      note = "The live model could not be reached, so the rule baseline answered.";
    }
    addReview({
      id: `m${Date.now()}`,
      text: t,
      category: category || null,
      count: 1,
      source: "manual",
      channel,
      dates: [new Date().toISOString()],
      analysis,
      engine,
      provisional: true,
    });
    setResult({ text: t, analysis, engine, note });
    setBusy(false);
    toast("Feedback added and analyzed");
  }

  const issue = result ? issueById(result.analysis.issueId) : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Panel className="p-6">
        <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Add one piece of feedback">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Feedback</span>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(false);
              }}
              aria-invalid={error}
              aria-describedby={error ? "fb-err" : undefined}
              placeholder="Paste what the customer wrote"
              className={`quote resize-y rounded-md border bg-surface px-3 py-2.5 text-base leading-relaxed outline-none focus:border-ink-3 ${
                error ? "border-neg" : "border-line"
              }`}
            />
            {error && (
              <span id="fb-err" role="alert" className="text-[13px] text-neg-fg">
                Write the feedback first. One sentence is enough.
              </span>
            )}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">Source</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-10 rounded-md border border-line bg-surface px-2">
                <option>Review</option>
                <option>Survey response</option>
                <option>Support message</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border border-line bg-surface px-2">
                <option value="">Leave blank</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Analyzing" : "Analyze and add"}
            </Button>
            <Button
              onClick={() => {
                setText(EXAMPLES[example % EXAMPLES.length]);
                setExample((x) => x + 1);
                setError(false);
              }}
            >
              <Wand2 size={15} /> Try an example
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className="flex min-h-[260px] flex-col gap-4 p-6" aria-live="polite" aria-label="Result">
        {!busy && !result && (
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">The analysis appears here</span>
            <span className="text-[13px] text-ink-2">Sentiment, severity and the matching issue, in a few seconds.</span>
          </div>
        )}
        {busy && (
          <div className="flex flex-col gap-3" aria-label="Analyzing">
            <div className="skeleton h-5 w-28" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
            <span className="self-start rounded border border-dashed border-line bg-surface-2 px-2 py-0.5 text-xs font-semibold">
              Provisional, {result.engine === "llm" ? "live model" : "rule baseline"}
            </span>
            <blockquote className="quote text-base leading-relaxed">“{result.text}”</blockquote>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
              <dt className="text-ink-2">Sentiment</dt>
              <dd>
                <SentimentChip value={result.analysis.sentiment} />
              </dd>
              <dt className="text-ink-2">Severity</dt>
              <dd>{SEVERITY_LABEL[result.analysis.severity]}</dd>
              <dt className="text-ink-2">Matches issue</dt>
              <dd>{issue?.name ?? "No issue, counted as praise"}</dd>
              <dt className="text-ink-2">Aspects</dt>
              <dd className="flex flex-wrap gap-1.5">
                {result.analysis.aspects.map((a) => (
                  <span key={a.topic} className="rounded bg-surface-2 px-1.5 py-0.5">
                    {a.topic}: {a.sentiment}
                  </span>
                ))}
              </dd>
            </dl>
            {result.note && <p className="text-xs text-attn-text">{result.note}</p>}
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={issue ? `/app/priorities?issue=${result.analysis.issueId}` : "/app/feedback"} size="sm">
                {issue ? "See its priority" : "See it in Feedback"}
              </ButtonLink>
              <Button
                size="sm"
                onClick={() => {
                  setText("");
                  setResult(null);
                }}
              >
                Add another
              </Button>
            </div>
          </motion.div>
        )}
      </Panel>
    </div>
  );
}
