import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { pickCrisis, Crisis } from "@/data/scenarios";
import { score, CampaignChoices, ScoreResult } from "@/lib/scoring";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Trophy, RefreshCw, BarChart3 } from "lucide-react";

function loadChoices(): CampaignChoices {
  const g = (k: string, d: any = null) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
  };
  return {
    objective: g("campaign_objective"),
    adFormat: g("campaign_adAsset"),
    campaignName: g("campaign_name", ""),
    geography: g("sim_geography"),
    skuStrategy: g("sim_sku_strategy"),
    selectedSkuIds: g("sim_selected_skus", []),
    selectedKeywords: g("sim_selected_keywords", []),
    budgetType: g("sim_budget_type"),
  };
}

export default function Results() {
  const nav = useNavigate();
  const { student, scenario, newScenario } = useSim();
  const [crisis] = useState<Crisis | null>(() => scenario ? pickCrisis(scenario.seed + ":" + Date.now()) : null);
  const [crisisChoice, setCrisisChoice] = useState<"a" | "b" | "c" | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);

  useEffect(() => {
    if (!student || !scenario) nav("/");
  }, [student, scenario, nav]);

  const choices = useMemo(loadChoices, []);

  const handleCrisis = async (k: "a" | "b" | "c") => {
    if (!scenario || !crisis || !student) return;
    setCrisisChoice(k);
    const r = score(scenario, choices, crisis, k);
    setResult(r);
    try {
      await supabase.from("attempts").insert({
        email: student.email,
        name: student.name,
        batch_code: student.batch,
        profile_id: scenario.profile.id,
        scenario: {
          city: scenario.city,
          season: scenario.season.name,
          market: scenario.market.name,
          inventory: scenario.inventory,
        } as any,
        choices: choices as any,
        crisis_id: crisis.id,
        crisis_choice: k,
        crisis_points: crisis.options.find((o) => o.key === k)?.points ?? 0,
        score_total: r.total,
        score_breakdown: r.lines as any,
        badge: r.badge,
      });
    } catch (e) {
      console.error("Failed to save attempt", e);
    }
  };

  if (!scenario || !student || !crisis) return null;

  if (!result) {
    return (
      <Dialog open>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" /> Mid-Campaign Crisis: {crisis.title}
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground">
              {crisis.message(scenario.city)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {crisis.options.map((o) => (
              <button
                key={o.key}
                onClick={() => handleCrisis(o.key)}
                className="w-full text-left p-3 rounded-md border border-border hover:border-primary hover:bg-accent transition-colors"
              >
                <span className="font-semibold text-sm mr-2">{o.key.toUpperCase()}.</span>
                <span className="text-sm">{o.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const scoreColor = result.verdictTone === "good" ? "text-primary" : result.verdictTone === "warn" ? "text-orange-500" : "text-destructive";

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        <div className="px-8 py-6 max-w-5xl space-y-5">
          <div>
            <div className="text-xs text-muted-foreground">Brand Central › Campaign Results</div>
            <h1 className="text-xl font-semibold text-foreground mt-1">Your Campaign Performance</h1>
          </div>

          {/* Score hero */}
          <Card className="p-8 flex items-center gap-8">
            <div className="text-center">
              <div className={`text-7xl font-bold ${scoreColor}`}>{result.total}</div>
              <div className="text-sm text-muted-foreground">out of 100</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-primary" />
                <Badge className="bg-primary text-primary-foreground text-sm">{result.badge}</Badge>
              </div>
              <h2 className={`text-2xl font-bold ${scoreColor}`}>{result.verdict}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Your {scenario.profile.name} campaign in {scenario.city} during {scenario.season.name},
                with {scenario.market.name.toLowerCase()} market conditions.
              </p>
            </div>
          </Card>

          {/* Score breakdown */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Score Breakdown</h3>
            <div className="space-y-3">
              {result.lines.map((l) => {
                const pct = (l.earned / l.max) * 100;
                const c = pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-orange-500" : "bg-destructive";
                return (
                  <div key={l.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{l.label}</span>
                      <span className="text-muted-foreground">{l.earned} / {l.max}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${c}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{l.note}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Right vs Wrong */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5 border-primary/30 bg-primary/5">
              <h4 className="text-sm font-semibold text-primary mb-3">✓ What You Did Right</h4>
              {result.rights.length === 0 ? (
                <p className="text-xs text-muted-foreground">Not much landed this time — review the breakdown.</p>
              ) : (
                <ul className="space-y-2 text-xs text-foreground">{result.rights.map((r, i) => <li key={i}>• {r}</li>)}</ul>
              )}
            </Card>
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <h4 className="text-sm font-semibold text-destructive mb-3">✗ What Cost You Points</h4>
              {result.wrongs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Clean run — no major mistakes!</p>
              ) : (
                <ul className="space-y-2 text-xs text-foreground">{result.wrongs.map((r, i) => <li key={i}>• {r}</li>)}</ul>
              )}
            </Card>
          </div>

          {/* Trap callout */}
          <Card className="p-5 border-orange-300 bg-orange-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-orange-900">The Trap In Your Scenario</h4>
                <p className="text-xs text-orange-800 mt-1">{scenario.profile.trap}</p>
              </div>
            </div>
          </Card>

          <div className="flex gap-3 pb-8">
            <Button variant="outline" onClick={() => nav("/leaderboard")} className="gap-2">
              <BarChart3 className="h-4 w-4" /> View Leaderboard
            </Button>
            <Button onClick={() => { newScenario(); nav("/brief"); }} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Try New Scenario
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
