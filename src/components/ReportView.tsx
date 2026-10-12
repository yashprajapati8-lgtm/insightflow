import type { ReportSnapshot } from "@/lib/report";

const n = (x: number) => Math.round(x).toLocaleString("en-US");

/** The printable brief. Used in the app preview, the shared link and the PDF. */
export function ReportView({ r }: { r: ReportSnapshot }) {
  const date = new Date(r.preparedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const s = r.sections;
  return (
    <article className="print-page glass mx-auto flex w-full max-w-[820px] flex-col gap-8 rounded-[22px] px-6 py-10 sm:px-12">
      <header className="flex flex-col gap-2 border-b border-line pb-6">
        <span className="text-[13px] text-ink-2">
          InsightFlow brief for {r.audience === "Leadership" ? "leadership" : "the team"}, prepared {date}
        </span>
        <h1 className="quote text-[32px] leading-tight font-semibold tracking-[-0.01em]">
          What {n(r.dataset.rows)} pieces of feedback told us
        </h1>
        <span className="text-[13px] text-ink-2">
          {r.dataset.name}, {n(r.dataset.distinct)} distinct reviews.
        </span>
      </header>

      {s.summary && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Summary</h2>
          <p className="max-w-[66ch] text-base leading-relaxed">{r.summary}</p>
        </section>
      )}

      {s.risks && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Open risks</h2>
          {r.risks.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-2">
                    <th className="border-b border-line py-2 font-medium">Issue</th>
                    <th className="border-b border-line py-2 text-right font-medium">Score</th>
                    <th className="border-b border-line py-2 pl-4 font-medium">Owner</th>
                    <th className="border-b border-line py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {r.risks.map((x) => (
                    <tr key={x.name}>
                      <td className="border-b border-line-soft py-2.5 font-medium">
                        {x.name} <span className="font-normal text-ink-2">({n(x.rows)} reports)</span>
                      </td>
                      <td className="border-b border-line-soft py-2.5 text-right font-semibold">{x.score}</td>
                      <td className="border-b border-line-soft py-2.5 pl-4">{x.owner}</td>
                      <td className="border-b border-line-soft py-2.5">{x.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-ink-2">No open risks. Every tracked issue is resolved.</p>
          )}
          {r.resolved.length > 0 && <p className="text-[13px] text-pos-fg">Resolved: {r.resolved.join(", ")}.</p>}
        </section>
      )}

      {s.actions && r.actions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Recommended actions</h2>
          <ol className="flex max-w-[66ch] list-decimal flex-col gap-2 pl-5">
            {r.actions.map((a) => (
              <li key={a.text} className="text-[15px] leading-relaxed">
                {a.text} <span className="text-ink-2">Owner: {a.owner}.</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {s.working && r.working.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">What is working</h2>
          <p className="max-w-[66ch] text-[15px]">
            Customers praise {r.working.map((w) => w.topic.toLowerCase()).join(", ")}. Protect these while fixing the risks above.
          </p>
          {r.working.slice(0, 2).map((w) => (
            <blockquote key={w.topic} className="quote border-l-2 border-line pl-4 text-base leading-relaxed">
              “{w.quote}” <span className="font-sans text-[13px] text-ink-2">×{n(w.count)}</span>
            </blockquote>
          ))}
        </section>
      )}

      {s.notes && r.notes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Team notes</h2>
          {r.notes.map((x, i) => (
            <p key={i} className="text-sm">
              <strong className="font-semibold">{x.issue}:</strong> {x.text}
            </p>
          ))}
        </section>
      )}

      {s.data && (
        <section className="flex flex-col gap-1.5 border-t border-line pt-5">
          <h2 className="text-[13px] font-semibold">About this data</h2>
          <p className="max-w-[72ch] text-[13px] text-ink-2">
            {n(r.dataset.rows - r.dataset.distinct)} of the {n(r.dataset.rows)} rows repeat an earlier review; counts include
            repeats. {r.dataset.hasDates ? "Trends use the dates in the file." : "The data has no dates, so this brief shows no trends."}{" "}
            Sentiment and issues come from the AI pipeline; every score is computed in code.
          </p>
        </section>
      )}
    </article>
  );
}
