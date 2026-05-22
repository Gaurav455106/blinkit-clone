import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { buildInitialStock, computeWeek, type WeekResult } from "@/lib/weeklyMetrics";
import { buildRunCrises, getEventById, type RunCrisis } from "@/lib/events";
import { AlertTriangle, ChevronLeft, Flag, Rocket, Sparkles } from "lucide-react";

const SNAP_DAYS = [1, 3, 7, 14, 21, 30];

function fmt(n: number) { return Math.round(n).toLocaleString("en-IN"); }
function money(n: number) { return `₹${fmt(n)}`; }

export default function RunResults() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const {
    student, scenario, campaigns, cmPitch, optimizations, stockLevels, setStockLevels,
    tokensRemaining, consumeToken, crisisResponses, recordCrisisResponse, startRun, activeRunId,
  } = useSim();

  if (!student || !scenario) { nav("/"); return null; }

  // Init stock once
  useEffect(() => {
    if (scenario && Object.keys(stockLevels).length === 0) {
      setStockLevels(buildInitialStock(scenario));
    }
    if (!activeRunId) startRun();
  }, [scenario]); // eslint-disable-line

  // Day from URL ?day= or default 7
  const initialDay = Math.min(30, Math.max(1, parseInt(sp.get("day") || "7", 10)));
  const [day, setDay] = useState<number>(initialDay);

  // Precompute weekly results for weeks 1..4 (with stock being shared / decremented sequentially)
  const weekly = useMemo(() => {
    if (!scenario) return [] as WeekResult[];
    let stock = Object.keys(stockLevels).length ? stockLevels : buildInitialStock(scenario);
    const out: WeekResult[] = [];
    for (let w = 1; w <= 4; w++) {
      const r = computeWeek({ scenario, campaigns, cmPitch, opts: optimizations, stockLevels: stock, week: w });
      out.push(r.result);
      stock = r.newStock;
    }
    return out;
  }, [scenario, campaigns, cmPitch, optimizations, stockLevels]);

  // Crises (deterministic per scenario seed)
  const crises: RunCrisis[] = useMemo(
    () => buildRunCrises(scenario.seed, scenario.scheduledCrisis),
    [scenario.seed, scenario.scheduledCrisis]
  );

  // Detect crisis modal need: when day >= a crisis day and that crisis hasn't been responded to
  const pendingCrisis = crises.find((c) => day >= c.day && !crisisResponses[c.id]);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [crisisChoice, setCrisisChoice] = useState<string>("");

  useEffect(() => {
    if (pendingCrisis) {
      setCrisisOpen(true);
      setCrisisChoice("");
    }
  }, [pendingCrisis?.id]);

  // Aggregate metrics up to selected day (interpolated within current week)
  const metricsForDay = useMemo(() => {
    const totals = { spend: 0, impressions: 0, clicks: 0, atcs: 0, units: 0, revenue: 0 };
    if (weekly.length === 0) return totals;
    const fullWeeks = Math.floor((day - 1) / 7); // completed weeks
    const fraction = ((day - 1) % 7 + 1) / 7;
    for (let i = 0; i < fullWeeks; i++) {
      totals.spend += weekly[i].totals.spend;
      totals.impressions += weekly[i].totals.impressions;
      totals.clicks += weekly[i].totals.clicks;
      totals.atcs += weekly[i].totals.atcs;
      totals.units += weekly[i].totals.units;
      totals.revenue += weekly[i].totals.revenue;
    }
    const cur = weekly[fullWeeks];
    if (cur) {
      totals.spend += cur.totals.spend * fraction;
      totals.impressions += cur.totals.impressions * fraction;
      totals.clicks += cur.totals.clicks * fraction;
      totals.atcs += cur.totals.atcs * fraction;
      totals.units += cur.totals.units * fraction;
      totals.revenue += cur.totals.revenue * fraction;
    }
    // Crisis penalty cumulative: unresolved past crises drag revenue 15%, resolved high-cost choices boost it 5%
    for (const c of crises) {
      if (day < c.day) continue;
      const resp = crisisResponses[c.id];
      if (!resp) {
        totals.revenue *= 0.92;
        totals.units = Math.round(totals.units * 0.92);
      } else if (resp.tokenCost >= 2) {
        totals.revenue *= 1.04;
      }
    }
    return totals;
  }, [day, weekly, crises, crisisResponses]);

  const roas = metricsForDay.spend > 0 ? metricsForDay.revenue / metricsForDay.spend : 0;
  const ctr = metricsForDay.impressions > 0 ? (metricsForDay.clicks / metricsForDay.impressions) * 100 : 0;

  // Daily spend chart up to selected day
  const chartData = useMemo(() => {
    const out: { day: string; spend: number }[] = [];
    for (let d = 1; d <= day; d++) {
      const wk = Math.min(3, Math.floor((d - 1) / 7));
      const idx = (d - 1) % 7;
      const spend = weekly[wk]?.dailySpend[idx] ?? 0;
      out.push({ day: `D${d}`, spend });
    }
    return out;
  }, [day, weekly]);

  // Pick snap-or-free
  const snapStop = SNAP_DAYS.includes(day) ? day : null;

  const submitCrisis = () => {
    if (!pendingCrisis || !crisisChoice) return;
    const evt = getEventById(pendingCrisis.eventId);
    if (!evt) return;
    const opt = evt.options.find((o) => o.key === crisisChoice);
    if (!opt) return;
    if (opt.tokenCost > 0) consumeToken(opt.tokenCost);
    recordCrisisResponse({
      crisisId: pendingCrisis.id,
      eventId: pendingCrisis.eventId,
      optionKey: opt.key,
      tokenCost: opt.tokenCost,
      day: pendingCrisis.day,
    });
    setCrisisOpen(false);
    setCrisisChoice("");
  };

  // Look up event objects for crisis timeline + modal
  const pendingEvent = pendingCrisis ? getEventById(pendingCrisis.eventId) : null;
  const topCity = scenario.city;
  const topSku = scenario.profile.skus[0]?.name ?? "your hero SKU";

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto pb-32">
        {/* Header */}
        <div className="px-8 pt-6 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <div>
              <button onClick={() => nav("/dashboard")} className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1">
                <ChevronLeft className="h-3 w-3" /> Brand Central
              </button>
              <h1 className="text-xl font-semibold mt-1">Live Campaign Results · {scenario.profile.emoji} {scenario.profile.name}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drag the slider to see how your campaigns perform over the 30-day flight. Crises will pop up on their scheduled days.
              </p>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="text-right">
                <div className="text-muted-foreground">Tokens left</div>
                <div className="font-semibold text-sm">{tokensRemaining}</div>
              </div>
              <Button onClick={() => nav("/results")} disabled={day < 30} className="gap-2">
                <Flag className="h-4 w-4" /> Lock in Day 30 results
              </Button>
            </div>
          </div>
        </div>

        {/* Slider band */}
        <div className="px-8 pt-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-muted-foreground">Viewing performance through</div>
                <div className="text-2xl font-bold text-foreground">Day {day}{snapStop ? ` · checkpoint` : ""}</div>
              </div>
              <div className="flex gap-1.5">
                {SNAP_DAYS.map((d) => (
                  <Button key={d} size="sm" variant={day === d ? "default" : "outline"} className="h-7 text-xs" onClick={() => setDay(d)}>
                    Day {d}
                  </Button>
                ))}
              </div>
            </div>
            <Slider value={[day]} onValueChange={(v) => setDay(v[0])} min={1} max={30} step={1} className="my-3" />
            {/* Timeline strip */}
            <div className="relative h-6 mt-2 bg-muted rounded">
              <div className="absolute top-0 bottom-0 left-0 bg-primary/30 rounded" style={{ width: `${(day / 30) * 100}%` }} />
              {crises.map((c) => {
                const left = ((c.day - 1) / 29) * 100;
                const resolved = !!crisisResponses[c.id];
                const reached = day >= c.day;
                return (
                  <div key={c.id}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-background ${
                      resolved ? "bg-primary text-primary-foreground" :
                      reached ? "bg-destructive text-destructive-foreground animate-pulse" :
                      "bg-amber-400 text-amber-900"
                    }`}
                    style={{ left: `${left}%` }}
                    title={`Day ${c.day} · ${c.type === "scheduled" ? "Scheduled" : "Random"} crisis`}>
                    !
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Day 1 · Launch</span>
              <span>Day 30 · Wrap</span>
            </div>
          </Card>
        </div>

        {/* KPI cards */}
        <div className="px-8 mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi title="Spend" value={money(metricsForDay.spend)} subtitle={`of ${money(scenario.budget)}`} />
          <Kpi title="Impressions" value={fmt(metricsForDay.impressions)} subtitle="ad views" />
          <Kpi title="Clicks (CTR)" value={`${fmt(metricsForDay.clicks)} · ${ctr.toFixed(2)}%`} subtitle="engagement" />
          <Kpi title="ATCs" value={fmt(metricsForDay.atcs)} subtitle="add-to-cart" />
          <Kpi title="Units sold" value={fmt(metricsForDay.units)} subtitle="conversions" />
          <Kpi title="ROAS" value={`${roas.toFixed(2)}x`} subtitle={`Revenue ${money(metricsForDay.revenue)}`}
            tone={roas >= 3 ? "good" : roas >= 1.5 ? "warn" : "bad"} />
        </div>

        {/* Trend */}
        <div className="px-8 mt-5">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Daily spend up to Day {day}</div>
            <div className="h-44">
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Area type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#g2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Crises log */}
        <div className="px-8 mt-5">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold">Crisis Timeline</h3>
              <Badge variant="outline" className="text-[10px]">{crises.length} event{crises.length === 1 ? "" : "s"}</Badge>
            </div>
            <div className="space-y-2">
              {crises.map((c) => {
                const evt = getEventById(c.eventId);
                const resp = crisisResponses[c.id];
                const reached = day >= c.day;
                return (
                  <div key={c.id} className={`rounded border p-3 text-xs ${
                    resp ? "border-primary/30 bg-primary/5" :
                    reached ? "border-destructive/40 bg-destructive/5" :
                    "border-amber-300 bg-amber-50/50"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">Day {c.day} · {evt?.emoji} {evt?.title}</span>
                        <Badge variant="outline" className="ml-2 text-[10px] capitalize">{c.type}</Badge>
                      </div>
                      {resp ? (
                        <Badge className="bg-primary text-primary-foreground">Resolved</Badge>
                      ) : reached ? (
                        <Button size="sm" className="h-7 text-[11px]" onClick={() => setCrisisOpen(true)}>Respond now</Button>
                      ) : (
                        <Badge variant="secondary">Upcoming</Badge>
                      )}
                    </div>
                    {resp && evt && (
                      <div className="text-muted-foreground mt-1">
                        You chose: <span className="text-foreground font-medium">{evt.options.find((o) => o.key === resp.optionKey)?.label}</span>
                        {resp.tokenCost > 0 && <span> · {resp.tokenCost} tokens spent</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Hint band */}
        <div className="px-8 mt-5">
          <Card className="p-4 bg-accent/30 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold">Tip</div>
              Snap to Day 3 to see early signal, Day 7 / 14 / 21 for weekly checkpoints, or Day 30 for the final wrap.
              Unresolved crises drag revenue 8% each — respond promptly.
            </div>
          </Card>
        </div>
      </div>

      {/* Crisis modal */}
      <Dialog open={crisisOpen && !!pendingCrisis} onOpenChange={(o) => { if (!o && pendingCrisis) return; setCrisisOpen(o); }}>
        <DialogContent>
          <div className="-m-6 mb-4 px-6 py-3 bg-destructive text-destructive-foreground rounded-t-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wide">
              Live Crisis · Day {pendingCrisis?.day} · {pendingCrisis?.type === "scheduled" ? "Scheduled" : "Surprise"}
            </span>
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingEvent?.emoji} {pendingEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {pendingEvent && (
            <>
              <p className="text-sm text-foreground/80">
                {pendingEvent.body({ topCity, topSku, daysLeft: 30 - (pendingCrisis?.day ?? 0), budgetLeft: scenario.budget })}
              </p>
              <RadioGroup value={crisisChoice} onValueChange={setCrisisChoice} className="space-y-2 pt-2">
                {pendingEvent.options.map((o) => (
                  <Label key={o.key}
                    className={`flex items-start gap-3 border rounded p-3 cursor-pointer ${crisisChoice === o.key ? "border-primary bg-primary/5" : "border-border"}`}>
                    <RadioGroupItem value={o.key} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{o.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{o.effect}</div>
                    </div>
                    <Badge variant={o.tokenCost > 0 ? "secondary" : "outline"} className="text-[10px]">
                      {o.tokenCost > 0 ? `${o.tokenCost} token${o.tokenCost > 1 ? "s" : ""}` : "Free"}
                    </Badge>
                  </Label>
                ))}
              </RadioGroup>
              <DialogFooter>
                <Button disabled={!crisisChoice} onClick={submitCrisis} className="gap-2">
                  <Rocket className="h-4 w-4" /> Lock in response
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ title, value, subtitle, tone }: { title: string; value: string; subtitle?: string; tone?: "good" | "warn" | "bad" }) {
  const cls = tone === "good" ? "text-primary" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted-foreground">{title}</div>
      <div className={`text-base font-semibold ${cls}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
    </Card>
  );
}
