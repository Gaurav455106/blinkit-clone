import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TrainerHeader } from "@/components/TrainerHeader";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { SimPage, PageHeader, Section, Tag, EmptyState } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { biggestLoss, mostFrequent, type AttemptRow } from "@/lib/attemptAnalysis";
import { cn } from "@/lib/utils";

type Attempt = Pick<AttemptRow, "email" | "name" | "batch_code" | "score_total" | "badge" | "profile_id" | "score_breakdown" | "id" | "created_at">;

const MAX_ALL_STUDENTS = 50;
const BADGE_TEXT: Record<string, string> = { gold: "Gold", silver: "Silver", bronze: "Bronze" };

export default function Leaderboard() {
  const nav = useNavigate();
  const { student } = useSim();
  const [rows, setRows] = useState<Attempt[]>([]);
  const [batchRows, setBatchRows] = useState<{ batch_code: string; score_total: number }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    setIsTrainer(localStorage.getItem("sim_trainer") === "1");
  }, []);

  useEffect(() => {
    supabase.from("attempts").select("*").order("score_total", { ascending: false }).limit(1000)
      .then(({ data, error }) => {
        if (error) {
          console.error("[leaderboard] attempts load failed", error);
          setLoadError(error.message);
        }
        setRows((data ?? []) as unknown as Attempt[]);
        setLoading(false);
      });
    supabase.from("batch_scores").select("batch_code,score_total").limit(5000)
      .then(({ data, error }) => {
        if (error) console.error("[leaderboard] batch_scores load failed", error);
        setBatchRows(data ?? []);
      });
  }, []);

  // Best-per-student. NOTE: the old nightly cleanup_idle_students() cron job that
  // capped this to 7 days was removed in migration 20260806095647 — attempts are
  // now retained until an admin deletes them explicitly.
  const bestByEmail = new Map<string, Attempt>();
  for (const r of rows) {
    const prev = bestByEmail.get(r.email);
    if (!prev || r.score_total > prev.score_total) bestByEmail.set(r.email, r);
  }
  const allBest = Array.from(bestByEmail.values()).sort((a, b) => b.score_total - a.score_total);
  const myBatch = student ? allBest.filter((r) => r.batch_code === student.batch) : [];

  // Batch aggregates — sourced from batch_scores so they survive student cleanup.
  const batchMap = new Map<string, number[]>();
  for (const r of batchRows) batchMap.set(r.batch_code, [...(batchMap.get(r.batch_code) ?? []), r.score_total]);
  const batches = Array.from(batchMap.entries()).map(([batch, scores]) => ({
    batch,
    avg: Math.round(scores.reduce((s, x) => s + x, 0) / scores.length),
    count: scores.length,
    top: Math.max(...scores),
    // Needs score_breakdown, only available on saved attempts.
    mistake: mostFrequent(rows.filter((r) => r.batch_code === batch).map((r) => biggestLoss(r as AttemptRow))) ?? "Nothing stands out",
  })).sort((a, b) => b.avg - a.avg);

  const header = isTrainer ? <TrainerHeader /> : (
    <div className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 md:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
            <span className="text-xs font-bold text-primary-foreground">B</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Leaderboard</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => nav(-1)} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background">
      {header}
      <SimPage>
        <PageHeader title="Leaderboard" description="Best score per student across all runs." />
        {loadError && (
          <p className="mb-4 rounded-lg bg-sim-bad/10 px-3 py-2 text-sm text-sim-bad">We couldn't load the leaderboard: {loadError}</p>
        )}
        <Tabs defaultValue="batch">
          <TabsList>
            <TabsTrigger value="batch">My batch</TabsTrigger>
            <TabsTrigger value="vs">Batch vs batch</TabsTrigger>
            <TabsTrigger value="all">All students</TabsTrigger>
          </TabsList>

          <TabsContent value="batch" className="mt-4">
            <Section>
              <RankTable rows={myBatch} meEmail={student?.email} loading={loading} empty={student ? "Nobody in your batch has finished a run yet." : "Sign in as a student to see your batch."} />
            </Section>
          </TabsContent>

          <TabsContent value="vs" className="mt-4">
            <Section>
              {batches.length === 0 ? <EmptyState title="No batch scores yet" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="border-b border-border">
                      <tr>{["#", "Batch", "Average", "Students", "Top score", "Where most points were lost"].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {batches.map((b, i) => (
                        <tr key={b.batch} className="hover:bg-secondary/50">
                          <td className="sim-num px-3 py-2.5 text-sm text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2.5 text-sm font-medium">{b.batch}</td>
                          <td className="px-3 py-2.5"><Tag tone={scoreTone(b.avg, 100)}><span className="sim-num">{b.avg}</span></Tag></td>
                          <td className="sim-num px-3 py-2.5 text-sm">{b.count}</td>
                          <td className="sim-num px-3 py-2.5 text-sm">{b.top}</td>
                          <td className="px-3 py-2.5 text-sm text-muted-foreground">{b.mistake}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Section>
              <RankTable rows={allBest.slice(0, MAX_ALL_STUDENTS)} meEmail={student?.email} loading={loading} empty="No finished runs yet." />
            </Section>
          </TabsContent>
        </Tabs>
      </SimPage>
    </div>
  );
}

function RankTable({ rows, meEmail, loading, empty }: { rows: Attempt[]; meEmail?: string; loading: boolean; empty: string }) {
  if (loading) return <p className="text-sm text-muted-foreground" aria-busy="true">Loading…</p>;
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px]">
        <thead className="border-b border-border">
          <tr>{["#", "Name", "Batch", "Best score", "Badge"].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => {
            const me = meEmail === r.email;
            return (
              <tr key={r.email} className={cn("hover:bg-secondary/50", me && "bg-accent")}>
                <td className="sim-num px-3 py-2.5 text-sm text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2.5 text-sm font-medium">{r.name}{me && <span className="ml-2"><Tag tone="good">You</Tag></span>}</td>
                <td className="px-3 py-2.5 text-sm">{r.batch_code}</td>
                <td className="px-3 py-2.5"><Tag tone={scoreTone(r.score_total, 100)}><span className="sim-num">{r.score_total}</span></Tag></td>
                <td className="px-3 py-2.5 text-sm">{r.badge ? BADGE_TEXT[r.badge] ?? r.badge : <span className="text-muted-foreground">None</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
