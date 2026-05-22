import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import { ArrowRight, Target, MapPin } from "lucide-react";
import { CITIES, CITY_STORE_COUNT, activeStoresFor, CityName } from "@/data/scenarios";

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

export default function Brief() {
  const nav = useNavigate();
  const { student, scenario } = useSim();
  const [ack, setAck] = useState(false);

  if (!student || !scenario) {
    nav("/");
    return null;
  }
  const { profile, season, market, inventory, budget, clientGoals, cityStockMap } = scenario;

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="flex-1 flex flex-col">
        <div className="px-8 pt-6 pb-2">
          <div className="text-xs text-muted-foreground">Brand Central › Client Brief</div>
          <h1 className="text-xl font-semibold text-foreground mt-1">Your Brand Brief</h1>
          <p className="text-xs text-muted-foreground">Hi {student.name} — here's the client you're running this campaign for.</p>
        </div>

        <div className="flex-1 px-8 py-6 overflow-y-auto space-y-5 max-w-5xl">
          {/* Brand header */}
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
                      profile.difficulty === "Hard" ? "bg-orange-500 text-white" :
                      "bg-destructive text-destructive-foreground"
                    }>{profile.difficulty}</Badge>
                    <Badge variant="outline" className="border-primary text-primary">{profile.goalType}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{profile.context}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Campaign Budget</div>
                <div className="text-2xl font-bold text-primary">₹{budget.toLocaleString("en-IN")}</div>
              </div>
            </div>
          </Card>

          {/* Client goal — prominent amber box */}
          <Card className="p-6 border-2 border-amber-300 bg-amber-50">
            <div className="flex items-start gap-3">
              <Target className="h-6 w-6 text-amber-700 shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">🎯 What the client wants</h3>
                <div className="mt-3">
                  <div className="text-xs font-semibold text-amber-900">PRIMARY GOAL</div>
                  <div className="text-base font-bold text-amber-950">{clientGoals.primary}</div>
                </div>
                <div className="mt-4">
                  <div className="text-xs font-semibold text-amber-900 mb-2">TARGET METRICS</div>
                  <div className="grid grid-cols-3 gap-3">
                    {clientGoals.metrics.map((m) => (
                      <div key={m.label} className="rounded-md bg-white border border-amber-200 p-3">
                        <div className="text-[11px] text-muted-foreground">{m.label}</div>
                        <div className="text-lg font-bold text-foreground">{formatTarget(m)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-xs text-amber-900">
                  <strong>Threshold:</strong> {clientGoals.threshold}
                </div>
              </div>
            </div>
          </Card>

          {/* Stock availability map */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">📍 Stock Availability Map</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2">City</th>
                    <th className="text-right py-2">OSA %</th>
                    <th className="text-right py-2">Dark Stores</th>
                    <th className="text-right py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {CITIES.map((c) => {
                    const osa = cityStockMap[c as CityName];
                    const stores = activeStoresFor(c as CityName, osa);
                    const total = CITY_STORE_COUNT[c as CityName];
                    const status =
                      osa >= 70 ? { label: "✅ Stocked", cls: "bg-primary/10 text-primary border-primary/40" } :
                      osa >= 30 ? { label: "⚠️ Partial", cls: "bg-amber-100 text-amber-800 border-amber-300" } :
                      { label: "❌ No Stock", cls: "bg-destructive/10 text-destructive border-destructive/40" };
                    return (
                      <tr key={c} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium text-foreground">{c}</td>
                        <td className="py-2 text-right">{osa}%</td>
                        <td className="py-2 text-right">{stores}/{total}</td>
                        <td className="py-2 text-right">
                          <span className={`text-xs px-2 py-1 rounded border ${status.cls}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠️ Ads can only serve in cities where you have stock. Selecting cities without stock = wasted budget.
            </p>
          </Card>

          {/* Context cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Season</div>
              <div className="text-base font-semibold text-foreground mt-1">{season.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{season.note}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Market Condition</div>
              <div className="text-base font-semibold text-foreground mt-1">{market.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{market.note}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Inventory State</div>
              <div className="text-base font-semibold text-foreground mt-1">{inventory.label}</div>
              <div className="text-[11px] text-muted-foreground mt-1">OSA {inventory.osa}% · Aging {inventory.agingUnits}</div>
            </Card>
          </div>

          {/* SKU portfolio */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">SKU Portfolio</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">MRP</th>
                  <th className="text-right py-2">Margin</th>
                  <th className="text-right py-2">Velocity</th>
                </tr>
              </thead>
              <tbody>
                {profile.skus.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2 text-foreground">{s.name}</td>
                    <td className="py-2 text-right">₹{s.mrp}</td>
                    <td className="py-2 text-right">₹{s.margin}</td>
                    <td className="py-2 text-right">{s.velocity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-muted-foreground mt-3">{profile.unitEconomics}</p>
          </Card>

          {/* Constraints */}
          <Card className="p-4 bg-muted/40">
            <h3 className="text-sm font-semibold text-foreground mb-2">📋 Your Constraints</h3>
            <ul className="text-xs text-foreground space-y-1">
              <li>• Total Budget: ₹2,00,000</li>
              <li>• Timeline: 30 days</li>
              <li>• Decision Tokens: 10 (for mid-campaign optimizations)</li>
              <li>• Success Threshold: 90% goal achievement = promotion</li>
            </ul>
          </Card>

          {/* Ack & continue */}
          <Card className="p-5 flex items-center justify-between bg-accent">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={ack} onCheckedChange={(v) => setAck(!!v)} />
              <span className="text-sm font-medium text-foreground">I have read the brief and understand the brand context.</span>
            </label>
            <Button disabled={!ack} onClick={() => nav("/brand-central")} className="gap-2">
              Acknowledge Brief & Go to Brand Central <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
