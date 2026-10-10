// What a student does well across attempts, and what keeps costing points.

import { EmptyState } from "@/components/sim/primitives";
import type { Gap, Strength } from "@/lib/attemptAnalysis";

export function StrengthsGaps({ strengths, gaps }: { strengths: readonly Strength[]; gaps: readonly Gap[] }) {
  if (strengths.length === 0 && gaps.length === 0) {
    return <EmptyState title="Not enough line scores yet" description="Strengths and gaps appear once a run with line-by-line scores has been saved." />;
  }
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-3 font-semibold text-foreground">Strengths</h3>
        {strengths.length === 0
          ? <p className="text-sm text-muted-foreground">No line is at 80% of its points on average yet.</p>
          : (
            <ul className="space-y-2">
              {strengths.map((s) => (
                <li key={s.key} className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
                  <span className="text-foreground">{s.label}</span>
                  <span className="sim-num shrink-0 text-sim-good">{s.avgPct}% of points</span>
                </li>
              ))}
            </ul>
          )}
      </div>
      <div>
        <h3 className="mb-3 font-semibold text-foreground">Keeps costing points</h3>
        {gaps.length === 0
          ? <p className="text-sm text-muted-foreground">No line lost points in more than half of the runs.</p>
          : (
            <ul className="space-y-4">
              {gaps.map((g) => (
                <li key={g.key} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-foreground">{g.label}</span>
                    <span className="sim-num shrink-0 text-sim-bad">-{g.avgLost} on average</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">Lost points in {g.lostIn} of {g.attempts} runs.</p>
                  {g.howToImprove && <p className="mt-1 text-foreground/90">{g.howToImprove}</p>}
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
