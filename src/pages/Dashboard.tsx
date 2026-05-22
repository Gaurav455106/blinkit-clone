import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Plus, RefreshCw, FileText, ChevronRight, Trophy } from "lucide-react";

function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + ", " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const nav = useNavigate();
  const { student, scenario, runHistory, activeRunId, reviewRunId, campaigns, cmPitch, newScenario, enterReview, exitReview, startRun, clearActiveRun } = useSim();

  // Landing on dashboard exits any active review session (mount only).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (reviewRunId) exitReview(); }, []);

  // If the active run is already completed, archive it on dashboard landing.
  useEffect(() => {
    if (!activeRunId) return;
    const r = runHistory.find((x) => x.id === activeRunId);
    if (r && r.status === "completed") clearActiveRun();
  }, [activeRunId, runHistory, clearActiveRun]);

  if (!student) { nav("/", { replace: true }); return null; }
  if (!scenario) { newScenario(); return null; }

  const activeRun = activeRunId ? runHistory.find((r) => r.id === activeRunId) : null;
  const activeInProgress = activeRun && activeRun.status === "in_progress" ? activeRun : null;
  const completed = runHistory.filter((r) => r.status === "completed");
  const past = runHistory.filter((r) => r.id !== activeInProgress?.id).reverse();

  const bestScore = completed.reduce((m, r) => Math.max(m, r.score ?? 0), 0);
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, r) => s + (r.score ?? 0), 0) / completed.length)
    : 0;
  const lastAttempt = completed[completed.length - 1]?.completedAt;

  const startNew = () => {
    if (!activeInProgress) { startRun(); nav("/brief"); return; }
    if (!cmPitch) nav("/cm-pitch");
    else nav("/campaign");
  };

  const openPast = (runId: string) => {
    const ok = enterReview(runId);
    if (ok) nav("/results");
  };

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        <div className="px-8 pt-6 pb-2">
          <div className="text-xs text-muted-foreground">Brand Central › Dashboard</div>
          <div className="flex items-end justify-between gap-4 mt-1">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Welcome back, {student.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="border-primary text-primary">QCommerce Executive</Badge>
                <span className="text-xs text-muted-foreground">
                  {scenario.profile.emoji} Current brief: {scenario.profile.name}
                </span>
              </div>
            </div>
            {activeInProgress && (
              <Button variant="outline" onClick={() => nav("/brief")} className="gap-2">
                <FileText className="h-4 w-4" /> Re-read Brief
              </Button>
            )}
          </div>
        </div>

        <div className="px-8 py-6 max-w-5xl space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total attempts</div>
              <div className="text-lg font-semibold">{runHistory.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Best score</div>
              <div className="text-lg font-semibold">{bestScore ? `${bestScore}/100` : "—"}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Average score</div>
              <div className="text-lg font-semibold">{avgScore ? `${avgScore}/100` : "—"}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Last attempt</div>
              <div className="text-xs font-semibold mt-1">{fmtDate(lastAttempt)}</div>
            </Card>
          </div>

          {/* Action band */}
          <Card className="p-5 border-primary/30 bg-primary/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-primary font-bold">
                  {activeInProgress ? "Continue your run" : "Ready for a new scenario"}
                </div>
                <h3 className="text-lg font-semibold mt-1">
                  {activeInProgress
                    ? `Run in progress · ${activeInProgress.brandName}`
                    : "Read the brief, pitch the CM, build campaigns, launch."}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeInProgress
                    ? "Pick up where you left off."
                    : "Scripted mid-campaign crisis included. Make smart calls."}
                </p>
              </div>
              <Button size="lg" onClick={startNew} className="gap-2 shrink-0">
                {activeInProgress ? <><Rocket className="h-4 w-4" /> Resume</> : <><Plus className="h-4 w-4" /> Start New Scenario</>}
              </Button>
            </div>
          </Card>

          {/* Active run summary */}
          {activeInProgress && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Active Run</div>
                  <div className="text-sm font-semibold mt-0.5">
                    {activeInProgress.brandEmoji} {activeInProgress.brandName} · Started {fmtDate(activeInProgress.startedAt)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} created
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => nav("/campaign")}>
                    Campaigns <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => nav("/simulation")}>
                    Simulation <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Past attempts */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Past Attempts</div>
                <div className="text-[11px] text-muted-foreground">Every run you've shipped</div>
              </div>
              <Badge variant="outline">{past.length} run{past.length === 1 ? "" : "s"}</Badge>
            </div>
            {past.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No attempts yet. Hit "Start New Scenario" above.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Brand</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-right px-4 py-2">Final Score</th>
                    <th className="text-right px-4 py-2">Goal Met?</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((r) => {
                    const canOpen = r.status === "completed" && !!r.snapshot;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => canOpen && openPast(r.id)}
                        className={`border-t border-border ${canOpen ? "cursor-pointer hover:bg-muted/40" : "opacity-70"}`}
                        title={canOpen ? "Review this run" : "No snapshot saved for this run"}
                      >
                        <td className="px-4 py-3 text-xs">{fmtDate(r.completedAt ?? r.startedAt)}</td>
                        <td className="px-4 py-3 font-medium">{r.brandEmoji} {r.brandName}</td>
                        <td className="px-4 py-3">
                          {r.status === "completed" ? (
                            <Badge className="bg-primary text-primary-foreground gap-1"><Trophy className="h-3 w-3" /> Completed</Badge>
                          ) : (
                            <Badge variant="secondary">In progress</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{r.score != null ? `${r.score}/100` : "—"}</td>
                        <td className="px-4 py-3 text-right">{r.achievementPct != null ? (r.achievementPct >= 90 ? "✅" : "—") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <div className="flex justify-between items-center">
            <Button variant="link" onClick={() => nav("/leaderboard")} className="px-0">
              View Full Leaderboard →
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { newScenario(); startRun(); nav("/brief"); }}>
              <RefreshCw className="h-3.5 w-3.5" /> New Brand Scenario
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
