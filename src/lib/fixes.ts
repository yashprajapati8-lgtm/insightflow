/**
 * The fix playbook: specific problems (themes) inside each issue, and the fixes that address them.
 *
 * - Themes split an issue into what customers actually describe, matched on the review text.
 * - One fix can address several themes (that is the point of the diagram), and every theme has
 *   more than one fix, from a quick win to the most complete option.
 * - Reach (how many reports a fix addresses) is computed from the data. Cost and time are
 *   relative estimates for planning, not measured values, and the UI says so.
 */
import type { Review } from "./types";
import { LENSES, type Lens } from "./geo";

export type Theme = {
  id: string;
  issue: string;
  name: string;
  /** When set, a review must match to belong here. The first matching theme of its issue wins. */
  match?: RegExp;
  /** Customers in this theme had their problem handled: evidence for what works, not a problem to fix. */
  recovered?: boolean;
};

const RECOVERY = /compensation|explanation|replacement|regular updates|informed|transparent|worth it|support team was (quick|helpful)|resolved them/i;

export const THEMES: Theme[] = [
  { id: "delay-recovered", issue: "delivery-delay", name: "Delayed, but handled well", match: RECOVERY, recovered: true },
  { id: "delay-long", issue: "delivery-delay", name: "Delayed one to two weeks, no recovery" },
  { id: "never-arrived", issue: "never-received", name: "Paid, but the order never arrived" },
  { id: "damaged-missing", issue: "damaged-missing", name: "Damaged packaging, items missing" },
  { id: "wrong-items", issue: "wrong-items", name: "Wrong items in the order" },
  { id: "extra-payment", issue: "extra-payment", name: "Seller demanded extra payment" },
  { id: "counterfeit", issue: "not-as-advertised", name: "Counterfeit or not authentic", match: /counterfeit|not authentic/i },
  { id: "not-as-described", issue: "not-as-advertised", name: "Not as described, or unrelated item" },
  { id: "double-charge", issue: "double-charge", name: "Charged more than once" },
  { id: "checkout-recovered", issue: "checkout-crash", name: "Site failed, but support fixed it", match: RECOVERY, recovered: true },
  { id: "site-crash", issue: "checkout-crash", name: "Site crashes or freezes while ordering", match: /crash|unresponsive/i },
  { id: "checkout-glitch", issue: "checkout-crash", name: "Glitches make checkout hard to finish" },
  { id: "stopped-working", issue: "product-failure", name: "Product failed or disappointed" },
  { id: "slow-support", issue: "support-quality", name: "Long wait for a response", match: /long time|wait/i },
  { id: "unresolved", issue: "support-quality", name: "Support did not resolve the issue" },
];

export type Fix = {
  id: string;
  name: string;
  covers: string[];
  owner: string;
  cost: 1 | 2 | 3;
  weeks: string;
  summary: string;
  steps: string[];
  measure: string;
  /** A "handled well" theme whose reviews show this kind of fix already works. */
  evidence?: string;
};

