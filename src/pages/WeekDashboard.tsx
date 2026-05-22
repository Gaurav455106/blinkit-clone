import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSim, SavedCampaign, CampaignOptimization } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { CITIES, CityName } from "@/data/scenarios";
import { buildInitialStock, computeWeek, type WeekResult, type CampaignWeekMetric } from "@/lib/weeklyMetrics";
import { pickEvent, type SimEvent } from "@/lib/events";
import { ChevronDown, ChevronUp, AlertTriangle, Loader2, Pause, Plus, Pencil, Package, TrendingUp } from "lucide-react";

const eventsCache: Record<number, SimEvent> = {};
function getEventForWeek(week: 2 | 3): SimEvent {
  if (!eventsCache[week]) eventsCache[week] = pickEvent(week);
  return eventsCache[week];
}

function fmt(n: number) { return Math.round(n).toLocaleString("en-IN"); }
function fmtMoney(n: number) { return `₹${fmt(n)}`; }

export default function WeekDashboard() {
  const nav = useNavigate();
  const { week: weekParam } = useParams();
  const week = Number(weekParam) as 1 | 2 | 3;
  const {
    student, scenario, campaigns, cmPitch,
    tokensRemaining, optimizations, stockLevels, setOptimization,
    setStockLevels, setCurrentDay, logDecision, recordWeekTotals,
    events, setEventResponse, consumeToken,
  } = useSim();

  if (!student || !scenario) { nav("/"); return null; }

  // Init stock if empty (first time landing on day-7)
  useEffect(() => {
    if (Object.keys(stockLevels).length === 0) {
      setStockLevels(buildInitialStock(scenario));
    }
  }, [scenario]); // eslint-disable-line

  const weekResult: WeekResult = useMemo(() => {
    const stock = Object.keys(stockLevels).length ? stockLevels : buildInitialStock(scenario);
    return computeWeek({ scenario, campaigns, cmPitch, opts: optimizations, stockLevels: stock, week }).result;
  }, [scenario, campaigns, cmPitch, optimizations, stockLevels, week]);

  const cumulativeWeeks = week; // Day 7=>1, Day 14=>2, Day 21=>3
  const daysComplete = cumulativeWeeks * 7;
  const daysRemaining = 30 - daysComplete;

  const totalBudget = scenario.budget;
  const totalAllocated = campaigns.reduce((s, c) => s + c.budget, 0);
  const budgetSpentSoFar = weekResult.totals.spend; // simplified: this week's spend (engine doesn't carry across weeks)

  // event for day 14 / day 21
  const eventWeek = week === 2 ? 2 : week === 3 ? 3 : null;
  const event = eventWeek ? getEventForWeek(eventWeek) : null;
  const existingResponse = eventWeek === 2 ? events.week2 : eventWeek === 3 ? events.week3 : null;
  const [showEvent, setShowEvent] = useState<boolean>(!!event && !existingResponse);
  const [eventChoice, setEventChoice] = useState<string>("");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [decisionsByCampaign, setDecisionsByCampaign] = useState<Record<string, string>>({});
  const [showLoading, setShowLoading] = useState(false);
  const [editing, setEditing] = useState<SavedCampaign | null>(null);
  const [restocking, setRestocking] = useState<{ campaignId: string } | null>(null);

  const allDecided = campaigns.every((c) => !!decisionsByCampaign[c.id]);

  const handleApplyDecision = (c: SavedCampaign, choice: string) => {
    setDecisionsByCampaign((p) => ({ ...p, [c.id]: choice }));
  };

  const handleContinue = () => {
    // Apply each decision to opts + log
    campaigns.forEach((c) => {
      const choice = decisionsByCampaign[c.id] || "continue";
      if (choice === "continue") {
        logDecision({ week, type: "continue", campaignId: c.id, description: `Kept ${c.name} as is`, tokenCost: 0 });
      } else if (choice === "pause") {
        setOptimization(c.id, { paused: true });
        logDecision({ week, type: "pause", campaignId: c.id, description: `Paused ${c.name}`, tokenCost: 0 });
      } else if (choice === "scale") {
        setOptimization(c.id, { scaleMultiplier: 1.25 });
        logDecision({ week, type: "scale", campaignId: c.id, description: `Scaled ${c.name} budget +25%`, tokenCost: 0 });
      }
    });
    // record totals
    recordWeekTotals({ week, totals: weekResult.totals });

    // navigate
    setShowLoading(true);
    setTimeout(() => {
      const nextDay = (week + 1) * 7;
      setCurrentDay(nextDay);
      if (week < 3) nav(`/day-${nextDay}`);
      else nav("/day-30-results");
    }, 2000);
  };

  const submitEvent = () => {
    if (!event || !eventChoice) return;
    const opt = event.options.find((o) => o.key === eventChoice);
    if (!opt) return;
    if (opt.tokenCost > 0) consumeToken(opt.tokenCost);
    setEventResponse(event.week, { eventId: event.id, optionKey: opt.key, tokenCost: opt.tokenCost });
    logDecision({ week, type: "event", description: `[${event.title}] → ${opt.label}`, tokenCost: opt.tokenCost });
    setShowEvent(false);
  };

  const dailySpendData = weekResult.dailySpend.map((v, i) => ({
    day: `${(week - 1) * 7 + i + 1} Day`,
    spend: v,
  }));

  const statusBadge = (s: CampaignWeekMetric["status"]) => {
    if (s === "paused") return <Badge variant="secondary">⏸ Paused</Badge>;
    if (s === "strong") return <Badge className="bg-primary text-primary-foreground">🟢 Strong</Badge>;
    if (s === "average") return <Badge className="bg-amber-500 text-white">🟡 Average</Badge>;
    return <Badge className="bg-destructive text-destructive-foreground">🔴 Failing</Badge>;
  };

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto pb-32">
        {/* Header */}
        <div className="px-8 pt-6 pb-3 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Brand Central → Ad Summary</div>
              <h1 className="text-xl font-semibold mt-1">Week {week} Performance — Day {daysComplete} of 30</h1>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="text-right">
                <div className="text-muted-foreground">Budget Spent</div>
                <div className="font-semibold text-sm">{fmtMoney(budgetSpentSoFar)} of {fmtMoney(totalBudget)}</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">Days Remaining</div>
                <div className="font-semibold text-sm">{daysRemaining}</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">Tokens</div>
                <div className="font-semibold text-sm">{tokensRemaining}</div>
              </div>
            </div>
          </div>
          {/* Filter row */}
          <div className="flex gap-2 mt-4 text-xs">
            <Select defaultValue="custom">
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="custom">Custom Dates</SelectItem></SelectContent>
            </Select>
            <Input className="w-32 h-8" defaultValue={`Day ${(week - 1) * 7 + 1}`} readOnly />
            <Input className="w-32 h-8" defaultValue={`Day ${week * 7}`} readOnly />
            <Select defaultValue="all">
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All campaigns</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        {/* Event banner */}
        {event && !showEvent && existingResponse && (
          <div className="px-8 mt-4">
            <Card className="p-3 bg-amber-50 border-amber-300">
              <div className="text-xs">
                <span className="font-semibold">{event.emoji} {event.title}</span> — You chose:{" "}
                <span className="font-medium">{event.options.find(o => o.key === existingResponse.optionKey)?.label}</span>
              </div>
            </Card>
          </div>
        )}

        {/* Stock alerts */}
        {weekResult.stockAlerts.length > 0 && (
          <div className="px-8 mt-4 space-y-2">
            {weekResult.stockAlerts.slice(0, 3).map((a, i) => (
              <Card key={i} className={`p-3 border-l-4 ${a.status === "oos" ? "border-l-destructive bg-destructive/5" : "border-l-amber-500 bg-amber-50"}`}>
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle className={`h-4 w-4 ${a.status === "oos" ? "text-destructive" : "text-amber-600"}`} />
                  <span className="font-semibold">{a.status === "oos" ? "🚨 OOS" : "⚠️ Low Stock"}:</span>
                  <span>{a.skuName} in {a.city} {a.status === "oos" ? "— sales stopped." : `(${a.remaining} units left)`}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 6 KPI cards */}
        <div className="px-8 mt-6 grid grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard title="Budget Consumed" value={fmtMoney(weekResult.totals.spend)} subtitle="Total budget spent" trend={weekResult.dailySpend} />
          <KpiCard title="Impressions" value={fmt(weekResult.totals.impressions)} subtitle="Total views on your ads" />
          <KpiCard title="ATCs" value={fmt(weekResult.totals.atcs)} subtitle="Add-to-cart count" />
          <KpiCard title="Qty Sold" value={fmt(weekResult.totals.units)} subtitle="Total products sold" />
          <KpiCard title="Sales" value={fmtMoney(weekResult.totals.revenue)} subtitle="Revenue from campaigns" />
          <KpiCard
            title="ROAS"
            value={`${weekResult.totals.roas.toFixed(2)}x`}
            subtitle="Revenue per rupee spent"
            highlight={weekResult.totals.roas >= 3 ? "good" : weekResult.totals.roas >= 1.5 ? "warn" : "bad"}
          />
        </div>

        {/* Daily trend chart */}
        <div className="px-8 mt-6">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Daily Metric Trends</div>
            <div className="h-48">
              <ResponsiveContainer>
                <AreaChart data={dailySpendData}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} />
                  <Area type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#g)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Campaigns table */}
        <div className="px-8 mt-6">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-semibold">Ad Campaigns</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Campaign</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Duration</th>
                  <th className="text-right px-4 py-2">Budget</th>
                  <th className="text-right px-4 py-2">Imp</th>
                  <th className="text-right px-4 py-2">ATCs</th>
                  <th className="text-right px-4 py-2">ROAS</th>
                  <th className="px-2"></th>
                </tr>
              </thead>
              <tbody>
                {weekResult.campaigns.map((m) => {
                  const isOpen = expanded === m.campaignId;
                  return (
                    <>
                      <tr key={m.campaignId} className="border-t border-border cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(isOpen ? null : m.campaignId)}>
                        <td className="px-4 py-3 font-medium">{m.name}</td>
                        <td className="px-4 py-3 capitalize text-xs">{campaigns.find(c => c.id === m.campaignId)?.objective ?? "-"}</td>
                        <td className="px-4 py-3">{statusBadge(m.status)}</td>
                        <td className="px-4 py-3 text-xs">{m.duration}</td>
                        <td className="px-4 py-3 text-right">{fmtMoney(m.spend)} / {fmtMoney(m.budget / 30 * 7)}</td>
                        <td className="px-4 py-3 text-right">{fmt(m.impressions)}</td>
                        <td className="px-4 py-3 text-right">{fmt(m.atcs)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{m.roas.toFixed(2)}x</td>
                        <td className="px-2 text-muted-foreground">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20 border-t border-border">
                          <td colSpan={9} className="p-4">
                            <Drilldown metric={m} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Optimization Actions */}
        <div className="px-8 mt-8">
          <Card className="p-5">
            <h3 className="text-base font-semibold mb-1">Make Your Optimization Decisions for Week {week + 1}</h3>
            <p className="text-xs text-muted-foreground mb-4">Decide what to do with each campaign. Continue is free; Edit/Restock cost tokens.</p>

            <div className="space-y-3">
              {weekResult.campaigns.map((m) => {
                const c = campaigns.find((x) => x.id === m.campaignId)!;
                const chosen = decisionsByCampaign[m.campaignId];
                return (
                  <div key={m.campaignId} className="border border-border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{m.name}</div>
                      {statusBadge(m.status)}
                    </div>
                    <RadioGroup value={chosen ?? ""} onValueChange={(v) => handleApplyDecision(c, v)} className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {[
                        { v: "continue", l: "Continue as is", t: "Free" },
                        { v: "pause", l: "Pause campaign", t: "Free" },
                        { v: "scale", l: "Scale budget +25%", t: "Free" },
                      ].map((opt) => (
                        <Label key={opt.v} className="flex items-center gap-2 text-xs border border-border rounded px-2 py-2 cursor-pointer hover:bg-muted/30">
                          <RadioGroupItem value={opt.v} id={`${m.campaignId}-${opt.v}`} />
                          <span className="flex-1">{opt.l}</span>
                          <span className="text-muted-foreground">{opt.t}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                    <div className="flex gap-2 mt-2 text-xs">
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setEditing(c)}>
                        <Pencil className="h-3 w-3" /> Edit (1 token)
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setRestocking({ campaignId: m.campaignId })}>
                        <Package className="h-3 w-3" /> Restock cities
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-5 pt-4 border-t border-border">
              <Button variant="outline" className="gap-2" onClick={() => nav("/campaign")}>
                <Plus className="h-4 w-4" /> Create new campaign for Week {week + 1}
              </Button>
            </div>
          </Card>
        </div>

        {/* Continue */}
        <div className="px-8 mt-6">
          <div className="flex justify-end">
            <Button
              size="lg"
              disabled={!allDecided}
              title={!allDecided ? "Make a decision for each campaign first" : ""}
              onClick={handleContinue}
            >
              Continue to Week {week + 1} (Day {daysComplete + 1}) →
            </Button>
          </div>
        </div>
      </div>

      {/* Event modal */}
      <Dialog open={showEvent} onOpenChange={setShowEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{event?.emoji} Mid-Week Event: {event?.title}</DialogTitle>
          </DialogHeader>
          {event && (
            <>
              <p className="text-sm">
                {event.body({
                  topCity: cmPitch?.approvedCities[0] || scenario.city,
                  topSku: scenario.profile.skus[0].name,
                  daysLeft: daysRemaining,
                  budgetLeft: Math.max(0, totalBudget - budgetSpentSoFar),
                })}
              </p>
              <RadioGroup value={eventChoice} onValueChange={setEventChoice} className="space-y-2">
                {event.options.map((o) => (
                  <Label key={o.key} className="flex items-start gap-2 border border-border rounded p-2 cursor-pointer hover:bg-muted/30">
                    <RadioGroupItem value={o.key} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{o.label}</div>
                      <div className="text-xs text-muted-foreground">{o.effect}</div>
                    </div>
                    {o.tokenCost > 0 && <Badge variant="outline">-{o.tokenCost} tokens</Badge>}
                  </Label>
                ))}
              </RadioGroup>
              <DialogFooter>
                <Button onClick={submitEvent} disabled={!eventChoice}>Respond</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Loading transition */}
      <Dialog open={showLoading}>
        <DialogContent className="text-center">
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="font-semibold">⏰ Simulating Week {week + 1} (Days {daysComplete + 1}-{daysComplete + 7})...</div>
            <div className="text-xs text-muted-foreground">Pulling performance data...</div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <EditCampaignModal campaign={editing} onClose={() => setEditing(null)} onSave={() => {
        if (editing) {
          consumeToken(1);
          logDecision({ week, type: "edit", campaignId: editing.id, description: `Edited ${editing.name}`, tokenCost: 1 });
        }
        setEditing(null);
      }} />

      {/* Restock modal */}
      <RestockModal
        open={!!restocking}
        onClose={() => setRestocking(null)}
        onApply={(mode, cities) => {
          const cost = mode === "standard" ? 1 : mode === "express" ? 2 : 3;
          const add = mode === "direct" ? 300 : 500;
          consumeToken(cost);
          // bump stock for SKUs in selected cities (all SKUs of campaign)
          const c = campaigns.find((c) => c.id === restocking?.campaignId);
          if (c) {
            const next = JSON.parse(JSON.stringify(stockLevels));
            for (const sid of (c.skuIds.length ? c.skuIds : scenario.profile.skus.map((s) => s.id))) {
              if (!next[sid]) next[sid] = {};
              for (const city of cities) {
                next[sid][city] = (next[sid][city] || 0) + add;
              }
            }
            setStockLevels(next);
          }
          logDecision({
            week, type: "restock", campaignId: restocking?.campaignId,
            description: `${mode === "standard" ? "Standard PO" : mode === "express" ? "Express PO" : "Direct Dispatch"} → ${cities.join(", ")} (+${add} units)`,
            tokenCost: cost,
          });
          setRestocking(null);
        }}
      />
    </div>
  );
}

function KpiCard({ title, value, subtitle, trend, highlight }: { title: string; value: string; subtitle: string; trend?: number[]; highlight?: "good" | "warn" | "bad" }) {
  const color = highlight === "good" ? "text-primary" : highlight === "bad" ? "text-destructive" : highlight === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{title}</div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{subtitle}</div>
      {trend && trend.length > 0 && (
        <div className="h-6 mt-2 flex items-end gap-0.5">
          {trend.map((v, i) => {
            const max = Math.max(...trend, 1);
            return <div key={i} className="bg-primary/40 flex-1 rounded-sm" style={{ height: `${(v / max) * 100}%` }} />;
          })}
        </div>
      )}
    </Card>
  );
}

function Drilldown({ metric }: { metric: CampaignWeekMetric }) {
  return (
    <div className="space-y-4">
      {/* City Panel */}
      <div>
        <div className="text-xs font-semibold mb-2">City Performance Breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left py-1">City</th>
                <th className="text-right py-1">Spend</th>
                <th className="text-right py-1">Imp</th>
                <th className="text-right py-1">Clicks</th>
                <th className="text-right py-1">CTR</th>
                <th className="text-right py-1">ATCs</th>
                <th className="text-right py-1">Units</th>
                <th className="text-right py-1">ROAS</th>
                <th className="text-right py-1">Health</th>
              </tr>
            </thead>
            <tbody>
              {metric.byCity.map((c) => (
                <tr key={c.city} className="border-t border-border/50">
                  <td className="py-1">{c.city}</td>
                  <td className="text-right">{fmtMoney(c.spend)}</td>
                  <td className="text-right">{fmt(c.impressions)}</td>
                  <td className="text-right">{fmt(c.clicks)}</td>
                  <td className="text-right">{c.ctr.toFixed(2)}%</td>
                  <td className="text-right">{fmt(c.atcs)}</td>
                  <td className="text-right">{fmt(c.units)}</td>
                  <td className="text-right font-semibold">{c.roas.toFixed(2)}x</td>
                  <td className="text-right">
                    {c.health === "strong" ? "🟢" : c.health === "average" ? "🟡" : "🔴"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dayparting Heatmap */}
      <div>
        <div className="text-xs font-semibold mb-2">Dayparting Performance</div>
        <div className="grid grid-cols-4 gap-2">
          {metric.byHour.map((h) => {
            const bg = !h.active ? "bg-muted text-muted-foreground" :
              h.roas >= 3 ? "bg-primary/30" : h.roas >= 1.5 ? "bg-amber-200" : "bg-destructive/20";
            return (
              <div key={h.block} className={`rounded p-2 text-[10px] ${bg}`}>
                <div className="font-semibold">{h.block}</div>
                {h.active ? (
                  <>
                    <div>Spend: {fmtMoney(h.spend)}</div>
                    <div>ROAS: {h.roas.toFixed(2)}x</div>
                  </>
                ) : (
                  <div>Not running</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Keywords / Cohorts */}
      <div>
        <div className="text-xs font-semibold mb-2">{metric.byKeyword.length && metric.byKeyword[0].name.match(/^[A-Z]/) ? "Cohort Performance" : "Keyword Performance"}</div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left py-1">{metric.byKeyword.length && metric.byKeyword[0].name.match(/^[A-Z]/) ? "Cohort" : "Keyword"}</th>
              <th className="text-right py-1">Spend</th>
              <th className="text-right py-1">Imp</th>
              <th className="text-right py-1">CTR</th>
              <th className="text-right py-1">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {metric.byKeyword.map((k) => (
              <tr key={k.name} className="border-t border-border/50">
                <td className="py-1">{k.name}</td>
                <td className="text-right">{fmtMoney(k.spend)}</td>
                <td className="text-right">{fmt(k.impressions)}</td>
                <td className="text-right">{k.ctr.toFixed(2)}%</td>
                <td className="text-right font-semibold">{k.roas.toFixed(2)}x</td>
              </tr>
            ))}
            {metric.byKeyword.length === 0 && (
              <tr><td colSpan={5} className="py-2 text-muted-foreground text-center">No keywords/cohorts configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      {metric.insights.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          {metric.insights.map((i, idx) => (
            <div key={idx} className="text-xs">{i}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditCampaignModal({ campaign, onClose, onSave }: { campaign: SavedCampaign | null; onClose: () => void; onSave: () => void }) {
  const { setOptimization, optimizations } = useSim();
  if (!campaign) return null;
  const opt = optimizations[campaign.id] || { paused: false, scaleMultiplier: 1, dayparting: "24_7" as const };
  return (
    <Dialog open={!!campaign} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {campaign.name}</DialogTitle></DialogHeader>
        <div className="text-xs text-muted-foreground mb-2">Costs 1 token. Currently you can adjust dayparting; full keyword/SKU edits coming in a later phase.</div>
        <div className="space-y-2">
          <Label className="text-sm">Dayparting</Label>
          <Select value={opt.dayparting} onValueChange={(v) => setOptimization(campaign.id, { dayparting: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24_7">24/7</SelectItem>
              <SelectItem value="peak_only">Peak hours only (+40% ROAS)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave}>Apply (1 token)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestockModal({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (mode: "standard" | "express" | "direct", cities: string[]) => void }) {
  const [mode, setMode] = useState<"standard" | "express" | "direct">("standard");
  const [cities, setCities] = useState<string[]>([]);
  useEffect(() => { if (!open) { setMode("standard"); setCities([]); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Restock cities</DialogTitle></DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-2">
          {[
            { v: "standard", l: "Standard PO", t: "5-day delivery · 1 token · +0%" },
            { v: "express", l: "Express PO", t: "2-day delivery · 2 tokens · +15% cost" },
            { v: "direct", l: "Direct Dispatch", t: "1-day delivery · 3 tokens · +25% cost" },
          ].map((o) => (
            <Label key={o.v} className="flex items-center gap-2 border border-border rounded p-2 cursor-pointer">
              <RadioGroupItem value={o.v} />
              <div className="flex-1">
                <div className="text-sm font-medium">{o.l}</div>
                <div className="text-xs text-muted-foreground">{o.t}</div>
              </div>
            </Label>
          ))}
        </RadioGroup>
        <div className="mt-2">
          <Label className="text-xs">Cities to restock</Label>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {CITIES.map((c) => (
              <Label key={c} className="flex items-center gap-2 text-xs border border-border rounded p-2 cursor-pointer">
                <input type="checkbox" checked={cities.includes(c)} onChange={(e) => {
                  setCities((prev) => e.target.checked ? [...prev, c] : prev.filter((x) => x !== c));
                }} />
                {c}
              </Label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onApply(mode, cities)} disabled={cities.length === 0}>Place Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
