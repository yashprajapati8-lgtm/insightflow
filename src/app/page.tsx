import Link from "next/link";
import { ArrowRight, FileUp, Sparkles, ListOrdered, ShieldCheck, Quote, Workflow } from "lucide-react";
import sample from "@/data/sample.json";
import { rankIssues, DEFAULT_WEIGHTS, ACT_NOW } from "@/lib/scoring";
import type { Review } from "@/lib/types";
import { HeroFlow } from "@/components/HeroFlow";
import { Logo } from "@/components/AppShell";
import { ThemeToggle } from "@/components/ThemeToggle";

const reviews = (sample as { reviews: Review[] }).reviews;
const rows = (sample as { rows: number }).rows;
const ranked = rankIssues(reviews, DEFAULT_WEIGHTS);
const top = ranked[0];
const mostReported = [...ranked].sort((a, b) => b.rows - a.rows)[0];
const topQuote = top.reviews[0];
const n = (x: number) => Math.round(x).toLocaleString("en-US");

export default function Landing() {
  return (
    <div className="min-h-screen text-ink">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-lg font-bold tracking-[-0.01em]">InsightFlow</span>
        </Link>
        <nav aria-label="Site" className="flex items-center gap-2 sm:gap-5">
          <a href="#how" className="hidden text-sm text-ink-2 hover:text-ink sm:inline">
            How it works
          </a>
          <Link href="/app/pipeline" className="hidden text-sm text-ink-2 hover:text-ink sm:inline">
            Where Adaption fits
          </Link>
          <ThemeToggle tone="page" />
          <Link href="/app" className="inline-flex h-10 items-center gap-2 raised rounded-xl px-4 text-sm font-semibold hover:brightness-105">
            Open the app
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pt-10 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:pt-16">
          <div className="flex flex-col gap-6">
            <p className="glass inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] text-ink-2">
              <span className="size-1.5 rounded-full bg-attn" /> Fix what matters first
            </p>
            <h1 className="max-w-[15ch] text-[44px] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[56px]">
              Customer feedback, ranked by what to fix first.
            </h1>
            <p className="max-w-[48ch] text-lg text-ink-2">
              InsightFlow reads every review, groups the repeats, and ranks the problems that cost your customers most. Every
              number opens the reviews behind it.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/app" className="inline-flex h-12 items-center gap-2 raised rounded-xl px-5 font-semibold hover:brightness-105">
                Open the sample workspace <ArrowRight size={17} />
              </Link>
              <Link href="/app/add" className="glass lift inline-flex h-12 items-center gap-2 rounded-xl px-5 font-medium">
                <FileUp size={17} /> Import your own CSV
              </Link>
            </div>
            <p className="text-[13px] text-ink-2">No sign-up. The sample is the {n(rows)}-row Build Battle dataset, already analyzed.</p>
          </div>
          <HeroFlow
            rows={rows}
            distinct={reviews.length}
            issues={ranked.map((r) => ({ name: r.name, score: r.score, act: r.score >= ACT_NOW }))}
          />
        </section>

        <section id="how" aria-labelledby="how-h">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-20 sm:px-8">
            <div className="flex max-w-[60ch] flex-col gap-3">
              <h2 id="how-h" className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">
                How it works
              </h2>
              <p className="text-ink-2">Three steps from a messy export to a decision you can defend in a meeting.</p>
            </div>
            <ol className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: FileUp,
                  title: "Bring your feedback",
                  body: "Import a CSV of reviews, surveys or support messages, or add one at a time. The text column is found automatically.",
                },
                {
                  icon: Sparkles,
                  title: "Analyzed once, grounded in the text",
                  body: "Repeats are grouped, then Adaption labels each distinct review for sentiment, topic and severity, aspect by aspect.",
                },
                {
                  icon: ListOrdered,
                  title: "Decide, track, report",
                  body: "Issues are ranked by a formula you can adjust. Track the ones you act on and share a brief written for leadership.",
                },
              ].map((s, i) => (
                <li key={s.title} className="glass lift flex flex-col gap-3 rounded-[22px] p-6">
                  <span className="flex items-center justify-between">
                    <span className="raised inline-flex size-10 items-center justify-center rounded-xl">
                      <s.icon size={19} />
                    </span>
                    <span className="text-sm font-semibold text-ink-3">Step {i + 1}</span>
                  </span>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="proof-h" className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 id="proof-h" className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">
              The most reported problem is not the most urgent one.
            </h2>
            <p className="max-w-[54ch] text-ink-2">
              In the sample, {mostReported.name.toLowerCase()} draws the most complaints, {n(mostReported.rows)}. But {n(top.rows)}{" "}
              customers reported “{top.name.toLowerCase()}”. InsightFlow ranks money lost above time lost, and shows you why.
            </p>
            <Link href={`/app/priorities?issue=${top.id}`} className="inline-flex w-fit items-center gap-2 font-semibold underline underline-offset-4">
              See the ranking and its evidence <ArrowRight size={16} />
            </Link>
          </div>
          <figure className="glass lift m-0 flex flex-col gap-4 rounded-[22px] p-7">
            <Quote size={22} className="text-attn" aria-hidden />
            <blockquote className="quote text-[22px] leading-relaxed">“{topQuote.text}”</blockquote>
            <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
              <span>Repeated {n(topQuote.count)} times</span>
              <span>Issue: {top.name}</span>
              <span className="font-semibold text-attn-text">Priority 1 of {ranked.length}</span>
            </figcaption>
          </figure>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-8">
          <div className="grid gap-6 rounded-[24px] border border-white/[0.08] bg-sidebar p-8 text-sidebar-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08),var(--shadow)] backdrop-blur-xl sm:p-10 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Nothing invented", body: "No dates in the data means no trend chart. Every claim links to real reviews." },
              { icon: Workflow, title: "Adaption does the analysis", body: "Distinct reviews run through Adaption's Adaptive Data API as one batch job." },
              { icon: ListOrdered, title: "Scores are computed", body: "The AI labels reviews. Every count and score is calculated in code you can read." },
            ].map((f) => (
              <div key={f.title} className="flex flex-col gap-2">
                <f.icon size={20} className="text-attn" aria-hidden />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-sidebar-ink-2">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 px-5 py-6 text-sm text-ink-2 sm:px-8">
          <span>InsightFlow, built for Build Battle 2026.</span>
          <span>Analysis runs on Adaption. Scores are computed in code, never by the AI.</span>
        </div>
      </footer>
    </div>
  );
}
