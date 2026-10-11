import type { Analysis, Aspect, Sentiment, Severity } from "./types";
import { ISSUES, OTHER_ISSUE } from "./taxonomy";

/**
 * Deterministic fallback analyzer. Used when the live model is unavailable,
 * and as the baseline the AI results are compared against. It never calls a network.
 */

const NEG =
  /\bnot\b|never|scam|fraud|delay|damag|wrong|crash|glitch|unhelpful|unresolved|wait(ed)? (for )?a long|frustrat|charged (multiple|twice)|multiple times|missing|defect|stopped working|inconvenien|disappoint|poor|counterfeit|incorrect|low-quality|unresponsive|rude|\bslow\b|issue|problem|took my money|broke|late\b|worst|terrible|bad\b|took a long time|still charged|charged twice|logged (me )?out|never answered|no (reply|answer|response)|ignored|didn.?t work|doesn.?t work|failed|error|lost|cancell?ed|broken/i;

const POS =
  /great|excellent|outstanding|love|amazing|innovative|helpful|quick|fast|perfect|worth|happy|satisf|recommend|best|good|smooth|friendly|knowledgeable|responsive|resolved|replacement|solution|promptly|transparent|compensat|on time|stylish|modern|sleek|elegant|functional|efficient|easy|user-friendly|valuable|reliable|impress|durable|cutting-edge|useful|beautiful|exceed|high-quality|premium|intuitive|appreciat|clear|professional|patient|attentive|ergonomic|comfortable|versatile|customizable|stable|consistent|powerful|robust|timeless|classic|essential|productiv|futuristic|practical|well|minimalist|unique|appealing|chic|trendy|contemporary|sophisticated|accurate|precise|exceptional|vibrant|eye-catching|effective|advanced|accessible|inclusive|nostalgic|traditional|uncluttered|understated|innovative|sustainable|lightweight|compact|affordable|refunded|without me asking/i;

// Phrases that contain a "negative" word but are not complaints on their own.
const NEUTRALIZE =
  /\b(no (signs of )?fraudulent activity( detected)?|not a victim of (fraud|a scam)|no (scam|fraud)|my (issue|concern|query|inquiry|problem)s?|resolved (my |the )?(issue|problem)s?|issues? (was|were) resolved|resolved them)\b/gi;

const POSITIVE_OPENERS = /^(no (signs of )?fraudulent|no (signs of )?(scam|fraud)|not a victim|i was not a victim)/i;

const ASPECTS: { topic: string; re: RegExp }[] = [
  { topic: "Payment", re: /charg|payment|paid|money|refund|billing/i },
  { topic: "Seller", re: /seller/i },
  { topic: "Delivery", re: /deliver|shipping|arriv|on time|late\b/i },
  { topic: "Packaging", re: /packag/i },
  { topic: "Order accuracy", re: /wrong item|incorrect|missing|processed/i },
  { topic: "Website", re: /website|site\b|app\b|checkout|crash|glitch|navigat|user-friendly|ordering process/i },
  { topic: "Customer support", re: /customer service|support|staff|agent|response|helpful|resolv/i },
  { topic: "Product quality", re: /quality|defect|stopped working|broke|durable|expectations/i },
  { topic: "Product design", re: /design/i },
  { topic: "Product features", re: /feature/i },
  { topic: "Product performance", re: /performance|perform/i },
  { topic: "Value for money", re: /value|price|worth/i },
  { topic: "Transaction safety", re: /fraud|scam|safe/i },
  { topic: "Communication", re: /compensat|explanation|informed|updates|transparent/i },
];

function clauseSentiment(text: string): Exclude<Sentiment, "mixed"> {
  if (POSITIVE_OPENERS.test(text.trim())) return "positive";
  const cleaned = text.replace(NEUTRALIZE, " ");
  const n = NEG.test(cleaned);
  const p = POS.test(cleaned);
  if (/not helpful|unhelpful|not as advertised|did not meet|didn.?t meet/i.test(cleaned)) return "negative";
  if (n && !p) return "negative";
  if (p && !n) return "positive";
  if (n && p) return "negative";
  return "neutral";
}

function splitClauses(text: string): string[] {
  return text
    .split(/,?\s+but\s+|\.\s*however,?\s*|;\s*however,?\s*|,\s*however,?\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

export function sentimentOf(text: string): Sentiment {
  if (POSITIVE_OPENERS.test(text.trim())) return "positive";
  const clauses = splitClauses(text);
  if (clauses.length > 1) {
    const s = clauses.map(clauseSentiment);
    const hasNeg = s.includes("negative");
    const hasPos = s.includes("positive");
    if (hasNeg && hasPos) return "mixed";
    if (hasNeg) return "negative";
    if (hasPos) return "positive";
    return "neutral";
  }
  return clauseSentiment(text);
}

export function issueOf(text: string): string {
  for (const issue of ISSUES) if (issue.match.test(text)) return issue.id;
  return OTHER_ISSUE.id;
}

function aspectsOf(text: string, overall: Sentiment): Aspect[] {
  const out: Aspect[] = [];
  const seen = new Set<string>();
  for (const clause of splitClauses(text)) {
    const s = overall === "mixed" ? clauseSentiment(clause) : overall === "neutral" ? "neutral" : overall;
    for (const a of ASPECTS) {
      if (a.re.test(clause) && !seen.has(a.topic)) {
        seen.add(a.topic);
        out.push({ topic: a.topic, sentiment: s });
      }
    }
  }
  if (out.length === 0) out.push({ topic: "General experience", sentiment: overall === "mixed" ? "neutral" : overall });
  return out.slice(0, 4);
}

const DOWNGRADE: Record<Severity, Severity> = { critical: "high", high: "medium", medium: "low", low: "low", none: "none" };

export function analyzeWithRules(text: string): Analysis {
  const sentiment = sentimentOf(text);
  const aspects = aspectsOf(text, sentiment);
  if (sentiment === "positive" || sentiment === "neutral") {
    return { sentiment, aspects, severity: "none", complaint: null, issueId: null };
  }
  // For a mixed review, only the negative clause decides the issue.
  const negText =
    sentiment === "mixed" ? splitClauses(text).filter((c) => clauseSentiment(c) === "negative").join(". ") || text : text;
  const issueId = issueOf(negText);
  const def = ISSUES.find((i) => i.id === issueId);
  const base: Severity = def ? def.severity : OTHER_ISSUE.severity;
  const severity = sentiment === "mixed" ? DOWNGRADE[base] : base;
  const complaint = def ? def.complaint : negText.split(/\s+/).slice(0, 8).join(" ");
  return { sentiment, aspects, severity, complaint, issueId };
}

/** Fill in the issue for a model result that did not pick one from the known list. */
export function withIssue(text: string, a: Analysis): Analysis {
  if (a.sentiment === "positive" || a.sentiment === "neutral") return { ...a, issueId: null, severity: "none", complaint: null };
  if (a.issueId) return a;
  const fallback = analyzeWithRules(text);
  return { ...a, issueId: fallback.issueId ?? OTHER_ISSUE.id };
}
