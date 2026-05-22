import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrainerHeader } from "@/components/TrainerHeader";
import { FlowHeader } from "@/components/FlowHeader";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

interface Attempt {
  email: string; name: string; batch_code: string; score_total: number; badge: string | null;
  profile_id: string; score_breakdown: any;
}

export default function Leaderboard() {
  const nav = useNavigate();
  const { student } = useSim();
  const [rows, setRows] = useState<Attempt[]>([]);

  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    setIsTrainer(localStorage.getItem("sim_trainer") === "1");
  }, []);

  useEffect(() => {
    supabase.from("attempts").select("*").order("score_total", { ascending: false }).limit(1000)
      .then(({ data }) => setRows((data as any) ?? []));
  }, []);

  // Best-per-student
  const bestByEmail = new Map<string, Attempt>();
  for (const r of rows) {
    const prev = bestByEmail.get(r.email);
    if (!prev || r.score_total > prev.score_total) bestByEmail.set(r.email, r);
  }
  const allBest = Array.from(bestByEmail.values()).sort((a, b) => b.score_total - a.score_total);
  const myBatch = student ? allBest.filter((r) => r.batch_code === student.batch) : [];

  // Batch aggregates
  const batchMap = new Map<string, { batch: string; scores: number[]; mistakes: string[] }>();
  for (const r of allBest) {
    if (!batchMap.has(r.batch_code)) batchMap.set(r.batch_code, { batch: r.batch_code, scores: [], mistakes: [] });
    const b = batchMap.get(r.batch_code)!;
    b.scores.push(r.score_total);
    const breakdown: any[] = Array.isArray(r.score_breakdown) ? r.score_breakdown : [];
    const worst = breakdown.slice().sort((a, b) => (a.earned / a.max) - (b.earned / b.max))[0];
    if (worst) b.mistakes.push(worst.label);
  }
  const batches = Array.from(batchMap.values()).map((b) => {
    const avg = b.scores.reduce((s, x) => s + x, 0) / b.scores.length;
    const top = Math.max(...b.scores);
    const mistake = mode(b.mistakes) || "—";
    return { batch: b.batch, avg: Math.round(avg), count: b.scores.length, top, mistake };
  }).sort((a, b) => b.avg - a.avg);

  return (
    <div className="min-h-screen w-full bg-background">
      <TrainerHeader />
      <div className="flex-1">
        <div className="px-8 py-6 max-w-6xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => nav(-1)} className="gap-2 mb-3">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Leaderboard</h1>
          <p className="text-xs text-muted-foreground">Best score per student across all attempts</p>

          <Tabs defaultValue="batch" className="mt-6">
            <TabsList>
              <TabsTrigger value="batch">My Batch</TabsTrigger>
              <TabsTrigger value="vs">Batch vs Batch</TabsTrigger>
              <TabsTrigger value="all">All Students</TabsTrigger>
            </TabsList>

            <TabsContent value="batch">
              <Card className="p-0 mt-4 overflow-hidden">
                <Table head={["#", "Name", "Batch", "Best Score", "Badge"]}>
                  {myBatch.map((r, i) => (
                    <tr key={r.email} className={`border-b border-border ${student?.email === r.email ? "bg-accent" : ""}`}>
                      <td className="p-3 text-sm">{i + 1}</td>
                      <td className="p-3 text-sm font-medium">{r.name}</td>
                      <td className="p-3 text-sm">{r.batch_code}</td>
                      <td className="p-3 text-sm font-semibold">{r.score_total}</td>
                      <td className="p-3 text-sm"><Badge variant="outline">{r.badge ?? "—"}</Badge></td>
                    </tr>
                  ))}
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="vs">
              <Card className="p-0 mt-4 overflow-hidden">
                <Table head={["#", "Batch", "Avg Score", "Students", "Top Score", "Most Common Mistake"]}>
                  {batches.map((b, i) => (
                    <tr key={b.batch} className="border-b border-border">
                      <td className="p-3 text-sm">{i + 1}</td>
                      <td className="p-3 text-sm font-medium">{b.batch}</td>
                      <td className="p-3 text-sm font-semibold">{b.avg}</td>
                      <td className="p-3 text-sm">{b.count}</td>
                      <td className="p-3 text-sm">{b.top}</td>
                      <td className="p-3 text-sm text-muted-foreground">{b.mistake}</td>
                    </tr>
                  ))}
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card className="p-0 mt-4 overflow-hidden">
                <Table head={["#", "Name", "Batch", "Best Score", "Badge"]}>
                  {allBest.slice(0, 50).map((r, i) => (
                    <tr key={r.email} className={`border-b border-border ${student?.email === r.email ? "bg-accent" : ""}`}>
                      <td className="p-3 text-sm">{i + 1}</td>
                      <td className="p-3 text-sm font-medium">{r.name}</td>
                      <td className="p-3 text-sm">{r.batch_code}</td>
                      <td className="p-3 text-sm font-semibold">{r.score_total}</td>
                      <td className="p-3 text-sm"><Badge variant="outline">{r.badge ?? "—"}</Badge></td>
                    </tr>
                  ))}
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full">
      <thead className="bg-muted/50">
        <tr>{head.map((h) => <th key={h} className="p-3 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function mode(arr: string[]) {
  const m = new Map<string, number>();
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1);
  let best = ""; let n = 0;
  for (const [k, v] of m) if (v > n) { best = k; n = v; }
  return best;
}
