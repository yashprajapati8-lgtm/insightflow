"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus, Sparkles, Clock, Users, Target, ListChecks, MousePointerClick, ThumbsUp, X } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Panel, Button, fmt } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useEvidence } from "@/lib/evidence";
import { useToast } from "@/lib/toast";
import { LENSES } from "@/lib/geo";
import { buildFixModel, optionTags, COST_LABEL, type FixStat, type ThemeStat } from "@/lib/fixes";

export default function FixesPage() {
  const reviews = useStore((s) => s.reviews);
  const model = useMemo(() => buildFixModel(reviews), [reviews]);
  const [lensId, setLensId] = useState("all");
  const [hover, setHover] = useState<{ kind: "theme" | "fix"; id: string } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const lensesPresent = LENSES.filter((l) => model.themes.some((t) => t.lens?.id === l.id && !t.recovered));
  const themes = model.themes
    .filter((t) => !t.recovered && (lensId === "all" || t.lens?.id === lensId))
    .sort((a, b) => b.reports - a.reports);
  const recovered = model.themes.filter((t) => t.recovered && (lensId === "all" || t.lens?.id === lensId));
  const shownIds = new Set(themes.map((t) => t.id));
  const fixes = model.fixes.filter((f) => f.themes.some((t) => shownIds.has(t.id))).sort((a, b) => b.reach - a.reach);
  const top = [...model.fixes].sort((a, b) => b.reach - a.reach)[0];
  const pickedTheme = picked ? model.themes.find((t) => t.id === picked) ?? null : null;

  // Deep link from Priorities: /app/fixes?issue=delivery-delay opens that issue's biggest problem.
  useEffect(() => {
    const issue = new URLSearchParams(window.location.search).get("issue");
    if (!issue) return;
    const t = model.themes.filter((x) => x.issue === issue && !x.recovered).sort((a, b) => b.reports - a.reports)[0];
    if (t) {
      setLensId(t.lens?.id ?? "all");
      pick(t.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(id: string) {
    setPicked(id);
    requestAnimationFrame(() => optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (!model.themes.length) {
    return (
      <div className="flex flex-col gap-5 px-5 py-7 lg:px-8">
        <PageHeader title="Fixes">What to do about each problem.</PageHeader>
        <Panel className="p-8 text-center text-ink-2">No complaints in this dataset match the fix playbook yet.</Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 py-7 lg:px-8">
      <PageHeader title="Fixes">
        Each problem customers describe, the fixes that solve it, and which single fix solves the most at once.
      </PageHeader>

      {top && (
        <Panel tone="attn" className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="raised mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
              <Sparkles size={17} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-semibold text-attn-text">Highest leverage fix</span>
              <p className="text-[17px] font-semibold">{top.name}</p>
              <p className="text-[13px] text-ink-2">
                One fix that addresses {fmt(top.reach)} reports across {top.themes.length} different problems:{" "}
                {top.themes.map((t) => t.name.toLowerCase()).join("; ")}.
              </p>
            </div>
          </div>
          <Button variant="primary" onClick={() => pick([...top.themes].sort((a, b) => b.reports - a.reports)[0].id)}>
            See the options
          </Button>
        </Panel>
      )}

      <div role="tablist" aria-label="Problem group" className="well flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl p-1 [scrollbar-width:none]">
        {[{ id: "all", name: "All problems", color: "" }, ...lensesPresent].map((l) => {
          const on = l.id === lensId;
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setLensId(l.id);
                setHover(null);
              }}
              className={clsx(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                on ? "raised" : "text-ink-2 hover:text-ink",
              )}
            >
              {l.color && <span className="size-2 rounded-full" style={{ background: l.color }} />}
              {l.name}
            </button>
          );
        })}
      </div>

      <Panel className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Problems → fixes</h2>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <MousePointerClick size={13} /> Hover to trace a line. Click a problem to compare its options.
          </span>
        </div>
        <FlowDiagram
          key={lensId}
          themes={themes}
          fixes={fixes}
          hover={hover}
          setHover={setHover}
          picked={picked}
          onPick={pick}
        />
        {recovered.length > 0 && (
          <div className="mt-5 flex flex-col gap-2 border-t border-line-soft pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ThumbsUp size={14} className="text-pos" /> What already works
            </h3>
            <div className="flex flex-wrap gap-2">
              {recovered.map((t) => (
                <RecoveredChip key={t.id} t={t} />
              ))}
            </div>
            <p className="text-[12px] text-ink-2">
              The same problem, handled well: these customers wrote mixed reviews instead of angry ones. It is the evidence
              behind several fixes below.
            </p>
          </div>
        )}
      </Panel>

      <div ref={optionsRef} className="scroll-mt-6">
        <AnimatePresence mode="wait">
          {pickedTheme && (
            <Options key={pickedTheme.id} theme={pickedTheme} model={model} onClose={() => setPicked(null)} />
          )}
        </AnimatePresence>
      </div>

      <p className="text-[12px] text-ink-3">
        Reach is counted from the reviews. Effort and time are planning estimates, not measurements; adjust them to your
        team.
      </p>
    </div>
  );
}

function RecoveredChip({ t }: { t: ThemeStat }) {
  const show = useEvidence((s) => s.show);
  return (
    <button
      type="button"
      onClick={() => show(t.name, `${fmt(t.reports)} reports, mixed rather than negative`, t.reviews)}
      className="inline-flex items-center gap-2 rounded-xl border border-pos/40 bg-pos-bg px-3 py-1.5 text-[13px] text-pos-fg hover:brightness-110"
    >
      <Check size={13} /> {t.name} <span className="font-semibold tabular-nums">{fmt(t.reports)}</span>
    </button>
  );
}

type Hover = { kind: "theme" | "fix"; id: string } | null;

function FlowDiagram({
  themes,
  fixes,
  hover,
  setHover,
  picked,
  onPick,
}: {
  themes: ThemeStat[];
  fixes: FixStat[];
  hover: Hover;
  setHover: (h: Hover) => void;
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const left = useRef(new Map<string, HTMLElement>());
  const right = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<{ key: string; theme: ThemeStat; fix: FixStat; d: string }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const maxReports = Math.max(1, ...themes.map((t) => t.reports));
  const maxReach = Math.max(1, ...fixes.map((f) => f.reach));

  const measure = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    setSize({ w: box.width, h: box.height });
    const out: typeof paths = [];
    for (const f of fixes) {
      const r = right.current.get(f.id)?.getBoundingClientRect();
      if (!r) continue;
      for (const t of f.themes) {
        const l = left.current.get(t.id)?.getBoundingClientRect();
        if (!l) continue;
        const x1 = l.right - box.left;
        const y1 = l.top + l.height / 2 - box.top;
        const x2 = r.left - box.left;
        const y2 = r.top + r.height / 2 - box.top;
        const mx = (x1 + x2) / 2;
        out.push({ key: `${t.id}>${f.id}`, theme: t, fix: f, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` });
      }
    }
    setPaths(out);
  }, [fixes]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [measure]);

  const lit = (t: ThemeStat, f: FixStat) =>
    !hover || (hover.kind === "theme" ? hover.id === t.id : hover.id === f.id);
  const themeLit = (t: ThemeStat) =>
    !hover || (hover.kind === "theme" ? hover.id === t.id : t.fixes.some((f) => f.id === hover.id));
  const fixLit = (f: FixStat) =>
    !hover || (hover.kind === "fix" ? hover.id === f.id : f.themes.some((t) => t.id === hover.id));

  return (
    <div ref={wrap} className="relative grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-x-[clamp(56px,12vw,180px)]">
      <svg className="pointer-events-none absolute inset-0 hidden md:block" width={size.w} height={size.h} aria-hidden>
        {paths.map((p, i) => {
          const on = lit(p.theme, p.fix);
          return (
            <motion.path
              key={p.key}
              d={p.d}
              fill="none"
              stroke={p.theme.lens?.color ?? "#9aa0aa"}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: on ? (hover ? 0.95 : 0.5) : 0.07,
                strokeWidth: 1.5 + 7 * (p.theme.reports / maxReports) * (on && hover ? 1.15 : 1),
              }}
              transition={{ pathLength: { duration: 0.7, delay: i * 0.025, ease: [0.2, 0.8, 0.2, 1] }, opacity: { duration: 0.2 } }}
            />
          );
        })}
      </svg>

      <div className="flex flex-col gap-2.5">
        <span className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Problems customers describe</span>
        {themes.map((t) => (
          <motion.button
            layout
            key={t.id}
            ref={(el) => {
              if (el) left.current.set(t.id, el);
              else left.current.delete(t.id);
            }}
            type="button"
            onMouseEnter={() => setHover({ kind: "theme", id: t.id })}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover({ kind: "theme", id: t.id })}
            onBlur={() => setHover(null)}
            onClick={() => onPick(t.id)}
            aria-pressed={picked === t.id}
            className={clsx(
              "relative z-10 flex flex-col gap-1.5 rounded-2xl border bg-[var(--bg)]/80 p-3.5 text-left backdrop-blur transition-[opacity,border-color,transform] duration-200",
              picked === t.id ? "border-attn shadow-[0_0_0_3px_var(--attn-soft)]" : "border-line hover:border-ink-3",
              themeLit(t) ? "opacity-100" : "opacity-35",
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-[14px] font-semibold leading-snug">{t.name}</span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums">×{fmt(t.reports)}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-line-soft">
              <span className="block h-full rounded-full" style={{ width: `${(t.reports / maxReports) * 100}%`, background: t.lens?.color }} />
            </span>
            <span className="flex items-center justify-between gap-2 text-[12px] text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: t.lens?.color }} /> {t.lens?.name}
              </span>
              <span>
                {t.fixes.length} {t.fixes.length === 1 ? "fix" : "fixes"} →
              </span>
            </span>
          </motion.button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="hidden text-[12px] font-semibold tracking-wide text-ink-3 uppercase md:block">Fixes, by reach</span>
        {fixes.map((f) => (
          <motion.div
            layout
            key={f.id}
            ref={(el) => {
              if (el) right.current.set(f.id, el);
              else right.current.delete(f.id);
            }}
            onMouseEnter={() => setHover({ kind: "fix", id: f.id })}
            onMouseLeave={() => setHover(null)}
            className={clsx(
              "relative z-10 hidden flex-col gap-1.5 rounded-2xl border border-line bg-[var(--bg)]/80 p-3.5 backdrop-blur transition-opacity duration-200 md:flex",
              fixLit(f) ? "opacity-100" : "opacity-35",
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-[14px] font-semibold leading-snug">{f.name}</span>
              {f.themes.length > 1 && (
                <span className="shrink-0 rounded-md bg-attn-soft px-1.5 py-0.5 text-[11px] font-semibold text-attn-text">
                  solves {f.themes.length}
                </span>
              )}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-line-soft">
              <span className="block h-full rounded-full bg-ink-2" style={{ width: `${(f.reach / maxReach) * 100}%` }} />
            </span>
            <span className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-2">
              <span>
                {fmt(f.reach)} reports · {f.owner}
              </span>
              <span className="flex items-center gap-2">
                <Effort cost={f.cost} /> {f.weeks}
              </span>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Effort({ cost }: { cost: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={COST_LABEL[cost]} aria-label={COST_LABEL[cost]}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={clsx("text-[12px] font-bold", i <= cost ? "text-ink" : "text-ink-3/40")}>
          ₹
        </span>
      ))}
    </span>
  );
}

function Options({ theme, model, onClose }: { theme: ThemeStat; model: ReturnType<typeof buildFixModel>; onClose: () => void }) {
  const show = useEvidence((s) => s.show);
  const options = model.fixes
    .filter((f) => f.themes.some((t) => t.id === theme.id))
    .sort((a, b) => a.cost - b.cost || b.reach - a.reach);
  const tags = optionTags(options);
  const maxReach = Math.max(1, ...options.map((o) => o.reach));

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      aria-label={`Options for ${theme.name}`}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: theme.lens?.color }}>
            <span className="size-2 rounded-full" style={{ background: theme.lens?.color }} /> {theme.lens?.name} · compare options
          </span>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">{theme.name}</h2>
          <button
            type="button"
            onClick={() => show(theme.name, "", theme.reviews)}
            className="w-fit text-[13px] text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
          >
            {fmt(theme.reports)} reports, from {fmt(theme.reviews.length)} {theme.reviews.length === 1 ? "phrasing" : "phrasings"}. Read them
          </button>
        </div>
        <Button size="sm" onClick={onClose}>
          <X size={14} /> Close
        </Button>
      </div>

      <div className={clsx("grid gap-4", options.length >= 3 ? "lg:grid-cols-3" : options.length === 2 ? "lg:grid-cols-2" : "")}>
        {options.map((f, i) => (
          <OptionCard key={f.id} f={f} theme={theme} model={model} tags={tags.get(f.id) ?? []} maxReach={maxReach} index={i} />
        ))}
      </div>
    </motion.section>
  );
}

function OptionCard({
  f,
  theme,
  model,
  tags,
  maxReach,
  index,
}: {
  f: FixStat;
  theme: ThemeStat;
  model: ReturnType<typeof buildFixModel>;
  tags: string[];
  maxReach: number;
  index: number;
}) {
  const tracked = useStore((s) => !!s.tracker[theme.issue]);
  const track = useStore((s) => s.track);
  const addNote = useStore((s) => s.addNote);
  const toast = useToast((s) => s.show);
  const show = useEvidence((s) => s.show);
  const [added, setAdded] = useState(false);
  const evidence = f.evidence ? model.themes.find((t) => t.id === f.evidence) : null;
  const others = f.themes.filter((t) => t.id !== theme.id);
  const best = tags.includes("Best value");

  useEffect(() => setAdded(false), [f.id]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
      className={clsx("glass flex flex-col gap-4 rounded-[22px] p-5", best && "glass-attn")}
    >
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className={clsx(
              "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
              t === "Best value" ? "bg-attn text-on-attn" : t === "Quick win" ? "bg-pos-bg text-pos-fg" : "bg-line-soft text-ink",
            )}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[17px] leading-snug font-semibold">{f.name}</h3>
        <p className="text-[13px] text-ink-2">{f.summary}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-[13px]">
        <div className="flex flex-col gap-0.5">
          <dt className="flex items-center gap-1 text-[11px] text-ink-2">Effort</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            <Effort cost={f.cost} /> {COST_LABEL[f.cost].replace(" effort", "")}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="flex items-center gap-1 text-[11px] text-ink-2">
            <Clock size={11} /> Time to ship
          </dt>
          <dd className="font-medium">{f.weeks}</dd>
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <dt className="flex items-center gap-1 text-[11px] text-ink-2">
            <Target size={11} /> Reach, counted from the reviews
          </dt>
          <dd className="flex items-center gap-2">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
              <motion.span
                className="block h-full rounded-full bg-attn"
                initial={{ width: 0 }}
                animate={{ width: `${(f.reach / maxReach) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.07 }}
              />
            </span>
            <span className="font-semibold tabular-nums">{fmt(f.reach)}</span>
          </dd>
          {others.length > 0 && (
            <dd className="text-[12px] text-ink-2">
              Also solves: {others.map((t) => `${t.name.toLowerCase()} (${fmt(t.reports)})`).join(", ")}
            </dd>
          )}
        </div>
        <div className="col-span-2 flex flex-col gap-0.5">
          <dt className="flex items-center gap-1 text-[11px] text-ink-2">
            <Users size={11} /> Owner
          </dt>
          <dd className="font-medium">{f.owner}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <h4 className="flex items-center gap-1.5 text-[13px] font-semibold">
          <ListChecks size={14} /> Steps
        </h4>
        <ol className="flex flex-col gap-2">
          {f.steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-[13px] leading-snug">
              <span className="well inline-flex size-[22px] items-center justify-center rounded-full text-[11px] font-semibold">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="well flex flex-col gap-1 rounded-2xl p-3 text-[13px]">
        <span className="text-[11px] font-semibold text-ink-2">How you will know it worked</span>
        {f.measure}
        {evidence && (
          <button
            type="button"
            onClick={() => show(evidence.name, "Evidence: the same problem, handled well", evidence.reviews)}
            className="mt-1 w-fit text-left text-[12px] font-medium text-pos-fg underline decoration-pos/40 underline-offset-4"
          >
            Evidence: {fmt(evidence.reports)} customers in this data were handled this way and wrote mixed, not angry, reviews.
          </button>
        )}
      </div>

      <Button
        variant={best ? "primary" : "secondary"}
        className="mt-auto w-full justify-center"
        disabled={added}
        onClick={() => {
          if (!tracked) track(theme.issue);
          addNote(
            theme.issue,
            `Plan for "${theme.name}": ${f.name} (${COST_LABEL[f.cost].toLowerCase()}, ${f.weeks}, owner ${f.owner}). ` +
              f.steps.map((s, i) => `${i + 1}. ${s}`).join(" ") +
              ` Measure: ${f.measure}`,
          );
          setAdded(true);
          toast(`Plan added to the tracker: ${f.name}`);
        }}
      >
        {added ? <Check size={15} /> : <Plus size={15} />} {added ? "Added to the tracker" : "Add to tracker with this plan"}
      </Button>
    </motion.article>
  );
}
