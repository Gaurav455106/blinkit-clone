// Best attempt per student, with expandable detail, a profile link and an
// optional delete action (admin only). Shared by the admin and trainer pages.

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
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
}

const COLS = 6;

export function StudentsTable({ rows, allRows, loading, error, onRetry, onOpenProfile, onDelete }: StudentsTableProps) {
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const runs = useMemo(() => runsByEmail(allRows ?? rows), [allRows, rows]);
  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
  const toggle = (email: string) => setOpenEmail((cur) => (cur === email ? null : email));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Student</th><th className={th}>Batch</th><th className={th}>Brand</th>
            <th className={th}>Best score</th><th className={th}>Grade</th><th className={`${th} text-right`}>Actions</th>
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
                  <td className="px-3 py-2.5 text-sm">{row.batch_code}</td>
                  <td className="px-3 py-2.5 text-sm">{brandOf(row)}</td>
                  <td className="px-3 py-2.5"><Tag tone={scoreTone(row.score_total, 100)}><span className="sim-num">{row.score_total} / 100</span></Tag></td>
                  <td className="px-3 py-2.5 text-sm">{gradeLabelOf(row)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => onOpenProfile(row.email)}>
                        <UserRound className="h-3.5 w-3.5" /> Profile
                      </Button>
                      {onDelete && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => onDelete(row)}
                          aria-label={`Delete all runs for ${row.name}`}
                          title="Delete all runs for this student"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
