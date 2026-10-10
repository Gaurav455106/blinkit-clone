// Crisis choices: which option students picked for each crisis, and the points it earned.

import { scoreTone } from "@/components/sim/tone";
import type { CrisisStat } from "@/lib/attemptAnalysis";
import { cn } from "@/lib/utils";

const FILL = { good: "bg-sim-good", warn: "bg-sim-warn", bad: "bg-sim-bad", neutral: "bg-foreground/50" } as const;

export function CrisisBreakdown({ stats }: { stats: readonly CrisisStat[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {stats.map((c) => (
        <article key={c.num}>
          <p className="text-xs text-muted-foreground">Crisis {c.num}</p>
          <h3 className="font-semibold text-foreground">{c.n ? c.title : `Crisis ${c.num}`}</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            {c.n ? <>Average <span className="sim-num font-medium text-foreground">{Math.round(c.avgPoints * 10) / 10}</span> of {c.max} points, {c.n} answers</> : "No answers saved in this view."}
          </p>
          <ul className="space-y-2.5">
            {c.options.map((o) => (
              <li key={o.optionKey} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate" title={o.label}><span className="font-medium">{o.optionKey.toUpperCase()}.</span> {o.label}</span>
                  <span className="sim-num shrink-0 text-muted-foreground">{o.share}%</span>
                </div>
                <div className="mt-1 h-2 rounded-r bg-secondary" title={`${o.count} chose this, ${o.avgPoints} points on average`}>
                  <div className={cn("h-full rounded-r", FILL[scoreTone(o.avgPoints, c.max)])} style={{ width: `${o.share}%` }} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.count} chose this, worth {o.avgPoints} {o.avgPoints === 1 ? "point" : "points"}</p>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
