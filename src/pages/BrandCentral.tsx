import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Plus, RefreshCw, FileText, ChevronRight, Trophy, Trash2 } from "lucide-react";

function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + ", " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function BrandCentral() {
  const nav = useNavigate();
  const { student, scenario, runHistory, activeRunId, campaigns, newScenario } = useSim();

  if (!student || !scenario) { nav("/"); return null; }

  const active = activeRunId ? runHistory.find((r) => r.id === activeRunId) : null;
  const past = runHistory.filter((r) => r.id !== activeRunId).reverse();

  const startNew = () => {
    // Wipe campaigns & re-issue scenario if there isn't an in-progress run
    if (!active) {
      newScenario();
      // newScenario also rebuilds scenario — but we want to stay on this brand.
      // Refresh brief by routing back through brief if user wants. For simplicity, send to /brief.
      nav("/brief");
      return;
    }
    // resume in-progress flow: continue where they were
    if (campaigns.length === 0) nav("/cm-pitch");
    else nav("/campaigns-dashboard");
  };

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        <div className="px-8 pt-6 pb-2">
          <div className="text-xs text-muted-foreground">Brand Central › Home</div>
          <div className="flex items-end justify-between gap-4 mt-1">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Welcome back, {student.name}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {scenario.profile.emoji} {scenario.profile.name} · {scenario.profile.category} · Budget ₹{scenario.budget.toLocaleString("en-IN")}
              </p>
            </div>
            <Button variant="outline" onClick={() => nav("/brief")} className="gap-2">
              <FileText className="h-4 w-4" /> Re-read Brief
            </Button>
          </div>
        </div>

        <div className="px-8 py-6 max-w-5xl space-y-5">
          {/* Action band */}
          <Card className="p-5 border-primary/30 bg-primary/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-primary font-bold">
                  {active ? "Continue your run" : "Start a new simulation run"}
                </div>
                <h3 className="text-lg font-semibold mt-1">
                  {active
                    ? `Run in progress · ${active.brandName}`
                    : "Pitch the CM, build campaigns, launch, and watch them play out over 30 days"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {active
                    ? "Pick up where you left off — campaigns dashboard or CM pitch."
                    : "You'll face a scripted mid-campaign crisis plus the chance of a random one. Make smart calls."}
                </p>
              </div>
              <Button size="lg" onClick={startNew} className="gap-2 shrink-0">
                {active ? <><Rocket className="h-4 w-4" /> Resume</> : <><Plus className="h-4 w-4" /> Start New Run</>}
              </Button>
            </div>
          </Card>

          {/* Active run summary */}
          {active && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Active Run</div>
                  <div className="text-sm font-semibold mt-0.5">
                    {active.brandEmoji} {active.brandName} · Started {fmtDate(active.startedAt)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} created
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => nav("/campaigns-dashboard")}>
                    Campaigns Dashboard <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => nav("/run-results")}>
                    Results <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Past runs */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">My Simulation Runs</div>
                <div className="text-[11px] text-muted-foreground">Every completed run you've shipped</div>
              </div>
              <Badge variant="outline">{past.length} run{past.length === 1 ? "" : "s"}</Badge>
            </div>
            {past.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No completed runs yet. Your first one is just a few clicks away.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Brand</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Started</th>
                    <th className="text-left px-4 py-2">Completed</th>
                    <th className="text-right px-4 py-2">Score</th>
                    <th className="text-right px-4 py-2">Goal Achv.</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{r.brandEmoji} {r.brandName}</td>
                      <td className="px-4 py-3">
                        {r.status === "completed" ? (
                          <Badge className="bg-primary text-primary-foreground gap-1"><Trophy className="h-3 w-3" /> Completed</Badge>
                        ) : (
                          <Badge variant="secondary">In progress</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{fmtDate(r.startedAt)}</td>
                      <td className="px-4 py-3 text-xs">{fmtDate(r.completedAt)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{r.score != null ? `${r.score}/100` : "—"}</td>
                      <td className="px-4 py-3 text-right">{r.achievementPct != null ? `${r.achievementPct}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Try a different brand */}
          <Card className="p-4 flex items-center justify-between bg-muted/30">
            <div className="text-xs text-muted-foreground">
              Want a different brand & scenario? This wipes your current run.
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { newScenario(); nav("/brief"); }}>
              <RefreshCw className="h-3.5 w-3.5" /> New Brand Scenario
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
