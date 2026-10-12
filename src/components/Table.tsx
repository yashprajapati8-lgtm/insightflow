"use client";

export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="well overflow-x-auto rounded-2xl px-4 py-1">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-ink-2">
            {head.map((h, i) => (
              <th key={h} className={`border-b border-line py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`border-b border-line-soft py-2.5 [tr:last-child_&]:border-0 ${j > 0 ? "text-right font-semibold" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
