import "server-only";
import { generateObject, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { z } from "zod";
import { ISSUES } from "./taxonomy";
import { AnalysisSchema } from "./parse";

/** Picks the live model from env. Returns null when no key is configured. */
export function liveModel(): { model: LanguageModel; name: string } | null {
  const provider = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const xai = process.env.XAI_API_KEY;
  if ((provider === "xai" || !google) && xai) {
    const id = process.env.LLM_MODEL || "grok-3-mini";
    return { model: createXai({ apiKey: xai })(id), name: id };
  }
  if (google) {
    const id = process.env.LLM_MODEL || "gemini-2.5-flash";
    return { model: createGoogleGenerativeAI({ apiKey: google })(id), name: id };
  }
  return null;
}

export const ANALYSIS_INSTRUCTIONS = `You label customer feedback for a product team.
For each review return:
- sentiment: positive, negative, mixed (both a complaint and praise), or neutral.
- aspects: up to 4 short topics the review talks about (for example Delivery, Payment, Customer support, Product quality), each with its own sentiment.
- severity: critical = money lost, fraud or scam; high = order unusable (wrong, missing, damaged, product failed, could not check out); medium = delay or slow support; low = minor annoyance; none = no complaint.
- complaint: the main complaint in under 8 words, or null.
- issueId: the best matching id from this list, or null when there is no complaint:
${ISSUES.map((i) => `  ${i.id}: ${i.name}`).join("\n")}
  other: a complaint that fits none of these
Base every label only on the review text. A review saying no fraud happened is positive.`;

const BatchSchema = z.object({
  results: z.array(AnalysisSchema.extend({ index: z.number().int() })),
});

/** Labels up to ~25 reviews in one call. Throws on timeout or invalid output. */
export async function analyzeBatch(texts: string[], timeoutMs = 20000) {
  const live = liveModel();
  if (!live) throw new Error("no-model");
  const { object } = await generateObject({
    model: live.model,
    schema: BatchSchema,
    temperature: 0,
    abortSignal: AbortSignal.timeout(timeoutMs),
    maxRetries: 1,
    system: ANALYSIS_INSTRUCTIONS,
    prompt: `Label each review. Return one result per review with its index.\n\n${texts
      .map((t, i) => `[${i}] ${t.replace(/\s+/g, " ").slice(0, 1200)}`)
      .join("\n")}`,
  });
  return { results: object.results, model: live.name };
}
