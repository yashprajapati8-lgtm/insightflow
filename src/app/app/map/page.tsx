"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Info, MapPin, RotateCcw, Plus, Check, MousePointerClick } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Panel, PanelHeader, Button, EmptyState, fmt } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useEvidence } from "@/lib/evidence";
import { useToast } from "@/lib/toast";
import { issueById } from "@/lib/taxonomy";
import { buildGeo, LENSES, SIMULATED_NOTE, isHotspot, tint, type CityStat, type Lens, type StateStat } from "@/lib/geo";
import type { Review } from "@/lib/types";

const MapScene = dynamic(() => import("@/components/MapScene"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-[18px]" />,
});

export default function MapPage() {
  const reviews = useStore((s) => s.reviews);
  const tracker = useStore((s) => s.tracker);
  const track = useStore((s) => s.track);
  const addNote = useStore((s) => s.addNote);
  const show = useEvidence((s) => s.show);
  const toast = useToast((s) => s.show);
  const geo = useMemo(() => buildGeo(reviews), [reviews]);
  const [lensId, setLensId] = useState<string>("main");
  const [selected, setSelected] = useState<string | null>(null);
  const dark = useDark();

  // Deep links from the homepage: /app/map?state=gj&lens=delivery
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("state");
    const l = q.get("lens");
    if (l && LENSES.some((x) => x.id === l)) setLensId(l);
    if (s) setSelected(s);
  }, []);

  const lens = LENSES.find((l) => l.id === lensId) ?? null;
  const st = selected ? geo.states[selected] : null;

  function openState(s: StateStat, l: Lens | null) {
    const rows: Review[] = [];
    for (const c of s.cities)
      for (const { review, n } of c.reviews) {
        if (l && !l.issues.includes(review.analysis.issueId ?? "")) continue;
        const prev = rows.find((r) => r.id === review.id);
        if (prev) prev.count += n;
        else rows.push({ ...review, count: n });
      }
    show(`${s.name}${l ? `: ${l.name.toLowerCase()}` : ""}`, `${geo.simulated ? "Simulated location · " : ""}${fmt(rows.reduce((a, r) => a + r.count, 0))} reports`, rows);
  }

  function openReview(r: Review, c: CityStat, n: number) {
    const same = c.reviews.filter((x) => x.review.analysis.issueId === r.analysis.issueId).map((x) => ({ ...x.review, count: x.n }));
    const issue = issueById(r.analysis.issueId);
    show(
      `${c.city.name}: ${issue ? issue.name.toLowerCase() : "this review"}`,
      `${geo.simulated ? "Simulated location · " : ""}${fmt(n)} customers sent this exact review here`,
      same.length ? same : [{ ...r, count: n }],
    );
  }

  if (!geo.located) {
    return (
      <div className="flex flex-col gap-6 px-5 py-7 lg:px-8">
        <PageHeader title="Map">Where each problem is concentrated.</PageHeader>
        <Panel className="p-8">
          <EmptyState
            title="This dataset has no locations"
            body="Add a state or city column to your CSV and import it again to see it here. Reset to the sample workspace to see the simulated demo."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 py-7 lg:px-8">
      <PageHeader
        title="Map"
        actions={
          geo.simulated ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-attn/50 bg-attn-soft px-3 py-1.5 text-[12px] font-semibold text-attn-text">
              <MapPin size={13} /> Simulated locations
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-pos-bg px-3 py-1.5 text-[12px] font-semibold text-pos-fg">
              <MapPin size={13} /> Locations from your file
            </span>
          )
        }
      >
        Is a problem regional, or everywhere? Regional problems need a local fix. Problems that appear everywhere need one fix
        at the source.
      </PageHeader>

      <p className="flex items-start gap-2 text-[13px] text-ink-2">
        <Info size={15} className="mt-0.5 shrink-0" />{" "}
        {geo.simulated
          ? SIMULATED_NOTE
          : `${fmt(geo.located)} of ${fmt(geo.total)} reports have a state or city in your file. Cities we do not have coordinates for are placed at their state's center.`}
      </p>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Panel className="relative overflow-hidden p-0">
          <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 p-4">
            <div role="radiogroup" aria-label="Color the map by" className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-[var(--bg)]/85 p-1 backdrop-blur-md [scrollbar-width:none] sm:flex-wrap">
              {[{ id: "main", name: "Main issue", color: "" }, ...LENSES].map((l) => {
                const on = l.id === lensId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setLensId(l.id)}
                    className={clsx(
                      "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                      on ? "raised" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {l.color && <span className="size-2 rounded-full" style={{ background: l.color }} />}
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-[460px] w-full sm:h-[640px]">
            <MapScene geo={geo} lens={lens} selected={selected} onSelect={setSelected} onOpenReview={openReview} dark={dark} />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-3 p-4">
            <Legend lens={lens} />
            <div className="pointer-events-auto flex items-center gap-2">
              {selected ? (
                <Button size="sm" onClick={() => setSelected(null)}>
                  <RotateCcw size={13} /> All of India
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-[var(--bg)]/85 px-2.5 py-1.5 text-[11px] text-ink-2 backdrop-blur-md">
                  <MousePointerClick size={13} /> Click a state · drag to move · right-drag to turn · scroll to zoom
                </span>
              )}
            </div>
          </div>
        </Panel>

        {st ? (
          <StatePanel
            st={st}
            simulated={geo.simulated}
            lens={lens}
            onOpen={(l) => openState(st, l)}
            tracked={(id) => !!tracker[id]}
            onTrack={(l) => {
              const counts = new Map<string, number>();
              for (const c of st.cities)
                for (const { review, n } of c.reviews)
                  if (review.analysis.issueId && l.issues.includes(review.analysis.issueId))
                    counts.set(review.analysis.issueId, (counts.get(review.analysis.issueId) ?? 0) + n);
              const issueId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
              if (!issueId) return;
              const top = topCities(st, l).slice(0, 2).map((c) => c.city.name);
              track(issueId);
              addNote(
                issueId,
                `Map${geo.simulated ? ", simulated locations" : ""}: ${st.name} has ${st.index[l.id].toFixed(1)}× the national rate of ${l.name.toLowerCase()} complaints. Start with ${top.join(" and ")}.`,
              );
              toast(`Tracked for ${st.name}, with a note`);
            }}
          />
        ) : (
          <SpreadPanel
            geo={geo}
            lensId={lensId}
            onLens={setLensId}
            onState={(id) => setSelected(id)}
          />
        )}
      </div>
    </div>
  );
}

function useDark() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.getAttribute("data-theme") !== "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

function Legend({ lens }: { lens: Lens | null }) {
  const box = "pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-line bg-[var(--bg)]/85 px-3 py-2 text-[11px] text-ink-2 backdrop-blur-md";
  if (!lens)
    return (
      <div className={box}>
        <span className="font-semibold text-ink">Each state shows the issue it has most above the national rate</span>
        <span>Strong color and raised: a proven hotspot. Pale: above average, but within chance.</span>
      </div>
    );
  return (
    <div className={box}>
      <span className="font-semibold text-ink">{lens.name}, compared with the national rate</span>
      <div className="flex items-center gap-2">
        <span>Lowest</span>
        <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, #f4f5f7, ${lens.color})` }} />
        <span>Highest</span>
      </div>
      <span>Strong color and raised: a proven hotspot. Pale: higher rates that chance can explain.</span>
    </div>
  );
}

function SpreadPanel({
  geo,
  lensId,
  onLens,
  onState,
}: {
  geo: ReturnType<typeof buildGeo>;
  lensId: string;
  onLens: (id: string) => void;
  onState: (id: string) => void;
}) {
  const sorted = [...geo.spread].sort((a, b) => Number(b.regional) - Number(a.regional) || b.reports - a.reports);
  return (
    <Panel className="flex flex-col gap-4 p-6">
      <PanelHeader title="Regional or everywhere?" subtitle={`${fmt(geo.located)} reports placed on the map`} />
      <ol className="flex flex-col gap-2">
        {sorted.map((s) => {
          const on = s.lens.id === lensId;
          return (
            <li key={s.lens.id}>
              <div
                className={clsx(
                  "flex flex-col gap-2 rounded-2xl border p-3.5 transition-colors",
                  on ? "border-attn/60 bg-attn-soft" : "border-line bg-well",
                )}
              >
                <button type="button" onClick={() => onLens(s.lens.id)} className="flex items-center justify-between gap-3 text-left">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="size-2.5 rounded-full" style={{ background: s.lens.color }} />
                    {s.lens.name}
                  </span>
                  <span className="text-xs text-ink-2">{fmt(s.reports)} reports</span>
                </button>
                {s.regional ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-neg-fg">Regional: fix it locally</span>
                    <div className="flex flex-wrap gap-1.5">
                      {s.hotspots.slice(0, 3).map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            onLens(s.lens.id);
                            onState(h.id);
                          }}
                          className="glass inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium hover:brightness-110"
                        >
                          {h.name} <span className="text-ink-2">{h.index[s.lens.id].toFixed(1)}×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] text-ink-2">
                      <span className="font-semibold text-ink">Everywhere:</span> no state stands out beyond chance. One fix at the
                      source, by {s.lens.owner}.
                    </span>
                    {s.top && (
                      <button
                        type="button"
                        onClick={() => {
                          onLens(s.lens.id);
                          onState(s.top!.id);
                        }}
                        className="w-fit text-left text-[12px] text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
                      >
                        Highest rate: {s.top.name}, {s.topIndex.toFixed(1)}× (within chance)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-ink-2">
        A state is a hotspot when its share of a problem is well above the national share, by more than chance explains
        (3.5 standard deviations). Small states are pulled toward the average so a handful of reports cannot top the list.
      </p>
    </Panel>
  );
}

function topCities(st: StateStat, l: Lens) {
  return [...st.cities].map((c) => ({ ...c, k: c.byLens[l.id] ?? 0 })).filter((c) => c.k > 0).sort((a, b) => b.k - a.k);
}

function StatePanel({
  st,
  simulated,
  lens,
  onOpen,
  onTrack,
  tracked,
}: {
  st: StateStat;
  simulated: boolean;
  lens: Lens | null;
  onOpen: (l: Lens | null) => void;
  onTrack: (l: Lens) => void;
  tracked: (issueId: string) => boolean;
}) {
  const focus = lens ?? st.main?.lens ?? null;
  const rows = LENSES.map((l) => ({ l, n: st.byLens[l.id], idx: st.index[l.id], hot: isHotspot(st, l.id) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.idx - a.idx);
  const maxIdx = Math.max(2, ...rows.map((r) => r.idx));
  const share = focus ? (st.byLens[focus.id] / Math.max(1, st.reports)) : 0;
  const expected = focus ? Math.round(st.expected[focus.id]) : 0;
  const excess = focus ? Math.max(0, st.byLens[focus.id] - expected) : 0;
  const cities = focus ? topCities(st, focus) : [];
  const hot = focus ? isHotspot(st, focus.id) : false;
  const isTracked = focus ? focus.issues.some(tracked) : false;

  // What customers in this state talk about, from the per-aspect labels (Adaption's, where it has run).
  const aspects = new Map<string, { neg: number; pos: number }>();
  let byAdaption = 0;
  let labeled = 0;
  for (const c of st.cities)
    for (const { review, n } of c.reviews) {
      if (focus && !focus.issues.includes(review.analysis.issueId ?? "")) continue;
      labeled += n;
      if (review.engine === "adaption") byAdaption += n;
      for (const a of review.analysis.aspects) {
        const k = a.topic.toLowerCase();
        const v = aspects.get(k) ?? { neg: 0, pos: 0 };
        if (a.sentiment === "negative") v.neg += n;
        else if (a.sentiment === "positive") v.pos += n;
        aspects.set(k, v);
      }
    }
  const topAspects = [...aspects.entries()].sort((a, b) => b[1].neg + b[1].pos - (a[1].neg + a[1].pos)).slice(0, 6);

  return (
    <Panel className="flex flex-col gap-5 p-6" tone={hot ? "attn" : undefined}>
      <div className="flex flex-col gap-1">
        <span className="text-[12px] text-ink-2">State{simulated ? " · simulated location" : ""}</span>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">{st.name}</h2>
        <p className="text-[13px] text-ink-2">
          {fmt(st.reports)} reports from {st.cities.length} {st.cities.length === 1 ? "city" : "cities"}, {fmt(st.complaints)} of them
          complaints
        </p>
      </div>

      {focus && (
        <div className="well flex flex-col gap-2 rounded-2xl p-4">
          <span className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: focus.color }}>
            <span className="size-2 rounded-full" style={{ background: focus.color }} /> {focus.name}
          </span>
          {hot ? (
            <p className="text-[15px] leading-snug">
              <strong>{st.index[focus.id].toFixed(1)}×</strong> the national rate. {fmt(st.byLens[focus.id])} reports where its
              volume predicts about {fmt(expected)}, so <strong>{fmt(excess)} more than expected</strong>.
            </p>
          ) : (
            <p className="text-[15px] leading-snug">
              {fmt(st.byLens[focus.id])} reports, {(share * 100).toFixed(0)}% of this state&apos;s feedback. Within the normal range
              for its volume, so not a local problem.
            </p>
          )}
          {hot && cities.length > 0 && (
            <p className="text-[13px] text-ink-2">
              Start with {cities.slice(0, 2).map((c) => `${c.city.name} (${fmt(c.k)})`).join(" and ")}
              {focus.id === "delivery" ? ": check courier performance and stock coverage there first." : "."} Owner: {focus.owner}.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => onOpen(focus)}>
              Open {fmt(st.byLens[focus.id])} reports
            </Button>
            {hot && (
              <Button size="sm" variant="primary" onClick={() => onTrack(focus)} disabled={isTracked}>
                {isTracked ? <Check size={13} /> : <Plus size={13} />} {isTracked ? "Tracked" : `Track for ${st.name}`}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Compared with the national rate</h3>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.l.id} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_44px] items-center gap-3 text-[13px]">
              <span className="truncate text-ink-2">{r.l.name}</span>
              <span className="relative h-2.5 rounded-full bg-line-soft">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(Math.min(r.idx, maxIdx) / maxIdx) * 100}%`, background: r.hot ? r.l.color : tint(r.l.color, 0.35, "#9aa0aa") }} />
                <span className="absolute inset-y-[-3px] w-px bg-ink-3" style={{ left: `${(1 / maxIdx) * 100}%` }} aria-hidden />
              </span>
              <span className={clsx("text-right tabular-nums", r.hot && "font-semibold")}>{r.idx.toFixed(1)}×</span>
            </li>
          ))}
        </ul>
        <span className="text-[11px] text-ink-3">The line marks 1×, the national rate. Bold means a real hotspot, not chance.</span>
      </div>

      {topAspects.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">What customers mention{focus ? ` in ${focus.name.toLowerCase()} reports` : ""}</h3>
          <div className="flex flex-wrap gap-1.5">
            {topAspects.map(([topic, v]) => (
              <span key={topic} className="well inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px]">
                <span className="capitalize">{topic}</span>
                {v.neg > 0 && <span className="text-neg-fg tabular-nums">−{fmt(v.neg)}</span>}
                {v.pos > 0 && <span className="text-pos-fg tabular-nums">+{fmt(v.pos)}</span>}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-ink-3">
            Aspect labels, aspect by aspect: a review can be negative on delivery and positive on support.{" "}
            {labeled > 0 && `${Math.round((byAdaption / labeled) * 100)}% labeled by Adaption.`}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Cities</h3>
        <ul className="flex flex-col divide-y divide-line-soft">
          {st.cities.map((c) => (
            <li key={c.city.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <span>{c.city.name}</span>
              <span className="text-ink-2 tabular-nums">
                {fmt(c.reports)} reports{focus ? ` · ${fmt(c.byLens[focus.id] ?? 0)} ${focus.name.toLowerCase()}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <span className="text-[11px] text-ink-3">Each dome on the map is a city. A dot is one kind of review; bigger means more customers.</span>
      </div>
    </Panel>
  );
}
