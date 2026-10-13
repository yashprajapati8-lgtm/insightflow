/**
 * Geography for the map view.
 *
 * The Build Battle dataset has no location column. The demo map uses SIMULATED city and state values,
 * assigned by scripts/build-locations.ts with a fixed seed. Reviews and categories are never changed.
 * Everything that shows a location must say so.
 */
import type { Review } from "./types";
import sim from "@/data/sim-locations.json";
import { STATE_NAMES, STATE_CENTER, findCity } from "./places";

export const SIMULATED_NOTE =
  "Simulated locations. The dataset has no location column, so each report was assigned a city by a seeded simulation to demonstrate this view. Review text and categories are unchanged.";

export type City = { id: string; name: string; state: string; lat: number; lon: number };
export const CITIES = (sim as { cities: City[] }).cities;
const BY_REVIEW = (sim as unknown as { byReview: Record<string, [number, number][]> }).byReview;

export { STATE_NAMES };

/** Issue groups the map can be viewed through. Colors follow the brief: delivery red, damage cyan, product teal. */
export type Lens = { id: string; name: string; issues: string[]; color: string; owner: string };
export const LENSES: Lens[] = [
  { id: "delivery", name: "Delivery", issues: ["delivery-delay", "never-received"], color: "#f0604f", owner: "Logistics" },
  { id: "damage", name: "Damaged or wrong items", issues: ["damaged-missing", "wrong-items"], color: "#25c2e3", owner: "Fulfilment" },
  { id: "fraud", name: "Fraud and scams", issues: ["extra-payment", "not-as-advertised"], color: "#d566e0", owner: "Trust and Safety" },
  { id: "payments", name: "Double charges", issues: ["double-charge"], color: "#eaa93c", owner: "Payments" },
  { id: "software", name: "App and checkout", issues: ["checkout-crash"], color: "#7d8cff", owner: "Engineering" },
  { id: "product", name: "Product quality", issues: ["product-failure"], color: "#2fb89c", owner: "Product" },
  { id: "support", name: "Support", issues: ["support-quality"], color: "#5fcf7f", owner: "Support" },
];
export const lensOf = (issueId: string | null) => LENSES.find((l) => issueId && l.issues.includes(issueId)) ?? null;

/** The svg map is Mercator. Fitted to its extremes: Kutch (68.16°E) at x=0, the northern tip (37.08°N) at y=0. */
const PX_PER_DEG = 20.93;
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
export function project(lat: number, lon: number): [number, number] {
  return [(lon - 68.16) * PX_PER_DEG, ((merc(37.08) - merc(lat)) * 180) / Math.PI * PX_PER_DEG];
}

export function unproject(x: number, y: number): [lat: number, lon: number] {
  const m = merc(37.08) - ((y / PX_PER_DEG) * Math.PI) / 180;
  return [((2 * Math.atan(Math.exp(m)) - Math.PI / 2) * 180) / Math.PI, x / PX_PER_DEG + 68.16];
}

/** Turns a review's locations into [city, count] pairs: real ones from an import, or the simulated ones for the sample. */
function placesOf(r: Review, real: boolean, virtual: Map<string, City>): [City, number][] {
  if (!real) return (BY_REVIEW[r.id] ?? []).map(([ci, n]) => [CITIES[ci], n] as [City, number]).filter(([c]) => !!c);
  const out: [City, number][] = [];
  for (const [key, n] of Object.entries(r.places ?? {})) {
    const [state, cityName = ""] = key.split("|");
    const known = cityName ? findCity(cityName) : null;
    if (known && known.state === state) {
      out.push([known, n]);
      continue;
    }
    const id = `${state}:${cityName.toLowerCase() || "*"}`;
    let c = virtual.get(id);
    if (!c) {
      const [cx, cy] = STATE_CENTER[state] ?? [306, 348];
      const a = (virtual.size * 2.4) % (Math.PI * 2);
      const off = cityName ? 9 : 0;
      const [lat, lon] = unproject(cx + Math.cos(a) * off, cy + Math.sin(a) * off);
      c = { id, name: cityName || STATE_NAMES[state] || state, state, lat, lon };
      virtual.set(id, c);
    }
    out.push([c, n]);
  }
  return out;
}

