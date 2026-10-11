import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainerHeader } from "@/components/TrainerHeader";
import { supabase } from "@/integrations/supabase/client";
import { Search, Trash2, Download, AlertTriangle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SimPage, PageHeader, StatTile, Section } from "@/components/sim/primitives";
import { BatchTable } from "@/components/admin/BatchTable";
import { StudentsTable } from "@/components/admin/StudentsTable";
import { CohortAnalysis } from "@/components/admin/CohortAnalysis";
import { CohortTab } from "@/components/admin/CohortTab";
import { useAllAttempts } from "@/components/admin/useAllAttempts";
import { attemptCampaigns, attemptTotals, bestPerStudent, brandOf, summariseBatches, type AttemptRow } from "@/lib/attemptAnalysis";
import { formatLabel } from "@/lib/resultsExport";

const ALL_BATCHES = "All";
const STALE_SESSION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const ATTEMPT_LIMIT = 5000;

// ── CSV export (kept from v1; the cohort tab also exports a full Excel file) ──
function toCSV(rows: readonly AttemptRow[]): string {
  const headers = [
    "Name", "Email", "Batch", "Brand", "Score",
    "Setup", "Live Opt", "Crisis", "Results",
    "Crisis Choice", "Crisis Points",
    "Campaign Formats", "Total Campaigns",
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) => {
    const t = attemptTotals(r);
    const campaigns = attemptCampaigns(r);
    return [
      r.name, r.email, r.batch_code, brandOf(r), r.score_total,
      t?.setup ?? "", t?.liveOpt ?? t?.live ?? "", t?.crisis ?? t?.eventsRohit ?? "", t?.results ?? "",
      r.crisis_choice ?? "", r.crisis_points ?? 0,
      campaigns.map((c) => formatLabel(c.adFormat)).join("; "), campaigns.length,
    ].map(escape).join(",");
  });
  return [headers.map(escape).join(","), ...body].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Admin() {
  const nav = useNavigate();
  const { rows, setRows, loading, error: loadError, reload } = useAllAttempts(ATTEMPT_LIMIT, "admin");
  const [search, setSearch] = useState("");
  const [activeBatch, setActiveBatch] = useState<string>(ALL_BATCHES);
  const [deleteTarget, setDeleteTarget] = useState<AttemptRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Batch-level delete (typed confirmation — higher blast radius than a single student)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState("");
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Manual "clear stale live sessions" (replaces the old nightly auto-cleanup)
  const [staleSessionsOpen, setStaleSessionsOpen] = useState(false);
  const [staleSessionCount, setStaleSessionCount] = useState<number | null>(null);
  const [staleSessionsBusy, setStaleSessionsBusy] = useState(false);

  const bestByEmail = useMemo(() => bestPerStudent(rows), [rows]);
  const batches = useMemo(() => [ALL_BATCHES, ...Array.from(new Set(bestByEmail.map((r) => r.batch_code))).sort()], [bestByEmail]);

  const filtered = useMemo(() => {
    const byBatch = activeBatch === ALL_BATCHES ? bestByEmail : bestByEmail.filter((r) => r.batch_code === activeBatch);
    const q = search.trim().toLowerCase();
    const bySearch = q ? byBatch.filter((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) : byBatch;
    return [...bySearch].sort((a, b) => b.score_total - a.score_total);
  }, [bestByEmail, activeBatch, search]);

  const totalStudents = bestByEmail.length;
  const totalBatches = batches.length - 1;
  const overallAvg = totalStudents ? Math.round(bestByEmail.reduce((s, x) => s + x.score_total, 0) / totalStudents) : 0;
  const batchSummaries = useMemo(() => summariseBatches(bestByEmail), [bestByEmail]);
  const openProfile = (email: string) => nav(`/admin/student/${encodeURIComponent(email)}`);

  // ── Delete handler ──────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete ALL attempts by this email (not just best)
    const { error } = await supabase.from("attempts").delete().eq("email", deleteTarget.email);
    setDeleting(false);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
    } else {
      toast.success(`Deleted all runs for ${deleteTarget.name}`);
      setRows((prev) => prev.filter((r) => r.email !== deleteTarget.email));
    }
    setDeleteTarget(null);
  };

  // ── Batch delete handler ────────────────────────────────────────────────────
  const confirmBatchDelete = async () => {
    if (!batchDeleteTarget) return;
    setBatchDeleting(true);
    const { error } = await supabase.from("attempts").delete().eq("batch_code", batchDeleteTarget);
    if (!error) {
      // Best-effort — stale live-session rows for this batch aren't worth blocking on.
      const { error: sessionError } = await supabase.from("run_sessions").delete().eq("batch_code", batchDeleteTarget);
      if (sessionError) console.warn("[admin] run_sessions batch delete failed", sessionError);
    }
    setBatchDeleting(false);
    if (error) {
      toast.error(`Batch delete failed: ${error.message}`);
    } else {
      toast.success(`Deleted all runs for batch ${batchDeleteTarget}`);
      setRows((prev) => prev.filter((r) => r.batch_code !== batchDeleteTarget));
      if (activeBatch === batchDeleteTarget) setActiveBatch(ALL_BATCHES);
    }
    setBatchDeleteTarget(null);
    setBatchDeleteConfirm("");
  };

  // ── Stale live-session cleanup (manual — replaces the old nightly cron) ─────
  const staleCutoff = () => new Date(Date.now() - STALE_SESSION_DAYS * DAY_MS).toISOString();

  const openStaleSessions = async () => {
    const { count, error } = await supabase
      .from("run_sessions")
      .select("*", { count: "exact", head: true })
      .lt("last_seen_at", staleCutoff());
    if (error) { toast.error(`Couldn't check stale sessions: ${error.message}`); return; }
    setStaleSessionCount(count ?? 0);
    setStaleSessionsOpen(true);
  };

  const closeStaleSessions = () => { setStaleSessionsOpen(false); setStaleSessionCount(null); };

  const confirmClearStaleSessions = async () => {
    setStaleSessionsBusy(true);
    const { error } = await supabase.from("run_sessions").delete().lt("last_seen_at", staleCutoff());
    setStaleSessionsBusy(false);
    if (error) {
      toast.error(`Clear failed: ${error.message}`);
    } else {
      toast.success(`Cleared ${staleSessionCount ?? 0} stale live session(s). Saved scores are untouched.`);
    }
    closeStaleSessions();
  };

  // ── CSV exports ─────────────────────────────────────────────────────────────
  const exportList = (list: readonly AttemptRow[], label: string) => {
    downloadCSV(toCSV(list), `blinkit-sim-${label}-${Date.now()}.csv`);
    toast.success(`Exported ${list.length} records`);
  };
  const exportBatch = () => exportList(activeBatch === ALL_BATCHES ? bestByEmail : bestByEmail.filter((r) => r.batch_code === activeBatch), activeBatch);

  const closeBatchDelete = () => { setBatchDeleteTarget(null); setBatchDeleteConfirm(""); };

  return (
    <div className="min-h-screen w-full bg-background">
      <TrainerHeader />
      <SimPage wide>
        <PageHeader
          eyebrow="Admin"
          title="Admin panel"
          description="Every saved run. Find where students lose points, open any profile, export data, and delete records."
          actions={
            <>
              <Button variant="outline" className="gap-2" onClick={openStaleSessions}><Clock className="h-4 w-4" /> Clear stale sessions</Button>
              <Button variant="outline" className="gap-2" onClick={exportBatch}><Download className="h-4 w-4" /> Export {activeBatch === ALL_BATCHES ? "all" : activeBatch} CSV</Button>
              {activeBatch !== ALL_BATCHES && (
                <Button variant="outline" className="gap-2" onClick={() => exportList(bestByEmail, "all")}><Download className="h-4 w-4" /> Export all CSV</Button>
              )}
            </>
          }
        />

        <div className="mb-6 flex items-center gap-2 rounded-xl bg-sim-warn/10 px-4 py-2.5 text-sm text-sim-warn">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Deleting here removes student data for good. It can't be undone.
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Students" value={totalStudents} />
          <StatTile label="Batches" value={totalBatches} />
          <StatTile label="Average best score" value={`${overallAvg} / 100`} />
        </div>

        <Tabs defaultValue="students" className="space-y-6">
          <TabsList>
            <TabsTrigger value="students">Students and batches</TabsTrigger>
            <TabsTrigger value="cohort">Cohort analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6">
            <Section title="Batches" description="Select a batch to filter the student list.">
              <BatchTable
                batches={batchSummaries}
                activeBatch={activeBatch}
                loading={loading}
                onSelect={(b) => setActiveBatch((prev) => (prev === b ? ALL_BATCHES : b))}
                renderActions={(batch) => (
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => exportList(bestByEmail.filter((r) => r.batch_code === batch), batch)}>
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10" onClick={() => setBatchDeleteTarget(batch)} title="Delete entire batch">
                      <Trash2 className="h-3.5 w-3.5" /> Delete batch
                    </Button>
                  </div>
                )}
              />
            </Section>

            <Section
              title="Students"
              description="Best run per student. Open a row for details, or the profile for every run. The bin deletes all of a student's runs."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by batch">
                    {batches.map((b) => (
                      <button
                        key={b}
                        type="button"
                        aria-pressed={activeBatch === b}
                        onClick={() => setActiveBatch(b)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${activeBatch === b ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                      >{b}</button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search students by name or email" className="h-8 w-56 pl-8 text-sm" />
                  </div>
                </div>
              }
            >
              <StudentsTable rows={filtered} loading={loading} error={loadError} onRetry={reload} onOpenProfile={openProfile} onDelete={setDeleteTarget} />
            </Section>
          </TabsContent>

          <TabsContent value="cohort">
            <CohortTab loading={loading} error={loadError} onRetry={reload}>
              <CohortAnalysis key={activeBatch} rows={rows} onOpenStudent={openProfile} initialBatch={activeBatch === ALL_BATCHES ? undefined : activeBatch} />
            </CohortTab>
          </TabsContent>
        </Tabs>
      </SimPage>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sim-ui max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete this student's runs?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This deletes every run saved for <span className="font-semibold text-foreground">{deleteTarget?.name}</span> ({deleteTarget?.email}). It can't be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete for good"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch delete confirmation dialog — typed confirmation, higher blast radius */}
      <Dialog open={!!batchDeleteTarget} onOpenChange={(o) => { if (!o) closeBatchDelete(); }}>
        <DialogContent className="sim-ui max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete the whole batch?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This deletes the runs of <span className="font-semibold text-foreground">{bestByEmail.filter((r) => r.batch_code === batchDeleteTarget).length}</span> students
            in batch <span className="font-semibold text-foreground">{batchDeleteTarget}</span>. It can't be undone. Export a CSV first if you need the data.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="batch-confirm" className="text-xs font-semibold text-foreground">
              Type <span className="font-mono">{batchDeleteTarget}</span> to confirm
            </label>
            <Input id="batch-confirm" value={batchDeleteConfirm} onChange={(e) => setBatchDeleteConfirm(e.target.value)} placeholder={batchDeleteTarget ?? ""} autoComplete="off" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeBatchDelete}>Cancel</Button>
            <Button variant="destructive" onClick={confirmBatchDelete} disabled={batchDeleting || batchDeleteConfirm !== batchDeleteTarget}>
              {batchDeleting ? "Deleting…" : "Delete batch for good"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stale live-session cleanup dialog — manual, replaces the old nightly cron */}
      <Dialog open={staleSessionsOpen} onOpenChange={(o) => { if (!o) closeStaleSessions(); }}>
        <DialogContent className="sim-ui max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-sim-warn" /> Clear stale live sessions?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {staleSessionCount === 0
              ? `No live session has been inactive for more than ${STALE_SESSION_DAYS} days, so there is nothing to clear.`
              : <>This removes <span className="font-semibold text-foreground">{staleSessionCount}</span> "in progress"
                  marker{staleSessionCount === 1 ? "" : "s"} inactive for over {STALE_SESSION_DAYS} days.
                  It only clears in-progress trackers. Saved scores and runs are <span className="font-semibold">not</span> touched.</>}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeStaleSessions}>Cancel</Button>
            <Button onClick={confirmClearStaleSessions} disabled={staleSessionsBusy || !staleSessionCount}>
              {staleSessionsBusy ? "Clearing…" : "Clear stale sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
