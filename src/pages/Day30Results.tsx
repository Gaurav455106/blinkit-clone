import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { simulateRun } from "@/lib/simResults";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Trophy, BarChart3, Home, Copy, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  scoreSetup, scoreDayparting, scoreNewCampaign, buildLiveOptScore,
  scoreCrisisResponse, buildCrisisScore, scoreResults, assembleFinalScore,
  type FinalScore, type ScoreLine,
} from "@/lib/newScoring";
import type { RunTotals } from "@/lib/engine";

function fmt(n: number) { return n.toLocaleString("en-IN"); }
function money(n: number) { return `₹${fmt(Math.round(n))}`; }
function fmtTarget(n: number, unit: string) {
  if (unit === "imp" || unit === "users") {
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    return fmt(Math.round(n));
  }
  if (unit === "x" || unit === "%") return `${n}${unit}`;
  return `${fmt(Math.round(n))} ${unit}`;
}

// ── Micro-components ──────────────────────────────────────────────────────────
function ProgressBar({ earned, max }: { earned: number; max: number }) {
  const pct = max > 0 ? (earned / max) * 100 : 0;
  const color = pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ScoreLineRow({ line }: { line: ScoreLine }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={line.good ? "text-foreground" : "text-muted-foreground"}>{line.label}</span>
        <span className={`font-semibold tabular-nums ${line.good ? "text-primary" : "text-muted-foreground"}`}>
          {line.earned}<span className="font-normal text-muted-foreground">/{line.max}</span>
        </span>
      </div>
      <ProgressBar earned={line.earned} max={line.max} />
      <p className="text-[10px] text-muted-foreground leading-snug">{line.note}</p>
    </div>
  );
}

