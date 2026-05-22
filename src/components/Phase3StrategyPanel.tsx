import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useSim } from "@/context/SimContext";
import type { WeekResult } from "@/lib/weeklyMetrics";
import { nextCompetitorAction } from "@/lib/phase3";
import { initCompetitor, type CompetitorAction } from "@/data/competitor";
import { AlertTriangle, Swords, MapPin, TrendingDown, FlaskConical, Target } from "lucide-react";

function fmt(n: number) { return Math.round(n).toLocaleString("en-IN"); }
function money(n: number) { return `₹${fmt(n)}`; }

// Cache competitor actions per week so they don't reroll on re-renders
const compCache: Record<number, CompetitorAction | null> = {};

interface Props {
  week: 1 | 2 | 3;
  weekResult: WeekResult;
}

export function Phase3StrategyPanel({ week, weekResult }: Props) {
  const {
    scenario, campaigns, tokensRemaining,
    competitor, setCompetitor, addCompetitorAction, competitorActions,
    cannibalResolved, resolveCannibal,
    clusterReactions, addClusterReaction,
    abTests, addAbTest,
    consumeToken, logDecision,
  } = useSim();

  // Ensure a competitor exists
  useEffect(() => {
    if (scenario && !competitor) {
      setCompetitor(initCompetitor(scenario.market.name === "Aggressive Competitor"));
    }
  }, [scenario, competitor, setCompetitor]);

  // Compute / cache this week's competitor reaction (based on last week's top performers)
  const competitorAction = useMemo(() => {
    if (week < 2 || !competitor) return null;
    if (week in compCache) return compCache[week];
    // top keyword + city from current weekResult (proxy for "previous performance")
    const allKw = weekResult.campaigns.flatMap((c) => c.byKeyword);
    const topKw = [...allKw].sort((a, b) => b.roas - a.roas)[0]?.name;
    const allCities = weekResult.campaigns.flatMap((c) => c.byCity);
    const topCity = [...allCities].sort((a, b) => b.roas - a.roas)[0]?.city;
    const existing = competitorActions.find((a) => a.week === week);
    if (existing) { compCache[week] = existing; return existing; }
    const next = nextCompetitorAction(week, competitor, topKw, topCity);
    compCache[week] = next;
    if (next) addCompetitorAction(next);
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, competitor]);

  const unresolvedPairs = weekResult.cannibalPairs.filter(
    (p) => !cannibalResolved.includes(`${p.keyword}|${p.city}`)
  );

  const clustersWithoutReaction = weekResult.clusters.filter(
    (c) => !clusterReactions.some((r) => r.city === c.city)
  );

  const pacingAlerts = weekResult.pacing.filter((p) => p.exhausted || (p.projectedExhaustionDay && p.projectedExhaustionDay < 30));

  const [abModal, setAbModal] = useState<string | null>(null);
  const [abVar, setAbVar] = useState<string>("headline");

  const runAbTest = () => {
    if (!abModal) return;
    consumeToken(1);
    const winner: "A" | "B" = Math.random() > 0.5 ? "B" : "A";
    const lift = +(1 + (0.08 + Math.random() * 0.12)).toFixed(2); // 8-20% lift
    addAbTest({ campaignId: abModal, week, variable: abVar, winner, ctrMultiplier: lift });
    logDecision({ week, type: "edit", campaignId: abModal, description: `A/B tested ${abVar}. Variant ${winner} won (+${Math.round((lift - 1) * 100)}% CTR next week).`, tokenCost: 1 });
    setAbModal(null);
  };

  const handleResolveCannibal = (key: string, desc: string) => {
    consumeToken(1);
    resolveCannibal(key);
    logDecision({ week, type: "edit", description: `Resolved keyword overlap: ${desc}`, tokenCost: 1 });
  };

  const handleClusterReaction = (city: string, action: "cluster_daypart" | "cluster_bid" | "expand_similar" | "stay_broad") => {
    const cost = action === "stay_broad" ? 0 : action === "expand_similar" ? 0 : 1;
    if (cost > 0) consumeToken(cost);
    addClusterReaction({ city, action, tokenCost: cost });
    const label = action === "cluster_daypart" ? "dayparted to peak in top zones" :
      action === "cluster_bid" ? "raised bids in top zones" :
      action === "expand_similar" ? "expanded to similar zones" : "stayed broad";
    logDecision({ week, type: "edit", description: `${city}: ${label}`, tokenCost: cost });
  };

  const nothingToShow =
    !competitorAction && unresolvedPairs.length === 0 &&
    clustersWithoutReaction.length === 0 && pacingAlerts.length === 0;

  if (nothingToShow) return null;

  return (
    <div className="px-8 mt-6 space-y-3">
      {/* Competitor action banner */}
      {competitorAction && (
        <Card className="p-3 border-l-4 border-l-destructive bg-destructive/5">
          <div className="flex items-start gap-2">
            <Swords className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-destructive flex items-center gap-2">
                Competitor Reaction
                <Badge variant="outline" className="text-[10px] capitalize">{competitor?.name} · {competitor?.aggressiveness}</Badge>
              </div>
              <div className="mt-0.5 text-foreground/80">{competitorAction.description}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Cannibalization */}
      {unresolvedPairs.length > 0 && (
        <Card className="p-3 border-l-4 border-l-amber-500 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-amber-900">Keyword Cannibalization Detected</div>
              <div className="text-foreground/80 mt-0.5">
                Multiple campaigns are bidding on the same keyword in the same city — you're paying twice for the same shopper.
              </div>
              <div className="mt-2 space-y-1">
                {unresolvedPairs.slice(0, 3).map((p) => {
                  const key = `${p.keyword}|${p.city}`;
                  const names = p.campaignIds.map((id) => campaigns.find((c) => c.id === id)?.name).filter(Boolean).join(" ↔ ");
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 bg-background/60 rounded px-2 py-1.5">
                      <span><span className="font-medium">'{p.keyword}'</span> in {p.city} — <span className="text-muted-foreground">{names}</span></span>
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" disabled={tokensRemaining < 1}
                        onClick={() => handleResolveCannibal(key, `${p.keyword} in ${p.city}`)}>
                        Resolve (1 token)
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Pacing alerts */}
      {pacingAlerts.length > 0 && (
        <Card className="p-3 border-l-4 border-l-orange-500 bg-orange-50">
          <div className="flex items-start gap-2">
            <TrendingDown className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-orange-900">Budget Pacing Alert</div>
              <div className="space-y-0.5 mt-1">
                {pacingAlerts.slice(0, 4).map((p) => {
                  const c = campaigns.find((x) => x.id === p.campaignId);
                  if (!c) return null;
                  return (
                    <div key={p.campaignId} className="flex items-center justify-between bg-background/60 rounded px-2 py-1">
                      <span><span className="font-medium">{c.name}</span> — {p.pacePct}% spent ({money(p.cumulativeSpend)} of {money(p.budget)})</span>
                      <span className={p.exhausted ? "text-destructive font-semibold" : "text-orange-700"}>
                        {p.exhausted ? "🔴 Exhausted" : `⚠ Out by Day ${p.projectedExhaustionDay}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Cluster insights */}
      {clustersWithoutReaction.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Pin-Code Clusters Discovered</h3>
            <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">{clustersWithoutReaction.length} city{clustersWithoutReaction.length > 1 ? "s" : ""}</Badge>
          </div>
          <div className="space-y-2">
            {clustersWithoutReaction.map((ins) => (
              <div key={ins.city} className="border border-border rounded p-3 bg-muted/20">
                <div className="text-xs">
                  <span className="font-semibold">{ins.city}</span> — top 3 zones average{" "}
                  <span className="text-primary font-semibold">{ins.avgRoas.toFixed(2)}x ROAS</span>
                  {" "}vs rest {ins.restAvgRoas.toFixed(2)}x ({ins.ratio.toFixed(1)}× lift).
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Hotspots: {ins.topZones.map((z) => `${z.zone} (${z.roas.toFixed(1)}x)`).join(" · ")}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={tokensRemaining < 1}
                    onClick={() => handleClusterReaction(ins.city, "cluster_daypart")}>
                    Daypart top zones (1 token)
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={tokensRemaining < 1}
                    onClick={() => handleClusterReaction(ins.city, "cluster_bid")}>
                    Raise bids in zones (1 token)
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]"
                    onClick={() => handleClusterReaction(ins.city, "expand_similar")}>
                    Expand to similar (free)
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                    onClick={() => handleClusterReaction(ins.city, "stay_broad")}>
                    Stay broad
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* A/B test launcher (compact) */}
      {campaigns.length > 0 && week <= 2 && (
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="font-semibold">A/B Test Creative</span>
              <span className="text-muted-foreground">Run 1 test for +8–20% CTR next week (1 token).</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {campaigns.map((c) => {
                const tested = abTests.some((t) => t.campaignId === c.id);
                return (
                  <Button key={c.id} size="sm" variant="outline" className="h-7 text-[11px]"
                    disabled={tested || tokensRemaining < 1} onClick={() => setAbModal(c.id)}>
                    {tested ? `✓ ${c.name}` : `Test ${c.name}`}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* A/B Modal */}
      <Dialog open={!!abModal} onOpenChange={(o) => !o && setAbModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Run A/B Test</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Pick a variable to test. Winner auto-applies from next week.</p>
          <RadioGroup value={abVar} onValueChange={setAbVar} className="space-y-1.5">
            {[
              { v: "headline", l: "Headline copy" },
              { v: "creative", l: "Banner creative" },
              { v: "cta", l: "Call to action" },
              { v: "thumbnail", l: "Product thumbnail" },
            ].map((o) => (
              <Label key={o.v} className="flex items-center gap-2 border border-border rounded p-2 cursor-pointer text-sm">
                <RadioGroupItem value={o.v} />
                {o.l}
              </Label>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbModal(null)}>Cancel</Button>
            <Button onClick={runAbTest}>Run Test (1 token)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