export type CityStat = { city: City; reports: number; byLens: Record<string, number>; reviews: { review: Review; n: number }[] };
export type StateStat = {
  id: string;
  name: string;
  reports: number;
  complaints: number;
  byLens: Record<string, number>;
  /** How many times the national share this state's share is, shrunk toward 1 when a state has few reports. */
  index: Record<string, number>;
  /** Standard deviations above what national rates predict. Separates a real hotspot from chance. */
  z: Record<string, number>;
  /** Reports this state would have at the national rate. */
  expected: Record<string, number>;
  main: { lens: Lens; index: number } | null;
  cities: CityStat[];
};
export type Spread = { lens: Lens; reports: number; top: StateStat | null; topIndex: number; regional: boolean; hotspots: StateStat[] };
export type GeoModel = { simulated: boolean; maxIndex: Record<string, number>; states: Record<string, StateStat>; spread: Spread[]; national: Record<string, number>; total: number; located: number };

const PRIOR = 60; // reports of "national average" blended into every state, so tiny states cannot top the chart by chance.
export const REGIONAL_AT = 1.5;
/** A state only counts as a hotspot when it is this many standard deviations above expectation (chance rarely gets there). */
export const SIGNIFICANT = 3.5;
export const isHotspot = (st: StateStat, lensId: string) => st.z[lensId] >= SIGNIFICANT && st.index[lensId] >= 1.25;

export function buildGeo(reviews: Review[]): GeoModel {
  const states: Record<string, StateStat> = {};
  const cityStats = new Map<string, CityStat>();
  const real = reviews.some((r) => r.places && Object.keys(r.places).length);
  const virtual = new Map<string, City>();
  const national: Record<string, number> = Object.fromEntries(LENSES.map((l) => [l.id, 0]));
  let total = 0;
  let located = 0;

  for (const r of reviews) {
    total += r.count;
    const spots = placesOf(r, real, virtual);
    if (!spots.length) continue;
    const lens = lensOf(r.analysis.issueId);
    for (const [city, n] of spots) {
      located += n;
      let cs = cityStats.get(city.id);
      if (!cs) cityStats.set(city.id, (cs = { city, reports: 0, byLens: {}, reviews: [] }));
      cs.reports += n;
      cs.reviews.push({ review: r, n });
      const st = (states[city.state] ??= {
        id: city.state,
        name: STATE_NAMES[city.state] ?? city.state,
        reports: 0,
        complaints: 0,
        byLens: Object.fromEntries(LENSES.map((l) => [l.id, 0])),
        index: {},
        z: {},
        expected: {},
        main: null,
        cities: [],
      });
      st.reports += n;
      if (lens) {
        cs.byLens[lens.id] = (cs.byLens[lens.id] ?? 0) + n;
        st.byLens[lens.id] += n;
        st.complaints += n;
        national[lens.id] += n;
      }
    }
  }

  for (const cs of cityStats.values()) {
    cs.reviews.sort((a, b) => b.n - a.n);
    states[cs.city.state]?.cities.push(cs);
  }
  for (const st of Object.values(states)) {
    st.cities.sort((a, b) => b.reports - a.reports);
    for (const l of LENSES) {
      const share = located ? national[l.id] / located : 0;
      if (!share) {
        st.index[l.id] = 1;
        st.z[l.id] = 0;
        st.expected[l.id] = 0;
        continue;
      }
      const expected = st.reports * share;
      st.expected[l.id] = expected;
      st.z[l.id] = expected > 0 ? (st.byLens[l.id] - expected) / Math.sqrt(expected * (1 - share)) : 0;
      const rate = (st.byLens[l.id] + PRIOR * share) / (st.reports + PRIOR);
      st.index[l.id] = rate / share;
    }
    const best = LENSES.filter((l) => st.z[l.id] >= SIGNIFICANT)
      .map((l) => ({ lens: l, index: st.index[l.id] }))
      .sort((a, b) => b.index - a.index)[0];
    st.main = best ?? null;
  }

  const spread: Spread[] = LENSES.map((l) => {
    const hot = Object.values(states)
      .filter((st) => isHotspot(st, l.id))
      .sort((a, b) => b.index[l.id] - a.index[l.id]);
    const top = hot[0] ?? Object.values(states).sort((a, b) => b.index[l.id] - a.index[l.id])[0] ?? null;
    const topIndex = top ? top.index[l.id] : 1;
    return { lens: l, reports: national[l.id], top, topIndex, regional: hot.length > 0, hotspots: hot };
  }).filter((s) => s.reports > 0);

  const maxIndex = Object.fromEntries(LENSES.map((l) => [l.id, Math.max(1, ...Object.values(states).map((st) => st.index[l.id] ?? 1))]));
  return { simulated: !real, maxIndex, states, spread, national, total, located };
}

/** Blends white toward a color. t in 0..1. */
export function tint(hex: string, t: number, base = "#f4f5f7") {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(base), p(hex)];
  const k = Math.max(0, Math.min(1, t));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

/** 1x national rate is white, 3x and above is the full color. */
export const indexToT = (index: number) => Math.max(0, Math.min(1, (index - 1) / 2));
