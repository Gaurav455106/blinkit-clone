import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrainerHeader } from "@/components/TrainerHeader";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, TrendingUp, Search, ChevronDown, ChevronUp } from "lucide-react";

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
  if (score >= 90) return { label: "Promoted",   color: "bg-emerald-100 text-emerald-700" };
  if (score >= 75) return { label: "Distinction", color: "bg-blue-100 text-blue-700" };
  if (score >= 60) return { label: "Pass",        color: "bg-slate-100 text-slate-700" };
  return              { label: "Needs Work",  color: "bg-red-100 text-red-700" };
}

const FORMAT_LABELS: Record<string, string> = {
  product_booster:    "Product Booster",
  recommendation_ads: "Recommendation Ads",
  listing_spotlight:  "Listing Spotlight",
  brand_booster:      "Brand Booster",
  stories:            "Stories Ad",
};

// ── Student drill-down row ────────────────────────────────────────────────────
function StudentRow({ row }: { row: Attempt }) {
  const [open, setOpen] = useState(false);
  const grade = gradeLabel(row.score_total);
  const snap  = row.snapshot as any;

  const breakdown: { label: string; earned: number; max: number }[] = useMemo(() => {
    const bd = snap?.score_breakdown ?? row.score_breakdown;
    if (!bd) return [];
    if (Array.isArray(bd)) return bd;
    if (typeof bd === "object") {
      return [
        { label: "Setup",    earned: bd.setup   ?? 0, max: 30 },
        { label: "Live Opt", earned: bd.liveOpt ?? 0, max: 25 },
        { label: "Crisis",   earned: bd.crisis  ?? 0, max: 20 },
        { label: "Results",  earned: bd.results ?? 0, max: 25 },
      ];
    }
    return [];
  }, [snap, row.score_breakdown]);

  const campaigns: any[]              = snap?.campaigns ?? [];
  const crisisResponses: Record<string, any> = snap?.crisisResponses ?? {};

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="p-3 text-sm font-medium">{row.name}</td>
        <td className="p-3 text-sm text-muted-foreground">{row.email}</td>
        <td className="p-3 text-sm">{row.batch_code}</td>
        <td className="p-3 text-sm">{row.profile_id}</td>
        <td className="p-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${grade.color}`}>
            {row.score_total} · {grade.label}
          </span>
        </td>
        <td className="p-3 text-right text-muted-foreground">
          {open
            ? <ChevronUp   className="h-4 w-4 inline" />
            : <ChevronDown className="h-4 w-4 inline" />}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={6} className="p-4">
            <div className="grid grid-cols-3 gap-4">

              {/* Score breakdown */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Score Breakdown</p>
                <div className="space-y-1.5">
                  {breakdown.length === 0 && (
                    <p className="text-xs text-muted-foreground">No breakdown available</p>
                  )}
                  {breakdown.map((b, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-muted-foreground">{b.label}</span>
                        <span className="font-medium">{Math.round(b.earned)}/{b.max}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, (b.earned / b.max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-border mt-2 flex justify-between text-xs font-semibold">
                    <span>Total</span>
                    <span>{row.score_total}/100</span>
                  </div>
                </div>
              </div>

              {/* Campaigns */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">
                  Campaigns ({campaigns.filter((c: any) => !c.isDraft).length} active)
                </p>
                {campaigns.length === 0 && (
                  <p className="text-xs text-muted-foreground">No campaign data</p>
                )}
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
                            <span key={kw} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{kw}</span>
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
                {Object.keys(crisisResponses).length === 0 && (
                  <p className="text-xs text-muted-foreground">No crisis data</p>
                )}
                <div className="space-y-2">
                  {Object.values(crisisResponses).map((cr: any) => {
                    const pts = cr.score ?? 0;
                    const max = cr.maxScore ?? 20;
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
                        {cr.effectLabel && (
                          <div className="text-muted-foreground italic truncate">{cr.effectLabel}</div>
                        )}
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
export default function Trainer() {
  const [rows,        setRows]        = useState<Attempt[]>([]);
  const [search,      setSearch]      = useState("");
  const [activeBatch, setActiveBatch] = useState<string>("All");
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    supabase.from("attempts").select("*").order("created_at", { ascending: false }).limit(2000)
      .then(({ data, error }) => {
        // Don't swallow the error — an empty table used to be indistinguishable
        // from a rejected query.
        if (error) console.error("[trainer] attempts load failed", error);
        setRows((data as any) ?? []);
        setLoading(false);
      });
  }, []);

  // Best attempt per student
  const bestByEmail = useMemo(() => {
    const m = new Map<string, Attempt>();
    for (const r of rows) {
      const p = m.get(r.email);
      if (!p || r.score_total > p.score_total) m.set(r.email, r);
    }
    return Array.from(m.values());
  }, [rows]);

  // Batch list (for tabs)
  const batches = useMemo(() => {
    const s = new Set(bestByEmail.map((r) => r.batch_code));
    return ["All", ...Array.from(s).sort()];
  }, [bestByEmail]);

  // Filtered students
  const filtered = useMemo(() => {
    let list = bestByEmail;
    if (activeBatch !== "All") list = list.filter((r) => r.batch_code === activeBatch);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.score_total - a.score_total);
  }, [bestByEmail, activeBatch, search]);

  // Summary stats
  const totalStudents = bestByEmail.length;
  const totalBatches  = batches.length - 1;
  const overallAvg    = totalStudents
    ? Math.round(bestByEmail.reduce((s, x) => s + x.score_total, 0) / totalStudents)
    : 0;

  // Batch-level summary rows
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

  return (
    <div className="min-h-screen w-full bg-background">
      <TrainerHeader />
      <div className="px-8 py-6 max-w-6xl mx-auto space-y-6">

        <div>
          <h1 className="text-xl font-semibold text-foreground">Trainer Dashboard</h1>
          <p className="text-xs text-muted-foreground">Cohort performance across all batches</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<Users className="h-5 w-5" />}         label="Total Students"   value={totalStudents} />
          <StatCard icon={<GraduationCap className="h-5 w-5" />} label="Active Batches"   value={totalBatches} />
          <StatCard icon={<TrendingUp className="h-5 w-5" />}    label="Overall Avg Score" value={overallAvg} />
        </div>

        {/* Batch overview */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Batch Overview</h3>
            <p className="text-xs text-muted-foreground">Click a row to filter students by that batch</p>
          </div>
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {["Batch", "Students", "Avg Score", "Top Student", "Most Common Mistake"].map((h) => (
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
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>{batch}</span>
                  </td>
                  <td className="p-3 text-sm">{count}</td>
                  <td className="p-3 text-sm font-semibold">{avg}</td>
                  <td className="p-3 text-sm">{top?.name} ({top?.score_total})</td>
                  <td className="p-3 text-sm text-muted-foreground">{mistake}</td>
                </tr>
              ))}
              {batchSummaries.length === 0 && !loading && (
                <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Student list */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold">Students</h3>
              <p className="text-xs text-muted-foreground">Best attempt per student · click a row to expand details</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Batch filter tabs */}
              <div className="flex gap-1 flex-wrap">
                {batches.map((b) => (
                  <button
                    key={b}
                    onClick={() => setActiveBatch(b)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      activeBatch === b
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >{b}</button>
                ))}
              </div>
              {/* Email / name search */}
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
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No students match your search</td></tr>
              )}
              {filtered.map((row) => <StudentRow key={row.email} row={row} />)}
            </tbody>
          </table>
        </Card>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-3xl font-bold text-foreground mt-2">{value}</div>
    </Card>
  );
}
