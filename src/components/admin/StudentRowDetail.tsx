// Expanded detail for one student in the staff tables: a strip of every run
// (best run picked first), quick numbers, then the picked run's part scores,
// lost points, goals, campaigns and decisions.

import { useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scoreTone, type Tone } from "@/components/sim/tone";
import { LossesAndGoals, PartScores, PlanAndDecisions } from "@/components/admin/StudentRunPanels";
import { attemptVersion, brandOf, type AttemptRow } from "@/lib/attemptAnalysis";
import { runHistory } from "@/lib/attemptDetail";
import { cn } from "@/lib/utils";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const CHIP_TONE: Record<Tone, string> = {
  good: "text-sim-good", warn: "text-sim-warn", bad: "text-sim-bad", neutral: "text-foreground",
};

interface RunStripProps {
  runs: readonly AttemptRow[];
  bestId: string;
  pickedId: string;
  onPick: (id: string) => void;
}

function RunStrip({ runs, bestId, pickedId, onPick }: RunStripProps) {
  return (
    // w-0 + min-w-full: scroll inside the cell instead of widening the table.
    <div className="flex w-0 min-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Runs">
      {runs.map((r) => {
        const picked = r.id === pickedId;
        return (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={picked}
            onClick={() => onPick(r.id)}
            className={cn(
              "sim-lift shrink-0 rounded-lg border px-3 py-1.5 text-left text-xs",
              picked ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
            )}
          >
            <span className="flex items-center gap-1">
              <span className={cn("sim-num text-sm font-semibold", CHIP_TONE[scoreTone(r.score_total, 100)])}>{r.score_total}</span>
              {r.id === bestId && <Star className="h-3 w-3 fill-sim-warn text-sim-warn" aria-label="Best run" />}
            </span>
            <span className="block text-muted-foreground">{brandOf(r)} · {shortDate(r.created_at)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-[72px]">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("sim-num text-base font-semibold", CHIP_TONE[tone])}>{value}</p>
    </div>
  );
}

interface StudentRowDetailProps {
  /** The row shown in the table (the student's best run). */
  row: AttemptRow;
  /** Every run this student saved; falls back to just the row. */
  runs?: readonly AttemptRow[];
  onOpenProfile?: (email: string) => void;
}

export function StudentRowDetail({ row, runs, onOpenProfile }: StudentRowDetailProps) {
  const history = runHistory(runs && runs.length > 0 ? runs : [row])!;
  const [pickedId, setPickedId] = useState(row.id);
  const picked = history.ordered.find((r) => r.id === pickedId) ?? row;
  const ChangeIcon = history.change >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-5">
          <Stat label="Runs" value={history.runs} />
          <Stat label="Best" value={history.best.score_total} tone={scoreTone(history.best.score_total, 100)} />
          <Stat label="Latest" value={history.latest.score_total} tone={scoreTone(history.latest.score_total, 100)} />
          {history.runs > 1 && (
            <Stat
              label="Since first run"
              tone={history.change > 0 ? "good" : history.change < 0 ? "bad" : "neutral"}
              value={<span className="inline-flex items-center gap-0.5"><ChangeIcon className="h-4 w-4" aria-hidden />{history.change > 0 ? "+" : ""}{history.change}</span>}
            />
          )}
          <Stat label="Scoring" value={attemptVersion(picked) === 2 ? "New" : "Old"} />
        </div>
        {onOpenProfile && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onOpenProfile(row.email)}>
            <UserRound className="h-3.5 w-3.5" /> Full profile
          </Button>
        )}
      </div>

      {history.runs > 1 && <RunStrip runs={history.ordered} bestId={history.best.id} pickedId={picked.id} onPick={setPickedId} />}

      <div key={picked.id} className="grid gap-6 md:grid-cols-3">
        <PartScores row={picked} />
        <LossesAndGoals row={picked} />
        <PlanAndDecisions row={picked} />
      </div>
    </div>
  );
}
