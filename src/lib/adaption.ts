import "server-only";
import Papa from "papaparse";
import { ANALYSIS_INSTRUCTIONS } from "./llm";

/**
 * Adaption Adaptive Data, used as the batch analysis engine.
 * Flow: create dataset -> PUT the CSV to the presigned URL -> complete upload
 * -> wait for "awaiting_input" -> adapt with a universal prompt -> poll -> download.
 * Docs: https://docs.adaptionlabs.ai/api
 */
const BASE = "https://api.prod.adaptionlabs.ai/api/v1";

export function adaptionConfigured() {
  return !!process.env.ADAPTION_API_KEY;
}

/** Paid runs are allowed locally, and on a deployment only when ADAPTION_ALLOW_RUNS=true. Protects credits on the public demo. */
export function adaptionRunsAllowed() {
  return adaptionConfigured() && (process.env.NODE_ENV !== "production" || process.env.ADAPTION_ALLOW_RUNS === "true");
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.ADAPTION_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Adaption ${init.method ?? "GET"} ${path} failed with ${res.status}: ${body.slice(0, 300)}`);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("json") ? res.json() : res.text()) as Promise<T>;
}

/** Uploads the distinct reviews as a CSV and returns the new dataset id. */
export async function createAndUpload(reviews: { id: string; text: string }[]) {
  const csv = Papa.unparse(reviews.map((r) => ({ id: r.id, review: r.text })));
  const bytes = new TextEncoder().encode(csv);
  const created = await call<{
    dataset_id: string;
    status: string;
    upload_instructions?: { url: string; method?: string };
  }>("/datasets", {
    method: "POST",
    body: JSON.stringify({ source: { name: `insightflow-${Date.now()}.csv`, file_format: "csv" } }),
  });
  if (!created.upload_instructions?.url) throw new Error("Adaption did not return an upload URL.");
  const put = await fetch(created.upload_instructions.url, {
    method: created.upload_instructions.method ?? "PUT",
    body: bytes,
    headers: { "Content-Type": "text/csv" },
  });
  if (!put.ok) throw new Error(`Uploading the CSV to Adaption failed with ${put.status}.`);
  await call(`/datasets/${created.dataset_id}/upload/complete`, {
    method: "POST",
    body: JSON.stringify({ file_size_bytes: bytes.byteLength }),
  });
  return created.dataset_id;
}

export interface AdaptionStatus {
  dataset_id: string;
  status: "pending" | "running" | "awaiting_input" | "succeeded" | "failed" | string;
  row_count?: number;
  progress?: { percent: number; processed_rows: number; total_rows: number } | null;
  error_data?: { message: string; code?: string } | null;
}

export function getStatus(id: string) {
  return call<AdaptionStatus>(`/datasets/${encodeURIComponent(id)}/status`);
}

/** Starts (or estimates) the analysis run. The review is context; one instruction applies to every row. */
export function adapt(id: string, estimate = false) {
  return call<{ run_id?: string | null; estimatedMinutes?: number; estimatedCreditsConsumed?: number }>(
    `/datasets/${encodeURIComponent(id)}/adapt`,
    {
      method: "POST",
      body: JSON.stringify({
        training_type: "instruction_dataset",
        estimate,
        column_mapping: {
          context: ["review"],
          universal_prompt: `${ANALYSIS_INSTRUCTIONS}\n\nReturn only one JSON object for the review in the context, with keys sentiment, aspects, severity, complaint, issueId.`,
        },
        recipe_specification: {
          recipes: { prompt_rephrase: false, deduplication: false, reasoning_traces: false },
        },
        brand_controls: {
          length: "concise",
          blueprint:
            "Every completion must be only valid JSON matching the schema in the prompt. No explanations, no markdown, no code fences, no extra text.",
        },
        job_specification: { idempotency_key: `insightflow-${id}${estimate ? "-estimate" : ""}` },
      }),
    },
  );
}

export function download(id: string) {
  return call<string>(`/datasets/${encodeURIComponent(id)}/download?fileFormat=csv`);
}

/** The output columns are not documented, so find the review text and the JSON answer in each row. */
export function extractRows(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
  return parsed
    .map((row) => {
      const cells = Object.entries(row);
      const json = cells.find(([, v]) => typeof v === "string" && v.includes("{") && v.includes("sentiment"));
      const review =
        row.review ??
        cells.find(([k]) => /review|context/i.test(k))?.[1] ??
        cells.filter(([, v]) => v && v !== json?.[1]).sort((a, b) => b[1].length - a[1].length)[0]?.[1];
      return { id: row.id, review: review ?? "", completion: json?.[1] ?? "" };
    })
    .filter((r) => r.completion);
}
