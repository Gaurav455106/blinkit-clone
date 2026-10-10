// Batch overview. Clicking a row filters the student list to that batch.

import type { ReactNode } from "react";
import { Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import type { BatchSummary } from "@/lib/attemptAnalysis";
import { cn } from "@/lib/utils";

interface BatchTableProps {
  batches: readonly BatchSummary[];
  activeBatch: string;
  loading: boolean;
  onSelect: (batch: string) => void;
  renderActions?: (batch: string) => ReactNode;
}

export function BatchTable({ batches, activeBatch, loading, onSelect, renderActions }: BatchTableProps) {
  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
  const cols = renderActions ? 6 : 5;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px]">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Batch</th><th className={`${th} text-right`}>Students</th><th className={`${th} text-right`}>Average</th>
            <th className={th}>Top student</th><th className={th}>Where most points were lost</th>
            {renderActions && <th className={`${th} text-right`}>Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {batches.map((b) => {
            const active = activeBatch === b.batch;
            return (
              <tr key={b.batch} className={cn("cursor-pointer hover:bg-secondary/50", active && "bg-accent/60")} onClick={() => onSelect(b.batch)}>
                <td className="px-3 py-2.5 text-sm">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={(e) => { e.stopPropagation(); onSelect(b.batch); }}
                    className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}
                  >
                    {b.batch}
                  </button>
                </td>
                <td className="sim-num px-3 py-2.5 text-right text-sm">{b.count}</td>
                <td className="px-3 py-2.5 text-right"><Tag tone={scoreTone(b.avg, 100)}><span className="sim-num">{b.avg}</span></Tag></td>
                <td className="px-3 py-2.5 text-sm">{b.top.name} <span className="sim-num text-muted-foreground">({b.top.score_total})</span></td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{b.commonLoss ?? "Nothing stands out"}</td>
                {renderActions && <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>{renderActions(b.batch)}</td>}
              </tr>
            );
          })}
          {batches.length === 0 && !loading && (
            <tr><td colSpan={cols} className="px-3 py-8 text-center text-sm text-muted-foreground">No runs saved yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
