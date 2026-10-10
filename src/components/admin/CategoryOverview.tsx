// Per part (category): average, share of max, and how students spread out.

import { scoreTone } from "@/components/sim/tone";
import type { CategoryStat } from "@/lib/attemptAnalysis";
import { cn } from "@/lib/utils";

const TONE_TEXT = { good: "text-sim-good", warn: "text-sim-warn", bad: "text-sim-bad", neutral: "text-foreground" } as const;

function Distribution({ stat }: { stat: CategoryStat }) {
  const peak = Math.max(1, ...stat.bins.map((b) => b.count));
  return (
    <ul className="mt-4 space-y-1" aria-label={`How students scored in ${stat.label}`}>
      {stat.bins.map((b) => (
        <li key={b.label} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 text-xs" title={`${b.count} student(s) scored ${b.label} of the points`}>
          <span className="text-muted-foreground">{b.label}</span>
          <span className="h-2 rounded-r bg-secondary">
            <span className="block h-full rounded-r bg-foreground/50" style={{ width: `${(b.count / peak) * 100}%` }} />
          </span>
          <span className="sim-num text-right text-foreground">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function CategoryOverview({ stats }: { stats: readonly CategoryStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => {
        const tone = s.n ? scoreTone(s.avg, s.max) : "neutral";
        return (
          <div key={s.category} className="rounded-xl bg-card px-5 py-4 shadow-[0_1px_0_hsl(var(--border)),0_8px_24px_-16px_hsl(24_30%_20%/0.25)]">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className={cn("sim-num mt-1 text-2xl font-semibold tracking-tight", TONE_TEXT[tone])}>
              {s.n ? s.avg : "No data"}{s.n > 0 && <span className="text-base font-normal text-muted-foreground"> / {s.max}</span>}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.n ? `${s.pctOfMax}% of points on average, ${s.n} runs` : "No runs in this view"}</p>
            {s.n > 0 && <Distribution stat={s} />}
          </div>
        );
      })}
    </div>
  );
}
