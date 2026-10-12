/**
 * Builds SIMULATED locations for the sample (src/data/sim-locations.json).
 *
 * The Build Battle dataset has no location column. With the organizer's permission, each of the 7,000 rows is
 * assigned a city here so the map view can be demonstrated. Review text and categories are not touched.
 *
 * The simulation is a scenario with a known answer, so the map can be checked:
 *  - Base volume follows a rough order-volume weight per city (large metros order more).
 *  - Delivery complaints are planted higher in Gujarat, Rajasthan, Madhya Pradesh and Bihar, lower in the big metros.
 *  - Damaged or wrong items are planted higher in the north-east and hill states (long transit).
 *  - Everything else (fraud, double charges, app crashes, product, support) is spread by volume only,
 *    so the map should report those as "everywhere", not regional.
 * Fixed seed: the same input always gives the same map.
 *
 * Run: npm run build:locations
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { Review } from "../src/lib/types";

type C = [id: string, name: string, state: string, lat: number, lon: number, weight: number];
const CITIES: C[] = [
  ["delhi", "Delhi", "dl", 28.61, 77.21, 10], ["gurugram", "Gurugram", "hr", 28.46, 77.03, 5],
  ["faridabad", "Faridabad", "hr", 28.41, 77.32, 2], ["noida", "Noida", "up", 28.54, 77.39, 4],
  ["lucknow", "Lucknow", "up", 26.85, 80.95, 4], ["kanpur", "Kanpur", "up", 26.45, 80.33, 3],
  ["varanasi", "Varanasi", "up", 25.32, 82.97, 2], ["agra", "Agra", "up", 27.18, 78.01, 2],
  ["jaipur", "Jaipur", "rj", 26.91, 75.79, 4], ["jodhpur", "Jodhpur", "rj", 26.24, 73.02, 2],
  ["udaipur", "Udaipur", "rj", 24.59, 73.71, 1.5], ["kota", "Kota", "rj", 25.21, 75.86, 1.5],
  ["bikaner", "Bikaner", "rj", 28.02, 73.31, 1], ["ahmedabad", "Ahmedabad", "gj", 23.02, 72.57, 6],
  ["surat", "Surat", "gj", 21.17, 72.83, 5], ["vadodara", "Vadodara", "gj", 22.31, 73.18, 3],
  ["rajkot", "Rajkot", "gj", 22.3, 70.8, 2.5], ["bhavnagar", "Bhavnagar", "gj", 21.76, 72.15, 1.2],
  ["mumbai", "Mumbai", "mh", 19.08, 72.88, 10], ["pune", "Pune", "mh", 18.52, 73.86, 6],
  ["nagpur", "Nagpur", "mh", 21.15, 79.09, 2.5], ["nashik", "Nashik", "mh", 20.0, 73.79, 1.5],
  ["bengaluru", "Bengaluru", "ka", 12.97, 77.59, 10], ["mysuru", "Mysuru", "ka", 12.3, 76.64, 1.5],
  ["hubballi", "Hubballi", "ka", 15.36, 75.12, 1], ["hyderabad", "Hyderabad", "tg", 17.39, 78.49, 7],
  ["warangal", "Warangal", "tg", 17.97, 79.59, 1], ["chennai", "Chennai", "tn", 13.08, 80.27, 7],
  ["coimbatore", "Coimbatore", "tn", 11.02, 76.96, 2.5], ["madurai", "Madurai", "tn", 9.93, 78.12, 1.5],
  ["kochi", "Kochi", "kl", 9.93, 76.27, 2.5], ["thiruvananthapuram", "Thiruvananthapuram", "kl", 8.52, 76.94, 1.5],
  ["kozhikode", "Kozhikode", "kl", 11.26, 75.78, 1], ["kolkata", "Kolkata", "wb", 22.57, 88.36, 6],
  ["siliguri", "Siliguri", "wb", 26.73, 88.4, 1], ["bhubaneswar", "Bhubaneswar", "or", 20.3, 85.82, 2],
  ["cuttack", "Cuttack", "or", 20.46, 85.88, 1], ["patna", "Patna", "br", 25.59, 85.14, 3],
  ["gaya", "Gaya", "br", 24.79, 85.0, 1], ["muzaffarpur", "Muzaffarpur", "br", 26.12, 85.39, 1],
  ["ranchi", "Ranchi", "jh", 23.34, 85.31, 2], ["jamshedpur", "Jamshedpur", "jh", 22.8, 86.2, 1.2],
  ["raipur", "Raipur", "ct", 21.25, 81.63, 1.5], ["indore", "Indore", "mp", 22.72, 75.86, 3],
  ["bhopal", "Bhopal", "mp", 23.26, 77.41, 2.5], ["jabalpur", "Jabalpur", "mp", 23.18, 79.99, 1.2],
  ["gwalior", "Gwalior", "mp", 26.22, 78.18, 1], ["chandigarh", "Chandigarh", "ch", 30.73, 76.78, 2],
  ["ludhiana", "Ludhiana", "pb", 30.9, 75.86, 2], ["amritsar", "Amritsar", "pb", 31.63, 74.87, 1.5],
  ["dehradun", "Dehradun", "ut", 30.32, 78.03, 1.5], ["shimla", "Shimla", "hp", 31.1, 77.17, 0.8],
  ["srinagar", "Srinagar", "jk", 34.08, 74.8, 1], ["jammu", "Jammu", "jk", 32.73, 74.86, 1],
  ["leh", "Leh", "jk", 34.15, 77.58, 0.3], ["guwahati", "Guwahati", "as", 26.14, 91.74, 2],
  ["dibrugarh", "Dibrugarh", "as", 27.47, 94.91, 0.6], ["visakhapatnam", "Visakhapatnam", "ap", 17.69, 83.22, 2.5],
  ["vijayawada", "Vijayawada", "ap", 16.51, 80.65, 2], ["tirupati", "Tirupati", "ap", 13.63, 79.42, 1],
  ["panaji", "Panaji", "ga", 15.5, 73.83, 1], ["imphal", "Imphal", "mn", 24.82, 93.94, 0.6],
  ["shillong", "Shillong", "ml", 25.58, 91.89, 0.6], ["agartala", "Agartala", "tr", 23.83, 91.29, 0.6],
  ["aizawl", "Aizawl", "mz", 23.73, 92.72, 0.4], ["kohima", "Kohima", "nl", 25.67, 94.11, 0.4],
  ["itanagar", "Itanagar", "ar", 27.08, 93.61, 0.4], ["gangtok", "Gangtok", "sk", 27.33, 88.61, 0.4],
  ["puducherry", "Puducherry", "py", 11.94, 79.81, 0.8], ["port-blair", "Port Blair", "an", 11.62, 92.73, 0.3],
];

// The planted scenario. Multipliers on a state's base volume for one issue group.
const DELIVERY = { gj: 3.4, rj: 2.3, mp: 1.8, br: 1.6, up: 1.2, dl: 0.45, hr: 0.5, mh: 0.55, ka: 0.5, tg: 0.6, tn: 0.7 };
const DAMAGE = { as: 2.8, mn: 2.8, ml: 2.8, tr: 2.8, mz: 2.8, nl: 2.8, ar: 2.8, sk: 2.6, jk: 2.4, hp: 1.9, ut: 1.7, an: 2.6 };
const SCENARIO: Record<string, Record<string, number>> = {
  "delivery-delay": DELIVERY,
  "never-received": DELIVERY,
  "damaged-missing": DAMAGE,
  "wrong-items": DAMAGE,
};

// Small seeded PRNG (mulberry32).
let seed = 20261012;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const sample = JSON.parse(readFileSync("src/data/sample.json", "utf8")) as { reviews: Review[] };
const byReview: Record<string, [number, number][]> = {};

for (const r of sample.reviews) {
  const mult = SCENARIO[r.analysis.issueId ?? ""] ?? {};
  const w = CITIES.map((c) => c[5] * ((mult as Record<string, number>)[c[2]] ?? 1));
  const sum = w.reduce((a, b) => a + b, 0);
  const counts = new Map<number, number>();
  for (let k = 0; k < r.count; k++) {
    let x = rand() * sum;
    let i = 0;
    while (x > w[i] && i < w.length - 1) x -= w[i++];
    counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  byReview[r.id] = [...counts.entries()].sort((a, b) => a[0] - b[0]);
}

writeFileSync(
  "src/data/sim-locations.json",
  JSON.stringify({
    simulated: true,
    note: "Simulated locations for demonstration. Not real customer data.",
    cities: CITIES.map(([id, name, state, lat, lon]) => ({ id, name, state, lat, lon })),
    byReview,
  }),
);
console.log(`Simulated locations for ${Object.keys(byReview).length} reviews across ${CITIES.length} cities.`);
