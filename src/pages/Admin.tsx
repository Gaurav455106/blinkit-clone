import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainerHeader } from "@/components/TrainerHeader";
import { api, errorMessage } from "@/lib/api";
import { SimPage, PageHeader, Section } from "@/components/sim/primitives";
import { BatchTable } from "@/components/admin/BatchTable";
import { BatchRail, type BatchLiveCount } from "@/components/admin/BatchRail";
import { BatchHeader } from "@/components/admin/BatchHeader";
import { StudentsTable } from "@/components/admin/StudentsTable";
import { ScoringGuide } from "@/components/admin/ScoringGuide";
import { CohortAnalysis } from "@/components/admin/CohortAnalysis";
import { CohortTab } from "@/components/admin/CohortTab";
import { useAllAttempts } from "@/components/admin/useAllAttempts";
import { ALL_BATCHES, LiveSessionsView, useLiveSummary } from "@/components/admin/LiveSessionsPanel";
import { ClearStaleDialog, DeleteBatchDialog, DeleteStudentDialog } from "@/components/admin/AdminDialogs";
import { bestPerStudent, summariseBatches, type AttemptRow } from "@/lib/attemptAnalysis";
import { attemptsToCsv, downloadCsv } from "@/lib/adminCsv";

const STALE_SESSION_DAYS = 7;
const ATTEMPT_LIMIT = 5000;

type AdminTab = "students" | "live" | "cohort" | "scoring";

function TabCount({ n, tone = "neutral" }: { n: number; tone?: "neutral" | "bad" }) {
  if (!n) return null;
  const cls = tone === "bad" ? "bg-sim-bad/10 text-sim-bad" : "bg-secondary text-muted-foreground";
  return <span className={`sim-num ml-1.5 rounded-full px-1.5 text-[11px] font-semibold ${cls}`}>{n}</span>;
}

