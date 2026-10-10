// "Where points were lost": one row per scored line, sorted by points lost on
// average. Open a row to see how students spread across levels, the most
// common reasons, and what to teach next.

import { ChevronDown } from "lucide-react";
import { ScoreBar, Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import type { LineStat, TierCount } from "@/lib/attemptAnalysis";
import { categoryLabel } from "@/lib/rubrics";
import { cn } from "@/lib/utils";

const LEVEL_FILL = { good: "bg-sim-good", warn: "bg-sim-warn", bad: "bg-sim-bad", neutral: "bg-foreground/50" } as const;

const levelPoints = (t: TierCount) => (t.minPoints !== undefined && t.minPoints !== t.points ? `${t.minPoints} to ${t.points}` : `${t.points}`);

function LevelBar({ stat }: { stat: LineStat }) {
  const used = stat.tiers.filter((t) => t.count > 0);
  return (
    <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Levels reached: ${used.map((t) => `${t.share}% ${t.short}`).join(", ")}`}>
      {used.map((t) => (
        <span
          key={`${t.points}-${t.minPoints ?? ""}`}
          className={cn("h-full first:rounded-l-full last:rounded-r-full", LEVEL_FILL[scoreTone(t.points, stat.max)])}
          style={{ width: `${t.share}%` }}
          title={`${t.share}% scored ${levelPoints(t)} (${t.short})`}
        />
      ))}
    </div>
  );
}

function LineRow({ stat }: { stat: LineStat }) {
  const avgLost = Math.round((stat.max - stat.avgEarned) * 10) / 10;
  return (
    <details className="group border-b border-border last:border-0">
      <summary className="grid cursor-pointer list-none grid-cols-1 items-center gap-3 px-2 py-3 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6rem_minmax(0,1fr)_1rem] [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{stat.label}</p>
          <p className="text-xs text-muted-foreground">{categoryLabel(stat.category)}</p>
        </div>
        <ScoreBar earned={stat.avgEarned} max={stat.max} label={`${stat.label} average`} />
        <div className="text-sm md:text-right">
          <span className="sim-num font-medium text-foreground">{stat.pctLost}%</span>
          <span className="block text-xs text-muted-foreground">lost points</span>
        </div>
        <LevelBar stat={stat} />
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 md:block" aria-hidden />
      </summary>
      <div className="grid gap-6 px-2 pb-5 pt-1 md:grid-cols-3">
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">Levels reached</h4>
          <ul className="space-y-1.5 text-sm">
            {stat.tiers.map((t) => (
              <li key={`${t.points}-${t.minPoints ?? ""}`} className="flex items-start justify-between gap-3" title={t.condition}>
                <span className={cn(t.count === 0 && "text-muted-foreground")}>{levelPoints(t)} pts: {t.short}</span>
                <span className="sim-num shrink-0">{t.count} ({t.share}%)</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">Most common reasons for losing points</h4>
          {stat.topReasons.length === 0
            ? <p className="text-sm text-muted-foreground">Nobody lost points here.</p>
            : (
              <ul className="space-y-2 text-sm">
                {stat.topReasons.map((r) => (
                  <li key={r.reason}><span className="sim-num mr-1 font-medium">{r.count}x</span>{r.reason}</li>
                ))}
              </ul>
            )}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">What to fix next</h4>
          <p className="text-sm font-medium text-foreground">{stat.dataNote}</p>
          {stat.howToImprove && <p className="mt-2 text-sm text-foreground/90">Tell students: {stat.howToImprove}</p>}
          {avgLost > 0 && <p className="mt-2"><Tag tone={scoreTone(stat.avgEarned, stat.max)}><span className="sim-num">{avgLost} points lost on average</span></Tag></p>}
        </div>
      </div>
    </details>
  );
}

export function LineLossTable({ stats }: { stats: readonly LineStat[] }) {
  const sorted = [...stats].sort((a, b) => (b.max - b.avgEarned) - (a.max - a.avgEarned));
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6rem_minmax(0,1fr)_1rem] gap-3 border-b border-border px-2 pb-2 text-xs font-medium text-muted-foreground md:grid">
        <span>Line (most points lost first)</span><span>Average points</span><span className="text-right">Students</span><span>Levels reached</span><span />
      </div>
      {sorted.map((s) => <LineRow key={s.key} stat={s} />)}
    </div>
  );
}
