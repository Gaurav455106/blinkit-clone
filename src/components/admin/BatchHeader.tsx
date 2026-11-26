// Header for the batch picked in the admin rail: its numbers at a glance,
// the everyday action (export) in view, and the rare or destructive ones in a menu.

import type { ReactNode } from "react";
import { Clock, Download, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { scoreTone, type Tone } from "@/components/sim/tone";
import type { AttemptRow } from "@/lib/attemptAnalysis";

interface BatchHeaderProps {
  /** null when every batch is shown */
  batch: string | null;
  students: number;
  avg: number;
  top: AttemptRow | null;
  commonLoss: string | null;
  live: number;
  onExport: () => void;
  onExportAll: () => void;
  onClearStale: () => void;
  onDeleteBatch: () => void;
}

const VALUE_TEXT: Record<Tone, string> = {
  good: "text-sim-good", warn: "text-sim-warn", bad: "text-sim-bad", neutral: "text-foreground",
};

function Fact({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`sim-num truncate text-lg font-semibold leading-tight ${VALUE_TEXT[tone]}`}>{value}</dd>
    </div>
  );
}

export function BatchHeader({ batch, students, avg, top, commonLoss, live, onExport, onExportAll, onClearStale, onDeleteBatch }: BatchHeaderProps) {
  return (
    <header className="rounded-2xl bg-card p-5 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{batch ? "Batch" : "Overview"}</p>
          <h2 className="truncate text-2xl font-semibold leading-tight text-foreground">{batch ?? "All batches"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={onExport}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="More batch actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="sim-ui w-60">
              {batch && (
                <DropdownMenuItem onSelect={onExportAll} className="gap-2">
                  <Download className="h-4 w-4" aria-hidden /> Export every batch as CSV
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onClearStale} className="gap-2">
                <Clock className="h-4 w-4" aria-hidden /> Clear stale live sessions
              </DropdownMenuItem>
              {batch && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Can't be undone</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={onDeleteBatch} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete batch {batch}…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3 xl:grid-cols-5">
        <Fact label="Students" value={students} />
        <Fact label="Average best score" value={students ? `${avg} / 100` : "None"} tone={students ? scoreTone(avg, 100) : "neutral"} />
        <Fact label="Live now" value={live} tone={live ? "good" : "neutral"} />
        <Fact label="Top student" value={top ? <>{top.name} <span className="text-muted-foreground">({top.score_total})</span></> : "None"} />
        <Fact label="Most points lost in" value={commonLoss ?? "Nothing stands out"} />
      </dl>
    </header>
  );
}
