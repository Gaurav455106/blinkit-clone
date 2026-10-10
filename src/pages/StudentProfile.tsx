// Student profile: every saved attempt, trends, points lost per line, strengths
// and gaps, and a plain-English summary of the latest run.
// Routes: /profile (the student's own), /admin/student/:email and
// /trainer/student/:email (staff view of any student).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { TrainerHeader } from "@/components/TrainerHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SimPage, PageHeader, StatTile, Section, EmptyState } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { CategoryTrendChart } from "@/components/profile/CategoryTrendChart";
import { LineGrid } from "@/components/profile/LineGrid";
import { AttemptsTable } from "@/components/profile/AttemptsTable";
import { StrengthsGaps } from "@/components/profile/StrengthsGaps";
import { ScoreSummary } from "@/components/results/ScoreSummary";
import { ScoreBreakdown } from "@/components/results/ScoreBreakdown";
import {
  attemptLines, attemptVersion, bestPerStudent, brandOf, gradeLabelOf, latestFirst, lineDetailSince, oldestFirst,
  strengthsAndGaps, versionsPresent, type AttemptRow,
} from "@/lib/attemptAnalysis";
import { qualitativeSummary } from "@/lib/rubrics";
import { buildProfileSheets, PROFILE_README } from "@/lib/profileExport";
import { downloadWorkbook } from "@/lib/excel";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; rows: AttemptRow[] };

function useStudentAttempts(email: string | null) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const load = useCallback(() => {
    if (!email) return;
    setState({ status: "loading" });
    supabase.from("attempts").select("*").eq("email", email).order("created_at", { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (error) {
          console.error("[profile] attempts load failed", error);
          setState({ status: "error", message: error.message });
          return;
        }
        setState({ status: "ready", rows: (data ?? []) as unknown as AttemptRow[] });
      });
  }, [email]);
  useEffect(load, [load]);
  return { state, reload: load };
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

function LoadingView() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading attempts">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

interface ProfileBodyProps {
  rows: AttemptRow[];
  isStaff: boolean;
}

function ProfileBody({ rows, isStaff }: ProfileBodyProps) {
  const latest = latestFirst(rows)[0];
  const best = bestPerStudent(rows)[0];
  const latestLines = attemptLines(latest);
  const latestVersion = attemptVersion(latest);
  const versions = versionsPresent(rows);
  const since = lineDetailSince(rows);
  const anyMissing = rows.some((r) => attemptLines(r) === null);
  const { strengths, gaps } = useMemo(() => strengthsAndGaps(rows.filter((r) => attemptVersion(r) === latestVersion)), [rows, latestVersion]);
  const average = Math.round(rows.reduce((s, r) => s + r.score_total, 0) / rows.length);

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Runs finished" value={rows.length} />
        <StatTile label="Latest score" value={`${latest.score_total} / 100`} tone={scoreTone(latest.score_total, 100)} hint={`${brandOf(latest)}, ${longDate(latest.created_at)}`} />
        <StatTile label="Best score" value={`${best.score_total} / 100`} tone={scoreTone(best.score_total, 100)} hint={`${brandOf(best)}, ${gradeLabelOf(best)}`} />
        <StatTile label="Average score" value={`${average} / 100`} tone={scoreTone(average, 100)} />
      </div>

      {latestLines
        ? <ScoreSummary summaries={qualitativeSummary(latestLines, latestVersion)} title="Your latest run in plain words" description={`${brandOf(latest)}, ${longDate(latest.created_at)}. What went well, where points were lost, and what to do first next time.`} />
        : (
          <Section title="Your latest run in plain words">
            <p className="text-sm text-muted-foreground">This run was saved before we stored a score for each line, so only the part totals are available.</p>
          </Section>
        )}

      {versions.map((v) => {
        const vRows = oldestFirst(rows.filter((r) => attemptVersion(r) === v));
        return (
          <Section
            key={`trend-${v}`}
            title={versions.length > 1 ? `How your parts changed (${v === 2 ? "new scoring" : "current scoring"})` : "How your parts changed"}
            description={vRows.length < 2 ? "Finish another run to see a trend." : "Share of points in each part, run by run."}
          >
            <CategoryTrendChart rows={vRows} version={v} />
          </Section>
        );
      })}

      {versions.map((v) => {
        const vRows = oldestFirst(rows.filter((r) => attemptVersion(r) === v));
        return (
          <Section
            key={`grid-${v}`}
            title="Points lost on each line"
            description="Each column is one run. A number shows the points lost on that line; Full means full marks. Hover a cell to see the reason."
          >
            {anyMissing && (
              <p className="mb-3 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                {since
                  ? `Line detail was not recorded for runs before ${longDate(since)}. Those runs show part totals only.`
                  : "Line detail was not recorded for these runs (they were saved before line scores were stored). They show part totals only."}
              </p>
            )}
            <LineGrid rows={vRows} version={v} />
          </Section>
        );
      })}

      <Section title="Strengths and gaps" description="Across all runs with line scores.">
        <StrengthsGaps strengths={strengths} gaps={gaps} />
      </Section>

      {latestLines && (
        <ScoreBreakdown
          lines={latestLines}
          version={latestVersion}
          showUnreachable={isStaff}
          title="Latest run, line by line"
          description="Open a line to see what was looked at, every level of points, and what would have earned more."
        />
      )}

      <Section title="All runs">
        <AttemptsTable rows={latestFirst(rows)} bestId={best.id} />
      </Section>
    </div>
  );
}

