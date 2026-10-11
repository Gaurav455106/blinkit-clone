import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { isEngineV2 } from "@/lib/engineFlag";
import DebriefV2 from "@/pages/DebriefV2";
import { useTour } from "@/components/tour/useTour";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
import { Button } from "@/components/ui/button";
import { simulateRun } from "@/lib/simResults";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, BarChart3, Home, Copy, Check, Download, UserRound, Award } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  scoreSetup, scoreDayparting, scoreNewCampaign, buildLiveOptScore,
  scoreCrisisResponse, buildCrisisScore, scoreResults, assembleFinalScore,
  type FinalScore, type ScoreLine,
} from "@/lib/newScoring";
import type { RunTotals } from "@/lib/engine";
import type { Json } from "@/integrations/supabase/types";
import { SimPage, PageHeader, StatTile, Section } from "@/components/sim/primitives";
import { scoreTone } from "@/components/sim/tone";
import { ScoreSummary } from "@/components/results/ScoreSummary";
import { ScoreBreakdown } from "@/components/results/ScoreBreakdown";
import { GoalTable, CampaignTable, CrisisList } from "@/components/results/ResultTables";
import { GradeScale } from "@/components/results/GradeScale";
import { linesFromFinalScore, qualitativeSummary, plainText } from "@/lib/rubrics";
import { buildSavedBreakdown } from "@/lib/attemptAnalysis";
import { buildResultsSheets, RESULTS_README, resultsFilename } from "@/lib/resultsExport";
import { downloadWorkbook } from "@/lib/excel";

const shareText = (total: number) =>
  `I scored ${total}/100 on the Blinkit Ads Simulation by Kraftshala and was promoted to Senior Executive. #QCommercePro #Kraftshala`;

// ─── Main page ─────────────────────────────────────────────────────────────────
/** Picks the results page for the engine the run used. */
export default function Day30Results() {
  const { student, scenario } = useSim();
  if (isEngineV2() && student && scenario) return <DebriefV2 student={student} scenario={scenario} />;
  return <Day30ResultsV1 />;
}

