// Every attempt a student has saved, newest first.

import { Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { attemptLines, attemptTotals, attemptVersion, brandOf, gradeLabelOf, type AttemptRow } from "@/lib/attemptAnalysis";
import { SCORE_SCHEMES } from "@/lib/rubrics";

const longDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function AttemptsTable({ rows, bestId }: { rows: readonly AttemptRow[]; bestId?: string }) {
  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
  const td = "px-3 py-2.5 text-sm";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Date</th><th className={th}>Brand</th><th className={`${th} text-right`}>Total</th>
            <th className={th}>Grade</th><th className={th}>Parts</th><th className={th}>Line scores</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const t = attemptTotals(r);
            const cats = SCORE_SCHEMES[attemptVersion(r)];
            return (
              <tr key={r.id} className="hover:bg-secondary/50">
                <td className={`${td} whitespace-nowrap`}>{longDate(r.created_at)}</td>
                <td className={td}>{brandOf(r)}</td>
                <td className={`${td} sim-num text-right font-semibold`}>
                  {r.score_total}
                  {r.id === bestId && <span className="ml-2"><Tag tone="good">Best</Tag></span>}
                </td>
                <td className={td}>{gradeLabelOf(r)}</td>
                <td className={td}>
                  {t ? (
                    <div className="flex flex-wrap gap-1.5">
                      {cats.map((c) => (
                        <Tag key={c.key} tone={scoreTone(t[c.key] ?? 0, c.max)}>
                          <span className="sim-num">{c.label} {t[c.key] ?? 0}/{c.max}</span>
                        </Tag>
                      ))}
                    </div>
                  ) : <span className="text-xs text-muted-foreground">Not saved</span>}
                </td>
                <td className={`${td} text-xs text-muted-foreground`}>
                  {attemptLines(r) ? "Saved" : "Not saved"}{attemptVersion(r) === 2 ? " (new scoring)" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