interface StudentProfileProps {
  email: string | null;
  isStaff: boolean;
}

export function StudentProfile({ email, isStaff }: StudentProfileProps) {
  const nav = useNavigate();
  const { state, reload } = useStudentAttempts(email);
  const rows = state.status === "ready" ? state.rows : [];
  const name = rows[0]?.name ?? (isStaff ? email ?? "Student" : "Your profile");
  const batch = rows[0]?.batch_code;

  const exportExcel = () => {
    try {
      downloadWorkbook(`blinkit-sim-profile-${name}-${new Date().toISOString().slice(0, 10)}.xlsx`, buildProfileSheets(rows), PROFILE_README);
      toast.success("Excel file downloaded.");
    } catch (err) {
      console.error("[profile] Excel export failed", err);
      toast.error("We couldn't create the Excel file. Please try again.");
    }
  };

  return (
    <SimPage>
      <PageHeader
        eyebrow={isStaff ? "Student profile" : "My profile"}
        title={name}
        description={[email, batch ? `Batch ${batch}` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="ghost" onClick={() => nav(-1)} className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button variant="outline" onClick={exportExcel} disabled={rows.length === 0} className="gap-2"><Download className="h-4 w-4" /> Export to Excel</Button>
          </>
        }
      />
      {!email && <EmptyState title="No student signed in" description="Sign in as a student to see your profile." />}
      {email && state.status === "loading" && <LoadingView />}
      {email && state.status === "error" && (
        <EmptyState
          title="We couldn't load the runs"
          description={`The database returned an error: ${state.message}`}
          action={<Button onClick={reload} className="gap-2"><RefreshCw className="h-4 w-4" /> Try again</Button>}
        />
      )}
      {email && state.status === "ready" && rows.length === 0 && (
        <EmptyState
          title="No finished runs yet"
          description={isStaff ? "This student hasn't saved a finished run." : "Finish a 30-day run and your score will appear here."}
          action={!isStaff ? <Button onClick={() => nav("/dashboard")}>Go to dashboard</Button> : undefined}
        />
      )}
      {state.status === "ready" && rows.length > 0 && <ProfileBody rows={rows} isStaff={isStaff} />}
    </SimPage>
  );
}

/** /profile: the signed-in student's own profile, next to the Blinkit sidebar. */
export default function MyProfilePage() {
  const { student } = useSim();
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <BlinkitSidebar />
      <div className="flex-1 overflow-y-auto bg-background">
        <StudentProfile email={student?.email ?? null} isStaff={false} />
      </div>
    </div>
  );
}

/** /admin/student/:email and /trainer/student/:email: staff view of any student. */
export function StaffStudentProfilePage() {
  const { email } = useParams<{ email: string }>();
  return (
    <div className="min-h-screen w-full bg-background">
      <TrainerHeader />
      <StudentProfile email={email ? decodeURIComponent(email) : null} isStaff />
    </div>
  );
}