function Day30ResultsV1() {
  const nav = useNavigate();
  const {
    student, scenario, campaigns, cmPitch, weekTotals, decisionsLog, newScenario,
    abTests, cannibalResolved, clusterReactions, tokensSpent, tokensRemaining,
    microDecisionsLog, exhaustedCampaigns, cumulativeSpendByCampaign, events,
    optimizations, stockLevels, competitor, competitorActions,
    crisisResponses, activeRunId, completeRun, mode,
    daypartingChanges,
    savedRunResults,
  } = useSim();

  // ── All hooks MUST be called before any early returns (React rule) ────────

  // ── Raw simulation metrics (legacy engine — used for perCampaign display) ─
  // Null-safe: returns null when scenario/campaigns are not ready.
  const r = useMemo(
    () => {
      if (!scenario || campaigns.length === 0) return null;
      return simulateRun(scenario, campaigns, cmPitch, { abTests, cannibalResolved, clusterReactions, tokensSpent });
    },
    [scenario, campaigns, cmPitch, abTests, cannibalResolved, clusterReactions, tokensSpent],
  );

  const frozenDays = useMemo(
    () => (activeRunId ? (savedRunResults[activeRunId]?.days ?? null) : null),
    [activeRunId, savedRunResults],
  );

  // ── RunTotals bridge ──────────────────────────────────────────────────────
  // Prefer frozen engine days (same numbers the student watched in LiveDashboard).
  // reach/brandedLift/sellThrough are derived directly from frozen impressions/units
  // so they are consistent with the live chart — no legacy engine needed for these.
  const runTotals: RunTotals | null = useMemo(() => {
    if (!scenario) return null;
    if (frozenDays && frozenDays.length > 0) {
      const totalSpend       = frozenDays.reduce((s, d) => s + d.spend, 0);
      const totalImpressions = frozenDays.reduce((s, d) => s + d.impressions, 0);
      const totalClicks      = frozenDays.reduce((s, d) => s + d.clicks, 0);
      const totalAtcs        = frozenDays.reduce((s, d) => s + d.atcs, 0);
      const totalUnits       = frozenDays.reduce((s, d) => s + d.units, 0);
      const totalRevenue     = frozenDays.reduce((s, d) => s + d.revenue, 0);
      return {
        days: frozenDays.length,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalAtcs,
        totalUnits,
        totalRevenue,
        ctr:          totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        roas:         totalSpend       > 0 ? totalRevenue / totalSpend      : 0,
        cvr:          totalClicks      > 0 ? totalAtcs / totalClicks        : 0,
        // Derived from frozen dayEngine output — consistent with the live chart the student watched.
        reach:        Math.round(totalImpressions * 0.4),
        brandedLift:  Math.round(Math.min(50, totalImpressions / 200_000)),
        sellThrough:  Math.min(100, Math.round((totalUnits / 1500) * 100)),
      };
    }
    // Fallback: use legacy engine output when no frozen snapshot exists (old sessions / dev).
    if (!r) return null;
    return {
      days: 30,
      totalSpend:       r.totals.spend,
      totalImpressions: r.totals.impressions,
      totalClicks:      r.totals.clicks,
      totalAtcs:        0,
      totalUnits:       r.totals.units,
      totalRevenue:     r.totals.revenue,
      ctr:              r.totals.ctr,
      roas:             r.totals.roas,
      cvr:              r.totals.cvr,
      reach:            r.totals.reach,
      brandedLift:      r.totals.brandedLift,
      sellThrough:      r.totals.sellThrough,
    };
  }, [r, frozenDays, scenario]);

  // ── 100-point scoring ─────────────────────────────────────────────────────
  const finalScore: FinalScore | null = useMemo(() => {
    if (!scenario || !runTotals) return null;

    const setup = scoreSetup(scenario, campaigns);

    const customDayparts: Record<string, number[]> = Object.fromEntries(
      Object.entries(daypartingChanges).map(([id, dc]) => [id, dc.blocks]),
    );
    const daypartingChangedOnDay: Record<string, number> = Object.fromEntries(
      Object.entries(daypartingChanges).map(([id, dc]) => [id, dc.changedDay]),
    );
    const daypartingLine = scoreDayparting({ scenario, campaigns, customDayparts, daypartingChangedOnDay });

    const originalCampaigns = campaigns.filter((c) => (c.launchDay ?? 1) <= 1);
    const newCampaigns      = campaigns.filter((c) => (c.launchDay ?? 1) > 1);
    const newCampaignLine   = scoreNewCampaign({
      scenario,
      originalCampaigns,
      newCampaigns,
      // Use actual spend from runTotals (works for both frozen and legacy paths)
      remainingBudgetAtEnd: Math.max(0, scenario.budget - runTotals.totalSpend),
    });
    const liveOpt = buildLiveOptScore(daypartingLine, newCampaignLine);

    const crisisLines: ScoreLine[] = ([1, 2, 3] as const).reduce<ScoreLine[]>((acc, num) => {
      const resp = Object.values(crisisResponses).find((cr) => cr.crisisNum === num);
      if (resp) {
        acc.push(scoreCrisisResponse(num, resp.optionKey, resp.score ?? 0, resp.maxScore ?? 15));
      }
      return acc;
    }, []);
    const crisis = buildCrisisScore(crisisLines);

    const results = scoreResults(scenario, runTotals, runTotals.totalSpend);

    return assembleFinalScore(setup, liveOpt, crisis, results);
  }, [scenario, campaigns, daypartingChanges, crisisResponses, runTotals]);

  const lines = useMemo(() => (finalScore ? linesFromFinalScore(finalScore) : []), [finalScore]);
  const summaries = useMemo(() => qualitativeSummary(lines), [lines]);

  // ── Crisis list for detail cards ─────────────────────────────────────────
  const crisisList = useMemo(
    () => Object.values(crisisResponses).filter((c) => c.crisisNum).sort((a, b) => (a.crisisNum! - b.crisisNum!)),
    [crisisResponses],
  );

  // ── Save once ─────────────────────────────────────────────────────────────
  const savedRef = useRef(false);
  useEffect(() => {
    if (savedRef.current) return;
    if (mode === "review") return;

    // These two can legitimately be unready on the first render (context hydrating
    // from localStorage, finalScore still memoising). With an empty dep array this
    // effect bailed here and never ran again, so the attempt was silently never
    // saved. Deps below now include them so the save retries once they land.
    if (!activeRunId) { console.warn("[sim] attempt save deferred: no activeRunId yet"); return; }
    if (!finalScore)  { console.warn("[sim] attempt save deferred: finalScore not ready"); return; }

    // Set synchronously before the async insert so a re-run can't double-insert.
    savedRef.current = true;
    completeRun({ score: finalScore.grandTotal, achievementPct: finalScore.results.achievementPct });
    const firstCrisis = Object.values(crisisResponses)[0];
    const snapshot = {
      scenario, cmPitch, campaigns, weekTotals, decisionsLog, crisisResponses,
      abTests, cannibalResolved, clusterReactions, tokensSpent, tokensRemaining,
      microDecisionsLog, exhaustedCampaigns, cumulativeSpendByCampaign, events,
      optimizations, stockLevels, competitor, competitorActions,
    };
    let snapshotForCloud: typeof snapshot = snapshot;
    try {
      if (JSON.stringify(snapshot).length > 400_000) {
        snapshotForCloud = { ...snapshot, decisionsLog: [], microDecisionsLog: [] };
      }
    } catch (err) {
      console.warn("[sim] snapshot size check failed", err);
    }
    supabase.from("attempts").insert({
      email: student.email,
      name: student.name,
      batch_code: student.batch,
      profile_id: scenario.profile.id ?? scenario.profile.name,
      scenario: { seed: scenario.seed, profile: scenario.profile.name },
      choices: { campaigns: campaigns.length, abTests: abTests.length, tokensSpent },
      crisis_id: firstCrisis?.crisisId ?? null,
      crisis_choice: firstCrisis?.optionKey ?? null,
      crisis_points: Object.values(crisisResponses).reduce((s, c) => s + (c.score ?? 0), 0),
      score_total: finalScore.grandTotal,
      // version 1 + line-level scores; keeps grandTotal/setup/liveOpt/crisis/results/
      // achievementPct/grade/gradeLabel so older readers still work.
      score_breakdown: buildSavedBreakdown(finalScore) as unknown as Json,
      badge: finalScore.results.achievementPct >= 90 ? "gold"
           : finalScore.results.achievementPct >= 70 ? "silver"
           : finalScore.results.achievementPct >= 50 ? "bronze"
           : null,
      snapshot: snapshotForCloud as unknown as Json,
    }).then(({ error }) => {
      if (error) {
        console.error("attempt save failed", error);
        // Surface it — a silently-lost score is worse than an ugly toast, and the
        // trainer needs to know before the student walks away from the machine.
        toast.error("Your score could not be saved. Please tell your trainer before closing this page.", { duration: 15000 });
        // Allow a retry on the next render rather than locking the save out.
        savedRef.current = false;
        return;
      }
      // Only clear the live-run row once the permanent record is confirmed
      // saved — if the insert above failed, the row stays so the run isn't lost.
      supabase.from("run_sessions").delete().eq("email", student.email)
        .then(({ error: sessionError }) => {
          if (sessionError) console.warn("[sim] run_sessions delete failed", sessionError);
        });
    });
    // Re-run when the save inputs become available. savedRef makes this idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId, finalScore, mode]);

  // ── Promotion dialog state (hook must be before early return) ───────────
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── All hooks done — safe to early return now ────────────────────────────
  useTour("resultsV1", student?.email, !!finalScore);

  if (!student || !scenario || !runTotals || !finalScore) {
    nav("/");
    return null;
  }

  const { grandTotal, gradeLabel, setup, liveOpt, crisis, results, rights, wrongs } = finalScore;
  const brand = scenario.profile.name;

  const exportExcel = () => {
    try {
      const exportedAt = new Date().toISOString();
      const sheets = buildResultsSheets({
        student, brand, grandTotal, gradeLabel, achievementPct: results.achievementPct,
        lines, goalRows: results.goalRows, campaigns, perCampaign: r?.perCampaign ?? [],
        crisisResponses: crisisList, weekTotals, days: frozenDays ?? [], decisionsLog, microDecisionsLog,
        daypartingChanges, exportedAt,
      });
      downloadWorkbook(resultsFilename(student.name, brand, exportedAt), sheets, RESULTS_README);
      toast.success("Excel file downloaded.");
    } catch (err) {
      console.error("[results] Excel export failed", err);
      toast.error("We couldn't create the Excel file. Please try again.");
    }
  };

  const copyShare = () => {
    navigator.clipboard.writeText(shareText(grandTotal))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error("Couldn't copy. Select the text and copy it yourself."));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <BlinkitSidebar />
      <div className="flex-1 overflow-y-auto bg-background">
        <FlowHeader crumb="Campaign Results" step="results" />

        <SimPage>
          <PageHeader
            tour="results-header"
            eyebrow={`30-day run complete · ${brand}`}
            title={<><span className="sim-num">{grandTotal}</span> out of 100</>}
            description={<>Your grade: <span className="font-medium text-foreground">{gradeLabel}</span>. Below you can see where every point came from and where you lost points.</>}
            actions={
              <>
                <Button data-tour="results-download" variant="outline" onClick={exportExcel} className="gap-2"><Download className="h-4 w-4" /> Export to Excel</Button>
                <Button variant="outline" onClick={() => nav("/profile")} className="gap-2"><UserRound className="h-4 w-4" /> My profile</Button>
              </>
            }
          />

          <div className="space-y-6 pb-12">
            <GradeScale total={grandTotal} />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Setup" value={`${setup.total} / ${setup.maxTotal}`} tone={scoreTone(setup.total, setup.maxTotal)} hint="Campaign choices before the run" />
              <StatTile label="Live optimisation" value={`${liveOpt.total} / ${liveOpt.maxTotal}`} tone={scoreTone(liveOpt.total, liveOpt.maxTotal)} hint="Changes during the run" />
              <StatTile label="Crisis responses" value={`${crisis.total} / ${crisis.maxTotal}`} tone={scoreTone(crisis.total, crisis.maxTotal)} hint={crisis.lines.length ? `${crisis.lines.length} of 3 crises answered` : "No crises answered"} />
              <StatTile label="Results" value={`${results.total} / ${results.maxTotal}`} tone={scoreTone(results.total, results.maxTotal)} hint="Client goals and budget used" />
            </div>

            <div data-tour="results-summary"><ScoreSummary summaries={summaries} /></div>

            <div data-tour="results-breakdown"><ScoreBreakdown lines={lines} /></div>

            <div data-tour="results-goals"><GoalTable goals={results.goalRows} achievementPct={results.achievementPct} /></div>

            <CampaignTable metrics={r?.perCampaign ?? []} campaigns={campaigns} />

            <CrisisList crises={crisisList} />

            <div className="grid gap-6 md:grid-cols-2">
              <Section title="Strong decisions">
                {rights.length === 0
                  ? <p className="text-sm text-muted-foreground">No line reached 70% of its points in this run.</p>
                  : <ul className="list-disc space-y-2 pl-5 text-sm">{rights.map((x) => <li key={x}>{plainText(x)}</li>)}</ul>}
              </Section>
              <Section title="Decisions that cost you">
                {wrongs.length === 0
                  ? <p className="text-sm text-muted-foreground">No line scored below half its points.</p>
                  : <ul className="list-disc space-y-2 pl-5 text-sm">{wrongs.map((x) => <li key={x}>{plainText(x)}</li>)}</ul>}
              </Section>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  localStorage.removeItem("sim_brief_ack");
                  newScenario(); // clears campaigns, resets state, sets activeRunId = null
                  nav("/brief");
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Try a new scenario
              </Button>
              <Button variant="outline" onClick={() => nav("/dashboard")} className="gap-2"><Home className="h-4 w-4" /> Back to dashboard</Button>
              <Button variant="outline" onClick={() => nav("/leaderboard")} className="gap-2"><BarChart3 className="h-4 w-4" /> Leaderboard</Button>
              {grandTotal >= 90 && (
                <Button variant="outline" className="gap-2 border-primary text-primary" onClick={() => setPromotionOpen(true)}>
                  <Award className="h-4 w-4" /> Accept promotion to Senior Executive
                </Button>
              )}
            </div>
          </div>
        </SimPage>
      </div>

      {/* ── Promotion dialog ─────────────────────────────────────────────── */}
      <Dialog open={promotionOpen} onOpenChange={setPromotionOpen}>
        <DialogContent className="sim-ui max-w-md p-8 text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Promotion accepted</DialogTitle>
          </DialogHeader>
          <Award className="mx-auto mb-3 h-12 w-12 text-primary" aria-hidden />
          <h2 className="text-2xl font-semibold text-foreground">You're promoted</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Well done, <strong>{student.name}</strong>. You are now<br />
            <span className="font-semibold text-primary">Senior Executive, Performance Marketing</span>
          </p>
          <div className="mb-5 rounded-xl bg-accent px-6 py-4">
            <div className="text-xs text-muted-foreground">Final score</div>
            <div className="sim-num text-4xl font-semibold">{grandTotal}<span className="text-lg font-normal text-muted-foreground"> / 100</span></div>
            <div className="mt-1 text-sm text-muted-foreground">{gradeLabel}</div>
          </div>

          <div className="mb-5 text-left">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Share your result</div>
            <div className="select-all rounded-md border border-border bg-secondary px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
              {shareText(grandTotal)}
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full gap-2 text-xs" onClick={copyShare}>
              {copied ? <><Check className="h-3.5 w-3.5 text-primary" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy to clipboard</>}
            </Button>
          </div>

          <Button className="w-full gap-2" onClick={() => { setPromotionOpen(false); nav("/leaderboard"); }}>
            <BarChart3 className="h-4 w-4" /> Leaderboard
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
