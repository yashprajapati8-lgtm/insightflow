# InsightFlow

**Fix what matters first.** InsightFlow turns customer feedback into ranked, evidence-backed decisions. It reads every review, groups the repeats, labels sentiment, topic and severity with AI, and ranks the problems that cost customers most. Every number opens the reviews behind it.

Built for Build Battle 2026 (Frontend Arena), AI × Web Development.

- **Live app:** https://insightflow-fawn.vercel.app
- **Repository:** https://github.com/yashprajapati8-lgtm/insightflow
- **Demo video:** [add the link]

## The problem, and what the data really says

The brief asks for a tool that turns scattered feedback into decisions. Before building, we audited the provided dataset:

| Finding | What InsightFlow does about it |
| --- | --- |
| 7,000 rows, but only **320 distinct reviews**: 95% are exact repeats | Repeats are grouped and counted, never deleted. Each distinct review is analyzed once. A **Reports / Distinct reviews** toggle shows both views. |
| The four categories look balanced (about 1,750 rows each) only because of repeats. Distinct reviews are 57% Product Feedback | The dashboard shows rows, distinct reviews and repeats side by side. |
| Category is not sentiment. "No fraudulent activity during my purchase" is labeled *Fraud and Scam* | Sentiment is analyzed separately from the category label, and the Feedback page flags these cases. |
| Many reviews are mixed: "delivery was delayed, but I was informed promptly" | Sentiment is scored per aspect, so one review can be negative about delivery and positive about communication. |
| **No dates, ratings, sources or customer ids** | No trend is invented. The trend chart and momentum turn on only for imports with a date column. |

## Requirement coverage

| Brief | Where |
| --- | --- |
| 1. Submit feedback and import CSV; display, search, filter, organize; sample data | **Add feedback** (CSV import with automatic column detection, or one review at a time); **Feedback** (search, filters, repeats grouped); sample loads with no sign-up |
| 2. AI sentiment, recurring topics, common complaints; group into categories; **use Adaption** | Live model + **Adaption batch run** label sentiment, aspects, severity, main complaint and issue; **Pipeline** page shows each stage |
| 3. Metrics, sentiment distribution, frequent issues, trends, filters | **Overview**: key metrics, funnel, sentiment by category (diverging, pie or table), most reported issues, trends for dated data, filters |
| 4. High-priority issues, recommendations, explain why | **Priorities**: transparent score with adjustable weights, a rank explanation built from the numbers, customer quotes, recommended action and owner |
| 5. Save or track issues, export or share reports | **Tracker** (drag between Open, Investigating, Fixing, Resolved; notes; activity log) and **Report** (leadership or team brief, share link, save as PDF) |

## How AI and Adaption are used

```
CSV or form → Clean (group repeats) → Analyze → Validate → Score
                                         │
                       live model (seconds, provisional)
                       Adaption batch job (confirms or replaces)
```

1. **Import** in the browser. The feedback text column is detected automatically; category, date and source columns are used when present.
2. **Clean.** Exact repeats are grouped with a count, so 7,000 rows become 320 analysis calls' worth of text.
3. **Analyze.**
   - **Adaption (batch).** The distinct reviews are uploaded to Adaption's Adaptive Data API as one dataset. Each review is mapped as **context** and one **universal prompt** asks for sentiment, aspects, severity, main complaint and matching issue as JSON. A **blueprint** enforces strict JSON; rephrasing and deduplication recipes are off so reviews are not changed. InsightFlow polls the job status and downloads the result (`src/lib/adaption.ts`).
   - **Live model (single reviews).** A review added in the app gets a label in seconds from Gemini or Grok through the Vercel AI SDK with a typed schema. It is marked *provisional* until an Adaption run confirms it.
   - **Rule baseline.** If no model is available or a call fails or times out, a deterministic rule set answers, so the app never breaks. It is also the floor that any AI must beat.
4. **Validate.** Every model answer is parsed against a Zod schema. Invalid rows keep their previous label. People can correct any label on the Feedback page.
5. **Score (no AI).** `priority = volume 35 + negativity 30 + severity 25 (+ momentum 10 when dates exist)`, normalized. Severity: money lost 1.0, order unusable 0.7, delay or friction 0.4. The AI never produces a number; every count and score is computed in `src/lib/scoring.ts` and links to its reviews.

**Example.** "Charged but never received" (510 reports) ranks above "Slow or unhelpful support" (587 reports): both are 100% negative, but losing money outranks losing time. Move the severity slider to 0 and support becomes number 1.

## Tech stack

Next.js 15 (App Router), TypeScript, Tailwind CSS 4, Motion, Zustand (state in the browser, no login), Papa Parse, Vercel AI SDK with Gemini or Grok, Zod, Adaption Adaptive Data API, lz-string (share links that hold the whole report). Deployed on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev                  # http://localhost:3000
```

Environment variables (all optional; the app works without them using the rule baseline):

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | `google` or `xai` |
| `LLM_MODEL` | for example `gemini-2.5-flash` or `grok-3-mini` |
| `GOOGLE_GENERATIVE_AI_API_KEY` / `XAI_API_KEY` | live model key |
| `ADAPTION_API_KEY` | Adaption batch analysis |

Data scripts:

- `npm run build:sample` rebuilds `src/data/sample.json` from `data/sample.csv`, using Adaption's output in `data/adaption-output.csv` when present.
- `npm run build:gold` turns the hand labels in `data/gold-labels.csv` into the accuracy check shown on the Pipeline page.

## Project structure

```
src/app            pages: landing, /app (overview), feedback, priorities, add, tracker, pipeline, /report
src/app/api        /analyze (live model), /adaption/* (start, status, adapt, result, config)
src/lib            rules, taxonomy, scoring, parse (schema), llm, adaption, store, report, csv
src/components     app shell, evidence drawer, charts, report view, UI kit
scripts            build-sample, build-gold
```

## Map (simulated locations)

The Build Battle dataset has no location column. With the organizer's permission, the Map page uses **simulated** city and state values, generated by `npm run build:locations` with a fixed seed. Review text and categories are unchanged, and every view that shows a location is labeled "Simulated".

The simulation plants a known scenario (delivery complaints concentrated in Gujarat and Rajasthan, damaged items in the north-east) and spreads every other issue by volume only. The map then has to tell the two apart: a state is called a hotspot only when its share of an issue is significantly above the national share (3.5 standard deviations), with small states pulled toward the average. Fraud, double charges and app crashes correctly come out as "everywhere", which means one fix at the source rather than a local one.

India state outlines: [@svg-maps/india](https://github.com/VictorCazanave/svg-maps), CC BY 4.0.