export const FIXES: Fix[] = [
  {
    id: "delay-alerts",
    evidence: "delay-recovered",
    name: "Proactive delay alerts with a new date",
    covers: ["delay-long"],
    owner: "Logistics",
    cost: 1,
    weeks: "1 to 2 weeks",
    summary: "Tell customers about a delay before they ask, and always give a new delivery date.",
    steps: [
      "Flag any order that misses its promised date by more than 24 hours.",
      "Send an SMS and email with the reason and a new date, and a link to track it.",
      "If the new date also slips, escalate the order to a person on the logistics team.",
    ],
    measure: "Delay reviews shift from negative to mixed, like the customers who were kept informed.",
  },
  {
    id: "delay-compensation",
    evidence: "delay-recovered",
    name: "Automatic compensation for long delays",
    covers: ["delay-long"],
    owner: "Logistics",
    cost: 2,
    weeks: "2 to 3 weeks",
    summary: "Credit customers automatically when a delivery is more than seven days late.",
    steps: [
      "Define the rule: a store credit or free delivery once an order is seven days late.",
      "Apply it automatically, without the customer asking, and say so in the delay alert.",
      "Track the cost per month against the change in delay complaints.",
    ],
    measure: "Fewer 'delayed by two weeks' complaints with no recovery, and more mixed reviews.",
  },
  {
    id: "carrier-sla",
    name: "Courier performance contracts and carrier switching",
    covers: ["delay-long", "never-arrived", "damaged-missing"],
    owner: "Logistics",
    cost: 3,
    weeks: "6 to 10 weeks",
    summary: "Measure every courier on delay, loss and damage, and move volume away from the worst.",
    steps: [
      "Report on-time, lost and damaged rates for each courier and region every week.",
      "Add penalties for lost or damaged parcels to courier contracts.",
      "Move volume from the worst courier in each region to the best one.",
    ],
    measure: "Delay, non-delivery and damage complaints fall in the regions that switched couriers.",
  },
  {
    id: "escrow-payout",
    name: "Hold seller payouts until delivery is confirmed",
    covers: ["never-arrived", "extra-payment", "not-as-described", "counterfeit"],
    owner: "Payments",
    cost: 2,
    weeks: "3 to 4 weeks",
    summary: "Pay sellers only after a delivery scan and a short return window, and refund automatically when there is no scan.",
    steps: [
      "Release seller payouts only after a delivery scan plus a three-day return window.",
      "Refund automatically when an order has no tracking scan after seven days.",
      "Claw back payouts on confirmed fraud cases and suspend the seller.",
    ],
    measure: "'Never received' and scam reports fall, and refunds no longer need a support ticket.",
  },
  {
    id: "seller-verification",
    name: "Seller verification and counterfeit takedowns",
    covers: ["counterfeit", "not-as-described", "extra-payment"],
    owner: "Trust and Safety",
    cost: 3,
    weeks: "6 to 8 weeks",
    summary: "Verify sellers before they can list, and remove listings that draw fraud reports.",
    steps: [
      "Require ID and business verification before a seller's first listing.",
      "Auto-hide a listing after three fraud or counterfeit reports until it is reviewed.",
      "Ask flagged sellers for proof of authenticity, and make returns free in these cases.",
    ],
    measure: "Counterfeit and 'not as advertised' reports fall, and repeat offenders disappear.",
  },
  {
    id: "block-offplatform",
    name: "Block requests for extra payment in seller messages",
    covers: ["extra-payment"],
    owner: "Trust and Safety",
    cost: 1,
    weeks: "1 week",
    summary: "Detect and block messages asking for more money or for payment outside the platform.",
    steps: [
      "Scan seller messages for payment requests, UPI IDs and bank details.",
      "Block the message, warn the customer, and log the seller.",
      "Suspend sellers after a second attempt.",
    ],
    measure: "Extra-payment scam reports drop close to zero.",
  },
  {
    id: "idempotent-payments",
    name: "Make payments idempotent, refund duplicates automatically",
    covers: ["double-charge"],
    owner: "Payments",
    cost: 2,
    weeks: "2 to 3 weeks",
    summary: "One order can only be charged once, however many times the pay button is pressed.",
    steps: [
      "Send an idempotency key with every payment request, tied to the order.",
      "Run a daily job that finds duplicate charges and refunds them automatically.",
      "Email affected customers before they notice.",
    ],
    measure: "'Charged multiple times' reports stop for new orders.",
  },
  {
    id: "checkout-monitoring",
    name: "Error monitoring on checkout, fix the top crash",
    covers: ["site-crash", "checkout-glitch"],
    owner: "Engineering",
    cost: 1,
    weeks: "1 to 2 weeks",
    summary: "See every checkout error as it happens, and fix the most frequent one first.",
    steps: [
      "Add error and session monitoring to every checkout step.",
      "Rank errors by how many orders they block and fix the top one.",
      "Alert the on-call engineer when checkout errors spike.",
    ],
    measure: "Crash and glitch reports fall, and checkout completion rises.",
  },
  {
    id: "checkout-resilience",
    name: "Load-test and harden the payment step",
    covers: ["site-crash", "checkout-glitch", "double-charge"],
    owner: "Engineering",
    cost: 3,
    weeks: "4 to 6 weeks",
    summary: "Make checkout hold up under peak traffic, and make retries safe so a failure never charges twice.",
    steps: [
      "Load-test checkout at three times the peak traffic and fix what breaks.",
      "Make payment retries safe: one order, one charge.",
      "Save the cart and resume checkout after a crash, instead of starting over.",
    ],
    measure: "Crashes at peak times stop, and double charges from retries disappear.",
  },
  {
    id: "pack-verify",
    name: "Scan-to-verify every order at packing",
    covers: ["wrong-items", "damaged-missing"],
    owner: "Fulfilment",
    cost: 1,
    weeks: "1 to 2 weeks",
    summary: "Scan each item into the box against the order, and weigh the box before it ships.",
    steps: [
      "Scan every item against the order before the box is sealed.",
      "Weigh the box and stop it if the weight does not match the order.",
      "Report errors by packer and by warehouse every week.",
    ],
    measure: "Wrong-item and missing-item reports fall at the warehouses that adopt it.",
  },
  {
    id: "instant-replacement",
    evidence: "delay-recovered",
    name: "Instant replacement for wrong or missing items",
    covers: ["wrong-items", "damaged-missing"],
    owner: "Support",
    cost: 1,
    weeks: "1 week",
    summary: "Ship the right item at once when a customer reports a wrong, missing or damaged item, before asking for the return.",
    steps: [
      "Add a 'wrong, missing or damaged item' option to the order page, with a photo upload.",
      "Ship the replacement immediately for customers in good standing.",
      "Collect the wrong item on the same visit as the replacement delivery.",
    ],
    measure: "These reports turn from negative to mixed, like customers who already got a replacement.",
  },
  {
    id: "packaging",
    name: "Protective packaging for fragile and long routes",
    covers: ["damaged-missing"],
    owner: "Fulfilment",
    cost: 2,
    weeks: "3 to 4 weeks",
    summary: "Use stronger packaging for fragile items and for long-distance routes.",
    steps: [
      "Tag fragile products in the catalog.",
      "Use double boxes and padding for fragile items and long routes.",
      "Photograph each sealed box so damage claims can be checked.",
    ],
    measure: "Damage reports fall, especially on long routes.",
  },
  {
    id: "support-sla",
    name: "First-response target and smarter ticket routing",
    covers: ["slow-support"],
    owner: "Support",
    cost: 1,
    weeks: "1 week",
    summary: "Answer every ticket within a set time, and send each one to the team that can solve it.",
    steps: [
      "Set a first-response target, for example four business hours.",
      "Route tickets by topic (payments, delivery, product) to the right team.",
      "Show the waiting time on the team's dashboard and alert on breaches.",
    ],
    measure: "'Long wait for a response' reports fall.",
  },
  {
    id: "support-escalation",
    evidence: "checkout-recovered",
    name: "Escalate unresolved tickets after 48 hours",
    covers: ["unresolved", "slow-support"],
    owner: "Support",
    cost: 2,
    weeks: "2 to 3 weeks",
    summary: "Every ticket gets an owner, and anything open after 48 hours goes to a team lead.",
    steps: [
      "Assign each ticket a named owner.",
      "Escalate any ticket still open after 48 hours to a team lead.",
      "Give leads the authority to refund or replace without approval up to a set amount.",
    ],
    measure: "'Issue remains unresolved' reports fall.",
  },
  {
    id: "self-serve-refunds",
    name: "Self-serve refunds and returns",
    covers: ["unresolved", "never-arrived", "not-as-described", "stopped-working"],
    owner: "Support",
    cost: 2,
    weeks: "3 to 5 weeks",
    summary: "Let customers start a refund or return themselves for the common cases, without waiting for an agent.",
    steps: [
      "Offer a refund button for orders with no delivery scan after seven days.",
      "Offer instant returns for items reported as faulty or not as described.",
      "Send only the unusual cases to an agent.",
    ],
    measure: "Fewer unresolved tickets, and faster refunds for non-delivery and faulty items.",
  },
  {
    id: "defect-triage",
    name: "Defect triage: pause the worst products",
    covers: ["stopped-working"],
    owner: "Product",
    cost: 2,
    weeks: "2 to 4 weeks",
    summary: "Find the products that fail most often and pause them until the supplier fixes them.",
    steps: [
      "Link failure reports to product IDs.",
      "Pause any product whose failure rate is well above its category's.",
      "Share the defect data with the supplier and require a fix before relisting.",
    ],
    measure: "'Stopped working after a week' reports fall.",
  },
];

