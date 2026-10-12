/** Indian states and cities: name matching for imported CSVs with real state or city columns. */
import sim from "@/data/sim-locations.json";

export const STATE_NAMES: Record<string, string> = {
  an: "Andaman and Nicobar", ap: "Andhra Pradesh", ar: "Arunachal Pradesh", as: "Assam", br: "Bihar",
  ch: "Chandigarh", ct: "Chhattisgarh", dn: "Dadra and Nagar Haveli", dd: "Daman and Diu", dl: "Delhi",
  ga: "Goa", gj: "Gujarat", hr: "Haryana", hp: "Himachal Pradesh", jk: "Jammu, Kashmir and Ladakh",
  jh: "Jharkhand", ka: "Karnataka", kl: "Kerala", ld: "Lakshadweep", mp: "Madhya Pradesh", mh: "Maharashtra",
  mn: "Manipur", ml: "Meghalaya", mz: "Mizoram", nl: "Nagaland", or: "Odisha", py: "Puducherry", pb: "Punjab",
  rj: "Rajasthan", sk: "Sikkim", tn: "Tamil Nadu", tg: "Telangana", tr: "Tripura", up: "Uttar Pradesh",
  ut: "Uttarakhand", wb: "West Bengal",
};

/** Center of each state on the svg map (px), for cities we have no coordinates for. */
export const STATE_CENTER: Record<string, [number, number]> = {
  an: [521, 609], ap: [263, 500], ar: [550, 224], as: [516, 271], br: [369, 275], ch: [179, 160], ct: [296, 388],
  dn: [102, 405], dd: [54, 391], dl: [186, 210], ga: [122, 512], gj: [66, 355], hr: [164, 195], hp: [190, 133],
  jk: [172, 61], jh: [366, 327], ka: [170, 519], kl: [166, 615], ld: [99, 627], mp: [214, 319], mh: [180, 435],
  mn: [537, 301], ml: [484, 283], mz: [516, 337], nl: [546, 270], or: [340, 405], py: [268, 546], pb: [151, 152],
  rj: [119, 257], sk: [425, 235], tn: [211, 610], tg: [237, 457], tr: [493, 325], up: [265, 245], ut: [232, 175],
  wb: [412, 310],
};

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

const STATE_ALIASES: Record<string, string> = {
  orissa: "or", pondicherry: "py", uttaranchal: "ut", newdelhi: "dl", nctofdelhi: "dl", nationalcapitalterritoryofdelhi: "dl",
  delhincr: "dl", ladakh: "jk", jammuandkashmir: "jk", jammukashmir: "jk", jandk: "jk", andamanandnicobarislands: "an",
  dadraandnagarhavelianddamananddiu: "dn", tamilnadu: "tn", up: "up", mp: "mp", ap: "ap",
};

const CITY_ALIASES: Record<string, string> = {
  bangalore: "bengaluru", bombay: "mumbai", gurgaon: "gurugram", calcutta: "kolkata", madras: "chennai",
  trivandrum: "thiruvananthapuram", mysore: "mysuru", baroda: "vadodara", vizag: "visakhapatnam", pondicherry: "puducherry",
  cochin: "kochi", calicut: "kozhikode", newdelhi: "delhi", hubli: "hubballi", benares: "varanasi", banaras: "varanasi",
};

type C = { id: string; name: string; state: string; lat: number; lon: number };
const KNOWN = (sim as { cities: C[] }).cities;
const BY_NAME = new Map(KNOWN.map((c) => [norm(c.name), c]));

export function findCity(name: string): C | null {
  const n = norm(name);
  if (!n) return null;
  return BY_NAME.get(CITY_ALIASES[n] ?? n) ?? null;
}

export function resolveState(stateRaw: string | undefined, city?: string): string | null {
  const n = norm(stateRaw ?? "");
  if (n) {
    if (STATE_NAMES[n]) return n; // already an id like "gj"
    if (STATE_ALIASES[n]) return STATE_ALIASES[n];
    for (const [id, name] of Object.entries(STATE_NAMES)) if (norm(name) === n) return id;
  }
  return city ? (findCity(city)?.state ?? null) : null;
}
