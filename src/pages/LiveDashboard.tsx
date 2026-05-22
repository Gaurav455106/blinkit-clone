import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Play, Pause, Rocket, Flag, AlertTriangle, Sparkles, Rabbit, Turtle, FastForward, X, Download, ChevronRight } from "lucide-react";
import { buildInitialStock, computeWeek, type WeekResult } from "@/lib/weeklyMetrics";
import { buildRunCrises, getEventById, type RunCrisis } from "@/lib/events";
import { toast } from "sonner";

type DayMetric = { day: number; spend: number; impressions: number; clicks: number; atcs: number; units: number; revenue: number };
type Filter = "last3" | "last7" | "last14" | "lifetime";

const SPEEDS = {
  slow: { label: "Slow", ms: 8000, icon: Turtle },
  normal: { label: "Normal", ms: 5000, icon: Play },
  fast: { label: "Fast", ms: 2000, icon: FastForward },
} as const;
type SpeedKey = keyof typeof SPEEDS;

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
const money = (n: number) => `₹${fmt(n)}`;

function useCountUp(target: number, duration = 500) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    startRef.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - (startRef.current || now)) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function MetricCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" | "neutral" }) {
  const toneCls = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

export default function LiveDashboard() {
  const nav = useNavigate();
  const {
    student, scenario, campaigns, cmPitch, optimizations, setOptimization,
    stockLevels, setStockLevels, tokensRemaining, consumeToken,
    crisisResponses, recordCrisisResponse, startRun, activeRunId,
  } = useSim();

  if (!student || !scenario) { nav("/"); return null; }

  // Init stock + run once
  useEffect(() => {
    if (scenario && Object.keys(stockLevels).length === 0) {
      setStockLevels(buildInitialStock(scenario));
    }
    if (!activeRunId) startRun();
  }, []); // eslint-disable-line

  // Pre-compute 4 weeks (deterministic from current state)
  const weekly = useMemo(() => {
    let stock = Object.keys(stockLevels).length ? stockLevels : buildInitialStock(scenario);
    const out: WeekResult[] = [];
    for (let w = 1; w <= 4; w++) {
      const r = computeWeek({ scenario, campaigns, cmPitch, opts: optimizations, stockLevels: stock, week: w });
      out.push(r.result);
      stock = r.newStock;
    }
    return out;
  }, [scenario, campaigns, cmPitch, optimizations, stockLevels]);

  // Day-level metrics — split each week's totals evenly across its 7 days w/ small variance
  const dayMetrics: DayMetric[] = useMemo(() => {
    const out: DayMetric[] = [];
    for (let d = 1; d <= 30; d++) {
      const w = Math.min(3, Math.floor((d - 1) / 7)); // 0..3 (cap)
      const wm = weekly[w]?.totals ?? { spend: 0, impressions: 0, clicks: 0, atcs: 0, units: 0, revenue: 0 };
      const variance = [0.92, 1.0, 1.06, 1.1, 1.04, 0.95, 0.93][(d - 1) % 7];
      out.push({
        day: d,
        spend: (wm.spend / 7) * variance,
        impressions: (wm.impressions / 7) * variance,
        clicks: (wm.clicks / 7) * variance,
        atcs: (wm.atcs / 7) * variance,
        units: (wm.units / 7) * variance,
        revenue: (wm.revenue / 7) * variance,
      });
    }
    return out;
  }, [weekly]);

  // Per-campaign daily share (proportional to weekly campaign spend)
  const campaignDaily = useMemo(() => {
    const map: Record<string, DayMetric[]> = {};
    for (const c of campaigns) {
      const days: DayMetric[] = [];
      for (let d = 1; d <= 30; d++) {
        const w = Math.min(3, Math.floor((d - 1) / 7));
        const cm = weekly[w]?.campaigns.find((x) => x.campaignId === c.id);
        const variance = [0.92, 1.0, 1.06, 1.1, 1.04, 0.95, 0.93][(d - 1) % 7];
        days.push({
          day: d,
          spend: ((cm?.spend ?? 0) / 7) * variance,
          impressions: ((cm?.impressions ?? 0) / 7) * variance,
          clicks: ((cm?.clicks ?? 0) / 7) * variance,
          atcs: ((cm?.atcs ?? 0) / 7) * variance,
          units: ((cm?.units ?? 0) / 7) * variance,
          revenue: ((cm?.revenue ?? 0) / 7) * variance,
        });
      }
      map[c.id] = days;
    }
    return map;
  }, [campaigns, weekly]);

  // Crises
  const crises: RunCrisis[] = useMemo(
    () => buildRunCrises(scenario.seed, scenario.scheduledCrisis),
    [scenario.seed, scenario.scheduledCrisis]
  );

  // Time progression
  const [currentDay, setCurrentDay] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<SpeedKey>("normal");
  const [filter, setFilter] = useState<Filter>("last7");
  const [endOpen, setEndOpen] = useState(false);

  // Crisis modal
  const pendingCrisis = crises.find((c) => currentDay >= c.day && !crisisResponses[c.id]);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [crisisChoice, setCrisisChoice] = useState("");
  const [crisisTimer, setCrisisTimer] = useState(30);

  useEffect(() => {
    if (pendingCrisis && !crisisOpen) {
      setCrisisOpen(true);
      setCrisisChoice("");
      setCrisisTimer(30);
      setPlaying(false);
    }
  }, [pendingCrisis?.id]); // eslint-disable-line

  useEffect(() => {
    if (!crisisOpen) return;
    if (crisisTimer <= 0) {
      // auto-pick neutral first low-cost option
      const ev = pendingCrisis ? getEventById(pendingCrisis.eventId) : null;
      const opt = ev?.options.find((o) => o.tokenCost === 0) ?? ev?.options[0];
      if (pendingCrisis && opt) resolveCrisis(opt.key);
      return;
    }
    const t = setTimeout(() => setCrisisTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [crisisOpen, crisisTimer]); // eslint-disable-line

  const resolveCrisis = (optionKey: string) => {
    if (!pendingCrisis) return;
    const ev = getEventById(pendingCrisis.eventId);
    const opt = ev?.options.find((o) => o.key === optionKey);
    if (!opt) return;
    if (opt.tokenCost > 0) consumeToken(opt.tokenCost);
    recordCrisisResponse({
      crisisId: pendingCrisis.id,
      eventId: pendingCrisis.eventId,
      optionKey,
      tokenCost: opt.tokenCost,
      day: currentDay,
    });
    toast.success(`✓ ${opt.label}`, { description: opt.effect });
    setCrisisOpen(false);
    setTimeout(() => setPlaying(true), 400);
  };

  // Tick
  useEffect(() => {
    if (!playing) return;
    if (currentDay >= 30) return;
    const ms = SPEEDS[speed].ms;
    const t = setTimeout(() => setCurrentDay((d) => Math.min(30, d + 1)), ms);
    return () => clearTimeout(t);
  }, [playing, currentDay, speed]);

  // Auto-end on day 30
  useEffect(() => {
    if (currentDay >= 30 && playing) {
      setPlaying(false);
      const t = setTimeout(() => nav("/day-30-results"), 1800);
      return () => clearTimeout(t);
    }
  }, [currentDay, playing, nav]);

  // Filter range
  const range = useMemo(() => {
    const end = currentDay;
    const start =
      filter === "last3" ? Math.max(1, end - 2) :
      filter === "last7" ? Math.max(1, end - 6) :
      filter === "last14" ? Math.max(1, end - 13) :
      1;
    return { start, end };
  }, [filter, currentDay]);

  const totals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, atcs: 0, units: 0, revenue: 0 };
    for (let d = range.start; d <= range.end; d++) {
      const m = dayMetrics[d - 1];
      if (!m) continue;
      t.spend += m.spend; t.impressions += m.impressions; t.clicks += m.clicks;
      t.atcs += m.atcs; t.units += m.units; t.revenue += m.revenue;
    }
    return t;
  }, [dayMetrics, range]);

  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const goalRoas = 3;

  const animSpend = useCountUp(totals.spend);
  const animImp = useCountUp(totals.impressions);
  const animAtc = useCountUp(totals.atcs);
  const animUnits = useCountUp(totals.units);
  const animRev = useCountUp(totals.revenue);
  const animRoas = useCountUp(roas);

  const chartData = useMemo(() => {
    const arr = [];
    for (let d = range.start; d <= range.end; d++) {
      const m = dayMetrics[d - 1];
      arr.push({ day: `D${d}`, spend: Math.round(m.spend), revenue: Math.round(m.revenue) });
    }
    return arr;
  }, [dayMetrics, range]);

  // Insights
  const [dismissed, setDismissed] = useState<string[]>([]);
  const insights = useMemo(() => {
    const list: { id: string; emoji: string; title: string; body: string; action?: string; sinceDay: number }[] = [];
    if (currentDay >= 5) list.push({ id: "ins-city", emoji: "🔥", title: "Bangalore performing best", body: "ROAS 5.2x in Bangalore vs 1.8x in Mumbai.", action: "Scale Bangalore", sinceDay: 5 });
    if (currentDay >= 10) list.push({ id: "ins-kw", emoji: "⚠️", title: "Keyword burn detected", body: "ROAS 0.4x — consider removing low-performers.", action: "Remove keyword", sinceDay: 10 });
    if (currentDay >= 16) list.push({ id: "ins-cluster", emoji: "🎯", title: "Cluster pattern detected", body: "Koramangala + HSR perform 4× average.", action: "Cluster zones (1 token)", sinceDay: 16 });
    if (currentDay >= 22) list.push({ id: "ins-stock", emoji: "📦", title: "Stock alert", body: `Hero SKU low in top city — only ~80 units left.`, action: "Restock now", sinceDay: 22 });
    return list
      .filter((i) => !dismissed.includes(i.id))
      .filter((i) => currentDay - i.sinceDay <= 4)
      .slice(0, 3);
  }, [currentDay, dismissed]);

  // Campaign row totals (lifetime up to currentDay)
  const campaignRows = campaigns.map((c) => {
    const days = campaignDaily[c.id] ?? [];
    const t = { spend: 0, impressions: 0, atcs: 0, revenue: 0 };
    for (let d = 1; d <= currentDay; d++) {
      const m = days[d - 1];
      if (!m) continue;
      t.spend += m.spend; t.impressions += m.impressions; t.atcs += m.atcs; t.revenue += m.revenue;
    }
    const opt = optimizations[c.id] ?? { paused: false, scaleMultiplier: 1, dayparting: "24_7" as const };
    const r = t.spend > 0 ? t.revenue / t.spend : 0;
    return { c, opt, totals: t, roas: r };
  });

  const totalBudget = scenario.budget;
  const allSpend = campaignRows.reduce((s, x) => s + x.totals.spend, 0);
  const pctBudget = Math.min(100, (allSpend / totalBudget) * 100);
  const pctTime = (currentDay / 30) * 100;

  const ev = pendingCrisis ? getEventById(pendingCrisis.eventId) : null;
  const ctx = {
    topCity: campaignRows[0]?.c.cities[0] ?? "Bangalore",
    topSku: scenario.profile.skus[0]?.name ?? "Hero SKU",
    daysLeft: 30 - currentDay,
    budgetLeft: Math.max(0, totalBudget - allSpend),
  };

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        {/* HEADER */}
        <div className="px-8 pt-5 pb-3 border-b border-border bg-card/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Brand Central › Live</div>
              <h1 className="text-xl font-semibold mt-1">Ad Summary</h1>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-2xl font-bold tabular-nums">📅 Day {currentDay} of 30</div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant={speed === "slow" ? "default" : "outline"} onClick={() => setSpeed("slow")} className="h-7 px-2">
                  <Turtle className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPlaying((p) => !p)} className="h-7 px-3">
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant={speed === "normal" ? "default" : "outline"} onClick={() => setSpeed("normal")} className="h-7 px-2 text-[10px]">5s</Button>
                <Button size="sm" variant={speed === "fast" ? "default" : "outline"} onClick={() => setSpeed("fast")} className="h-7 px-2">
                  <FastForward className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Progress value={pctTime} className="w-56 h-1.5 mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-xs">
                <div className="text-muted-foreground">💰 {money(allSpend)} / {money(totalBudget)}</div>
                <div className="text-muted-foreground mt-0.5">🎫 {tokensRemaining} tokens</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => { setPlaying(false); setEndOpen(true); }} className="gap-1.5">
                <Flag className="h-3.5 w-3.5" /> End Now
              </Button>
            </div>
          </div>
        </div>

        <div className="flex">
          <div className="flex-1 px-8 py-5 space-y-5">
            {/* FILTER ROW */}
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last3">Last 3 days</SelectItem>
                  <SelectItem value="last7">Last 7 days</SelectItem>
                  <SelectItem value="last14">Last 14 days</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[10px]">Day {range.start} → {range.end}</Badge>
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </div>

            {/* METRIC CARDS */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <MetricCard label="Budget Consumed" value={money(animSpend)} hint={`${Math.round(pctBudget)}% of brief`} />
              <MetricCard label="Impressions" value={fmt(animImp)} />
              <MetricCard label="ATCs" value={fmt(animAtc)} />
              <MetricCard label="Qty Sold" value={fmt(animUnits)} />
              <MetricCard label="Sales" value={money(animRev)} />
              <MetricCard
                label="ROAS"
                value={`${animRoas.toFixed(2)}×`}
                hint={`Goal ${goalRoas}×`}
                tone={roas >= goalRoas ? "good" : roas >= goalRoas * 0.7 ? "neutral" : "bad"}
              />
            </div>

            {/* CHART */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Daily Trend</div>
                <div className="text-[11px] text-muted-foreground">Sales vs Spend</div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                      formatter={(v: number) => money(v)}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#gRev)" strokeWidth={2} />
                    <Area type="monotone" dataKey="spend" stroke="hsl(var(--muted-foreground))" fill="url(#gSpend)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* CAMPAIGNS TABLE */}
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="text-sm font-medium">Campaigns ({campaigns.length})</div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setPlaying(false); nav("/campaign"); }}>
                  + New Campaign
                </Button>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Campaign</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-right px-4 py-2">Spend</th>
                    <th className="text-right px-4 py-2">Impr.</th>
                    <th className="text-right px-4 py-2">ATCs</th>
                    <th className="text-right px-4 py-2">ROAS</th>
                    <th className="text-right px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignRows.map(({ c, opt, totals: t, roas: r }) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 capitalize">{c.objective ?? "—"}</td>
                      <td className="px-4 py-2">
                        {opt.paused ? <Badge variant="secondary">Paused</Badge> :
                          r >= 3 ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Strong</Badge> :
                          r >= 1.5 ? <Badge variant="outline">Average</Badge> :
                          <Badge variant="destructive">Failing</Badge>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(t.spend)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(t.impressions)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(t.atcs)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${r >= 3 ? "text-emerald-600" : r < 1.5 ? "text-red-600" : ""}`}>{r.toFixed(2)}×</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setOptimization(c.id, { paused: !opt.paused });
                            toast(opt.paused ? `▶ Resumed ${c.name}` : `⏸ Paused ${c.name}`);
                          }}>
                          {opt.paused ? "Resume" : "Pause"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setOptimization(c.id, { scaleMultiplier: Math.min(2, (opt.scaleMultiplier || 1) + 0.25) });
                            toast.success(`+25% budget on ${c.name}`);
                          }}>
                          +25%
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {campaignRows.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No campaigns.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          {/* INSIGHTS SIDEBAR */}
          <div className="w-72 shrink-0 border-l border-border bg-card/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> Live Insights
            </div>
            {insights.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Watching campaigns… insights will appear as days progress.
              </div>
            )}
            {insights.map((i) => (
              <Card key={i.id} className="p-3 relative animate-fade-in">
                <button onClick={() => setDismissed((d) => [...d, i.id])} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
                <div className="text-xs font-medium pr-4">{i.emoji} {i.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{i.body}</div>
                {i.action && (
                  <Button size="sm" variant="outline" className="h-7 mt-2 text-[11px] w-full"
                    onClick={() => { setDismissed((d) => [...d, i.id]); toast.success(`Applied: ${i.action}`); }}>
                    {i.action} <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CRISIS MODAL */}
      <Dialog open={crisisOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg">
          <div className="-m-6 mb-0 px-6 py-2 bg-red-600 text-white text-xs font-medium rounded-t-lg flex items-center justify-between">
            <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> URGENT — Day {currentDay}</span>
            <span className="tabular-nums">⏱ {crisisTimer}s</span>
          </div>
          <DialogHeader className="pt-4">
            <DialogTitle>{ev?.emoji} {ev?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{ev?.body(ctx)}</p>
          <RadioGroup value={crisisChoice} onValueChange={setCrisisChoice} className="space-y-2 py-2">
            {ev?.options.map((o) => (
              <Label key={o.key} htmlFor={o.key} className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value={o.key} id={o.key} className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {o.label}
                    {o.tokenCost > 0 && <Badge variant="outline" className="text-[10px]">🎫 {o.tokenCost}</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{o.effect}</div>
                </div>
              </Label>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button disabled={!crisisChoice} onClick={() => resolveCrisis(crisisChoice)}>Confirm Decision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* END NOW MODAL */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End simulation at Day {currentDay}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your performance up to Day {currentDay} will be evaluated. You can still complete all 30 days for a full score.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEndOpen(false); setPlaying(true); }}>Cancel</Button>
            <Button onClick={() => { setEndOpen(false); nav("/day-30-results"); }}>End Simulation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DAY 30 COMPLETE OVERLAY */}
      {currentDay >= 30 && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <Card className="p-8 text-center max-w-sm">
            <Rocket className="h-10 w-10 text-primary mx-auto mb-3" />
            <div className="text-lg font-semibold">🏁 Simulation Complete!</div>
            <div className="text-sm text-muted-foreground mt-1">Day 30 of 30. Calculating final results…</div>
          </Card>
        </div>
      )}
    </div>
  );
}
