import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { simulateRun } from "@/lib/simResults";
import { RefreshCw, Trophy, BarChart3, Home } from "lucide-react";

function fmt(n: number) { return n.toLocaleString("en-IN"); }
function fmtTarget(n: number, unit: string) {
  if (unit === "imp" || unit === "users") {
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    return fmt(Math.round(n));
  }
  if (unit === "x" || unit === "%") return `${n}${unit}`;
  return `${fmt(Math.round(n))} ${unit}`;
}

export default function Day30Results() {
  const nav = useNavigate();
  const { student, scenario, campaigns, cmPitch, weekTotals, decisionsLog, newScenario,
    abTests, cannibalResolved, clusterReactions, tokensSpent, crisisResponses } = useSim();

  if (!student || !scenario) { nav("/"); return null; }

  const r = useMemo(
    () => simulateRun(scenario, campaigns, cmPitch, { abTests, cannibalResolved, clusterReactions, tokensSpent }),
    [scenario, campaigns, cmPitch, abTests, cannibalResolved, clusterReactions, tokensSpent]
  );

  const crisisList = useMemo(
    () =>
      Object.values(crisisResponses)
        .filter((c) => c.crisisNum)
        .sort((a, b) => (a.crisisNum! - b.crisisNum!)),
    [crisisResponses],
  );

  const achColor = r.achievementPct >= 90 ? "text-primary" :
    r.achievementPct >= 70 ? "text-amber-600" :
    r.achievementPct >= 50 ? "text-orange-600" : "text-destructive";
  const achBg = r.achievementPct >= 90 ? "bg-primary/10 border-primary/30" :
    r.achievementPct >= 70 ? "bg-amber-50 border-amber-300" :
    r.achievementPct >= 50 ? "bg-orange-50 border-orange-300" : "bg-destructive/10 border-destructive/30";

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        <FlowHeader crumb="Campaign Results" step="results" />
        <div className="px-8 pt-4 pb-2">
          <h1 className="text-xl font-semibold text-foreground">Campaign Complete — 30 Days</h1>
        </div>

        <div className="px-8 py-6 max-w-5xl space-y-5">
          {/* Goal achievement */}
          <Card className={`p-6 border-2 ${achBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3">🎯 Goal Achievement</h3>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2">Target Metric</th>
                  <th className="text-right py-2">Goal</th>
                  <th className="text-right py-2">Actual</th>
                  <th className="text-right py-2">Achievement %</th>
                </tr>
              </thead>
              <tbody>
                {r.goalRows.map((g) => (
                  <tr key={g.label} className="border-b border-border last:border-0">
                    <td className="py-2">{g.label}</td>
                    <td className="py-2 text-right">{fmtTarget(g.goal, g.unit)}</td>
                    <td className="py-2 text-right font-medium">{fmtTarget(g.actual, g.unit)}</td>
                    <td className={`py-2 text-right font-bold ${g.pct >= 90 ? "text-primary" : g.pct >= 70 ? "text-amber-600" : "text-destructive"}`}>{g.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-center pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">OVERALL GOAL ACHIEVEMENT</div>
              <div className={`text-5xl font-bold ${achColor}`}>{r.achievementPct}% {r.achievementPct >= 90 ? "🎉" : ""}</div>
            </div>
          </Card>

          {/* Per campaign */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Campaign Performance</h3>
            <div className="space-y-3">
              {r.perCampaign.length === 0 && <p className="text-xs text-muted-foreground">No campaigns to report.</p>}
              {r.perCampaign.map((m) => {
                const cmp = campaigns.find((c) => c.id === m.campaignId);
                return (
                  <Card key={m.campaignId} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">{m.name}</span>
                      <Badge className={m.status === "strong" ? "bg-primary text-primary-foreground" : m.status === "average" ? "bg-amber-500 text-white" : "bg-destructive text-destructive-foreground"}>
                        {m.status === "strong" ? "🟢 Strong" : m.status === "average" ? "🟡 Average" : "🔴 Failing"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-6 gap-3 text-xs">
                      <Metric label="Spend / Budget" value={`₹${fmt(m.spend)} / ₹${fmt(cmp?.budget || 0)}`} />
                      <Metric label="Impressions" value={fmt(m.impressions)} />
                      <Metric label="Clicks (CTR)" value={`${fmt(m.clicks)} (${m.ctr.toFixed(2)}%)`} />
                      <Metric label="Units" value={fmt(m.units)} />
                      <Metric label="Revenue" value={`₹${fmt(m.revenue)}`} />
                      <Metric label="ROAS" value={`${m.roas.toFixed(2)}x`} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>

          {/* Weekly Performance Timeline */}
          {weekTotals.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">📅 Weekly Performance Timeline</h3>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((w) => {
                  const wt = weekTotals.find((x) => x.week === w)?.totals;
                  const strongest = weekTotals.reduce((m, x) => x.totals.roas > (m?.totals.roas ?? 0) ? x : m, weekTotals[0]);
                  const isStrong = strongest?.week === w;
                  return (
                    <Card key={w} className={`p-3 ${isStrong ? "border-primary bg-primary/5" : ""}`}>
                      <div className="text-xs font-semibold mb-2">Week {w} {isStrong && "🏆"}</div>
                      {wt ? (
                        <div className="space-y-1 text-xs">
                          <div>Spend: ₹{fmt(wt.spend)}</div>
                          <div>Imp: {fmt(wt.impressions)}</div>
                          <div>Units: {fmt(wt.units)}</div>
                          <div className="font-semibold">ROAS: {wt.roas.toFixed(2)}x</div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No data</div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Crisis Decisions */}
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

          {/* Decision Timeline */}
          {decisionsLog.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">🗒️ Decision Timeline</h3>
              {[1, 2, 3].map((w) => {
                const items = decisionsLog.filter((d) => d.week === w);
                if (items.length === 0) return null;
                return (
                  <div key={w} className="mb-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Day {w * 7} Decisions:</div>
                    <ul className="space-y-1 text-xs ml-3">
                      {items.map((d, i) => (
                        <li key={i}>
                          • {d.description}
                          {d.tokenCost > 0 && <span className="text-muted-foreground"> ({d.tokenCost} tokens)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </Card>
          )}

          {/* Decision score */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Decision Quality Score</h3>
              <div className="text-2xl font-bold text-primary">{r.decisionTotal}/100</div>
            </div>
            <div className="space-y-3">
              {r.decisionScore.map((d) => {
                const pct = (d.earned / d.max) * 100;
                const c = pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-amber-500" : "bg-destructive";
                return (
                  <div key={d.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{d.label}</span>
                      <span className="text-muted-foreground">{d.earned}/{d.max}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${c}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Client verdict */}
          <Card className={`p-6 border-l-4 ${r.verdict.tone === "good" ? "border-l-primary bg-primary/5" : r.verdict.tone === "warn" ? "border-l-amber-500 bg-amber-50" : "border-l-destructive bg-destructive/5"}`}>
            <div className="flex items-start gap-3">
              <Trophy className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-muted-foreground">CLIENT VERDICT</div>
                <p className="text-sm text-foreground mt-1 italic">"{r.verdict.quote}"</p>
              </div>
            </div>
          </Card>

          {/* Right / wrong */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5 border-primary/30 bg-primary/5">
              <h4 className="text-sm font-semibold text-primary mb-3">✅ Strong Decisions</h4>
              {r.rights.length === 0 ? <p className="text-xs text-muted-foreground">No standout wins.</p> :
                <ul className="space-y-2 text-xs">{r.rights.map((x, i) => <li key={i}>• {x}</li>)}</ul>}
            </Card>
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <h4 className="text-sm font-semibold text-destructive mb-3">❌ Decisions That Cost You</h4>
              {r.wrongs.length === 0 ? <p className="text-xs text-muted-foreground">Clean run — no major mistakes.</p> :
                <ul className="space-y-2 text-xs">{r.wrongs.map((x, i) => <li key={i}>• {x}</li>)}</ul>}
            </Card>
          </div>

          <div className="flex gap-3 pb-8 flex-wrap">
            <Button onClick={() => { localStorage.removeItem("sim_brief_ack"); newScenario(); nav("/brief"); }} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Try New Scenario
            </Button>
            <Button variant="outline" onClick={() => nav("/dashboard")} className="gap-2">
              <Home className="h-4 w-4" /> Back to Dashboard
            </Button>
            <Button variant="outline" onClick={() => nav("/leaderboard")} className="gap-2">
              <BarChart3 className="h-4 w-4" /> View Leaderboard
            </Button>
            {r.achievementPct >= 90 && (
              <Button variant="outline" className="gap-2 border-primary text-primary">
                🎉 Accept Promotion to Senior Executive
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
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
