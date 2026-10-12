"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, MapPin, X } from "lucide-react";
import sample from "@/data/sample.json";
import { buildGeo, LENSES } from "@/lib/geo";
import type { Review } from "@/lib/types";

const MapScene = dynamic(() => import("@/components/MapScene"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-[22px]" />,
});

export function LandingMap() {
  const geo = useMemo(() => buildGeo((sample as { reviews: Review[] }).reviews), []);
  const [selected, setSelected] = useState<string | null>(null);
  const st = selected ? geo.states[selected] : null;
  const regional = geo.spread.filter((s) => s.regional);
  const everywhere = geo.spread.filter((s) => !s.regional);

  return (
    <div className="glass relative overflow-hidden rounded-[24px]">
      <div className="h-[460px] sm:h-[600px]">
        <MapScene geo={geo} lens={null} selected={selected} onSelect={setSelected} onOpenReview={() => { if (selected) window.location.href = `/app/map?state=${selected}`; }} dark wheelZoom={false} />
      </div>

      <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-attn/50 bg-[var(--bg)]/85 px-3 py-1.5 text-[12px] font-semibold text-attn-text backdrop-blur-md">
        <MapPin size={13} /> Simulated locations, for demonstration
      </span>

      <div className="absolute right-4 bottom-4 left-4 flex flex-col gap-3 sm:left-auto sm:w-[340px]">
        {st ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-[var(--bg)]/90 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{st.name}</p>
                <p className="text-[12px] text-ink-2">{st.reports.toLocaleString("en-US")} reports</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Back to all of India" className="rounded-lg p-1 hover:bg-surface-2">
                <X size={16} />
              </button>
            </div>
            <p className="text-[14px]">
              {st.main
                ? `${st.main.lens.name} complaints run ${st.main.index.toFixed(1)}× the national rate here. A local fix, owned by ${st.main.lens.owner}.`
                : "Nothing here stands out beyond chance. Problems in this state are the same ones everyone has."}
            </p>
            <Link href={`/app/map?state=${st.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold underline underline-offset-4">
              Open the reviews behind it <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-[var(--bg)]/90 p-4 backdrop-blur-md">
            <p className="text-[13px] font-semibold">Click a state</p>
            {regional.map((s) => (
              <p key={s.lens.id} className="flex items-center gap-2 text-[13px]">
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.lens.color }} />
                <span>
                  <strong>{s.lens.name}</strong> is regional: {s.hotspots.map((h) => h.name).join(", ")}
                </span>
              </p>
            ))}
            <p className="text-[13px] text-ink-2">
              {everywhere.map((s) => s.lens.name.toLowerCase()).join(", ")}: everywhere, so one fix at the source.
            </p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute top-4 right-4 hidden gap-1.5 sm:flex">
        {LENSES.slice(0, 3).map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg)]/80 px-2.5 py-1 text-[11px] text-ink-2 backdrop-blur">
            <span className="size-2 rounded-full" style={{ background: l.color }} /> {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
