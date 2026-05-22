import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";

import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, TrendingUp } from "lucide-react";

export default function Trainer() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("attempts").select("*").limit(2000)
      .then(({ data }) => setRows((data as any) ?? []));
  }, []);

  // Best per student
  const bestByEmail = new Map<string, any>();
  for (const r of rows) {
    const p = bestByEmail.get(r.email);
    if (!p || r.score_total > p.score_total) bestByEmail.set(r.email, r);
  }
  const best = Array.from(bestByEmail.values());

  const batches = new Map<string, any[]>();
  for (const r of best) {
    if (!batches.has(r.batch_code)) batches.set(r.batch_code, []);
    batches.get(r.batch_code)!.push(r);
  }

  const totalStudents = best.length;
  const totalBatches = batches.size;
  const overallAvg = best.length ? Math.round(best.reduce((s, x) => s + x.score_total, 0) / best.length) : 0;

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background">
        <div className="px-8 py-6 max-w-6xl">
          <h1 className="text-xl font-semibold text-foreground">Trainer Dashboard</h1>
          <p className="text-xs text-muted-foreground">Cohort performance across all batches</p>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <StatCard icon={<Users className="h-5 w-5" />} label="Total Students" value={totalStudents} />
            <StatCard icon={<GraduationCap className="h-5 w-5" />} label="Active Batches" value={totalBatches} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Overall Avg Score" value={overallAvg} />
          </div>

          <Card className="mt-6 p-0 overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Batches</h3>
            </div>
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {["Batch", "Students", "Avg Score", "Top Student", "Most Common Mistake", ""].map((h) =>
                    <th key={h} className="p-3 text-left text-xs font-medium text-muted-foreground">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from(batches.entries()).map(([batch, members]) => {
                  const avg = Math.round(members.reduce((s, m) => s + m.score_total, 0) / members.length);
                  const top = members.slice().sort((a, b) => b.score_total - a.score_total)[0];
                  const worsts = members.map((m) => {
                    const arr: any[] = Array.isArray(m.score_breakdown) ? m.score_breakdown : [];
                    return arr.slice().sort((a, b) => (a.earned / a.max) - (b.earned / b.max))[0]?.label ?? "";
                  });
                  const mistake = mode(worsts) || "—";
                  return (
                    <tr key={batch} className="border-b border-border">
                      <td className="p-3 text-sm font-medium">{batch}</td>
                      <td className="p-3 text-sm">{members.length}</td>
                      <td className="p-3 text-sm font-semibold">{avg}</td>
                      <td className="p-3 text-sm">{top?.name} ({top?.score_total})</td>
                      <td className="p-3 text-sm text-muted-foreground">{mistake}</td>
                      <td className="p-3 text-sm">
                        <Link to={`/trainer/${encodeURIComponent(batch)}`} className="text-primary hover:underline">View →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
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

function mode(arr: string[]) {
  const m = new Map<string, number>();
  for (const x of arr) if (x) m.set(x, (m.get(x) ?? 0) + 1);
  let best = ""; let n = 0;
  for (const [k, v] of m) if (v > n) { best = k; n = v; }
  return best;
}
