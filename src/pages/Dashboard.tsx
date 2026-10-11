import "@/components/game/game.css";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, FileText, RefreshCw } from "lucide-react";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { SimPage, PageHeader, StatTile, Section, Tag, EmptyState } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTour } from "@/components/tour/useTour";
import { TourButton } from "@/components/tour/TourButton";

/** Goal achievement at or above this counts as "goal met". */
const GOAL_MET_PCT = 90;

const STEPS = ["Read the brief", "Make a deal with Rohit", "Build campaigns", "Run 30 days"] as const;

function fmtDate(s?: string) {
  if (!s) return "None yet";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + ", " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const nav = useNavigate();
  const { student, scenario, runHistory, activeRunId, reviewRunId, campaigns, newScenario, enterReview, exitReview, clearActiveRun, clearCampaigns, resumeRun } = useSim();

  // Landing on dashboard exits any active review session (mount only).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (reviewRunId) exitReview(); }, []);

  // If the active run is already completed, archive it and clear campaigns.
  useEffect(() => {
    if (!activeRunId) return;
    const r = runHistory.find((x) => x.id === activeRunId);
    if (r && r.status === "completed") {
      clearActiveRun();
      clearCampaigns();
    }
  }, [activeRunId, runHistory, clearActiveRun, clearCampaigns]);

  // On mount: clear stranded campaigns that have no active run backing them.
  // This handles the case where a previous run completed but campaigns weren't
  // cleared yet (e.g. clearCampaigns was added after the run already cleared activeRunId).
  useEffect(() => {
    if (activeRunId) return; // active run owns the campaigns, don't touch
    const hasInProgressRun = runHistory.some((r) => r.status === "in_progress");
    if (!hasInProgressRun && campaigns.length > 0) clearCampaigns();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useTour("dashboard", student?.email, !!student && !!scenario);

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
    if (activeInProgress) { nav("/simulation"); return; }
    nav("/brief"); // always start from brief for a new run
  };

  const openPast = (runId: string) => {
    const ok = enterReview(runId);
    if (ok) nav("/results");
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <BlinkitSidebar />
      <div className="flex-1 overflow-y-auto">
        <SimPage>
          <PageHeader
            eyebrow="Dashboard"
            title={`Welcome back, ${student.name}`}
            description={<>You run Blinkit ads for a brand. Your brand right now: <span className="font-medium text-foreground">{scenario.profile.name}</span> ({scenario.profile.category}).</>}
            actions={
              <>
                <TourButton />
                {activeInProgress && (
                  <Button variant="outline" onClick={() => nav("/brief")} className="gap-2">
                    <FileText className="h-4 w-4" /> Re-read brief
                  </Button>
                )}
              </>
            }
          />

          <div className="space-y-6">
            {/* Next step */}
            <section data-tour="dash-next-step" aria-labelledby="next-step" className="rounded-2xl bg-primary px-6 py-6 text-primary-foreground md:px-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="max-w-[60ch]">
                  <p className="text-sm text-primary-foreground/75">{activeInProgress ? "Run in progress" : "Your next step"}</p>
                  <h2 id="next-step" className="mt-1 text-2xl font-semibold">
                    {activeInProgress ? `Carry on with ${activeInProgress.brandName}` : `Read the ${scenario.profile.name} brief`}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
                    {activeInProgress
                      ? `Started ${fmtDate(activeInProgress.startedAt)}. ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} running. Pick up where you left off.`
                      : "Learn the brand, its numbers and its rivals. Then make a deal with Rohit, build your campaigns and run 30 days."}
                  </p>
                </div>
                <Button size="lg" onClick={startNew} className="shrink-0 gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  {activeInProgress ? "Resume run" : "Open the brief"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {!activeInProgress && (
                <ol data-tour="dash-steps" aria-label="Your mission" className="relative mt-6 grid gap-3 text-sm sm:grid-cols-4">
                  {/* The path the steps sit on (SPEC §15) */}
                  <span aria-hidden className="absolute left-4 right-4 top-4 hidden h-0.5 bg-primary-foreground/25 sm:block" />
                  {STEPS.map((s, i) => (
                    <li key={s} className="sim-pop-in relative flex items-center gap-3 sm:flex-col sm:items-start" style={{ animationDelay: `${i * 120}ms` }}>
                      <span className={cn(
                        "sim-num relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        i === 0 ? "sim-pulse bg-primary-foreground text-primary" : "bg-primary text-primary-foreground/80 ring-2 ring-primary-foreground/30",
                      )}>{i + 1}</span>
                      <span className={cn(i === 0 ? "font-medium" : "text-primary-foreground/70")}>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {activeInProgress && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => nav("/campaign")} className="gap-1">
                  Campaigns <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => nav("/simulation")} className="gap-1">
                  Simulation <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Attempts summary */}
            <div data-tour="dash-stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Attempts" value={runHistory.length} hint={`${completed.length} finished`} />
              <StatTile label="Best score" value={bestScore ? `${bestScore}/100` : "None yet"} />
              <StatTile label="Average score" value={avgScore ? `${avgScore}/100` : "None yet"} />
              <StatTile label="Last finished" value={<span className="text-base">{fmtDate(lastAttempt)}</span>} />
            </div>

            {/* Past attempts */}
            <div data-tour="dash-history">
            {past.length === 0 ? (
              <EmptyState
                title="No attempts yet"
                description="Your finished runs show up here with their score. Open one to see what went well and what cost you money."
              />
            ) : (
              <Section
                title="Past attempts"
                description="Click a finished run to review it. A run that was stopped part-way can be resumed if it was saved."
                actions={<Tag>{past.length} run{past.length === 1 ? "" : "s"}</Tag>}
              >
                <div className="-mx-6 overflow-x-auto px-6">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Brand</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">Score</th>
                        <th scope="col" className="py-2 text-right font-medium">Goal met</th>
                      </tr>
                    </thead>
                    <tbody>
                      {past.map((r) => {
                        const canReview = r.status === "completed" && !!r.snapshot;
                        // In-progress run with a snapshot = was interrupted but state was saved → resumable.
                        // In-progress run without snapshot = truly lost (old behaviour pre-snapshot).
                        const canResume = r.status === "in_progress" && !!r.snapshot && !activeRunId;
                        const isClickable = canReview || canResume;
                        const handleClick = canReview
                          ? () => openPast(r.id)
                          : canResume
                          ? () => { const ok = resumeRun(r.id); if (ok) nav("/simulation"); }
                          : undefined;
                        const title =
                          canReview ? "Review this run" :
                          canResume ? `Resume from day ${r.snapshot?.currentDay ?? 1}` :
                          r.status === "in_progress" && activeRunId ? "Finish your current run before resuming this one" :
                          "This run stopped without saving, so it can't be resumed";
                        return (
                          <tr
                            key={r.id}
                            onClick={handleClick}
                            onKeyDown={(e) => { if (handleClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleClick(); } }}
                            tabIndex={isClickable ? 0 : undefined}
                            title={title}
                            className={cn("border-b border-border/60 last:border-0", isClickable ? "cursor-pointer hover:bg-secondary/50 focus-visible:bg-secondary/50" : "text-muted-foreground")}
                          >
                            <td className="py-3 pr-4 text-xs">{fmtDate(r.completedAt ?? r.startedAt)}</td>
                            <td className="py-3 pr-4 font-medium text-foreground">{r.brandName}</td>
                            <td className="py-3 pr-4">
                              {r.status === "completed" ? <Tag tone="good">Finished</Tag>
                                : canResume ? <Tag tone="warn">Paused, can resume</Tag>
                                : <Tag>Stopped</Tag>}
                            </td>
                            <td className="sim-num py-3 pr-4 text-right font-semibold text-foreground">{r.score != null ? `${r.score}/100` : "None"}</td>
                            <td className="py-3 text-right">
                              {r.achievementPct != null && r.achievementPct >= GOAL_MET_PCT ? <Tag tone="good">Yes</Tag> : <span className="text-muted-foreground">No</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="link" onClick={() => nav("/leaderboard")} className="px-0">
                See the full leaderboard <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { newScenario(); nav("/brief"); }}>
                <RefreshCw className="h-3.5 w-3.5" /> Try a different brand
              </Button>
            </div>
          </div>
        </SimPage>
      </div>
    </div>
  );
}
