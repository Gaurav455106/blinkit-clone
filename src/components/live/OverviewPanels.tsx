// ── Overview panels: budget by ad format, sponsored share of voice ────────────

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DayResult } from "@/market/engineTypes";
import { Section } from "@/components/sim/primitives";
import { SERIES } from "@/components/live/palette";
import { keywordSov, spendByFormat } from "@/components/live/overviewData";
import { cn } from "@/lib/utils";

const PIE_HEIGHT = 200;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const KIND_DOT = { good: "bg-sim-good", risky: "bg-sim-bad", other: "bg-muted-foreground/40" } as const;

/** Where the money went, by ad format. */
export function BudgetDistribution({ results, formatById }: { results: readonly DayResult[]; formatById: Readonly<Record<string, string | null | undefined>> }) {
  const rows = useMemo(() => spendByFormat(results, formatById), [results, formatById]);
  return (
    <Section title="Budget distribution" description="Share of your ad spend by campaign type.">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No spend yet.</p>
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
          <ResponsiveContainer width="100%" height={PIE_HEIGHT}>
            <PieChart>
              <Pie data={rows} dataKey="spend" nameKey="label" innerRadius={52} outerRadius={84} paddingAngle={rows.length > 1 ? 2 : 0} stroke="none">
                {rows.map((r, i) => <Cell key={r.format} fill={SERIES[i % SERIES.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => rupees(v)} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-2 text-sm">
            {rows.map((r, i) => (
              <li key={r.format} className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                <span className="flex-1 text-foreground">{r.label}</span>
                <span className="sim-num font-semibold text-foreground">{pct(r.share)}</span>
                <span className="sim-num w-24 text-right text-muted-foreground">{rupees(r.spend)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

/** Each keyword's searches and your share of its ad views. */
export function SponsoredSov({ results, good, risky }: { results: readonly DayResult[]; good: readonly string[]; risky: readonly string[] }) {
  const rows = useMemo(() => keywordSov(results, good, risky), [results, good, risky]);
  return (
    <Section title="Sponsored share of voice" description="Your share of the ad views on each keyword you target (last 7 days).">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No keyword campaigns running.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 font-medium">Keyword</th>
                <th scope="col" className="py-2 text-right font-medium">Searches</th>
                <th scope="col" className="py-2 text-right font-medium">SOV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.term} className="border-b border-border last:border-0">
                  <td className="max-w-[16ch] py-2.5">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", KIND_DOT[r.kind])} />
                      <span className="truncate text-foreground" title={r.term}>{r.term}</span>
                    </span>
                  </td>
                  <td className="sim-num py-2.5 text-right text-muted-foreground">{Math.round(r.searches).toLocaleString("en-IN")}</td>
                  <td className="sim-num py-2.5 text-right font-semibold text-foreground">{pct(r.sov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-sim-good" />Good keyword</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-sim-bad" />Risky keyword</span>
          </p>
        </>
      )}
    </Section>
  );
}