export default function Admin() {
  const nav = useNavigate();
  const { rows, setRows, loading, error: loadError, reload } = useAllAttempts(ATTEMPT_LIMIT, "admin");
  const live = useLiveSummary(rows);
  const [search, setSearch] = useState("");
  const [activeBatch, setActiveBatch] = useState<string>(ALL_BATCHES);
  const [tab, setTab] = useState<AdminTab>("students");

  const [deleteTarget, setDeleteTarget] = useState<AttemptRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [staleSessionsOpen, setStaleSessionsOpen] = useState(false);
  const [staleSessionCount, setStaleSessionCount] = useState<number | null>(null);
  const [staleSessionsBusy, setStaleSessionsBusy] = useState(false);

  const isAll = activeBatch === ALL_BATCHES;
  const bestByEmail = useMemo(() => bestPerStudent(rows), [rows]);
  const batchSummaries = useMemo(() => summariseBatches(bestByEmail), [bestByEmail]);
  const inBatch = useMemo(() => (isAll ? bestByEmail : bestByEmail.filter((r) => r.batch_code === activeBatch)), [bestByEmail, activeBatch, isAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySearch = q ? inBatch.filter((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : inBatch;
    return [...bySearch].sort((a, b) => b.score_total - a.score_total);
  }, [inBatch, search]);

  // The header's numbers: one batch's summary, or every student pooled together
  const summary = useMemo(() => {
    if (!isAll) return batchSummaries.find((b) => b.batch === activeBatch) ?? null;
    return summariseBatches(bestByEmail.map((r) => ({ ...r, batch_code: ALL_BATCHES })))[0] ?? null;
  }, [isAll, activeBatch, batchSummaries, bestByEmail]);

  const liveByBatch = useMemo(() => {
    const counts = new Map<string, BatchLiveCount>();
    for (const s of live.sessions) {
      const c = counts.get(s.batch) ?? { live: 0, unsaved: 0 };
      counts.set(s.batch, { live: c.live + 1, unsaved: c.unsaved + (s.status === "unsaved" ? 1 : 0) });
    }
    return counts;
  }, [live.sessions]);
  const liveHere = useMemo(() => (isAll ? live.sessions : live.sessions.filter((s) => s.batch === activeBatch)), [live.sessions, activeBatch, isAll]);
  const unsavedHere = liveHere.filter((s) => s.status === "unsaved").length;

  const overallAvg = bestByEmail.length ? Math.round(bestByEmail.reduce((s, x) => s + x.score_total, 0) / bestByEmail.length) : 0;
  const openProfile = (email: string) => nav(`/admin/student/${encodeURIComponent(email)}`);
  const selectBatch = (b: string) => { setActiveBatch(b); setSearch(""); };

  // ── Deletes ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Deletes ALL attempts by this email (not just the best)
    const error = await api<null>("DELETE", "/api/admin", { query: { target: "student", email: deleteTarget.email } })
      .then(() => null, (err: unknown) => errorMessage(err));
    setDeleting(false);
    if (error) toast.error(`Delete failed: ${error}`);
    else {
      toast.success(`Deleted all runs for ${deleteTarget.name}`);
      setRows((prev) => prev.filter((r) => r.email !== deleteTarget.email));
    }
    setDeleteTarget(null);
  };

  const confirmBatchDelete = async () => {
    if (!batchDeleteTarget) return;
    setBatchDeleting(true);
    // The server deletes the batch's attempts, then (best-effort) its live-session rows
    const error = await api<null>("DELETE", "/api/admin", { query: { target: "batch", batch: batchDeleteTarget } })
      .then(() => null, (err: unknown) => errorMessage(err));
    setBatchDeleting(false);
    if (error) toast.error(`Batch delete failed: ${error}`);
    else {
      toast.success(`Deleted all runs for batch ${batchDeleteTarget}`);
      setRows((prev) => prev.filter((r) => r.batch_code !== batchDeleteTarget));
      if (activeBatch === batchDeleteTarget) setActiveBatch(ALL_BATCHES);
    }
    setBatchDeleteTarget(null);
  };

  // ── Stale live-session cleanup (manual) ─────────────────────────────────────
  const openStaleSessions = async () => {
    try {
      const { count } = await api<{ count: number }>("GET", "/api/staff", { query: { view: "stale-count", days: STALE_SESSION_DAYS } });
      setStaleSessionCount(count);
      setStaleSessionsOpen(true);
    } catch (err) {
      toast.error(`Couldn't check stale sessions: ${errorMessage(err)}`);
    }
  };
  const closeStaleSessions = () => { setStaleSessionsOpen(false); setStaleSessionCount(null); };
  const confirmClearStaleSessions = async () => {
    setStaleSessionsBusy(true);
    const error = await api<null>("DELETE", "/api/admin", { query: { target: "stale", days: STALE_SESSION_DAYS } })
      .then(() => null, (err: unknown) => errorMessage(err));
    setStaleSessionsBusy(false);
    if (error) toast.error(`Clear failed: ${error}`);
    else {
      toast.success(`Cleared ${staleSessionCount ?? 0} stale live session(s). Saved scores are untouched.`);
      live.reload();
    }
    closeStaleSessions();
  };

  const exportList = (list: readonly AttemptRow[], label: string) => {
    downloadCsv(attemptsToCsv(list), `blinkit-sim-${label}-${Date.now()}.csv`);
    toast.success(`Exported ${list.length} records`);
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <TrainerHeader />
      <SimPage wide>
        <PageHeader
          eyebrow="Admin"
          title="Admin panel"
          description="Pick a batch to see its students, who is playing now, where they lose points, and how they are judged."
        />

        <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="max-h-72 overflow-y-auto lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start">
            <BatchRail
              batches={batchSummaries}
              liveByBatch={liveByBatch}
              allLabel={ALL_BATCHES}
              totalStudents={bestByEmail.length}
              overallAvg={overallAvg}
              active={activeBatch}
              onSelect={selectBatch}
            />
          </aside>

          <div className="min-w-0 space-y-5">
            <BatchHeader
              batch={isAll ? null : activeBatch}
              students={inBatch.length}
              avg={summary?.avg ?? 0}
              top={summary?.top ?? null}
              commonLoss={summary?.commonLoss ?? null}
              live={liveHere.length}
              onExport={() => exportList(inBatch, isAll ? "all" : activeBatch)}
              onExportAll={() => exportList(bestByEmail, "all")}
              onClearStale={openStaleSessions}
              onDeleteBatch={() => setBatchDeleteTarget(activeBatch)}
            />

            {unsavedHere > 0 && tab !== "live" && (
              <button
                type="button"
                onClick={() => setTab("live")}
                className="flex w-full items-center gap-2 rounded-xl bg-sim-bad/10 px-4 py-2.5 text-left text-sm text-sim-bad hover:bg-sim-bad/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">
                  {unsavedHere} {unsavedHere === 1 ? "student finished but their score wasn't" : "students finished but their scores weren't"} saved.
                </span>
                <span className="flex items-center gap-1 font-medium">See who <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
              </button>
            )}

            <Tabs value={tab} onValueChange={(v) => setTab(v as AdminTab)} className="space-y-5">
              <TabsList>
                <TabsTrigger value="students">Students<TabCount n={inBatch.length} /></TabsTrigger>
                <TabsTrigger value="live">Live now<TabCount n={liveHere.length} tone={unsavedHere ? "bad" : "neutral"} /></TabsTrigger>
                <TabsTrigger value="cohort">Cohort analysis</TabsTrigger>
                <TabsTrigger value="scoring">How students are judged</TabsTrigger>
              </TabsList>

              <TabsContent value="students" className="space-y-5">
                {isAll && batchSummaries.length > 1 && (
                  <Section title="Batches compared" description="Open a batch to see only its students.">
                    <BatchTable batches={batchSummaries} activeBatch={activeBatch} loading={loading} onSelect={selectBatch} />
                  </Section>
                )}
                <Section
                  title={isAll ? "Every student" : `Students in ${activeBatch}`}
                  description="Best run per student, highest first. Open a row for details, or the profile for every run."
                  actions={
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search students by name or email" className="h-8 w-56 pl-8 text-sm" />
                    </div>
                  }
                >
                  <StudentsTable
                    rows={filtered}
                    allRows={rows}
                    loading={loading}
                    error={loadError}
                    onRetry={reload}
                    onOpenProfile={openProfile}
                    onDelete={setDeleteTarget}
                    showBatch={isAll}
                  />
                </Section>
              </TabsContent>

              <TabsContent value="live">
                <LiveSessionsView
                  sessions={liveHere}
                  loading={live.loading}
                  error={live.error}
                  loadedAt={live.loadedAt}
                  onRefresh={live.reload}
                  batchLabel={isAll ? undefined : activeBatch}
                  showBatch={isAll}
                />
              </TabsContent>

              <TabsContent value="cohort">
                <CohortTab loading={loading} error={loadError} onRetry={reload}>
                  <CohortAnalysis key={activeBatch} rows={rows} onOpenStudent={openProfile} initialBatch={isAll ? undefined : activeBatch} />
                </CohortTab>
              </TabsContent>
              <TabsContent value="scoring">
                <ScoringGuide />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SimPage>

      <DeleteStudentDialog target={deleteTarget} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <DeleteBatchDialog
        batch={batchDeleteTarget}
        students={bestByEmail.filter((r) => r.batch_code === batchDeleteTarget).length}
        busy={batchDeleting}
        onCancel={() => setBatchDeleteTarget(null)}
        onConfirm={confirmBatchDelete}
      />
      <ClearStaleDialog
        open={staleSessionsOpen}
        count={staleSessionCount}
        days={STALE_SESSION_DAYS}
        busy={staleSessionsBusy}
        onCancel={closeStaleSessions}
        onConfirm={confirmClearStaleSessions}
      />
    </div>
  );
}
