import type { IssueDef, Severity } from "./types";

/**
 * Known issue types. Order matters: the first match wins, so the more specific
 * patterns (double charges, extra payment demands) come before broad ones.
 * Recommended actions were drafted from the sample's evidence and reviewed by hand.
 */
export const ISSUES: IssueDef[] = [
  {
    id: "double-charge",
    name: "Charged multiple times",
    owner: "Payments",
    severity: "critical",
    complaint: "Charged more than once for one order",
    action: "Make payment requests idempotent so a retry cannot charge twice, and refund duplicate charges automatically.",
    match: /charged (multiple|twice|two times|again)|multiple times for a single|double charge/i,
  },
  {
    id: "extra-payment",
    name: "Seller demands extra payment",
    owner: "Trust and Safety",
    severity: "critical",
    complaint: "Seller demanded extra payment",
    action: "Block requests for extra payment in seller messages and suspend sellers who repeat it.",
    match: /(additional|extra) payment|requested additional|asked for (additional|more) (money|payment)/i,
  },
  {
    id: "not-as-advertised",
    name: "Item not as advertised",
    owner: "Trust and Safety",
    severity: "critical",
    complaint: "Product not as advertised",
    action: "Require proof of authenticity from flagged sellers and make returns free in these cases.",
    match: /not as advertised|counterfeit|\bfake\b|low-quality product|not authentic|not related to my order|did not function/i,
  },
  {
    id: "never-received",
    name: "Charged but never received",
    owner: "Payments",
    severity: "critical",
    complaint: "Paid, but the order never arrived",
    action: "Hold seller payouts until delivery is confirmed, and refund automatically when an order has no tracking scan after 7 days.",
    match: /never (received|sent|arrived|got)|took my money|despite being charged|didn.?t (receive|arrive)/i,
  },
  {
    id: "checkout-crash",
    name: "Website crashes at checkout",
    owner: "Engineering",
    severity: "high",
    complaint: "Website failed while ordering",
    action: "Add error monitoring to the checkout flow and fix the most frequent crash before shipping new features.",
    match: /crash|glitch|technical issues|difficult to complete|issues while placing my order|logged (me )?out|checkout (failed|error)|payment page/i,
  },
  {
    id: "damaged-missing",
    name: "Damaged or missing items",
    owner: "Fulfilment",
    severity: "high",
    complaint: "Arrived damaged or incomplete",
    action: "Audit packing at the warehouse with the most reports and add a weight check before dispatch.",
    match: /damaged|missing|broken on arrival/i,
  },
  {
    id: "wrong-items",
    name: "Wrong items received",
    owner: "Fulfilment",
    severity: "high",
    complaint: "Received the wrong items",
    action: "Add a scan-to-verify step when each order is packed.",
    match: /wrong item|processed incorrectly|incorrect (item|order)/i,
  },
  {
    id: "product-failure",
    name: "Product stopped working",
    owner: "Product",
    severity: "high",
    complaint: "Product failed or disappointed",
    action: "Pull defect data for the affected products and pause the worst-performing item until it is fixed.",
    match: /stopped working|did not meet|didn.?t meet|does not meet|defect|broke|poor quality|disappoint/i,
  },
  {
    id: "delivery-delay",
    name: "Delivery delays",
    owner: "Logistics",
    severity: "medium",
    complaint: "Delivery arrived late",
    action: "Send delay notices before customers ask. Where compensation is offered, reviews turn mixed rather than negative.",
    match: /delay|late delivery|arrived late|took longer|delivery process/i,
  },
  {
    id: "support-quality",
    name: "Slow or unhelpful support",
    owner: "Support",
    severity: "medium",
    complaint: "Support was slow or unhelpful",
    action: "Set a first-response target for support and escalate any ticket still unresolved after 48 hours to a team lead.",
    match: /not helpful|unhelpful|unresolved|wait(ed)? (for )?a long|unresponsive|rude|slow (response|support)|took a long time|no response/i,
  },
];

export const OTHER_ISSUE = {
  id: "other",
  name: "Other complaints",
  owner: "Unassigned",
  severity: "low" as const,
  complaint: "Other complaint",
  action: "Read these reviews to decide whether they form a new issue worth tracking.",
};

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 1,
  high: 0.7,
  medium: 0.4,
  low: 0.2,
  none: 0,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical, money lost",
  high: "High, order unusable",
  medium: "Medium, delay or friction",
  low: "Low, minor annoyance",
  none: "None",
};

export function issueById(id: string | null | undefined) {
  if (!id) return null;
  if (id === OTHER_ISSUE.id) return OTHER_ISSUE;
  return ISSUES.find((i) => i.id === id) ?? null;
}
