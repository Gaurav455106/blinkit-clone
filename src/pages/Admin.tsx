import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrainerHeader } from "@/components/TrainerHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, GraduationCap, TrendingUp, Search,
  ChevronDown, ChevronUp, Trash2, Download, AlertTriangle, Clock,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Attempt {
  id: string;
  name: string;
  email: string;
  batch_code: string;
  score_total: number;
  score_breakdown: any;
  profile_id: string;
  crisis_choice: string | null;
  crisis_points: number;
  choices: any;
  snapshot: any;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function mode(arr: string[]) {
  const m = new Map<string, number>();
  for (const x of arr) if (x) m.set(x, (m.get(x) ?? 0) + 1);
  let best = ""; let n = 0;
  for (const [k, v] of m) if (v > n) { best = k; n = v; }
  return best;
}

function gradeLabel(score: number) {
  if (score >= 90) return { label: "Promoted",    color: "bg-emerald-100 text-emerald-700" };
  if (score >= 75) return { label: "Distinction", color: "bg-blue-100 text-blue-700" };
  if (score >= 60) return { label: "Pass",        color: "bg-slate-100 text-slate-700" };
  return              { label: "Needs Work",   color: "bg-red-100 text-red-700" };
}

const FORMAT_LABELS: Record<string, string> = {
  product_booster:    "Product Booster",
  recommendation_ads: "Recommendation Ads",
  listing_spotlight:  "Listing Spotlight",
  brand_booster:      "Brand Booster",
  stories:            "Stories Ad",
};

// ── CSV export ─────────────────────────────────────────────────────────────────
function toCSV(rows: Attempt[]) {
  const headers = [
    "Name", "Email", "Batch", "Brand", "Score",
    "Setup", "Live Opt", "Crisis", "Results",
    "Crisis Choice", "Crisis Points",
    "Campaign Formats", "Total Campaigns",
  ];
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const body = rows.map((r) => {
    const bd = r.score_breakdown ?? r.snapshot?.score_breakdown ?? {};
    const campaigns: any[] = r.snapshot?.campaigns ?? [];
    const formats = campaigns.filter((c) => !c.isDraft).map((c) => FORMAT_LABELS[c.adFormat] ?? c.adFormat).join("; ");
    return [
      r.name, r.email, r.batch_code, r.profile_id, r.score_total,
      typeof bd === "object" ? (bd.setup   ?? "") : "",
      typeof bd === "object" ? (bd.liveOpt ?? "") : "",
      typeof bd === "object" ? (bd.crisis  ?? "") : "",
      typeof bd === "object" ? (bd.results ?? "") : "",
      r.crisis_choice ?? "", r.crisis_points,
      formats, campaigns.filter((c) => !c.isDraft).length,
    ].map(escape).join(",");
  });

  return [headers.map(escape).join(","), ...body].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Student admin row ─────────────────────────────────────────────────────────
function AdminStudentRow({
  row, onDelete,
}: { row: Attempt; onDelete: (r: Attempt) => void }) {
  const [open, setOpen] = useState(false);
  const grade = gradeLabel(row.score_total);
  const snap  = row.snapshot as any;

  const breakdown: { label: string; earned: number; max: number }[] = useMemo(() => {
    const bd = snap?.score_breakdown ?? row.score_breakdown;
    if (!bd) return [];
    if (Array.isArray(bd)) return bd;
    if (typeof bd === "object") return [
      { label: "Setup",    earned: bd.setup   ?? 0, max: 30 },
      { label: "Live Opt", earned: bd.liveOpt ?? 0, max: 25 },
      { label: "Crisis",   earned: bd.crisis  ?? 0, max: 20 },
      { label: "Results",  earned: bd.results ?? 0, max: 25 },
    ];
    return [];
  }, [snap, row.score_breakdown]);

  const campaigns: any[]                   = snap?.campaigns ?? [];
  const crisisResponses: Record<string, any> = snap?.crisisResponses ?? {};

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/30 transition-colors">
        <td className="p-3 text-sm font-medium cursor-pointer" onClick={() => setOpen((o) => !o)}>{row.name}</td>
        <td className="p-3 text-sm text-muted-foreground cursor-pointer" onClick={() => setOpen((o) => !o)}>{row.email}</td>
        <td className="p-3 text-sm cursor-pointer" onClick={() => setOpen((o) => !o)}>{row.batch_code}</td>
        <td className="p-3 text-sm cursor-pointer" onClick={() => setOpen((o) => !o)}>{row.profile_id}</td>
        <td className="p-3 cursor-pointer" onClick={() => setOpen((o) => !o)}>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${grade.color}`}>
            {row.score_total} · {grade.label}
          </span>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-1 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); onDelete(row); }}
              title="Delete attempt"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border bg-amber-50/30">
          <td colSpan={6} className="p-4">
            <div className="grid grid-cols-3 gap-4">

              {/* Score breakdown */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Score Breakdown</p>
                <div className="space-y-1.5">
                  {breakdown.length === 0 && <p className="text-xs text-muted-foreground">No breakdown available</p>}
                  {breakdown.map((b, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-muted-foreground">{b.label}</span>
                        <span className="font-medium">{Math.round(b.earned)}/{b.max}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.min(100, (b.earned / b.max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-border mt-2 flex justify-between text-xs font-semibold">
                    <span>Total</span><span>{row.score_total}/100</span>
                  </div>
                </div>
              </div>

              {/* Campaigns */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">
                  Campaigns ({campaigns.filter((c: any) => !c.isDraft).length} active)
                </p>
                {campaigns.length === 0 && <p className="text-xs text-muted-foreground">No campaign data</p>}
                <div className="space-y-2">
                  {campaigns.filter((c: any) => !c.isDraft).map((c: any) => (
                    <div key={c.id} className="text-[11px] bg-card border border-border rounded p-2">
                      <div className="font-medium text-foreground truncate">{c.name}</div>
                      <div className="text-muted-foreground mt-0.5">
                        {FORMAT_LABELS[c.adFormat] ?? c.adFormat} · {c.objective} · ₹{(c.budget ?? 0).toLocaleString("en-IN")}
                      </div>
                      {c.geography && (
                        <div className="text-muted-foreground">
                          {c.geography === "pan_india" ? "Pan India" : (c.cities ?? []).join(", ")}
                        </div>
                      )}
                      {c.keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(c.keywords as string[]).slice(0, 3).map((kw) => (
                            <span key={kw} className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px]">{kw}</span>
                          ))}
                          {c.keywords.length > 3 && (
                            <span className="text-muted-foreground text-[10px]">+{c.keywords.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Crisis decisions */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Crisis Decisions</p>
                {Object.keys(crisisResponses).length === 0 && <p className="text-xs text-muted-foreground">No crisis data</p>}
                <div className="space-y-2">
                  {Object.values(crisisResponses).map((cr: any) => {
                    const pts = cr.score ?? 0; const max = cr.maxScore ?? 20;
                    const pct = max > 0 ? pts / max : 0;
                    const color = pct >= 0.8 ? "text-emerald-600" : pct >= 0.5 ? "text-amber-600" : "text-red-500";
                    return (
                      <div key={cr.crisisId} className="text-[11px] bg-card border border-border rounded p-2">
                        <div className="flex justify-between">
                          <span className="font-medium text-foreground">Crisis {cr.crisisNum} · Day {cr.day}</span>
                          <span className={`font-semibold ${color}`}>{pts}/{max}</span>
                        </div>
                        <div className="text-muted-foreground mt-0.5 truncate">
                          Option {cr.optionKey?.toUpperCase()}: {cr.optionLabel ?? "—"}
                        </div>
                        {cr.effectLabel && <div className="text-muted-foreground italic truncate">{cr.effectLabel}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Admin() {
  const [rows,        setRows]        = useState<Attempt[]>([]);
  const [search,      setSearch]      = useState("");
  const [activeBatch, setActiveBatch] = useState<string>("All");
  const [loading,     setLoading]     = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Attempt | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  // Batch-level delete (typed confirmation — higher blast radius than a single student)
  const [batchDeleteTarget,  setBatchDeleteTarget]  = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState("");
  const [batchDeleting,      setBatchDeleting]      = useState(false);

  // Manual "clear stale live sessions" (replaces the old nightly auto-cleanup)
  const [staleSessionsOpen,  setStaleSessionsOpen]  = useState(false);
  const [staleSessionCount,  setStaleSessionCount]  = useState<number | null>(null);
  const [staleSessionsBusy,  setStaleSessionsBusy]  = useState(false);
  const STALE_SESSION_DAYS = 7;

  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setLoadError(null);
    supabase.from("attempts").select("*").order("created_at", { ascending: false }).limit(5000)
      .then(({ data, error }) => {
        // Previously `error` was ignored, so a failed read rendered an empty table
        // and looked identical to "no scores recorded". Always surface it.
        if (error) {
          console.error("[admin] attempts load failed", error);
          setLoadError(error.message);
          toast.error(`Couldn't load attempts: ${error.message}`);
        }
        setRows((data as any) ?? []);
        setLoading(false);
      });
  };
  useEffect(fetchData, []);

  // Best attempt per student
  const bestByEmail = useMemo(() => {
    const m = new Map<string, Attempt>();
    for (const r of rows) {
      const p = m.get(r.email);
      if (!p || r.score_total > p.score_total) m.set(r.email, r);
    }
    return Array.from(m.values());
  }, [rows]);

  const batches = useMemo(() => {
    const s = new Set(bestByEmail.map((r) => r.batch_code));
    return ["All", ...Array.from(s).sort()];
  }, [bestByEmail]);

  const filtered = useMemo(() => {
    let list = bestByEmail;
    if (activeBatch !== "All") list = list.filter((r) => r.batch_code === activeBatch);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.score_total - a.score_total);
  }, [bestByEmail, activeBatch, search]);

  const totalStudents = bestByEmail.length;
  const totalBatches  = batches.length - 1;
  const overallAvg    = totalStudents
    ? Math.round(bestByEmail.reduce((s, x) => s + x.score_total, 0) / totalStudents)
    : 0;

  const batchSummaries = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const r of bestByEmail) {
      if (!m.has(r.batch_code)) m.set(r.batch_code, []);
      m.get(r.batch_code)!.push(r);
    }
    return Array.from(m.entries()).map(([batch, members]) => {
      const avg = Math.round(members.reduce((s, x) => s + x.score_total, 0) / members.length);
      const top = members.slice().sort((a, b) => b.score_total - a.score_total)[0];
      const worsts = members.map((m) => {
        const arr: any[] = Array.isArray(m.score_breakdown) ? m.score_breakdown : [];
        return arr.slice().sort((a: any, b: any) => (a.earned / a.max) - (b.earned / b.max))[0]?.label ?? "";
      });
      return { batch, count: members.length, avg, top, mistake: mode(worsts) || "—" };
    }).sort((a, b) => a.batch.localeCompare(b.batch));
  }, [bestByEmail]);

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
      toast.success(`Deleted all attempts for ${deleteTarget.name}`);
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
      await supabase.from("run_sessions").delete().eq("batch_code", batchDeleteTarget);
    }
    setBatchDeleting(false);
    if (error) {
      toast.error(`Batch delete failed: ${error.message}`);
    } else {
      toast.success(`Deleted all attempts for batch ${batchDeleteTarget}`);
      setRows((prev) => prev.filter((r) => r.batch_code !== batchDeleteTarget));
      if (activeBatch === batchDeleteTarget) setActiveBatch("All");
    }
    setBatchDeleteTarget(null);
    setBatchDeleteConfirm("");
  };

  // ── Stale live-session cleanup (manual — replaces the old nightly cron) ─────
  const openStaleSessions = async () => {
    const cutoff = new Date(Date.now() - STALE_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("run_sessions")
      .select("*", { count: "exact", head: true })
      .lt("last_seen_at", cutoff);
    if (error) { toast.error(`Couldn't check stale sessions: ${error.message}`); return; }
    setStaleSessionCount(count ?? 0);
    setStaleSessionsOpen(true);
  };

  const confirmClearStaleSessions = async () => {
    setStaleSessionsBusy(true);
    const cutoff = new Date(Date.now() - STALE_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("run_sessions").delete().lt("last_seen_at", cutoff);
    setStaleSessionsBusy(false);
    if (error) {
      toast.error(`Clear failed: ${error.message}`);
    } else {
      toast.success(`Cleared ${staleSessionCount ?? 0} stale live session(s). Saved scores are untouched.`);
    }
    setStaleSessionsOpen(false);
    setStaleSessionCount(null);
  };

  // ── CSV exports ─────────────────────────────────────────────────────────────
  const exportBatch = () => {
    const list = activeBatch === "All" ? bestByEmail : bestByEmail.filter((r) => r.batch_code === activeBatch);
    downloadCSV(toCSV(list), `blinkit-sim-${activeBatch}-${Date.now()}.csv`);
    toast.success(`Exported ${list.length} records`);
  };

  const exportAll = () => {
    downloadCSV(toCSV(bestByEmail), `blinkit-sim-all-${Date.now()}.csv`);
    toast.success(`Exported ${bestByEmail.length} records`);
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <TrainerHeader />

      {/* Admin banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-8 py-2 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-xs text-amber-700 font-medium">Admin Panel — changes here affect all student data permanently</span>
      </div>

      <div className="px-8 py-6 max-w-6xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Full data access · delete records · export CSVs</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={openStaleSessions}>
              <Clock className="h-3.5 w-3.5" /> Clear Stale Sessions
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={exportBatch}>
              <Download className="h-3.5 w-3.5" />
              Export {activeBatch === "All" ? "All" : activeBatch} CSV
            </Button>
            {activeBatch !== "All" && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={exportAll}>
                <Download className="h-3.5 w-3.5" /> Export All CSV
              </Button>
            )}
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<Users className="h-5 w-5" />}         label="Total Students"   value={totalStudents} amber />
          <StatCard icon={<GraduationCap className="h-5 w-5" />} label="Active Batches"   value={totalBatches}  amber />
          <StatCard icon={<TrendingUp className="h-5 w-5" />}    label="Overall Avg Score" value={overallAvg}   amber />
        </div>

        {/* Batch overview */}
        <Card className="p-0 overflow-hidden border-amber-200">
          <div className="p-4 border-b border-border bg-amber-50/40">
            <h3 className="text-sm font-semibold">Batch Overview</h3>
            <p className="text-xs text-muted-foreground">Click a row to filter the student list below</p>
          </div>
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {["Batch", "Students", "Avg Score", "Top Student", "Most Common Mistake", ""].map((h) => (
                  <th key={h} className="p-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batchSummaries.map(({ batch, count, avg, top, mistake }) => (
                <tr
                  key={batch}
                  className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => setActiveBatch((prev) => prev === batch ? "All" : batch)}
                >
                  <td className="p-3 text-sm font-medium">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      activeBatch === batch
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>{batch}</span>
                  </td>
                  <td className="p-3 text-sm">{count}</td>
                  <td className="p-3 text-sm font-semibold">{avg}</td>
                  <td className="p-3 text-sm">{top?.name} ({top?.score_total})</td>
                  <td className="p-3 text-sm text-muted-foreground">{mistake}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] text-muted-foreground gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          const list = bestByEmail.filter((r) => r.batch_code === batch);
                          downloadCSV(toCSV(list), `blinkit-sim-${batch}-${Date.now()}.csv`);
                          toast.success(`Exported ${list.length} records for ${batch}`);
                        }}
                      >
                        <Download className="h-3 w-3" /> CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] text-destructive hover:bg-destructive/10 gap-1"
                        onClick={(e) => { e.stopPropagation(); setBatchDeleteTarget(batch); }}
                        title="Delete entire batch"
                      >
                        <Trash2 className="h-3 w-3" /> Delete batch
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {batchSummaries.length === 0 && !loading && (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Student list */}
        <Card className="p-0 overflow-hidden border-amber-200">
          <div className="p-4 border-b border-border bg-amber-50/40 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold">Students</h3>
              <p className="text-xs text-muted-foreground">Best attempt per student · expand to view details · 🗑 delete all their attempts</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {batches.map((b) => (
                <button
                  key={b}
                  onClick={() => setActiveBatch(b)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    activeBatch === b
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >{b}</button>
              ))}
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="pl-8 h-8 text-xs w-52"
                />
              </div>
            </div>
          </div>

          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {["Name", "Email", "Batch", "Brand", "Score / Grade", ""].map((h) => (
                  <th key={h} className="p-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Loading…</td></tr>
              )}
              {/* Distinguish "the query failed" from "there is genuinely no data" —
                  conflating the two is what made missing scores hard to diagnose. */}
              {!loading && loadError && (
                <tr><td colSpan={6} className="p-6 text-center text-sm">
                  <span className="text-destructive font-medium">Couldn't load attempts.</span>
                  <span className="text-muted-foreground"> {loadError}</span>
                  <button onClick={fetchData} className="ml-2 underline text-primary">Retry</button>
                </td></tr>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No students match your search</td></tr>
              )}
              {filtered.map((row) => (
                <AdminStudentRow key={row.email} row={row} onDelete={setDeleteTarget} />
              ))}
            </tbody>
          </table>
        </Card>

      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Delete student data?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>'s
            ({deleteTarget?.email}) attempts from the database. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch delete confirmation dialog — typed confirmation, higher blast radius */}
      <Dialog
        open={!!batchDeleteTarget}
        onOpenChange={(o) => { if (!o) { setBatchDeleteTarget(null); setBatchDeleteConfirm(""); } }}
      >
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Delete entire batch?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-semibold text-foreground">
              {bestByEmail.filter((r) => r.batch_code === batchDeleteTarget).length}
            </span> students' attempts in batch{" "}
            <span className="font-semibold text-foreground">{batchDeleteTarget}</span>. This cannot be undone.
            Consider exporting a CSV first.
          </p>
          <div>
            <label className="text-xs font-semibold text-foreground">
              Type <span className="font-mono">{batchDeleteTarget}</span> to confirm
            </label>
            <Input
              value={batchDeleteConfirm}
              onChange={(e) => setBatchDeleteConfirm(e.target.value)}
              placeholder={batchDeleteTarget ?? ""}
              className="mt-1"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setBatchDeleteTarget(null); setBatchDeleteConfirm(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBatchDelete}
              disabled={batchDeleting || batchDeleteConfirm !== batchDeleteTarget}
            >
              {batchDeleting ? "Deleting…" : "Yes, delete batch permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stale live-session cleanup dialog — manual, replaces the old nightly cron */}
      <Dialog open={staleSessionsOpen} onOpenChange={(o) => { if (!o) { setStaleSessionsOpen(false); setStaleSessionCount(null); } }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" /> Clear stale live sessions?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {staleSessionCount === 0
              ? "No live sessions have been inactive for more than 7 days — nothing to clear."
              : <>This will remove <span className="font-semibold text-foreground">{staleSessionCount}</span> "in progress"
                  session marker{staleSessionCount === 1 ? "" : "s"} inactive for over {STALE_SESSION_DAYS} days.
                  This only clears in-progress trackers — it does <span className="font-semibold">not</span> touch
                  any saved scores or attempts.</>}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setStaleSessionsOpen(false); setStaleSessionCount(null); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmClearStaleSessions}
              disabled={staleSessionsBusy || !staleSessionCount}
            >
              {staleSessionsBusy ? "Clearing…" : "Clear stale sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, amber }: { icon: React.ReactNode; label: string; value: number; amber?: boolean }) {
  return (
    <Card className={`p-5 ${amber ? "border-amber-200" : ""}`}>
      <div className="flex items-center gap-3 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <div className={`text-3xl font-bold mt-2 ${amber ? "text-amber-600" : "text-foreground"}`}>{value}</div>
    </Card>
  );
}
