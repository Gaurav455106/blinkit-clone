// Best attempt per student, with expandable detail, a profile link and an
// optional delete action (admin only). Shared by the admin and trainer pages.

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, MoreHorizontal, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tag } from "@/components/sim/primitives";
import { scoreTone, type Tone } from "@/components/sim/tone";
import { StudentRowDetail } from "@/components/admin/StudentRowDetail";
import { brandOf, gradeLabelOf, type AttemptRow } from "@/lib/attemptAnalysis";
import { runsByEmail } from "@/lib/attemptDetail";
import { cn } from "@/lib/utils";

interface StudentsTableProps {
  rows: readonly AttemptRow[];
  /** Every saved attempt, so an open row can switch between a student's runs. */
  allRows?: readonly AttemptRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenProfile: (email: string) => void;
  onDelete?: (row: AttemptRow) => void;
  /** Hide the batch column when the list is already one batch. */
  showBatch?: boolean;
}

const BAR_FILL: Record<Tone, string> = { good: "bg-sim-good", warn: "bg-sim-warn", bad: "bg-sim-bad", neutral: "bg-muted-foreground" };
const SCORE_TEXT: Record<Tone, string> = { good: "text-sim-good", warn: "text-sim-warn", bad: "text-sim-bad", neutral: "text-foreground" };

/** Score out of 100 as a number plus a short bar, so a column of scores reads at a glance. */
function ScoreCell({ score }: { score: number }) {
  const tone = scoreTone(score, 100);
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("sim-num w-7 text-right text-sm font-semibold", SCORE_TEXT[tone])}>{score}</span>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <span className={cn("block h-full rounded-full", BAR_FILL[tone])} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
    </div>
  );
}

export function StudentsTable({ rows, allRows, loading, error, onRetry, onOpenProfile, onDelete, showBatch = true }: StudentsTableProps) {
  const COLS = showBatch ? 6 : 5;
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const runs = useMemo(() => runsByEmail(allRows ?? rows), [allRows, rows]);
  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
  const toggle = (email: string) => setOpenEmail((cur) => (cur === email ? null : email));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Student</th>{showBatch && <th className={th}>Batch</th>}<th className={th}>Brand</th>
            <th className={th}>Best score <span className="font-normal">/ 100</span></th><th className={th}>Grade</th><th className={`${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && [0, 1, 2].map((i) => (
            <tr key={`sk-${i}`}><td colSpan={COLS} className="px-3 py-2"><Skeleton className="h-9 w-full rounded-md" /></td></tr>
          ))}
          {!loading && error && (
            <tr><td colSpan={COLS} className="px-3 py-8 text-center text-sm">
              <span className="font-medium text-destructive">We couldn't load the runs.</span>
              <span className="text-muted-foreground"> {error}</span>
              <Button variant="link" onClick={onRetry} className="ml-1 h-auto p-0">Try again</Button>
            </td></tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr><td colSpan={COLS} className="px-3 py-8 text-center text-sm text-muted-foreground">No students match these filters.</td></tr>
          )}
          {!loading && rows.map((row) => {
            const open = openEmail === row.email;
            return (
              <Fragment key={row.email}>
                <tr className={cn("border-b border-border hover:bg-secondary/50", open && "bg-secondary/40")}>
                  <td className="px-3 py-2.5 text-sm">
                    <button type="button" onClick={() => toggle(row.email)} aria-expanded={open} className="flex items-center gap-2 text-left">
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
                      <span>
                        <span className="block font-medium text-foreground">{row.name}</span>
                        <span className="block text-xs text-muted-foreground">{row.email}</span>
                      </span>
                    </button>
                  </td>
                  {showBatch && <td className="px-3 py-2.5 text-sm">{row.batch_code}</td>}
                  <td className="px-3 py-2.5 text-sm">{brandOf(row)}</td>
                  <td className="px-3 py-2.5"><ScoreCell score={row.score_total} /></td>
                  <td className="px-3 py-2.5"><Tag tone={scoreTone(row.score_total, 100)}>{gradeLabelOf(row)}</Tag></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => onOpenProfile(row.email)}>
                        <UserRound className="h-3.5 w-3.5" /> Profile
                      </Button>
                      {onDelete && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label={`More actions for ${row.name}`}>
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="sim-ui">
                            <DropdownMenuItem onSelect={() => onDelete(row)} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                              <Trash2 className="h-4 w-4" aria-hidden /> Delete all runs…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-border bg-secondary/30">
                    <td colSpan={COLS} className="px-4 py-4"><StudentRowDetail row={row} runs={runs.get(row.email)} onOpenProfile={onOpenProfile} /></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
