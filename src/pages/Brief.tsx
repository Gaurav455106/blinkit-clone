import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Target, MapPin, Lightbulb, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { STATE_TO_CITIES, activeStoresFor, CityName, stockedStates, BLINKIT_STATES, GoalType } from "@/data/scenarios";
import { FlowHeader } from "@/components/FlowHeader";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTarget(t: { label: string; target: number; unit: string }) {
  let v: string;
  if (t.unit === "imp" || t.unit === "users") {
    if (t.target >= 100000) v = `${(t.target / 100000).toFixed(t.target % 100000 === 0 ? 0 : 1)}L`;
    else v = t.target.toLocaleString("en-IN");
  } else {
    v = t.target.toString();
  }
  return `${v}${t.unit === "x" || t.unit === "%" ? t.unit : t.unit === "imp" || t.unit === "users" ? "" : ` ${t.unit}`}`;
}

function inventoryImplication(tone: string): string {
  switch (tone) {
    case "healthy":    return "Good stock levels — scale confidently. Your ads can deliver without constraints.";
    case "warning":    return "Stock is patchy. Narrow geo targeting to stocked states only to avoid under-delivery.";
    case "critical":   return "Critical OSA — ads will underdeliver badly. Fix inventory before spending on reach campaigns.";
    case "overstocked":return "Too much stock. Sell-through is the priority — price promotions or heavy conversion spend may help.";
    default: return "";
  }
}

// ─── Comprehension quiz ───────────────────────────────────────────────────────

const GOAL_LABELS: Record<GoalType, string> = {
  "ROAS-First":         "Drive sales with maximum return on ad spend",
  "Awareness-First":    "Build brand recognition among new shoppers",
  "Category-Creation":  "Pioneer this category and educate new customers",
  "Volume-First":       "Sell as many units as possible",
  "Inventory-Clearance":"Move aging stock before it expires",
};

