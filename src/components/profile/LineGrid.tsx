// Points lost on every scored line in every attempt (one score version).
// Attempts saved before line scores were stored show only part totals.

import { attemptLines, attemptTotals, type AttemptRow } from "@/lib/attemptAnalysis";
import { RUBRICS, SCORE_SCHEMES, isRubricKey, type LineResult, type ScoreVersion } from "@/lib/rubrics";
import { cn } from "@/lib/utils";

interface LineGridProps {
  rows: readonly AttemptRow[]; // oldest first
  version: ScoreVersion;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function lostClass(lost: number, max: number): string {
  if (lost <= 0) return "bg-sim-good/10 text-sim-good";
  const share = max > 0 ? lost / max : 1;
  return share >= 0.6 ? "bg-sim-bad/10 text-sim-bad" : "bg-sim-warn/10 text-sim-warn";
}

function lineRows(lineSets: (LineResult[] | null)[]): { key: string; label: string; category: string }[] {
  const seen = new Map<string, LineResult>();
  for (const ls of lineSets) for (const l of ls ?? []) if (!seen.has(l.key)) seen.set(l.key, l);
  const v1 = RUBRICS.filter((r) => seen.has(r.key)).map((r) => seen.get(r.key)!);
  const rest = Array.from(seen.values()).filter((l) => !isRubricKey(l.key));
  return [...v1, ...rest].map((l) => ({ key: l.key, label: l.label, category: l.category }));
}

export function LineGrid({ rows, version }: LineGridProps) {
  const lineSets = rows.map(attemptLines);
  const totals = rows.map(attemptTotals);
  const linesList = lineRows(lineSets);
  const cats = SCORE_SCHEMES[version];
  const th = "px-2 py-2 text-xs font-medium text-muted-foreground";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-y-1 text-sm">
        <caption className="sr-only">Points lost per line in each run</caption>
        <thead>
          <tr>
            <th scope="col" className={`${th} text-left`}>Line</th>
            {rows.map((r, i) => (
              <th key={r.id} scope="col" className={`${th} text-center`}>
                <div className="text-foreground">Run {i + 1}</div>
                <div className="font-normal">{shortDate(r.created_at)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map((c) => (
            <tr key={`cat-${c.key}`}>
              <th scope="row" className="px-2 py-1.5 text-left font-semibold text-foreground">{c.label} total</th>
              {rows.map((r, i) => {
                const t = totals[i];
                const earned = t ? t[c.key] ?? 0 : null;
                return (
                  <td key={r.id} className="px-1 text-center">
                    {earned === null
                      ? <span className="text-xs text-muted-foreground">Not saved</span>
                      : <span className={cn("sim-num inline-block min-w-[3.5rem] rounded-md px-2 py-1 font-medium", lostClass(c.max - earned, c.max))}>{earned}/{c.max}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          {linesList.map((line) => (
            <tr key={line.key}>
              <th scope="row" className="px-2 py-1 text-left font-normal text-foreground">{line.label}</th>
              {rows.map((r, i) => {
                const l = lineSets[i]?.find((x) => x.key === line.key);
                if (!lineSets[i]) return <td key={r.id} className="px-1 text-center text-xs text-muted-foreground">Not saved</td>;
                if (!l) return <td key={r.id} className="px-1 text-center text-xs text-muted-foreground">Not scored</td>;
                const lost = l.max - l.earned;
                return (
                  <td key={r.id} className="px-1 text-center" title={l.note}>
                    <span className={cn("sim-num inline-block min-w-[3.5rem] rounded-md px-2 py-1 text-xs font-medium", lostClass(lost, l.max))}>
                      {lost > 0 ? `-${lost}` : "Full"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
