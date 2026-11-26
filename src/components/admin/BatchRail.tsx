// Admin batch rail: one place to pick the batch every tab shows.
// Each batch shows its size, average and who is live; test batches sit apart.

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { scoreTone, type Tone } from "@/components/sim/tone";
import type { BatchSummary } from "@/lib/attemptAnalysis";
import { TEST_BATCH } from "@/lib/testRuns";
import { cn } from "@/lib/utils";

export interface BatchLiveCount {
  live: number;
  unsaved: number;
}

interface BatchRailProps {
  batches: readonly BatchSummary[];
  liveByBatch: ReadonlyMap<string, BatchLiveCount>;
  allLabel: string;
  totalStudents: number;
  overallAvg: number;
  active: string;
  onSelect: (batch: string) => void;
}

const AVG_TEXT: Record<Tone, string> = {
  good: "text-sim-good", warn: "text-sim-warn", bad: "text-sim-bad", neutral: "text-muted-foreground",
};

/** Test identities save under TEST_BATCH; they are not a real cohort. */
const isTestBatch = (batch: string) => batch === TEST_BATCH;

interface RailItemProps {
  label: string;
  count: number;
  avg: number;
  live?: BatchLiveCount;
  active: boolean;
  onClick: () => void;
}

function RailItem({ label, count, avg, live, active, onClick }: RailItemProps) {
  const liveText = live?.live ? `, ${live.live} live` : "";
  const unsavedText = live?.unsaved ? `, ${live.unsaved} score not saved` : "";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        aria-label={`${label}: ${count} students, average ${avg}${liveText}${unsavedText}`}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className={cn("sim-num block text-xs", active ? "text-primary-foreground/75" : "text-muted-foreground")}>
            {count} {count === 1 ? "student" : "students"} · avg{" "}
            <span className={cn("font-semibold", active ? "text-primary-foreground" : AVG_TEXT[scoreTone(avg, 100)])}>{avg}</span>
          </span>
        </span>
        {live?.unsaved ? (
          <span aria-hidden className={cn("sim-num rounded-full px-1.5 text-[11px] font-semibold", active ? "bg-primary-foreground/20" : "bg-sim-bad/10 text-sim-bad")}>
            {live.unsaved}!
          </span>
        ) : null}
        {live?.live ? (
          <span aria-hidden className={cn("sim-num flex items-center gap-1 text-[11px] font-semibold", active ? "text-primary-foreground" : "text-sim-good")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary-foreground" : "bg-sim-good")} />
            {live.live}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function BatchRail({ batches, liveByBatch, allLabel, totalStudents, overallAvg, active, onSelect }: BatchRailProps) {
  const [query, setQuery] = useState("");
  const [showTest, setShowTest] = useState(() => isTestBatch(active));

  const { real, test } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? batches.filter((b) => b.batch.toLowerCase().includes(q)) : batches;
    return { real: shown.filter((b) => !isTestBatch(b.batch)), test: shown.filter((b) => isTestBatch(b.batch)) };
  }, [batches, query]);

  const totalLive = useMemo(() => {
    let live = 0, unsaved = 0;
    liveByBatch.forEach((c) => { live += c.live; unsaved += c.unsaved; });
    return { live, unsaved };
  }, [liveByBatch]);

  const item = (b: BatchSummary) => (
    <RailItem key={b.batch} label={b.batch} count={b.count} avg={b.avg} live={liveByBatch.get(b.batch)} active={active === b.batch} onClick={() => onSelect(b.batch)} />
  );

  return (
    <nav aria-label="Batches" className="rounded-2xl bg-card p-3 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Batches</h2>
        <span className="sim-num text-xs text-muted-foreground">{batches.length}</span>
      </div>
      {batches.length > 6 && (
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a batch" aria-label="Find a batch" className="h-8 pl-8 text-sm" />
        </div>
      )}
      <ul className="space-y-0.5">
        {!query && (
          <RailItem label={allLabel} count={totalStudents} avg={overallAvg} live={totalLive} active={active === allLabel} onClick={() => onSelect(allLabel)} />
        )}
        {real.map(item)}
      </ul>
      {query && real.length === 0 && test.length === 0 && (
        <p className="px-3 py-4 text-xs text-muted-foreground">No batch matches "{query}".</p>
      )}
      {test.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setShowTest((v) => !v)}
            aria-expanded={showTest || !!query}
            className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", (showTest || query) && "rotate-90")} aria-hidden />
            Test runs (Student view)
          </button>
          {(showTest || query) && <ul className="mt-0.5 space-y-0.5">{test.map(item)}</ul>}
        </div>
      )}
    </nav>
  );
}