function buildQuiz(
  goalType: GoalType,
  primaryState: CityName,
  cityStockMap: Record<string, number>,
) {
  // Q1 — correct answer + 2 wrong picks
  const correct1 = GOAL_LABELS[goalType];
  const wrong1Pool = (Object.entries(GOAL_LABELS) as [GoalType, string][])
    .filter(([k]) => k !== goalType)
    .map(([, v]) => v);
  // deterministic wrong picks (no randomness so quiz is stable on re-render)
  const wrongs1 = wrong1Pool.slice(0, 2);
  const q1Options = [correct1, ...wrongs1].sort();

  // Q2 — correct primary state + 2 wrong (zero-stock) states
  const zeroStates = BLINKIT_STATES.filter((s) => (cityStockMap[s] ?? 0) === 0);
  const wrong2 = zeroStates.slice(0, 2);
  const q2Options = [primaryState, ...wrong2].sort();

  return { q1Options, correct1, q2Options, correct2: primaryState };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Brief() {
  const nav = useNavigate();
  const { student, scenario } = useSim();

  // Quiz state
  const [q1Answer, setQ1Answer] = useState<string | null>(null);
  const [q2Answer, setQ2Answer] = useState<string | null>(null);
  const [quizChecked, setQuizChecked] = useState(false);
  // Escape hatch: track failed attempts — show skip after 3 wrong checks
  const [quizAttempts, setQuizAttempts] = useState(0);
  const [quizSkipped,  setQuizSkipped]  = useState(false);

  // Budget split — stored as conversion % (0–100); reach gets the remainder
  // Uses scenario?.profile at init time because profile isn't destructured until after the null guard
  const [convPct, setConvPct] = useState(() => {
    const gt = scenario?.profile?.goalType;
    return gt === "ROAS-First" ? 70 : gt === "Volume-First" ? 60 : 30;
  });

  if (!student || !scenario) { nav("/"); return null; }

  const { profile, season, market, inventory, budget, clientGoals, cityStockMap } = scenario;

  const quiz = useMemo(
    () => buildQuiz(profile.goalType, profile.primaryState, cityStockMap),
    [profile.goalType, profile.primaryState, cityStockMap],
  );

  const q1Correct = quizChecked && q1Answer === quiz.correct1;
  const q2Correct = quizChecked && q2Answer === quiz.correct2;
  const quizPassed = q1Correct && q2Correct;

  const convNum = Math.round(budget * convPct / 100);
  const reachNum = budget - convNum;

  // Student can continue if they passed the quiz OR deliberately skipped after 3 failures
  const canContinue = quizPassed || quizSkipped;

  const handleCheckAnswers = () => {
    setQuizChecked(true);
    if (!(q1Answer === quiz.correct1 && q2Answer === quiz.correct2)) {
      setQuizAttempts((n) => n + 1);
    }
  };

  const handleContinue = () => {
    localStorage.setItem("sim_brief_ack", "1");
    localStorage.setItem("sim_budget_intent_conversion", String(convNum));
    localStorage.setItem("sim_budget_intent_reach", String(reachNum));
    localStorage.setItem("sim_budget_intent_conv_pct", String(convPct));
    nav("/cm-pitch");
  };

  return (
    <div className="flex h-screen overflow-hidden w-full bg-background">
      <BlinkitSidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <FlowHeader crumb="Client Brief" step="brief" backTo="/dashboard" backLabel="Dashboard" />
        <div className="px-8 pt-4 pb-2">
          <h1 className="text-xl font-semibold text-foreground">Your Brand Brief</h1>
          <p className="text-xs text-muted-foreground">Hi {student.name} — here's the client you're running this campaign for.</p>
        </div>

        <div className="flex-1 px-8 py-6 overflow-y-auto space-y-5 max-w-5xl">

          {/* ── Brand header ─────────────────────────────────────────────── */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-accent flex items-center justify-center text-3xl">{profile.emoji}</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
                    <Badge variant="outline">{profile.category}</Badge>
                    <Badge className={
                      profile.difficulty === "Medium" ? "bg-primary text-primary-foreground" :
                      profile.difficulty === "Hard"   ? "bg-orange-500 text-white" :
                      "bg-destructive text-destructive-foreground"
                    }>{profile.difficulty}</Badge>
                    <Badge variant="outline" className="border-primary text-primary">{profile.goalType}</Badge>
                    <Badge variant="outline" className={
                      clientGoals.lifecycle === "Acquire" ? "bg-blue-100 text-blue-800 border-blue-300" :
                      clientGoals.lifecycle === "Convert" ? "bg-orange-100 text-orange-800 border-orange-300" :
                      "bg-purple-100 text-purple-800 border-purple-300"
                    }>
                      {clientGoals.lifecycle === "Acquire" ? "🌱 Acquire" :
                       clientGoals.lifecycle === "Convert" ? "🎯 Convert" : "🔄 Retain"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{profile.context}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">Campaign Budget</div>
                <div className="text-2xl font-bold text-primary">₹{budget.toLocaleString("en-IN")}</div>
              </div>
            </div>
          </Card>

          {/* ── Client goals — split by campaign type ────────────────────── */}
          <Card className="p-6 border-2 border-amber-300 bg-amber-50">
            <div className="flex items-start gap-3">
              <Target className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">🎯 What the client wants</h3>
                <div className="mt-1">
                  <div className="text-xs font-semibold text-amber-900">PRIMARY GOAL</div>
                  <div className="text-base font-bold text-amber-950">{clientGoals.primary}</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  {(clientGoals.performanceGoals ?? []).length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
                        <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">Conversion Targets</span>
                      </div>
                      <div className="text-[10px] text-orange-600 mb-2">→ Product Booster · Recommendation Ads</div>
                      <div className="space-y-2">
                        {(clientGoals.performanceGoals ?? []).map((m) => (
                          <div key={m.label} className="rounded-md bg-white border border-orange-200 p-2.5 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">{m.label}</span>
                            <span className="text-sm font-bold text-foreground">{formatTarget(m)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(clientGoals.reachGoals ?? []).length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Reach Targets</span>
                      </div>
                      <div className="text-[10px] text-blue-600 mb-2">→ Listing Spotlight · Brand Booster · Stories</div>
                      <div className="space-y-2">
                        {(clientGoals.reachGoals ?? []).map((m) => (
                          <div key={m.label} className="rounded-md bg-white border border-blue-200 p-2.5 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">{m.label}</span>
                            <span className="text-sm font-bold text-foreground">{formatTarget(m)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-amber-900">
                  <strong>Threshold:</strong> {clientGoals.threshold}
                </div>
              </div>
            </div>
          </Card>

          {/* ── Campaign strategy hint ────────────────────────────────────── */}
          {clientGoals.campaignHint && (
            <Card className="p-4 border border-blue-200 bg-blue-50">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Campaign Strategy Hint</span>
                  <p className="text-xs text-blue-900 mt-1">{clientGoals.campaignHint}</p>
                </div>
              </div>
            </Card>
          )}

          {/* ── Stock availability map ────────────────────────────────────── */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">📍 Stock Availability Map</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2">State</th>
                    <th className="text-left py-2">Cities Stocked</th>
                    <th className="text-right py-2">OSA %</th>
                    <th className="text-right py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockedStates(scenario).map((s) => {
                    const osa = cityStockMap[s];
                    const cities = STATE_TO_CITIES[s] ?? [];
                    const cityCells = cities.map((c) => {
                      const active = Math.round((osa / 100) * c.stores);
                      return `${c.name} (${active}/${c.stores})`;
                    }).join(", ") || "—";
                    const status =
                      osa >= 70 ? { label: "✅ Stocked",  cls: "bg-primary/10 text-primary border-primary/40" } :
                      osa >= 30 ? { label: "⚠️ Partial",  cls: "bg-amber-100 text-amber-800 border-amber-300" } :
                                  { label: "❌ No Stock", cls: "bg-destructive/10 text-destructive border-destructive/40" };
                    return (
                      <tr key={s} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium text-foreground">{s}</td>
                        <td className="py-2 text-xs text-muted-foreground">{cityCells}</td>
                        <td className="py-2 text-right">{osa}%</td>
                        <td className="py-2 text-right">
                          <span className={`text-xs px-2 py-1 rounded border ${status.cls}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {stockedStates(scenario).length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-center text-xs text-muted-foreground">No stocked states for this scenario.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Fixed: correct explanation of what 0-OSA means for delivery */}
            <p className="text-xs text-amber-900 mt-3 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠️ Blinkit only serves ads where you have stock. Your campaign will automatically skip states with 0 OSA — but if you select Pan India, your budget only delivers in the {stockedStates(scenario).length} stocked state{stockedStates(scenario).length !== 1 ? "s" : ""} above. This means your budget under-delivers and your impression targets become much harder to hit. Select only stocked states to get full delivery.
            </p>
          </Card>

          {/* ── Context cards with actionable implications ────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Season</div>
              <div className="text-base font-semibold text-foreground mt-1">{season.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{season.note}</div>
              <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5">
                💡 {season.implication}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Market Condition</div>
              <div className="text-base font-semibold text-foreground mt-1">{market.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{market.note}</div>
              <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5">
                💡 {market.implication}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Inventory State</div>
              <div className="text-base font-semibold text-foreground mt-1">{inventory.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">OSA {inventory.osa}% · Aging {inventory.agingUnits} units</div>
              <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5">
                💡 {inventoryImplication(inventory.tone)}
              </div>
            </Card>
          </div>

          {/* ── SKU portfolio with velocity guidance ─────────────────────── */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">SKU Portfolio</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">MRP</th>
                  <th className="text-right py-2">Margin</th>
                  <th className="text-right py-2">Velocity</th>
                  <th className="text-right py-2">Campaign Role</th>
                </tr>
              </thead>
              <tbody>
                {profile.skus.map((s, i) => {
                  const role =
                    s.velocity === "High"     ? { label: "Hero — lead this in Product Booster",      cls: "text-green-700" } :
                    s.velocity === "Medium"   ? { label: "Support — include if budget allows",        cls: "text-blue-700"  } :
                    s.velocity === "Low"      ? { label: "Tail — only if hero is maxed out",          cls: "text-amber-700" } :
                                               { label: "Skip — very low velocity, don't advertise", cls: "text-red-600"   };
                  // First SKU is always Hero if none are High velocity
                  const effectiveRole = (s.velocity !== "High" && s.velocity !== "Medium" && i === 0)
                    ? { label: "Hero — highest velocity of the set", cls: "text-green-700" }
                    : role;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-foreground">{s.name}</td>
                      <td className="py-2 text-right">₹{s.mrp}</td>
                      <td className="py-2 text-right">₹{s.margin}</td>
                      <td className="py-2 text-right">{s.velocity}</td>
                      <td className={`py-2 text-right text-[11px] font-medium ${effectiveRole.cls}`}>{effectiveRole.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-muted-foreground mt-3">{profile.unitEconomics}</p>
          </Card>

          {/* ── Keyword preview ───────────────────────────────────────────── */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">🔍 Keyword Landscape</h3>
            <p className="text-[11px] text-muted-foreground mb-3">These are the search terms your audience uses. You'll select keywords in the campaign builder — understand them here first.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold text-green-700 uppercase tracking-wide mb-2">✅ High-intent keywords</div>
                <div className="text-[10px] text-muted-foreground mb-2">Specific to your category — high CVR, lower competition</div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.goodKeywords.map((kw) => (
                    <span key={kw} className="text-xs bg-green-50 border border-green-200 text-green-800 rounded px-2 py-0.5">{kw}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-red-700 uppercase tracking-wide mb-2">⚠️ Risky keywords</div>
                <div className="text-[10px] text-muted-foreground mb-2">Brand name or generic terms — expensive, low CVR</div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.riskyKeywords.map((kw) => (
                    <span key={kw} className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-0.5">{kw}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* ── Constraints ───────────────────────────────────────────────── */}
          <Card className="p-4 bg-muted/40">
            <h3 className="text-sm font-semibold text-foreground mb-2">📋 Your Constraints</h3>
            <ul className="text-xs text-foreground space-y-1">
              <li>• Total Budget: ₹{budget.toLocaleString("en-IN")}</li>
              <li>• Timeline: 30 days</li>
              <li>• Decision Tokens: 10 (for mid-campaign optimizations)</li>
              <li>• Success Threshold: 90% goal achievement = promotion</li>
            </ul>
          </Card>

          {/* ── Budget split planning ──────────────────────────────────────── */}
          {(() => {
            // Recommended conversion% range per goal type
            const recMap: Record<GoalType, { min: number; max: number; label: string }> = {
              "ROAS-First":         { min: 60, max: 80, label: "ROAS brands need strong conversion spend" },
              "Volume-First":       { min: 50, max: 65, label: "Volume brands lean conversion but need some reach" },
              "Awareness-First":    { min: 20, max: 40, label: "Awareness brands should put most budget in reach" },
              "Category-Creation":  { min: 20, max: 40, label: "Category-creation needs awareness to build the market" },
            };
            const rec = recMap[profile.goalType] ?? { min: 40, max: 60, label: "" };
            const isGood = convPct >= rec.min && convPct <= rec.max;
            const tooMuchConv = convPct > rec.max;
            const hint = isGood
              ? { text: `✅ Good split for a ${profile.goalType} brand`, cls: "text-green-700 bg-green-50 border-green-200" }
              : tooMuchConv
              ? { text: `⚠️ You're over-indexing on conversion. ${rec.label}.`, cls: "text-amber-700 bg-amber-50 border-amber-200" }
              : { text: `⚠️ You're under-investing in conversion. ${rec.label}.`, cls: "text-amber-700 bg-amber-50 border-amber-200" };

            return (
              <Card className="p-5 border border-primary/30">
                <h3 className="text-sm font-semibold text-foreground mb-1">💰 Plan Your Budget Split</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  You have ₹{budget.toLocaleString("en-IN")} total. Drag the slider to set how much goes to conversion vs reach campaigns.
                </p>

                {/* Visual split bar */}
                <div className="h-6 w-full rounded-full overflow-hidden flex mb-3 border border-border">
                  <div
                    className="bg-orange-400 h-full transition-all duration-150 flex items-center justify-center"
                    style={{ width: `${convPct}%` }}
                  >
                    {convPct >= 15 && <span className="text-[10px] text-white font-bold">{convPct}%</span>}
                  </div>
                  <div
                    className="bg-blue-400 h-full flex-1 flex items-center justify-center"
                  >
                    {(100 - convPct) >= 15 && <span className="text-[10px] text-white font-bold">{100 - convPct}%</span>}
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={convPct}
                  onChange={(e) => setConvPct(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />

                {/* Labels */}
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1 mb-3">
                  <span className="text-blue-600 font-medium">← More reach</span>
                  <span className="text-orange-600 font-medium">More conversion →</span>
                </div>

                {/* Derived amounts */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                    <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">🟠 Conversion</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Product Booster · Rec Ads</div>
                    <div className="text-sm font-bold text-orange-800 mt-1">₹{convNum.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">🔵 Reach</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Spotlight · Booster · Stories</div>
                    <div className="text-sm font-bold text-blue-800 mt-1">₹{reachNum.toLocaleString("en-IN")}</div>
                  </div>
                </div>

                {/* Validation hint */}
                <div className={`text-[11px] rounded border px-3 py-2 ${hint.cls}`}>
                  {hint.text}
                  {!isGood && (
                    <button
                      onClick={() => setConvPct(Math.round((rec.min + rec.max) / 2))}
                      className="ml-2 underline font-medium"
                    >
                      Apply recommended ({Math.round((rec.min + rec.max) / 2)}% conversion)
                    </button>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* ── Brief comprehension quiz ───────────────────────────────────── */}
          <Card className="p-5 border-2 border-primary/40">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">✋ Quick Check — Before You Proceed</h3>
            </div>

            {/* Q1 */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-foreground mb-2">Q1. What is this brand's primary campaign objective?</p>
              <div className="space-y-2">
                {quiz.q1Options.map((opt) => {
                  const selected = q1Answer === opt;
                  const isCorrect = quizChecked && opt === quiz.correct1;
                  const isWrong   = quizChecked && selected && opt !== quiz.correct1;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setQ1Answer(opt); setQuizChecked(false); }}
                      className={`w-full text-left text-xs rounded border px-3 py-2 transition-colors ${
                        isCorrect ? "bg-green-50 border-green-400 text-green-800" :
                        isWrong   ? "bg-red-50 border-red-400 text-red-800" :
                        selected  ? "bg-primary/10 border-primary text-foreground" :
                                    "border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                        {isWrong   && <XCircle      className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Q2 */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-foreground mb-2">Q2. Which state has the highest stock availability for this brand?</p>
              <div className="space-y-2">
                {quiz.q2Options.map((opt) => {
                  const selected  = q2Answer === opt;
                  const isCorrect = quizChecked && opt === quiz.correct2;
                  const isWrong   = quizChecked && selected && opt !== quiz.correct2;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setQ2Answer(opt); setQuizChecked(false); }}
                      className={`w-full text-left text-xs rounded border px-3 py-2 transition-colors ${
                        isCorrect ? "bg-green-50 border-green-400 text-green-800" :
                        isWrong   ? "bg-red-50 border-red-400 text-red-800" :
                        selected  ? "bg-primary/10 border-primary text-foreground" :
                                    "border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                        {isWrong   && <XCircle      className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Check / result */}
            {!quizPassed && !quizSkipped && (
              <Button
                variant="outline"
                size="sm"
                disabled={!q1Answer || !q2Answer}
                onClick={handleCheckAnswers}
                className="mb-3"
              >
                Check Answers
              </Button>
            )}

            {quizChecked && !quizPassed && !quizSkipped && (
              <p className="text-xs text-red-600 mb-3">
                {!q1Correct && !q2Correct ? "Both answers are wrong — re-read the brief and try again." :
                 !q1Correct ? "Q1 is wrong — re-read the goal section and try again." :
                 "Q2 is wrong — check the stock availability map above."}
              </p>
            )}

            {/* Escape hatch after 3 failed attempts */}
            {quizAttempts >= 3 && !quizPassed && !quizSkipped && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 mb-3">
                <p className="text-xs text-amber-800 mb-2">
                  Having trouble? Re-read the <strong>Client Goals</strong> section (objective) and the <strong>Stock Availability Map</strong> (top state). If you're still stuck, ask your trainer.
                </p>
                <button
                  onClick={() => setQuizSkipped(true)}
                  className="text-xs text-amber-700 underline font-medium hover:text-amber-900"
                >
                  Skip quiz and proceed anyway →
                </button>
              </div>
            )}

            {quizSkipped && (
              <div className="flex items-center gap-2 text-amber-700 text-xs font-medium mb-1">
                <CheckCircle2 className="h-4 w-4" />
                Quiz skipped — ask your trainer to review. You can still proceed.
              </div>
            )}

            {quizPassed && (
              <div className="flex items-center gap-2 text-green-700 text-xs font-medium mb-1">
                <CheckCircle2 className="h-4 w-4" />
                Good — you've read the brief correctly. You can now proceed.
              </div>
            )}
          </Card>

          {/* ── Continue ──────────────────────────────────────────────────── */}
          <Card className="p-5 flex items-center justify-between bg-accent">
            <p className="text-sm text-muted-foreground">
              {canContinue ? "Brief complete — head to the Category Manager meeting." : "Answer both questions correctly to continue."}
            </p>
            <Button disabled={!canContinue} onClick={handleContinue} className="gap-2">
              Continue to Category Manager <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>

        </div>
      </div>
    </div>
  );
}