function CategoryCard({
  emoji, title, total, maxTotal, lines,
}: {
  emoji: string; title: string; total: number; maxTotal: number; lines: ScoreLine[];
}) {
  const pct = (total / maxTotal) * 100;
  const border = pct >= 70 ? "border-primary/40 bg-primary/5" : pct >= 40 ? "border-amber-300 bg-amber-50/50" : "border-destructive/30 bg-destructive/5";
  return (
    <Card className={`p-4 border-2 ${border}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{emoji} {title}</div>
          <div className="text-2xl font-bold tabular-nums mt-0.5">
            {total}<span className="text-sm font-normal text-muted-foreground">/{maxTotal}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{Math.round(pct)}%</div>
      </div>
      <ProgressBar earned={total} max={maxTotal} />
      <div className="mt-3 space-y-3">
        {lines.map((l) => <ScoreLineRow key={l.key} line={l} />)}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Day30Results() {
  const nav = useNavigate();
  const {
    student, scenario, campaigns, cmPitch, weekTotals, decisionsLog, newScenario,
    abTests, cannibalResolved, clusterReactions, tokensSpent, tokensRemaining,
    microDecisionsLog, exhaustedCampaigns, cumulativeSpendByCampaign, events,
    optimizations, stockLevels, competitor, competitorActions,
    crisisResponses, activeRunId, completeRun, mode,
    daypartingChanges, midRunCampaignLaunched,
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

  // ── RunTotals bridge ──────────────────────────────────────────────────────
  // Prefer frozen engine days (same numbers the student watched in LiveDashboard).
  // reach/brandedLift/sellThrough are derived directly from frozen impressions/units
  // so they are consistent with the live chart — no legacy engine needed for these.
  const runTotals: RunTotals | null = useMemo(() => {
    if (!scenario) return null;
    const frozenDays = activeRunId ? (savedRunResults[activeRunId]?.days ?? null) : null;
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
  }, [r, activeRunId, savedRunResults, scenario]);

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
    if (!activeRunId) return;
    if (!finalScore) return;
    savedRef.current = true;
    completeRun({ score: finalScore.grandTotal, achievementPct: finalScore.results.achievementPct });
    const firstCrisis = Object.values(crisisResponses)[0];
    const snapshot = {
      scenario, cmPitch, campaigns, weekTotals, decisionsLog, crisisResponses,
      abTests, cannibalResolved, clusterReactions, tokensSpent, tokensRemaining,
      microDecisionsLog, exhaustedCampaigns, cumulativeSpendByCampaign, events,
      optimizations, stockLevels, competitor, competitorActions,
    };
    let snapshotForCloud: any = snapshot;
    try {
      if (JSON.stringify(snapshot).length > 400_000) {
        snapshotForCloud = { ...snapshot, decisionsLog: [], microDecisionsLog: [] };
      }
    } catch {}
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
      score_breakdown: {
        grandTotal: finalScore.grandTotal,
        grade: finalScore.grade,
        gradeLabel: finalScore.gradeLabel,
        setup: finalScore.setup.total,
        liveOpt: finalScore.liveOpt.total,
        crisis: finalScore.crisis.total,
        results: finalScore.results.total,
        achievementPct: finalScore.results.achievementPct,
      },
      badge: finalScore.results.achievementPct >= 90 ? "gold"
           : finalScore.results.achievementPct >= 70 ? "silver"
           : finalScore.results.achievementPct >= 50 ? "bronze"
           : null,
      snapshot: snapshotForCloud,
    }).then(({ error }) => { if (error) console.error("attempt save failed", error); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Promotion dialog state (hook must be before early return) ───────────
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── All hooks done — safe to early return now ────────────────────────────
  if (!student || !scenario || !runTotals || !finalScore) {
    nav("/");
    return null;
  }

  const { grandTotal, grade, gradeLabel, setup, liveOpt, crisis, results, rights, wrongs } = finalScore;

  const heroBg = grandTotal >= 90 ? "from-primary/10 to-primary/5 border-primary/30"
    : grandTotal >= 75 ? "from-amber-50 to-amber-50/30 border-amber-300"
    : grandTotal >= 60 ? "from-orange-50 to-orange-50/30 border-orange-300"
    :                    "from-destructive/10 to-destructive/5 border-destructive/30";

  return (
    <div className="flex h-screen overflow-hidden w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        <FlowHeader crumb="Campaign Results" step="results" />

        <div className="px-8 py-6 max-w-5xl space-y-5 pb-12">

          {/* Hero banner */}
          <Card className={`p-6 border-2 bg-gradient-to-br ${heroBg}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  30-Day Campaign Complete
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold tabular-nums">{grandTotal}</span>
                  <span className="text-xl text-muted-foreground font-normal">/ 100 pts</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl">{grade}</span>
                  <span className="text-base font-semibold">{gradeLabel}</span>
                </div>
              </div>
              <div className="text-right space-y-1 text-xs text-muted-foreground">
                <div>Setup <span className="font-semibold text-foreground">{setup.total}/35</span></div>
                <div>Live Opt <span className="font-semibold text-foreground">{liveOpt.total}/25</span></div>
                <div>Crisis <span className="font-semibold text-foreground">{crisis.total}/25</span></div>
                <div>Results <span className="font-semibold text-foreground">{results.total}/15</span></div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    grandTotal >= 75 ? "bg-primary" : grandTotal >= 60 ? "bg-amber-500" : "bg-destructive"
                  }`}
                  style={{ width: `${grandTotal}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>0</span>
                <span>40 Still Learning</span>
                <span>60 Growing Fast</span>
                <span>75 Sharp Strategist</span>
                <span>90 QCommerce Pro</span>
              </div>
            </div>
          </Card>

          {/* 4 category score cards */}
          <div className="grid grid-cols-2 gap-4">
            <CategoryCard
              emoji="🏗️" title="Setup (35 pts)"
              total={setup.total} maxTotal={35}
              lines={setup.lines}
            />
            <CategoryCard
              emoji="⚙️" title="Live Optimisation (25 pts)"
              total={liveOpt.total} maxTotal={25}
              lines={[liveOpt.daypartingLine, liveOpt.newCampaignLine]}
            />
            <CategoryCard
              emoji="🚨" title="Crisis Responses (25 pts)"
              total={crisis.total} maxTotal={25}
              lines={crisis.lines.length > 0 ? crisis.lines : [{
                key: "no_crisis", label: "No crises encountered",
                earned: 0, max: 25,
                note: "No crisis events were triggered during your run.", good: false,
              }]}
            />
            <CategoryCard
              emoji="🎯" title="Results (15 pts)"
              total={results.total} maxTotal={15}
              lines={results.lines}
            />
          </div>

          {/* Goal achievement table */}
          {results.goalRows.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">🎯 Client Goal Achievement</h3>
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2">Target Metric</th>
                    <th className="text-right py-2">Goal</th>
                    <th className="text-right py-2">Actual</th>
                    <th className="text-right py-2">Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  {results.goalRows.map((g) => (
                    <tr key={g.label} className="border-b border-border last:border-0">
                      <td className="py-2">{g.label}</td>
                      <td className="py-2 text-right text-muted-foreground">{fmtTarget(g.goal, g.unit)}</td>
                      <td className="py-2 text-right font-medium">{fmtTarget(g.actual, g.unit)}</td>
                      <td className={`py-2 text-right font-bold ${
                        g.pct >= 90 ? "text-primary" : g.pct >= 70 ? "text-amber-600" : "text-destructive"
                      }`}>{g.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-center pt-3 border-t border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Overall Goal Achievement</div>
                <div className={`text-4xl font-bold mt-0.5 ${
                  results.achievementPct >= 90 ? "text-primary" :
                  results.achievementPct >= 70 ? "text-amber-600" : "text-destructive"
                }`}>{results.achievementPct}%</div>
              </div>
            </Card>
          )}

          {/* Campaign performance */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Campaign Performance</h3>
            <div className="space-y-3">
              {(!r || r.perCampaign.length === 0) && <p className="text-xs text-muted-foreground">No campaigns to report.</p>}
              {(r?.perCampaign ?? []).map((m) => {
                const cmp = campaigns.find((c) => c.id === m.campaignId);
                return (
                  <Card key={m.campaignId} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{m.name}</span>
                      <Badge className={
                        m.status === "strong"  ? "bg-primary text-primary-foreground" :
                        m.status === "average" ? "bg-amber-500 text-white" :
                                                 "bg-destructive text-destructive-foreground"
                      }>
                        {m.status === "strong" ? "🟢 Strong" : m.status === "average" ? "🟡 Average" : "🔴 Failing"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-6 gap-3 text-xs">
                      <Metric label="Spend / Budget" value={`${money(m.spend)} / ${money(cmp?.budget ?? 0)}`} />
                      <Metric label="Impressions"    value={fmt(m.impressions)} />
                      <Metric label="Clicks (CTR)"   value={`${fmt(m.clicks)} (${m.ctr.toFixed(2)}%)`} />
                      <Metric label="Units"          value={fmt(m.units)} />
                      <Metric label="Revenue"        value={money(m.revenue)} />
                      <Metric label="ROAS"           value={`${m.roas.toFixed(2)}×`} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>

          {/* Crisis decisions */}
          {crisisList.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">🚨 Crisis Decisions</h3>
              <div className="space-y-3">
                {crisisList.map((c) => {
                  const pct = c.maxScore ? (c.score! / c.maxScore) * 100 : 0;
                  const tone = c.bestChoice ? "text-primary" : pct >= 60 ? "text-amber-600" : "text-destructive";
                  return (
                    <Card key={c.crisisId} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">Day {c.day}</div>
                          <div className="text-sm font-semibold">{c.title}</div>
                          <div className="text-xs mt-1">Chose: <span className="font-medium">{c.optionLabel}</span></div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">Effect: {c.effectLabel}</div>
                          <div className="text-[11px] mt-1 italic">
                            {c.bestChoice ? "✅ Best available choice." : pct >= 60 ? "🟡 Solid call but not optimal." : "🔴 A stronger option was available."}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-bold ${tone}`}>+{c.score}</div>
                          <div className="text-[10px] text-muted-foreground">/ {c.maxScore} pts</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Rights / Wrongs */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5 border-primary/30 bg-primary/5">
              <h4 className="text-sm font-semibold text-primary mb-3">✅ Strong Decisions</h4>
              {rights.length === 0
                ? <p className="text-xs text-muted-foreground">No standout wins this run.</p>
                : <ul className="space-y-2 text-xs">{rights.map((x, i) => <li key={i}>• {x}</li>)}</ul>}
            </Card>
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <h4 className="text-sm font-semibold text-destructive mb-3">❌ Decisions That Cost You</h4>
              {wrongs.length === 0
                ? <p className="text-xs text-muted-foreground">Clean run — no major mistakes.</p>
                : <ul className="space-y-2 text-xs">{wrongs.map((x, i) => <li key={i}>• {x}</li>)}</ul>}
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => {
              localStorage.removeItem("sim_brief_ack");
              newScenario(); // clears campaigns, resets state, sets activeRunId = null
              nav("/brief");
            }} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Try New Scenario
            </Button>
            <Button variant="outline" onClick={() => nav("/dashboard")} className="gap-2">
              <Home className="h-4 w-4" /> Back to Dashboard
            </Button>
            <Button variant="outline" onClick={() => nav("/leaderboard")} className="gap-2">
              <BarChart3 className="h-4 w-4" /> View Leaderboard
            </Button>
            {grandTotal >= 90 && (
              <Button variant="outline" className="gap-2 border-primary text-primary" onClick={() => setPromotionOpen(true)}>
                🎉 Accept Promotion to Senior Executive
              </Button>
            )}
          </div>

        </div>
      </div>

      {/* ── Promotion dialog ─────────────────────────────────────────────── */}
      <Dialog open={promotionOpen} onOpenChange={setPromotionOpen}>
        <DialogContent className="max-w-md text-center p-8">
          <DialogHeader>
            <DialogTitle className="sr-only">Promotion Accepted</DialogTitle>
          </DialogHeader>
          <div className="text-6xl mb-3">🏆</div>
          <h2 className="text-2xl font-bold text-foreground">Promoted!</h2>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Congratulations, <strong>{student.name}</strong>. You've been promoted to<br />
            <span className="text-primary font-semibold">Senior Executive — Performance Marketing</span>
          </p>
          <div className="rounded-xl border-2 border-primary bg-primary/5 px-6 py-4 mb-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Final Score</div>
            <div className="text-4xl font-bold tabular-nums">{grandTotal}<span className="text-lg font-normal text-muted-foreground"> / 100</span></div>
            <div className="text-sm text-muted-foreground mt-1">{grade} {gradeLabel}</div>
          </div>

          {/* Copyable share text */}
          <div className="text-left mb-5">
            <div className="text-xs text-muted-foreground mb-1.5 font-medium">Share your achievement</div>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-foreground font-mono leading-relaxed select-all">
              {`I scored ${grandTotal}/100 on the Blinkit Ads Simulation by Kraftshala — promoted to Senior Executive! 🏆 #QCommercePro #Kraftshala`}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full gap-2 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(
                  `I scored ${grandTotal}/100 on the Blinkit Ads Simulation by Kraftshala — promoted to Senior Executive! 🏆 #QCommercePro #Kraftshala`,
                ).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
              }}
            >
              {copied ? <><Check className="h-3.5 w-3.5 text-primary" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy to clipboard</>}
            </Button>
          </div>

          <Button className="w-full gap-2" onClick={() => { setPromotionOpen(false); nav("/leaderboard"); }}>
            <BarChart3 className="h-4 w-4" /> View Leaderboard
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
