// Cohort analysis for trainers and admins: where did the group lose points,
// why, and what to teach next. Pure stats come from attemptAnalysis.ts.

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Section, EmptyState, Tag } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { CategoryOverview } from "@/components/admin/CategoryOverview";
import { LineLossTable } from "@/components/admin/LineLossTable";
import { CrisisBreakdown } from "@/components/admin/CrisisBreakdown";
import {
  ALL, attemptLines, attemptTotals, bestPerStudent, brandOf, categoryStats, crisisStats, distinctSorted,
  filterAttempts, lineDetailSince, lineStats, versionsPresent, type AttemptRow,
} from "@/lib/attemptAnalysis";
import { SCORE_SCHEMES, type ScoreVersion } from "@/lib/rubrics";
import { buildCohortSheets, COHORT_README } from "@/lib/profileExport";
import { downloadWorkbook } from "@/lib/excel";

type CountMode = "best" | "all";

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}

function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-[9rem] rounded-lg border border-input bg-card px-3 text-sm text-foreground hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

interface StudentListProps {
  rows: readonly AttemptRow[];
  version: ScoreVersion;
  onOpenStudent: (email: string) => void;
}

function StudentList({ rows, version, onOpenStudent }: StudentListProps) {
  const sorted = [...rows].sort((a, b) => b.score_total - a.score_total);
  const cats = SCORE_SCHEMES[version];
  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Student</th><th className={th}>Batch</th><th className={th}>Brand</th>
            <th className={`${th} text-right`}>Total</th>
            {cats.map((c) => <th key={c.key} className={`${th} text-right`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => {
            const t = attemptTotals(r);
            return (
              <tr key={r.id} className="cursor-pointer hover:bg-secondary/60" onClick={() => onOpenStudent(r.email)}>
                <td className="px-3 py-2.5 text-sm">
                  <button
                    type="button"
                    className="text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:underline"
                    onClick={(e) => { e.stopPropagation(); onOpenStudent(r.email); }}
                  >
                    {r.name}
                  </button>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </td>
                <td className="px-3 py-2.5 text-sm">{r.batch_code}</td>
                <td className="px-3 py-2.5 text-sm">{brandOf(r)}</td>
                <td className="px-3 py-2.5 text-right"><Tag tone={scoreTone(r.score_total, 100)}><span className="sim-num">{r.score_total}</span></Tag></td>
                {cats.map((c) => (
                  <td key={c.key} className="sim-num px-3 py-2.5 text-right text-sm">{t ? `${t[c.key] ?? 0}/${c.max}` : "Not saved"}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface CohortAnalysisProps {
  rows: readonly AttemptRow[];
  onOpenStudent: (email: string) => void;
  /** Start filtered to this batch (e.g. the trainer's selected batch). */
  initialBatch?: string;
}

export function CohortAnalysis({ rows, onOpenStudent, initialBatch = ALL }: CohortAnalysisProps) {
  const [batch, setBatch] = useState(initialBatch);
  const [brand, setBrand] = useState(ALL);
  const [countMode, setCountMode] = useState<CountMode>("best");
  const versions = useMemo(() => versionsPresent(rows), [rows]);
  const [versionPick, setVersionPick] = useState<ScoreVersion | null>(null);
  const version: ScoreVersion = versionPick ?? versions[0] ?? 1;

  const batches = useMemo(() => distinctSorted(rows.map((r) => r.batch_code)), [rows]);
  const brands = useMemo(() => distinctSorted(rows.map(brandOf)), [rows]);

  const view = useMemo(() => {
    const filtered = filterAttempts(rows, { batch, brand, version });
    return countMode === "best" ? bestPerStudent(filtered) : filtered;
  }, [rows, batch, brand, version, countMode]);

  const cats = useMemo(() => categoryStats(view, version), [view, version]);
  const lines = useMemo(() => lineStats(view), [view]);
  const crises = useMemo(() => crisisStats(view), [view]);
  const withLines = view.filter((r) => attemptLines(r) !== null).length;
  const since = lineDetailSince(rows);

  const exportCohort = () => {
    try {
      const name = [batch === ALL ? "all-batches" : batch, brand === ALL ? "" : brand].filter(Boolean).join("-");
      downloadWorkbook(`blinkit-sim-cohort-${name}-${new Date().toISOString().slice(0, 10)}.xlsx`, buildCohortSheets(view), COHORT_README);
      toast.success(`Exported ${view.length} runs.`);
    } catch (err) {
      console.error("[cohort] Excel export failed", err);
      toast.error("We couldn't create the Excel file. Please try again.");
    }
  };

  if (rows.length === 0) {
    return <EmptyState title="No runs saved yet" description="Cohort analysis appears once students finish a 30-day run." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect id="cohort-batch" label="Batch" value={batch} onChange={setBatch}
            options={[{ value: ALL, label: "All batches" }, ...batches.map((b) => ({ value: b, label: b }))]} />
          <FilterSelect id="cohort-brand" label="Brand" value={brand} onChange={setBrand}
            options={[{ value: ALL, label: "All brands" }, ...brands.map((b) => ({ value: b, label: b }))]} />
          <FilterSelect id="cohort-count" label="Runs counted" value={countMode} onChange={(v) => setCountMode(v as CountMode)}
            options={[{ value: "best", label: "Best run per student" }, { value: "all", label: "Every run" }]} />
          {versions.length > 1 && (
            <FilterSelect id="cohort-version" label="Scoring" value={String(version)} onChange={(v) => setVersionPick(Number(v) as ScoreVersion)}
              options={versions.map((v) => ({ value: String(v), label: v === 2 ? "New scoring (v2)" : "Current scoring (v1)" }))} />
          )}
        </div>
        <Button variant="outline" onClick={exportCohort} disabled={view.length === 0} className="gap-2">
          <Download className="h-4 w-4" /> Export cohort to Excel
        </Button>
      </div>

      {view.length === 0 ? (
        <EmptyState title="No runs match these filters" description="Try a different batch or brand." />
      ) : (
        <>
          <Section
            title="Score by part"
            description={`${view.length} ${countMode === "best" ? "students (best run each)" : "runs"}. Bars show how many scored in each band of the part's points.`}
          >
            <CategoryOverview stats={cats} />
          </Section>

          <Section
            title="Where points were lost"
            description="Lines with the most points lost on average come first. Open a line for the levels students reached, the most common reasons, and what to teach next."
          >
            {withLines === 0 ? (
              <EmptyState
                title="No line-by-line scores in this view"
                description={since ? `Line scores are saved for runs finished on or after ${new Date(since).toLocaleDateString("en-IN")}.` : "These runs were saved before line scores were stored. New runs will fill this in."}
              />
            ) : (
              <>
                {withLines < view.length && (
                  <p className="mb-3 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    {view.length - withLines} of {view.length} runs were saved before line scores were stored, so they are left out of this table.
                  </p>
                )}
                <LineLossTable stats={lines} />
              </>
            )}
          </Section>

          {version === 1 && (
            <Section title="Crisis choices" description="Which option students picked in each crisis, and the points it was worth.">
              <CrisisBreakdown stats={crises} />
            </Section>
          )}

          <Section title="Students" description="Select a student to open their profile.">
            <StudentList rows={view} version={version} onOpenStudent={onOpenStudent} />
          </Section>
        </>
      )}
    </div>
  );
}