export type ThemeStat = Theme & { reports: number; reviews: Review[]; lens: Lens | null; fixes: Fix[] };
export type FixStat = Fix & { reach: number; themes: ThemeStat[] };
export type FixModel = { themes: ThemeStat[]; fixes: FixStat[]; unthemed: number };

export function themeOf(r: Review): Theme | null {
  const id = r.analysis.issueId;
  if (!id) return null;
  const candidates = THEMES.filter((t) => t.issue === id);
  return candidates.find((t) => !t.match || t.match.test(r.text)) ?? null;
}

export function buildFixModel(reviews: Review[]): FixModel {
  const byTheme = new Map<string, Review[]>();
  let unthemed = 0;
  for (const r of reviews) {
    if (r.analysis.sentiment === "positive") continue;
    const t = themeOf(r);
    if (!t) {
      if (r.analysis.issueId) unthemed += r.count;
      continue;
    }
    const list = byTheme.get(t.id) ?? [];
    list.push(r);
    byTheme.set(t.id, list);
  }
  const themes: ThemeStat[] = THEMES.filter((t) => byTheme.has(t.id)).map((t) => {
    const list = byTheme.get(t.id)!.sort((a, b) => b.count - a.count);
    return {
      ...t,
      reviews: list,
      reports: list.reduce((s, r) => s + r.count, 0),
      lens: LENSES.find((l) => l.issues.includes(t.issue)) ?? null,
      fixes: [],
    };
  });
  const tById = new Map(themes.map((t) => [t.id, t]));
  const fixes: FixStat[] = FIXES.map((f) => {
    const ts = f.covers.map((id) => tById.get(id)).filter((t): t is ThemeStat => !!t && !t.recovered);
    return { ...f, themes: ts, reach: ts.reduce((s, t) => s + t.reports, 0) };
  }).filter((f) => f.themes.length > 0);
  for (const f of fixes) for (const t of f.themes) t.fixes.push(FIXES.find((x) => x.id === f.id)!);
  return { themes, fixes, unthemed };
}

/** Labels for a theme's options: the cheapest, the most reach per cost, and the widest. */
export function optionTags(fixes: FixStat[]) {
  const tags = new Map<string, string[]>();
  const add = (id: string, tag: string) => tags.set(id, [...(tags.get(id) ?? []), tag]);
  if (!fixes.length) return tags;
  const quick = [...fixes].sort((a, b) => a.cost - b.cost || b.reach - a.reach)[0];
  const value = [...fixes].sort((a, b) => b.reach / b.cost - a.reach / a.cost)[0];
  const complete = [...fixes].sort((a, b) => b.themes.length - a.themes.length || b.reach - a.reach)[0];
  add(quick.id, "Quick win");
  add(value.id, "Best value");
  add(complete.id, "Most complete");
  return tags;
}

export const COST_LABEL = { 1: "Low effort", 2: "Medium effort", 3: "High effort" } as const;
