import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim, REAL_MS_PER_SIM_DAY, CRISIS_DEADLINE_DAYS } from "@/context/SimContext";
import type { SavedCampaign } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
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
import {
  Area, ComposedChart, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Play, Pause, Rocket, Flag, AlertTriangle, Sparkles, Turtle,
  FastForward, X, Download, ChevronRight, SkipForward, Bell,
  Clock, Zap, Timer, CalendarClock, Pencil, Trash2, Wallet, Trophy, RotateCcw,
} from "lucide-react";
import { buildInitialStock } from "@/lib/weeklyMetrics";
import { buildCrisis, type CrisisSpec } from "@/lib/crisisEvents";
import { computeAllDays, type EngineDayResult } from "@/lib/dayEngine";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CampaignForm } from "@/components/CampaignForm";

// ── Types ─────────────────────────────────────────────────────────────────────
type DayMetric = EngineDayResult;
type Filter = "last3" | "last7" | "last14" | "lifetime";

const SPEEDS = {
  slow:   { label: "Slow",   ms: 8000, icon: Turtle },
  normal: { label: "Normal", ms: 5000, icon: Play },
  fast:   { label: "Fast",   ms: 2000, icon: FastForward },
} as const;
type SpeedKey = keyof typeof SPEEDS;

const PACE_LABEL: Record<string, string> = {
  very_fast: "Very Fast (5 min/day)",
  normal:    "Normal (10 min/day)",
  slow:      "Slow (30 min/day)",
};

const TIME_BLOCKS: { label: string; shortLabel: string; mult: number }[] = [
  { label: "12–3 AM",  shortLabel: "12a", mult: 0.80 },
  { label: "3–6 AM",   shortLabel: "3a",  mult: 0.80 },
  { label: "6–9 AM",   shortLabel: "6a",  mult: 1.00 },
  { label: "9–12 PM",  shortLabel: "9a",  mult: 1.10 },
  { label: "12–3 PM",  shortLabel: "12p", mult: 1.10 },
  { label: "3–6 PM",   shortLabel: "3p",  mult: 1.20 },
  { label: "6–9 PM",   shortLabel: "6p",  mult: 1.40 },
  { label: "9–12 AM",  shortLabel: "9p",  mult: 1.15 },
];

const FORMAT_LABEL: Record<string, string> = {
  product_booster:    "Product Booster",
  recommendation_ads: "Recommendation Ads",
  listing_spotlight:  "Listing Spotlight",
  brand_booster:      "Brand Booster",
  stories:            "Stories",
};

const FORMAT_COLORS: Record<string, string> = {
  product_booster:    "#4ade80",
  recommendation_ads: "#fbbf24",
  listing_spotlight:  "#60a5fa",
  brand_booster:      "#a78bfa",
  stories:            "#f472b6",
};

// Base CPMs for pre-launch Proj. Impressions estimate (₹ per 1000 impressions)
const BASE_CPM: Record<string, number> = {
  product_booster:    80,
  recommendation_ads: 100,
  listing_spotlight:  120,
  brand_booster:      150,
  stories:            500,
};

type MetricKey = "spend" | "impressions" | "atcs" | "units" | "revenue" | "clicks";
const METRIC_DEFS: { key: MetricKey; label: string; desc: string; color: string; isMoney: boolean }[] = [
  { key: "spend",       label: "Budget Consumed", desc: "Total budget spent on ad campaigns",            color: "#f59e0b", isMoney: true  },
  { key: "impressions", label: "Impressions",      desc: "Total count of views on your ads",              color: "#16a34a", isMoney: false },
  { key: "atcs",        label: "ATCs",             desc: "Number of times products were added to carts",  color: "#3b82f6", isMoney: false },
  { key: "units",       label: "Qty Sold",         desc: "Total number of products sold",                 color: "#8b5cf6", isMoney: false },
  { key: "revenue",     label: "Sales",            desc: "Total revenue from ad campaigns",               color: "#ec4899", isMoney: true  },
  { key: "clicks",      label: "Clicks",           desc: "Total clicks on your ads",                      color: "#06b6d4", isMoney: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt   = (n: number) => Math.round(n).toLocaleString("en-IN");
const money = (n: number) => `₹${fmt(n)}`;
function fmtShort(n: number): string {
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)    return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
function moneyShort(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function projectedImpressions(c: SavedCampaign): number | null {
  if (!c.adFormat || c.budgetType !== "overall") return null;
  const cpm = BASE_CPM[c.adFormat] ?? 100;
  return Math.round((c.budget / cpm) * 1000);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Sparkline({ data, tone = "primary", pulse }: { data: number[]; tone?: "primary" | "muted"; pulse: number }) {
  if (!data.length) return <div className="h-8" />;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const w = 100, h = 28, range = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts  = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  const last = data[data.length - 1], lx = (data.length - 1) * step, ly = h - ((last - min) / range) * h;
  const stroke = tone === "primary" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
  const pr = 2.5 + Math.sin(pulse / 3) * 1.2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8 mt-1.5" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={pr + 2} fill={stroke} opacity={0.18} />
      <circle cx={lx} cy={ly} r={pr} fill={stroke} />
    </svg>
  );
}

function MetricCard({ label, value, hint, tone, spark, pulse }: {
  label: string; value: string; hint?: string; tone?: "good" | "bad" | "neutral"; spark?: number[]; pulse: number;
}) {
  const toneCls = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${toneCls}`}>{value}</div>
      {spark && <Sparkline data={spark} tone={tone === "bad" ? "muted" : "primary"} pulse={pulse} />}
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function ReentryOverlay({ daysAdvanced, fromDay, toDay, missedCrises, onDismiss }: {
  daysAdvanced: number; fromDay: number; toDay: number; missedCrises: string[]; onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="text-4xl mb-3">👋</div>
          <h2 className="text-lg font-bold">Welcome back!</h2>
          <p className="text-sm text-muted-foreground mt-1">Your simulation kept running while you were away.</p>
        </div>
        <div className="px-6 pb-4 space-y-3">
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
            <div className="text-2xl">📅</div>
            <div>
              <div className="text-sm font-bold">+{daysAdvanced} day{daysAdvanced !== 1 ? "s" : ""} passed</div>
              <div className="text-xs text-muted-foreground">Day {fromDay} → Day {toDay}</div>
            </div>
          </div>
          {missedCrises.length > 0 ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span className="text-sm font-bold text-red-700">{missedCrises.length} crisis{missedCrises.length > 1 ? " events" : ""} auto-resolved</span>
              </div>
              <p className="text-xs text-red-600">You didn't respond within {CRISIS_DEADLINE_DAYS} days — worst option was applied.</p>
            </div>
          ) : (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2">
              <div className="text-lg">✅</div>
              <div className="text-xs text-green-700">No crises missed — good timing!</div>
            </div>
          )}
        </div>
        <div className="px-6 pb-6">
          <Button onClick={onDismiss} className="w-full">Continue to Dashboard <ChevronRight className="h-4 w-4 ml-1" /></Button>
        </div>
      </Card>
    </div>
  );
}

// ── Budget Distribution Pie ───────────────────────────────────────────────────
function BudgetDistributionPie({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <div className="w-28 h-28 rounded-full border-8 border-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground text-center leading-tight">No<br/>campaigns</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(1)}%`} labelLine={false}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => moneyShort(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SOV Table ─────────────────────────────────────────────────────────────────
function SOVTable({ keywords, goodKws, riskyKws, lifetimeImpressions }: {
  keywords: string[]; goodKws: string[]; riskyKws: string[]; lifetimeImpressions: number;
}) {
  const unique = Array.from(new Set(keywords)).slice(0, 8);
  if (unique.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-6 text-center leading-relaxed">
        Category targeting active<br />— keyword SOV not applicable
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground border-b border-border pb-2 mb-1">
        <span>Keyword</span><span className="text-right">Searches</span><span className="text-right">SOV %</span>
      </div>
      <div className="space-y-1">
        {unique.map((kw) => {
          const searches  = 20000 + (hashSeed(kw) % 80000);
          const share     = lifetimeImpressions > 0 ? (lifetimeImpressions / Math.max(unique.length, 1) / searches * 100) : 0;
          const sov       = Math.min(share, 15).toFixed(2);
          const isGood    = goodKws.includes(kw);
          const isRisky   = riskyKws.includes(kw);
          const dotColor  = isGood ? "bg-emerald-500" : isRisky ? "bg-red-500" : "bg-muted-foreground";
          return (
            <div key={kw} className="grid grid-cols-3 text-xs py-1.5 border-b border-border/50 items-center">
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                <span className="truncate">{kw}</span>
              </span>
              <span className="text-right tabular-nums text-muted-foreground">{searches.toLocaleString("en-IN")}</span>
              <span className="text-right tabular-nums font-medium">{sov}%</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Good kw</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Risky kw</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveDashboard() {
  const nav = useNavigate();
  const {
    student, scenario, campaigns, cmPitch, optimizations, setOptimization,
    stockLevels, setStockLevels, tokensRemaining, consumeToken,
    crisisResponses, recordCrisisResponse, startRun, activeRunId,
    simMode, setSimMode, assignmentPace, setAssignmentPace, simStartedAt,
    crisisRevealedAt, missedCrises,
    recordCrisisRevealed, recordMissedCrisis,
    dailyNoise,
    setupScore, daypartingChanges, recordDaypartingChange,
    currentDay, setCurrentDay,
    saveRunResult, savedRunResults, deleteCampaign, runHistory, clearActiveRun,
  } = useSim();

  if (!student) { nav("/", { replace: true }); return null; }
  if (!scenario) { nav("/brief", { replace: true }); return null; }

  // A run is "pre-launch" if there is no activeRunId, OR if the current run is
  // already marked completed (user ended/finished and came back to this page).
  const currentRunCompleted = !!activeRunId && runHistory.find((r) => r.id === activeRunId)?.status === "completed";
  const isCompleted  = currentRunCompleted; // run finished; stay in post-launch view
  const isPreLaunch  = !activeRunId;        // true only before any run starts

  // ── Init stock + run ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRunId) return;
    if (!Object.keys(stockLevels).length && scenario) setStockLevels(buildInitialStock(scenario));
  }, []); // eslint-disable-line

  // ── Pre-compute all days (non-draft campaigns only) ───────────────────────
  const nonDraftCampaigns = useMemo(() => campaigns.filter((c) => !c.isDraft), [campaigns]);

  const allDays = useMemo<DayMetric[]>(() => {
    if (isPreLaunch) return [];
    // For completed runs, use the frozen snapshot so metrics don't change on return visits
    if (isCompleted && activeRunId && savedRunResults[activeRunId]?.days?.length) {
      return savedRunResults[activeRunId].days;
    }
    const crisisDecisions = Object.values(crisisResponses)
      .filter((r) => r.crisisNum)
      .map((r) => ({ num: r.crisisNum as 1 | 2 | 3, optionKey: r.optionKey }));
    return computeAllDays({
      scenario,
      campaigns: nonDraftCampaigns,
      cmPitch,
      optimizations,
      stockLevels,
      crisisDecisions,
      dailyNoise: dailyNoise ?? { cpmMult: [], ctrMult: [], cvrMult: [] },
    });
  }, [scenario, nonDraftCampaigns, cmPitch, optimizations, stockLevels, crisisResponses, dailyNoise, isPreLaunch, isCompleted, activeRunId, savedRunResults]);

  const crisisSpecs: CrisisSpec[] = useMemo(
    () => [buildCrisis(1, scenario), buildCrisis(2, scenario), buildCrisis(3, scenario)],
    [scenario],
  );
  const crisisIdFor = (num: 1 | 2 | 3) => `crisis-${num}`;

  const dayMetrics = allDays;
  const simLength  = allDays.length > 0 ? allDays.length : 120;

  // ── Sim control state ─────────────────────────────────────────────────────
  const [playing, setPlaying]       = useState(false);
  const [speed, setSpeed]           = useState<SpeedKey>("normal");
  const [filter, setFilter]         = useState<Filter>("last7");
  const [endOpen, setEndOpen]       = useState(false);
  const [jumpDay, setJumpDay]       = useState("");
  const [showReentry, setShowReentry] = useState(false);
  const [reentryInfo, setReentryInfo] = useState({ daysAdvanced: 0, fromDay: 0, toDay: 0, newMissed: [] as string[] });
  const [scheduleOpen, setScheduleOpen] = useState<string | null>(null);
  const [scheduleBlocks, setScheduleBlocks] = useState<number[]>([0,1,2,3,4,5,6,7]);
  const allDaysRef = useRef<EngineDayResult[]>([]);

  // ── New campaign Sheet ────────────────────────────────────────────────────
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<SavedCampaign | undefined>(undefined);

  // ── Right panel tab ───────────────────────────────────────────────────────
  const [rightTab] = useState<"decisions">("decisions");

  // ── Campaign search ───────────────────────────────────────────────────────
  const [campaignSearch, setCampaignSearch] = useState("");

  // ── Launch modal ──────────────────────────────────────────────────────────
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchStep, setLaunchStep] = useState<1 | 2>(1);
  const [launchMode, setLaunchMode] = useState<"demo" | "assignment">("demo");
  const [launchPace, setLaunchPace] = useState<"very_fast" | "normal" | "slow">("normal");

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const readyCampaigns = campaigns.filter((c) => !c.isDraft);
  const canLaunch = readyCampaigns.length > 0;

  const handleLaunch = () => {
    setSimMode(launchMode);
    setAssignmentPace(launchPace);
    if (scenario) setStockLevels(buildInitialStock(scenario));
    startRun();
    setLaunchOpen(false);
    setLaunchStep(1);
  };

  // ── Assignment mode: catch up on mount ───────────────────────────────────
  useEffect(() => {
    if (simMode !== "assignment" || !simStartedAt || isPreLaunch || isCompleted) return;
    const msPerDay  = REAL_MS_PER_SIM_DAY[assignmentPace ?? "normal"];
    const elapsed   = Date.now() - new Date(simStartedAt).getTime();
    const catchUp   = Math.min(simLength, Math.max(1, Math.floor(elapsed / msPerDay) + 1));
    if (catchUp > currentDay) {
      setReentryInfo({ daysAdvanced: catchUp - currentDay, fromDay: currentDay, toDay: catchUp, newMissed: [] });
      setCurrentDay(catchUp);
      setShowReentry(true);
    }
  }, []); // eslint-disable-line

  // ── Assignment mode: periodic sync ───────────────────────────────────────
  useEffect(() => {
    if (simMode !== "assignment" || !simStartedAt || isPreLaunch || isCompleted) return;
    const id = setInterval(() => {
      const msPerDay = REAL_MS_PER_SIM_DAY[assignmentPace ?? "normal"];
      const elapsed  = Date.now() - new Date(simStartedAt).getTime();
      const newDay   = Math.min(simLength, Math.max(1, Math.floor(elapsed / msPerDay) + 1));
      setCurrentDay((prev) => Math.max(prev, newDay));
    }, 30_000);
    return () => clearInterval(id);
  }, [simMode, simStartedAt, assignmentPace]); // eslint-disable-line

  // ── Demo mode: ticker ─────────────────────────────────────────────────────
  useEffect(() => {
    if (simMode !== "demo" || isPreLaunch || isCompleted) return;
    if (!playing || currentDay >= simLength) return;
    const t = setTimeout(() => setCurrentDay(Math.min(simLength, currentDay + 1)), SPEEDS[speed].ms);
    return () => clearTimeout(t);
  }, [simMode, playing, currentDay, speed, isPreLaunch]); // eslint-disable-line

  // ── Crisis reveal + auto-apply ────────────────────────────────────────────
  useEffect(() => {
    if (isPreLaunch) return;
    const newlyMissed: string[] = [];
    for (const spec of crisisSpecs) {
      const key = crisisIdFor(spec.num);
      if (crisisResponses[key]) continue;
      if (currentDay < spec.day) continue;
      if (!crisisRevealedAt[key]) recordCrisisRevealed(key, Date.now());
      if (simMode === "assignment" && currentDay >= spec.day + CRISIS_DEADLINE_DAYS && !missedCrises.includes(key)) {
        const worstOpt  = spec.options.reduce((w, o) => o.score < w.score ? o : w, spec.options[0]);
        const maxScore  = Math.max(...spec.options.map((o) => o.score));
        recordCrisisResponse({
          crisisId: key, eventId: key, optionKey: worstOpt.key, tokenCost: 0, day: currentDay,
          crisisNum: spec.num, score: 0, maxScore, optionLabel: worstOpt.label,
          effectLabel: worstOpt.effect, title: spec.title, bestChoice: false,
        });
        recordMissedCrisis(key);
        newlyMissed.push(key);
        toast.error(`Crisis ${spec.num} auto-resolved — worst option applied (−${maxScore} pts)`);
      }
    }
    if (newlyMissed.length > 0) setReentryInfo((prev) => ({ ...prev, newMissed: [...prev.newMissed, ...newlyMissed] }));
  }, [currentDay]); // eslint-disable-line

  // ── Demo mode: pending crisis ─────────────────────────────────────────────
  const pendingCrisis: CrisisSpec | null = useMemo(() => {
    if (simMode !== "demo" || isPreLaunch) return null;
    for (const spec of crisisSpecs) {
      if (currentDay >= spec.day && !crisisResponses[crisisIdFor(spec.num)]) return spec;
    }
    return null;
  }, [simMode, crisisSpecs, currentDay, crisisResponses, isPreLaunch]);

  const [crisisOpen, setCrisisOpen]     = useState(false);
  const [crisisChoice, setCrisisChoice] = useState("");
  useEffect(() => {
    if (pendingCrisis && !crisisOpen) {
      setNewCampaignOpen(false);
      setCrisisOpen(true);
      setCrisisChoice("");
      setPlaying(false);
    }
  }, [pendingCrisis?.num]); // eslint-disable-line

  // ── Assignment crisis ─────────────────────────────────────────────────────
  const [assignCrisisOpen, setAssignCrisisOpen]   = useState(false);
  const [assignCrisisSpec, setAssignCrisisSpec]   = useState<CrisisSpec | null>(null);
  const [assignCrisisChoice, setAssignCrisisChoice] = useState("");
  const pendingAssignCrisis: CrisisSpec | null = useMemo(() => {
    if (simMode !== "assignment" || isPreLaunch) return null;
    for (const spec of crisisSpecs) {
      const key = crisisIdFor(spec.num);
      if (currentDay >= spec.day && !crisisResponses[key] && !missedCrises.includes(key)) return spec;
    }
    return null;
  }, [simMode, crisisSpecs, currentDay, crisisResponses, missedCrises, isPreLaunch]);

  // ── Crisis countdown ──────────────────────────────────────────────────────
  const [crisisSecsLeft, setCrisisSecsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!simStartedAt || simMode !== "assignment" || isPreLaunch) { setCrisisSecsLeft(null); return; }
    const spec = assignCrisisSpec ?? pendingAssignCrisis;
    if (!spec) { setCrisisSecsLeft(null); return; }
    const msPerDay   = REAL_MS_PER_SIM_DAY[assignmentPace ?? "normal"];
    const deadlineMs = new Date(simStartedAt).getTime() + (spec.day + CRISIS_DEADLINE_DAYS) * msPerDay;
    const tick = () => setCrisisSecsLeft(Math.max(0, Math.round((deadlineMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [assignCrisisSpec, pendingAssignCrisis, simStartedAt, simMode, assignmentPace, isPreLaunch]); // eslint-disable-line

  function fmtCountdown(secs: number): string {
    if (secs <= 0) return "Expired";
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const resolveCrisis = (spec: CrisisSpec, optionKey: string) => {
    const opt = spec.options.find((o) => o.key === optionKey);
    if (!opt) return;
    const maxScore = Math.max(...spec.options.map((o) => o.score));
    recordCrisisResponse({
      crisisId: crisisIdFor(spec.num), eventId: `crisis-${spec.num}`, optionKey, tokenCost: 0,
      day: currentDay, crisisNum: spec.num, score: opt.score, maxScore,
      optionLabel: opt.label, effectLabel: opt.effect, title: spec.title, bestChoice: !!opt.best,
    });
    toast.success(`Decision applied: ${opt.effect}`);

    // ── Auto-actions: execute side-effects on campaigns based on chosen option ──
    if (opt.autoAction?.type === "pause_affected_state") {
      const topState = scenario.profile.primaryState ?? "";
      const affected = nonDraftCampaigns.filter((c) =>
        // Bug6 guard: skip already-paused campaigns (student's intentional pause)
        !optimizations[c.id]?.paused &&
        (c.geography === "pan_india" || c.cities.includes(topState))
      );
      affected.forEach((c) => {
        setOptimization(c.id, { paused: true, crisisPaused: true });
      });
      if (affected.length > 0) {
        const names = affected.map((c) => c.name).join(", ");
        toast(`⏸ Auto-paused: ${names} — stock low in ${topState}`);
      }
    }

    setCrisisOpen(false); setAssignCrisisOpen(false);
    if (simMode === "demo") setTimeout(() => setPlaying(true), 400);
  };

  // ── Keep allDaysRef current ───────────────────────────────────────────────
  useEffect(() => { allDaysRef.current = allDays; }, [allDays]);

  // ── Auto-end ──────────────────────────────────────────────────────────────
  const endedRef = useRef(false);
  useEffect(() => {
    if (isPreLaunch || isCompleted || currentDay < simLength || endedRef.current) return;
    endedRef.current = true;
    setPlaying(false);
    if (activeRunId) saveRunResult({ runId: activeRunId, days: allDaysRef.current, savedAt: new Date().toISOString() });
    const t = setTimeout(() => nav("/results"), 800);
    return () => clearTimeout(t);
  }, [currentDay, nav]); // eslint-disable-line

  // ── Pulse + wall clock ────────────────────────────────────────────────────
  const [pulse, setPulse]     = useState(0);
  const [wallSec, setWallSec] = useState(0);
  useEffect(() => { const id = setInterval(() => setPulse((p) => p + 1), 220); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (simMode !== "demo" || isPreLaunch) return;
    const id = setInterval(() => setWallSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [simMode, isPreLaunch]);

  // ── Activity ticker ───────────────────────────────────────────────────────
  const [ticker, setTicker] = useState<{ id: number; text: string; tone: "good" | "neutral" | "warn" }[]>([]);
  useEffect(() => {
    if (isPreLaunch || currentDay < 1) return;
    const m = dayMetrics[currentDay - 1]; if (!m) return;
    const cities = Array.from(new Set(nonDraftCampaigns.flatMap((c) => c.cities ?? [])));
    const cityList = cities.length ? cities : ["Bangalore", "Mumbai", "Delhi"];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)] as T;
    const city = pick(cityList);
    const skuNames = scenario.profile.skus.slice(0, 3).map((s) => s.name);
    const sku  = pick(skuNames.length ? skuNames : ["Hero SKU"]);
    const ctr  = m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(2) : "0.00";
    const cpm  = m.impressions > 0 ? Math.round((m.spend / m.impressions) * 1000) : 0;
    const events: { text: string; tone: "good" | "neutral" | "warn" }[] = [];
    if (Math.round(m.revenue) > 0) events.push({ text: `💰 ₹${fmt(Math.round(m.revenue))} revenue · Day ${currentDay}`, tone: "good" });
    if (Math.round(m.atcs) > 0)   events.push({ text: `🛒 ${Math.round(m.atcs)} ATCs · ${city}`, tone: "good" });
    if (Math.round(m.units) > 0)  events.push({ text: `📦 ${Math.round(m.units)} units sold · ${sku}`, tone: "good" });
    if (Math.round(m.impressions) > 0) events.push({ text: `👁 ${fmt(Math.round(m.impressions))} impressions · Day ${currentDay}`, tone: "neutral" });
    if (parseFloat(ctr) > 0) events.push({ text: `📊 CTR ${ctr}% · ${pick(nonDraftCampaigns.map(c => c.name))}`, tone: "neutral" });
    if (cpm > 0) events.push({ text: `📈 CPM ₹${cpm} avg · Day ${currentDay}`, tone: "neutral" });
    setTicker((prev) => [...events.map((e, i) => ({ id: Date.now() + i, ...e })), ...prev].slice(0, 20));
  }, [currentDay]); // eslint-disable-line

  // ── Filter + totals ───────────────────────────────────────────────────────
  const range = useMemo(() => {
    const end = currentDay;
    const start = filter === "last3" ? Math.max(1, end - 2) : filter === "last7" ? Math.max(1, end - 6) : filter === "last14" ? Math.max(1, end - 13) : 1;
    return { start, end };
  }, [filter, currentDay]);

  const totals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, atcs: 0, units: 0, revenue: 0 };
    for (let d = range.start; d <= range.end; d++) {
      const m = dayMetrics[d - 1]; if (!m) continue;
      t.spend += m.spend; t.impressions += m.impressions; t.clicks += m.clicks;
      t.atcs  += m.atcs;  t.units       += m.units;       t.revenue += m.revenue;
    }
    return t;
  }, [dayMetrics, range]);

  const lifetimeTotals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, atcs: 0, units: 0, revenue: 0 };
    for (let d = 1; d <= currentDay; d++) {
      const m = dayMetrics[d - 1]; if (!m) continue;
      t.spend += m.spend; t.impressions += m.impressions; t.clicks += m.clicks;
      t.atcs  += m.atcs;  t.units       += m.units;       t.revenue += m.revenue;
    }
    return t;
  }, [dayMetrics, currentDay]);

  const roas     = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  // ── Download CSV ──────────────────────────────────────────────────────────
  const downloadCSV = () => {
    const filteredDays = allDays.filter((d) => d.day >= range.start && d.day <= range.end);
    if (filteredDays.length === 0) { toast("No data in this range yet."); return; }
    const header = "Day,Spend (₹),Impressions,Clicks,ATCs,Units,Revenue (₹),ROAS";
    const rows = filteredDays.map((d) => {
      const r = d.spend > 0 ? (d.revenue / d.spend).toFixed(2) : "0.00";
      return [
        d.day,
        Math.round(d.spend),
        Math.round(d.impressions),
        Math.round(d.clicks),
        Math.round(d.atcs),
        Math.round(d.units),
        Math.round(d.revenue),
        r,
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `blinkit-campaign-day${range.start}-${range.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded: Day ${range.start}–${range.end} metrics`);
  };

  // ── Metric selector ───────────────────────────────────────────────────────
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(["spend", "impressions"]);
  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length < 2) return [...prev, key];
      return [prev[1], key];
    });
  };
  const metricValues: Record<MetricKey, number> = {
    spend: totals.spend, impressions: totals.impressions, atcs: totals.atcs,
    units: totals.units, revenue: totals.revenue, clicks: totals.clicks,
  };

  const chartData = useMemo(() => {
    const arr: Record<string, number | string>[] = [];
    for (let d = range.start; d <= Math.min(range.end, currentDay); d++) {
      const m = dayMetrics[d - 1]; if (!m) continue;
      arr.push({ day: `D${d}`, spend: Math.round(m.spend), impressions: Math.round(m.impressions),
        atcs: Math.round(m.atcs), units: Math.round(m.units), revenue: Math.round(m.revenue), clicks: Math.round(m.clicks) });
    }
    return arr;
  }, [dayMetrics, range, currentDay]);

  // ── Insights ──────────────────────────────────────────────────────────────
  const [dismissed, setDismissed] = useState<string[]>([]);
  const insights = useMemo(() => {
    // WS-4: derive bodies from scenario.profile so numbers are never fake
    const ps      = scenario.profile.primaryState ?? "your top state";
    const risky   = scenario.profile.riskyKeywords?.[0] ?? "broad keywords";
    const heroSku = scenario.profile.skus?.[0]?.name ?? "hero SKU";
    const list: { id: string; emoji: string; title: string; body: string; action?: string; sinceDay: number }[] = [];
    if (currentDay >= 5)  list.push({ id: "ins-city",    emoji: "🔥", title: "Top city performing",      body: `${ps} is your strongest stock hub — ROAS likely peaks there. Consider concentrating budget.`, action: "Scale top city",  sinceDay: 5  });
    if (currentDay >= 10) list.push({ id: "ins-kw",      emoji: "⚠️", title: "Keyword burn detected",    body: `"${risky}" is a high-spend, low-conversion keyword. Review bids before it drains budget.`,   action: "Remove keyword",  sinceDay: 10 });
    if (currentDay >= 16) list.push({ id: "ins-cluster", emoji: "🎯", title: "Cluster pattern detected",  body: `Pin code clusters in ${ps} show higher repeat-purchase signals than surrounding areas.`,       sinceDay: 16 });
    if (currentDay >= 22) list.push({ id: "ins-stock",   emoji: "📦", title: "Stock alert",               body: `${heroSku} may be running low in ${ps} — check inventory before scaling spend further.`,     sinceDay: 22 });
    return list.filter((i) => !dismissed.includes(i.id)).filter((i) => currentDay - i.sinceDay <= 4).slice(0, 3);
  }, [currentDay, dismissed, scenario.profile]);

  // ── Stock-restore notification (crisis 1 auto-pause flow) ────────────────
  // Fires when stock returns after the student chose "pause affected state" in crisis 1.
  // Only shows if there are still crisis-paused campaigns waiting for the student to resume.
  const stockRestoreNotice = useMemo(() => {
    if (isPreLaunch) return null;
    const r = crisisResponses["crisis-1"];
    if (!r) return null;
    const crisis1 = crisisSpecs.find((s) => s.num === 1);
    if (!crisis1) return null;
    const chosenOpt = crisis1.options.find((o) => o.key === r.optionKey);
    if (!chosenOpt?.autoAction?.restoreAfterDays) return null;
    const restoreDay = crisis1.day + chosenOpt.autoAction.restoreAfterDays;
    if (currentDay < restoreDay) return null;
    // Only show while at least one crisis-paused campaign is still paused
    const stillPaused = nonDraftCampaigns.filter(
      (c) => optimizations[c.id]?.crisisPaused && optimizations[c.id]?.paused,
    );
    if (stillPaused.length === 0) return null;
    return { restoreDay, campaigns: stillPaused, state: scenario.profile.primaryState ?? "affected state" };
  }, [isPreLaunch, crisisResponses, crisisSpecs, currentDay, nonDraftCampaigns, optimizations, scenario.profile.primaryState]);

  // Bug7: fire one-time toast when stock restores — guard with ref so it only fires once per run.
  const stockToastFiredRef = useRef(false);
  // WS-1: Reset the guard whenever a new run starts (activeRunId changes).
  useEffect(() => { stockToastFiredRef.current = false; }, [activeRunId]);
  useEffect(() => {
    if (!stockRestoreNotice || stockToastFiredRef.current) return;
    stockToastFiredRef.current = true;
    toast(`📦 Stock is back in ${stockRestoreNotice.state}! Your paused campaigns can now resume.`, { duration: 6000 });
  }, [stockRestoreNotice]);

  // ── Budget spent ──────────────────────────────────────────────────────────
  const allSpend  = useMemo(() => dayMetrics.slice(0, currentDay).reduce((s, m) => s + m.spend, 0), [dayMetrics, currentDay]);
  const pctBudget = Math.min(100, (allSpend / scenario.budget) * 100);
  const pctTime   = (currentDay / simLength) * 100;

  // ── Campaign rows (post-launch) ───────────────────────────────────────────
  const campaignRows = campaigns.map((c) => {
    const t = { spend: 0, impressions: 0, atcs: 0, revenue: 0 };
    if (!isPreLaunch) {
      for (let d = 1; d <= currentDay; d++) {
        const m = allDays[d - 1]?.byCampaign?.[c.id]; if (!m) continue;
        t.spend += m.spend; t.impressions += m.impressions; t.atcs += m.atcs; t.revenue += m.revenue;
      }
    }
    const opt = optimizations[c.id] ?? { paused: false, scaleMultiplier: 1, dayparting: "24_7" as const, pausedAtDay: null };
    const r   = t.spend > 0 ? t.revenue / t.spend : 0;
    const isStopped = !c.isDraft && !opt.paused && c.budgetType === "overall" && t.spend >= c.budget * 0.99 && t.spend > 0;
    let status: "active" | "paused" | "draft" | "stopped" | "ready";
    if (isPreLaunch) {
      status = c.isDraft ? "draft" : "ready";
    } else {
      status = c.isDraft ? "draft" : isStopped ? "stopped" : opt.paused ? "paused" : "active";
    }
    return { c, opt, totals: t, roas: r, status };
  });

  const filteredRows = campaignSearch.trim()
    ? campaignRows.filter((r) => r.c.name.toLowerCase().includes(campaignSearch.toLowerCase()))
    : campaignRows;

  // ── Budget distribution data ──────────────────────────────────────────────
  const budgetDistData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { c, totals: t, status } of campaignRows) {
      if (status === "draft") continue;
      const fmt = c.adFormat ?? "unknown";
      const val = isPreLaunch ? c.budget : t.spend;
      map[fmt] = (map[fmt] || 0) + val;
    }
    return Object.entries(map).map(([k, v]) => ({
      name: FORMAT_LABEL[k] ?? k,
      value: v,
      color: FORMAT_COLORS[k] ?? "#94a3b8",
    }));
  }, [campaignRows, isPreLaunch]);

  // ── SOV data ──────────────────────────────────────────────────────────────
  const sovKeywords = useMemo(() => {
    return Array.from(new Set(nonDraftCampaigns.flatMap((c) => c.keywords ?? [])));
  }, [nonDraftCampaigns]);

  // ── Crisis countdown (upcoming) ───────────────────────────────────────────
  const nextCrisis = crisisSpecs.find(
    (spec) => !crisisResponses[crisisIdFor(spec.num)] && !missedCrises.includes(crisisIdFor(spec.num)) && currentDay < spec.day,
  );
  const daysToNextCrisis  = nextCrisis ? nextCrisis.day - currentDay : null;
  const showCountdown     = daysToNextCrisis !== null && daysToNextCrisis <= 2;
  const minsToNextCrisis  = useMemo(() => {
    if (!nextCrisis || !simStartedAt || simMode !== "assignment") return null;
    const msPerDay = REAL_MS_PER_SIM_DAY[assignmentPace ?? "normal"];
    return Math.round(((daysToNextCrisis ?? 0) * msPerDay) / 60_000);
  }, [nextCrisis, simStartedAt, simMode, assignmentPace, daysToNextCrisis]);

  // ── Shared: campaign table ────────────────────────────────────────────────
  const campaignTableSection = (
    <Card className="rounded-xl border border-border bg-white shadow-sm">
      {/* ── Header row ── */}
      <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-base font-bold text-foreground">Ad campaigns</div>
          <div className="text-xs text-muted-foreground mt-0.5">View and manage all your campaigns here</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              placeholder="Search for campaign"
              className="h-8 w-52 rounded-md border border-border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => { setEditCampaign(undefined); setNewCampaignOpen(true); }} className="h-8 gap-1.5 text-xs font-semibold border-green-600 text-green-700 hover:bg-green-50">
            + Create new campaign
          </Button>
        </div>
      </div>

      {/* ── "All Campaigns" tab underline ── */}
      <div className="px-6 border-b border-border">
        <span className="inline-block pb-2 text-xs font-semibold text-green-600 border-b-2 border-green-600">All Campaigns</span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-border bg-transparent">
              <th className="text-left px-6 py-3 text-xs font-semibold text-foreground/70 whitespace-nowrap">Campaign Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/70 whitespace-nowrap">Campaign Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/70 whitespace-nowrap">
                Status <span className="ml-0.5 text-muted-foreground">⇅</span>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/70 whitespace-nowrap">Duration</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/70 whitespace-nowrap">
                {isPreLaunch ? "Budget Planned" : "Budget Consumed"} <span className="ml-0.5 text-muted-foreground">⇅</span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/70 whitespace-nowrap">
                Impressions <span className="ml-0.5 text-muted-foreground">⇅</span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/70 whitespace-nowrap">
                ATCS <span className="ml-0.5 text-muted-foreground">⇅</span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/70 whitespace-nowrap">
                ROAS <span className="ml-0.5 text-muted-foreground">⇅</span>
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-foreground/70">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                  {campaignSearch ? "No campaigns match your search." : "No campaigns yet — click + Create new campaign to get started."}
                </td>
              </tr>
            )}
            {filteredRows.map(({ c, opt, totals: t, roas: r, status }) => {
              const savedBlocks = daypartingChanges[c.id]?.blocks;
              const isScheduled = !!savedBlocks && savedBlocks.length < 8;
              const projImpr = projectedImpressions(c);
              // Duration: "Day X onwards" post-launch, "On launch" for ready, "—" for draft
              const duration = status === "draft"
                ? "—"
                : isPreLaunch
                  ? "On launch"
                  : `Day ${c.launchDay ?? 1} onwards`;
              return (
                <React.Fragment key={c.id}>
                  <tr className="border-b border-border/60 hover:bg-slate-50/70 transition-colors">
                    {/* Campaign Name */}
                    <td className="px-6 py-4">
                      <span className="font-semibold text-sm text-foreground">{c.name}</span>
                    </td>
                    {/* Campaign Type */}
                    <td className="px-4 py-4 text-sm text-foreground/80">
                      {FORMAT_LABEL[c.adFormat ?? ""] ?? "—"}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-4">
                      {status === "active"  && <span className="text-xs font-semibold text-green-600">Active</span>}
                      {status === "paused"  && <span className="text-xs font-semibold text-amber-600">Paused{opt.pausedAtDay ? ` · D${opt.pausedAtDay}` : ""}</span>}
                      {status === "stopped" && <span className="inline-block px-2.5 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-600 text-xs font-semibold">Stopped</span>}
                      {status === "ready"   && <span className="inline-block px-2.5 py-0.5 rounded-full border border-green-500 bg-green-50 text-green-700 text-xs font-semibold">Ready</span>}
                      {status === "draft"   && <span className="inline-block px-2.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground text-xs font-medium">Draft</span>}
                    </td>
                    {/* Duration */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-foreground/70">{duration}</span>
                      {status !== "draft" && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {c.budgetType === "overall"
                            ? `₹${Math.round(c.budget).toLocaleString("en-IN")} total`
                            : `₹${Math.round(c.budget).toLocaleString("en-IN")}/day`}
                        </div>
                      )}
                    </td>
                    {/* Budget Consumed / Planned */}
                    <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">
                      {status === "draft" ? "—" : isPreLaunch ? money(c.budget) : money(t.spend)}
                    </td>
                    {/* Impressions */}
                    <td className="px-4 py-4 text-right tabular-nums text-sm text-foreground/80">
                      {status === "draft" || isPreLaunch ? (
                        <span className="text-muted-foreground">{status === "draft" ? "—" : projImpr !== null ? fmt(projImpr) : "—"}</span>
                      ) : fmt(Math.round(t.impressions))}
                    </td>
                    {/* ATCS */}
                    <td className="px-4 py-4 text-right tabular-nums text-sm">
                      {status === "draft" || isPreLaunch || c.objective === "reach" ? "—" : fmt(Math.round(t.atcs))}
                    </td>
                    {/* ROAS */}
                    <td className={`px-4 py-4 text-right tabular-nums text-sm font-medium ${c.objective !== "reach" && r >= 3 ? "text-emerald-600" : c.objective !== "reach" && r < 1.5 && r > 0 ? "text-red-600" : ""}`}>
                      {status === "draft" || isPreLaunch || c.objective === "reach" ? "—" : t.spend === 0 ? "0" : r.toFixed(2)}
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {status === "draft" && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-primary hover:bg-primary/5"
                            onClick={() => { setEditCampaign(c); setNewCampaignOpen(true); }}>
                            <Pencil className="h-3 w-3 mr-1" />Edit
                          </Button>
                        )}
                        {!isPreLaunch && status !== "draft" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
                              onClick={() => {
                                setOptimization(c.id, { paused: !opt.paused });
                                toast(opt.paused ? `▶ Resumed ${c.name}` : `⏸ Paused ${c.name} — spend stops from Day ${currentDay}`);
                              }}>
                              {opt.paused ? "Resume" : "Pause"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
                              onClick={() => { setOptimization(c.id, { scaleMultiplier: Math.min(2, (opt.scaleMultiplier || 1) + 0.25) }); toast.success(`+25% budget on ${c.name}`); }}>
                              +25%
                            </Button>
                            <Button variant="ghost" size="sm"
                              className={`h-7 px-2 text-[11px] gap-1 ${isScheduled ? "text-primary" : ""}`}
                              onClick={() => { if (scheduleOpen === c.id) setScheduleOpen(null); else { setScheduleBlocks(savedBlocks ?? [0,1,2,3,4,5,6,7]); setScheduleOpen(c.id); } }}>
                              <CalendarClock className="h-3 w-3" />{isScheduled ? "Sched." : "Schedule"}
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => { deleteCampaign(c.id); toast(`Deleted: ${c.name}`); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {/* Inline schedule editor */}
                  {scheduleOpen === c.id && (
                    <tr key={`${c.id}-sched`} className="border-b border-primary/20 bg-primary/[0.02]">
                      <td colSpan={9} className="px-6 py-4">
                        <div className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5 text-primary" />
                          Ad Schedule — toggle hours to run ads (6–9 PM is peak)
                        </div>
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {TIME_BLOCKS.map((block, idx) => {
                            const on = scheduleBlocks.includes(idx), isPeak = block.mult >= 1.35;
                            return (
                              <button key={idx} type="button"
                                onClick={() => setScheduleBlocks(prev => prev.includes(idx) ? prev.filter(b => b !== idx) : [...prev, idx].sort((a,b) => a-b))}
                                className={`px-2.5 py-1.5 rounded border text-[10px] font-medium transition-all ${on ? isPeak ? "bg-amber-500 border-amber-600 text-white" : "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/60"}`}>
                                <div>{block.label}</div>
                                <div className={`text-[9px] mt-0.5 ${on ? "opacity-80" : "opacity-50"}`}>{block.mult >= 1.35 ? "⚡ PEAK" : `${block.mult}×`}</div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="h-7 text-xs" disabled={scheduleBlocks.length === 0}
                            onClick={() => {
                              recordDaypartingChange(c.id, scheduleBlocks, currentDay);
                              setScheduleOpen(null);
                              const peakOn = scheduleBlocks.includes(6), deadOff = !scheduleBlocks.includes(0) && !scheduleBlocks.includes(1);
                              toast.success(peakOn && deadOff ? `⚡ Schedule saved — peak hours on, dead hours off. Good call!` : `📅 Schedule saved for ${c.name}`);
                            }}>Save Schedule</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setScheduleOpen(null)}>Cancel</Button>
                          <span className="text-[10px] text-muted-foreground ml-1">{scheduleBlocks.length}/8 slots active</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // ── Shared: bottom row (pie + SOV) ────────────────────────────────────────
  const bottomRow = (
    <div className="grid grid-cols-2 gap-4">
      <Card className="p-5">
        <div className="font-semibold text-sm mb-0.5">Budget Distribution</div>
        <div className="text-xs text-muted-foreground mb-4">Distribution of {isPreLaunch ? "planned budgets" : "spends"} across campaign types</div>
        <BudgetDistributionPie data={budgetDistData} />
      </Card>
      <Card className="p-5">
        <div className="font-semibold text-sm mb-0.5">Sponsored Share of Voice</div>
        <div className="text-xs text-muted-foreground mb-4">Your brand's inorganic visibility for targeted keywords</div>
        <SOVTable
          keywords={sovKeywords}
          goodKws={scenario.profile.goodKeywords}
          riskyKws={scenario.profile.riskyKeywords}
          lifetimeImpressions={lifetimeTotals.impressions}
        />
      </Card>
    </div>
  );

  // ── Shared: right panel (Decisions) ───────────────────────────────────────
  const rightPanel = (
    <div className="w-72 shrink-0 border-l border-border bg-card/40 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border text-xs font-semibold text-foreground">Decisions</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {setupScore && (
          <Card className="p-3 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-semibold">📊 Setup Score</div>
              <div className="text-sm font-bold text-primary">{setupScore.total}<span className="text-xs font-normal text-muted-foreground">/35</span></div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
              <div className="h-full bg-primary transition-all" style={{ width: `${(setupScore.total / 35) * 100}%` }} />
            </div>
            <div className="space-y-1">
              {setupScore.lines.map((l) => (
                <div key={l.key} className="flex items-center justify-between text-[10px]">
                  <span className={l.good ? "text-green-600" : "text-amber-600"}>{l.good ? "✓" : "○"} {l.label}</span>
                  <span className="text-muted-foreground tabular-nums">{l.earned}/{l.max}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card className="p-3">
          <div className="text-xs font-semibold mb-2">📦 Stock Status</div>
          <div className="flex flex-wrap gap-1">
            {(Object.entries(scenario.cityStockMap) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([state, osa]) => (
              <span key={state} className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${osa >= 70 ? "bg-green-50 border-green-300 text-green-700" : osa >= 40 ? "bg-amber-50 border-amber-300 text-amber-700" : osa > 0 ? "bg-red-50 border-red-300 text-red-700" : "border-border text-muted-foreground/50"}`}>
                {state.length > 9 ? state.slice(0, 8) + "…" : state}{osa > 0 && <span className="ml-0.5">{osa}%</span>}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground">
            <span className="text-green-600">≥70% good</span><span className="text-amber-600">40–69% low</span><span className="text-red-600">&lt;40% critical</span>
          </div>
        </Card>
        {!isPreLaunch && (
          <>
            {/* ── Resolved crisis decisions (persistent log) ── */}
            {Object.values(crisisResponses)
              .filter((r) => r.crisisNum)
              .sort((a, b) => (a.crisisNum! - b.crisisNum!))
              .map((r) => {
                const pct = r.maxScore ? (r.score! / r.maxScore) * 100 : 0;
                const isBest   = r.bestChoice;
                const tone     = isBest ? "border-green-300 bg-green-50" : pct >= 60 ? "border-amber-300 bg-amber-50" : "border-red-200 bg-red-50";
                const dotColor = isBest ? "text-green-700" : pct >= 60 ? "text-amber-700" : "text-red-600";
                return (
                  <Card key={r.crisisId} className={`p-3 border ${tone}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className={`text-[10px] font-bold uppercase tracking-wide ${dotColor}`}>
                        {isBest ? "✅" : pct >= 60 ? "🟡" : "🔴"} Crisis {r.crisisNum} — Day {r.day}
                      </div>
                      <div className={`text-[10px] font-semibold tabular-nums shrink-0 ${dotColor}`}>+{r.score ?? 0} pts</div>
                    </div>
                    <div className="text-[11px] font-medium text-foreground leading-snug mb-0.5">
                      {r.optionLabel}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-snug">
                      → {r.effectLabel}
                    </div>
                  </Card>
                );
              })}

            <div className="flex items-center gap-2 text-sm font-medium pt-1"><Sparkles className="h-4 w-4 text-primary" /> Live Insights</div>

            {/* ── Stock-restore notification (crisis auto-pause flow) ── */}
            {stockRestoreNotice && (
              <Card className="p-3 border-green-400 bg-green-50 animate-fade-in">
                <div className="text-xs font-semibold text-green-800 mb-1">
                  📦 Stock restored in {stockRestoreNotice.state}!
                </div>
                <div className="text-[11px] text-green-700 mb-2">
                  Your campaigns were paused while stock was low (Day {stockRestoreNotice.restoreDay}). Resume them to restart spend.
                </div>
                <div className="space-y-1.5">
                  {stockRestoreNotice.campaigns.map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      className="h-7 text-[11px] w-full bg-green-600 hover:bg-green-700 text-white border-0"
                      onClick={() => {
                        setOptimization(c.id, { paused: false });
                        toast.success(`▶ Resumed ${c.name} — spending from Day ${currentDay}`);
                      }}
                    >
                      ▶ Resume "{c.name}"
                    </Button>
                  ))}
                </div>
              </Card>
            )}

            {insights.length === 0 && !stockRestoreNotice ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Watching campaigns… insights appear as days progress.</div>
            ) : (
              insights.map((i) => {
                // WS-5: each action does something real instead of a fake toast
                const handleAction = () => {
                  setDismissed((d) => [...d, i.id]);
                  if (i.id === "ins-city") {
                    // Scale the highest-spend active campaign by +25%
                    const best = campaignRows
                      .filter((r) => r.status === "active")
                      .sort((a, b) => b.totals.spend - a.totals.spend)[0];
                    if (best) {
                      const newMult = Math.min(2.0, (best.opt.scaleMultiplier || 1) + 0.25);
                      setOptimization(best.c.id, { scaleMultiplier: newMult });
                      toast.success(`+25% budget applied to "${best.c.name}"`);
                    } else {
                      toast.success("No active campaigns to scale yet.");
                    }
                  } else if (i.id === "ins-kw") {
                    const risky = scenario.profile.riskyKeywords?.[0] ?? "broad keyword";
                    toast(`⚠️ Remove "${risky}" from your campaign keywords — it has low conversion potential and burns budget.`, { duration: 6000 });
                  }
                };
                return (
                  <Card key={i.id} className="p-3 relative animate-fade-in">
                    <button onClick={() => setDismissed((d) => [...d, i.id])} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                    <div className="text-xs font-medium pr-4">{i.emoji} {i.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{i.body}</div>
                    {i.action && (
                      <Button size="sm" variant="outline" className="h-7 mt-2 text-[11px] w-full"
                        onClick={handleAction}>
                        {i.action} <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </Card>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Shared: new campaign sheet ────────────────────────────────────────────
  const newCampaignSheet = (
    <Sheet open={newCampaignOpen} onOpenChange={(open) => { if (!open) { setEditCampaign(undefined); } setNewCampaignOpen(open); }}>
      <SheetContent side="right" className="!w-screen !max-w-none p-0 overflow-hidden h-full [&>button]:hidden">
        <CampaignForm
          asSheet
          editCampaign={editCampaign}
          onDone={() => { setNewCampaignOpen(false); setEditCampaign(undefined); }}
        />
      </SheetContent>
    </Sheet>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-hidden flex flex-col">
        <FlowHeader crumb="Ad Summary" step="simulation" />

        {/* ── Crisis banners (post-launch only) ── */}
        {!isPreLaunch && missedCrises.map((key) => {
          const num  = parseInt(key.replace("crisis-", "")) as 1 | 2 | 3;
          const spec = crisisSpecs[num - 1];
          return (
            <div key={key} className="mx-0 flex items-start gap-3 bg-red-600 text-white px-6 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <span className="font-bold">Crisis {num} auto-resolved</span>{" — "}You didn't respond within {CRISIS_DEADLINE_DAYS} days after "{spec?.title}". The worst option was applied.{" "}
                <span className="font-semibold">−{spec ? Math.max(...spec.options.map(o => o.score)) : 0} pts</span>
              </div>
            </div>
          );
        })}
        {!isPreLaunch && simMode === "assignment" && pendingAssignCrisis && (
          <div className="flex items-center gap-3 px-6 py-2.5 text-sm font-medium bg-red-100 text-red-800 border-b border-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="flex-1">🚨 <strong>Crisis {pendingAssignCrisis.num}:</strong> "{pendingAssignCrisis.title}" — respond before Day {pendingAssignCrisis.day + CRISIS_DEADLINE_DAYS}
              {crisisSecsLeft !== null && crisisSecsLeft > 0 && <span className="ml-2 font-mono text-xs bg-red-200 px-1.5 py-0.5 rounded">{fmtCountdown(crisisSecsLeft)} left</span>}
            </span>
            <Button size="sm" className="h-7 text-xs bg-red-700 hover:bg-red-800 text-white border-0 ml-auto shrink-0"
              onClick={() => { setAssignCrisisSpec(pendingAssignCrisis); setAssignCrisisOpen(true); }}>
              Respond now <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
        {!isPreLaunch && showCountdown && nextCrisis && !pendingAssignCrisis && (
          <div className="flex items-center gap-3 px-6 py-2.5 text-sm font-medium bg-amber-50 text-amber-800 border-b border-amber-200">
            <Bell className="h-4 w-4 shrink-0 animate-pulse" />
            <span>🔔 Crisis {nextCrisis.num} fires in {daysToNextCrisis} day{daysToNextCrisis !== 1 ? "s" : ""}{minsToNextCrisis !== null ? ` (~${minsToNextCrisis} min)` : ""}</span>
          </div>
        )}

        {/* ── Simulation completed banner ── */}
        {isCompleted && (
          <div className="px-6 py-2.5 border-b border-border bg-emerald-50/60 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-bold text-emerald-700 tracking-wider uppercase">Simulation Ended</span>
            <span className="text-sm font-semibold tabular-nums text-emerald-800">Day {currentDay} / {simLength}</span>
            <div className="flex-1 min-w-[80px] max-w-[160px]"><Progress value={100} className="h-1.5" /></div>
            <div className="text-[11px] text-emerald-700 shrink-0">{moneyShort(allSpend)} spent of {moneyShort(scenario.budget)}</div>
            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-100 gap-1.5 ml-auto shrink-0"
              onClick={() => nav("/results")}>
              <Trophy className="h-3 w-3" /> View Results
            </Button>
            <Button size="sm" variant="outline"
              className="h-7 text-xs border-slate-300 text-slate-600 hover:bg-slate-100 gap-1.5 shrink-0 disabled:opacity-40"
              disabled={tokensRemaining < 1}
              title={tokensRemaining < 1 ? "No tokens remaining" : "Re-run simulation (costs 1 token)"}
              onClick={() => setResetConfirmOpen(true)}>
              <RotateCcw className="h-3 w-3" /> Reset (1 token)
            </Button>
          </div>
        )}

        {/* ── Simulation strip (active run only) ── */}
        {!isPreLaunch && !isCompleted && (
          <div className="px-6 py-2 border-b border-border bg-card/40 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${simMode === "demo" ? "bg-amber-500" : "bg-red-500"}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${simMode === "demo" ? "bg-amber-500" : "bg-red-500"}`} />
              </span>
              <span className={`text-[10px] font-bold tracking-wider ${simMode === "demo" ? "text-amber-600" : "text-red-600"}`}>{simMode === "demo" ? "DEMO" : "LIVE"}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm font-bold tabular-nums">Day {currentDay}</span>
              <span className="text-xs text-muted-foreground">/ {simLength}</span>
            </div>
            <div className="flex-1 min-w-[80px] max-w-[160px]"><Progress value={pctTime} className="h-1.5" /></div>
            {simMode === "demo" && (
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant={speed === "slow" ? "default" : "ghost"} onClick={() => setSpeed("slow")} className="h-6 w-6 p-0"><Turtle className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setPlaying((p) => !p)} className="h-6 w-6 p-0">{playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}</Button>
                <Button size="sm" variant={speed === "fast" ? "default" : "ghost"} onClick={() => setSpeed("fast")} className="h-6 w-6 p-0"><FastForward className="h-3 w-3" /></Button>
                <input type="number" min={1} max={simLength} placeholder="Go" value={jumpDay} onChange={(e) => setJumpDay(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { const d = parseInt(jumpDay); if (d >= 1 && d <= simLength) { setCurrentDay(d); setJumpDay(""); } } }}
                  className="w-10 h-6 border border-border rounded px-1 text-[11px] text-center bg-background" />
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                  onClick={() => { const d = parseInt(jumpDay); if (d >= 1 && d <= simLength) { setCurrentDay(d); setJumpDay(""); } }}>
                  <SkipForward className="h-3 w-3" />
                </Button>
              </div>
            )}
            {simMode === "assignment" && (
              <div className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
                {assignmentPace === "very_fast" && <Zap className="h-3 w-3" />}
                {assignmentPace === "normal"    && <Clock className="h-3 w-3" />}
                {assignmentPace === "slow"      && <Timer className="h-3 w-3" />}
                {PACE_LABEL[assignmentPace ?? "normal"]?.split(" ")[0]}
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-hidden mx-1">
              {ticker.length === 0 ? (
                <span className="text-[11px] text-muted-foreground/50 italic">Waiting for Day 1 activity…</span>
              ) : (
                <div className="ticker-track">
                  {[...ticker, ...ticker].map((t, i) => (
                    <span key={i} className={`mr-8 tabular-nums text-[11px] ${t.tone === "good" ? "text-emerald-600" : t.tone === "warn" ? "text-amber-600" : "text-foreground/60"}`}>
                      {t.text}<span className="text-muted-foreground/30 ml-8">·</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right text-[11px] text-muted-foreground shrink-0 leading-tight">
              <div>{moneyShort(allSpend)} / {moneyShort(scenario.budget)}</div>
              <div>{tokensRemaining} token{tokensRemaining !== 1 ? "s" : ""} left</div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => { if (simMode === "demo") setPlaying(false); setEndOpen(true); }} className="h-7 gap-1.5 shrink-0">
              <Flag className="h-3.5 w-3.5" /> End
            </Button>
          </div>
        )}

        {/* ── Page header ── */}
        <div className="px-6 pt-5 pb-3 border-b border-border flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">Ad Summary</h1>
            <p className="text-xs text-muted-foreground mt-0.5">An overview of your campaigns' key metrics and performance</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs"
              onClick={() => { setEditCampaign(undefined); setNewCampaignOpen(true); }}>
              + Create new campaign
            </Button>
            <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-xs font-medium">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              Ads Wallet | {moneyShort(isPreLaunch ? scenario.budget - campaigns.filter(c=>!c.isDraft).reduce((s,c)=>s+c.budget,0) : Math.max(0, scenario.budget - allSpend))}
            </div>
            {isPreLaunch && (
              <Button
                size="sm"
                disabled={!canLaunch}
                onClick={() => { setLaunchStep(1); setLaunchOpen(true); }}
                className="h-9 gap-1.5 bg-[#1a1a1a] hover:bg-[#333] text-white text-xs"
              >
                <Rocket className="h-3.5 w-3.5" /> Launch →
              </Button>
            )}
          </div>
        </div>

        {/* ── Main body ── */}
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 px-6 py-4 overflow-y-auto flex flex-col gap-4">

            {/* ── Post-launch: filter row + performance overview + chart ── */}
            {!isPreLaunch && (
              <>
                {/* Filter row */}
                <div className="flex items-center gap-2">
                  <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last3">Last 3 days</SelectItem>
                      <SelectItem value="last7">Last 7 days</SelectItem>
                      <SelectItem value="last14">Last 14 days</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="text-[10px]">Day {range.start} → {range.end}</Badge>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={downloadCSV}><Download className="h-3.5 w-3.5" /> Download</Button>
                </div>

                {/* Performance Overview */}
                <div>
                  <div className="text-sm font-semibold mb-3">Performance Overview</div>
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                    {METRIC_DEFS.map((def) => {
                      const isSelected = selectedMetrics.includes(def.key);
                      const val = metricValues[def.key];
                      const displayVal = def.isMoney ? moneyShort(val) : fmtShort(val);
                      const dotColor = selectedMetrics.indexOf(def.key) === 0
                        ? METRIC_DEFS.find((m) => m.key === selectedMetrics[0])?.color
                        : selectedMetrics.indexOf(def.key) === 1
                        ? METRIC_DEFS.find((m) => m.key === selectedMetrics[1])?.color
                        : undefined;
                      return (
                        <button key={def.key} onClick={() => toggleMetric(def.key)}
                          className={`min-w-[176px] w-[176px] shrink-0 rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm ${isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-sm text-foreground/80 font-medium leading-tight">{def.label}</span>
                            <div className={`h-5 w-5 rounded flex items-center justify-center border-2 shrink-0 ml-2 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30 bg-transparent"}`}>
                              {isSelected && <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </div>
                          </div>
                          <div className="text-2xl font-bold tabular-nums mb-1.5 flex items-center gap-2">
                            {displayVal}
                            {isSelected && dotColor && <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dotColor }} />}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight">{def.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chart */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold">Daily Metric Trends</div>
                    <div className="flex items-center gap-4 text-[11px]">
                      {selectedMetrics.length === 0 && <span className="text-muted-foreground italic">Select a metric above to plot</span>}
                      {selectedMetrics.map((key) => { const def = METRIC_DEFS.find((m) => m.key === key)!; return (
                        <span key={key} className="flex items-center gap-1.5 font-medium" style={{ color: def.color }}>
                          <span className="inline-block w-3 h-3 rounded-full" style={{ background: def.color }} />{def.label}
                        </span>
                      ); })}
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart key={`${filter}-${selectedMetrics.join("-")}`} data={chartData}
                        margin={{ top: 4, right: selectedMetrics.length > 1 ? 52 : 8, bottom: 0, left: 4 }}>
                        <defs>{selectedMetrics.map((key) => { const def = METRIC_DEFS.find((m) => m.key === key)!; return (
                          <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={def.color} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={def.color} stopOpacity={0.02} />
                          </linearGradient>
                        ); })}</defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ dy: 4 }} />
                        {selectedMetrics.length > 0 && (() => { const def = METRIC_DEFS.find((m) => m.key === selectedMetrics[0])!; return (
                          <YAxis yAxisId="left" orientation="left" stroke={def.color} fontSize={10} tickFormatter={(v) => def.isMoney ? moneyShort(v) : fmtShort(v)} width={52} />
                        ); })()}
                        {selectedMetrics.length > 1 && (() => { const def = METRIC_DEFS.find((m) => m.key === selectedMetrics[1])!; return (
                          <YAxis yAxisId="right" orientation="right" stroke={def.color} fontSize={10} tickFormatter={(v) => def.isMoney ? moneyShort(v) : fmtShort(v)} width={52} />
                        ); })()}
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12, borderRadius: 8 }}
                          formatter={(v: number, name: string) => { const def = METRIC_DEFS.find((m) => m.key === name); return [def?.isMoney ? moneyShort(v) : fmtShort(v), def?.label ?? name]; }}
                          labelFormatter={(l) => `Day ${String(l).replace("D", "")}`} />
                        {selectedMetrics.length > 0 && <ReferenceLine yAxisId="left" x={`D${currentDay}`} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" strokeWidth={1} label={{ value: "today", position: "insideTopRight", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />}
                        {selectedMetrics.map((key, idx) => { const def = METRIC_DEFS.find((m) => m.key === key)!; return (
                          <Area key={key} yAxisId={idx === 0 ? "left" : "right"} type="monotone" dataKey={key} stroke={def.color} fill={`url(#grad-${key})`} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: def.color }} />
                        ); })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </>
            )}

            {/* ── Campaign table (both states) ── */}
            {campaignTableSection}

            {/* ── Bottom row: pie + SOV (both states) ── */}
            {bottomRow}
          </div>

          {/* ── Right panel (both states) ── */}
          {rightPanel}
        </div>
      </div>

      {/* ── New/Edit campaign sheet ── */}
      {newCampaignSheet}

      {/* ── Launch modal (pre-launch only) ── */}
      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent className="max-w-md">
          {launchStep === 1 ? (
            <>
              <DialogHeader><DialogTitle>Choose simulation mode</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                {([["demo", "Demo", "Play/pause, speed controls — great for self-practice"], ["assignment", "Assignment", "Real-time clock — for classroom use"]] as const).map(([val, label, desc]) => (
                  <button key={val} onClick={() => setLaunchMode(val)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${launchMode === val ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                  </button>
                ))}
                {launchMode === "assignment" && (
                  <div className="pt-1">
                    <div className="text-xs font-medium mb-2 text-muted-foreground">Simulation pace</div>
                    <div className="flex gap-2">
                      {([["very_fast", "Very Fast", "5 min/day"], ["normal", "Normal", "10 min/day"], ["slow", "Slow", "30 min/day"]] as const).map(([val, label, sub]) => (
                        <button key={val} onClick={() => setLaunchPace(val)}
                          className={`flex-1 text-center p-2.5 rounded-lg border-2 transition-all text-xs ${launchPace === val ? "border-primary bg-primary/5 font-semibold" : "border-border hover:border-primary/40"}`}>
                          <div>{label}</div><div className="text-[10px] text-muted-foreground">{sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLaunchOpen(false)}>Cancel</Button>
                <Button onClick={() => setLaunchStep(2)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader><DialogTitle>Ready to launch?</DialogTitle></DialogHeader>
              <div className="py-3 space-y-3">
                <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Ready campaigns</span><span className="font-semibold">{readyCampaigns.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total budget</span><span className="font-semibold">{money(readyCampaigns.reduce((s, c) => s + c.budget, 0))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span className="font-semibold capitalize">{launchMode}</span></div>
                  {launchMode === "assignment" && <div className="flex justify-between"><span className="text-muted-foreground">Pace</span><span className="font-semibold">{PACE_LABEL[launchPace]}</span></div>}
                </div>
                <p className="text-xs text-muted-foreground">Draft campaigns won't spend until you complete and save them. You can add new campaigns mid-simulation.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLaunchStep(1)}>Back</Button>
                <Button onClick={handleLaunch} className="gap-1.5"><Rocket className="h-4 w-4" /> Launch Simulation</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Demo mode: blocking crisis modal ── */}
      <Dialog open={crisisOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-[600px] p-0 overflow-hidden [&>button]:hidden"
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          {/* Radix requires DialogTitle always present in DOM */}
          <DialogHeader className="sr-only">
            <DialogTitle>{pendingCrisis?.title ?? "Crisis Decision"}</DialogTitle>
          </DialogHeader>
          {pendingCrisis && (
            <>
              <div className={`px-6 py-2.5 text-white text-xs font-semibold tracking-wide flex items-center justify-between ${pendingCrisis.tone === "red" ? "bg-red-600" : pendingCrisis.tone === "orange" ? "bg-orange-500" : "bg-blue-600"}`}>
                <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />URGENT DECISION REQUIRED — DAY {currentDay}</div>
                <span className="bg-white/20 rounded px-2 py-0.5 text-[11px] font-normal">⏸ Sim paused — resolve to continue</span>
              </div>
              <div className="px-6 pt-5 pb-4 text-center">
                <div className="text-4xl mb-2">{pendingCrisis.icon}</div>
                <div className="text-lg font-bold">{pendingCrisis.title}</div>
                {pendingCrisis.subtitle && <div className="text-xs text-muted-foreground mt-1">{pendingCrisis.subtitle}</div>}
              </div>
              <div className="px-6 pb-4">
                <p className="text-sm text-foreground/90 leading-relaxed bg-muted/40 rounded-md p-3 border border-border">{pendingCrisis.message}</p>
              </div>
              <div className="px-6 pb-2 space-y-2">
                {pendingCrisis.options.map((o) => (
                  <button key={o.key} onClick={() => setCrisisChoice(o.key)}
                    className={`w-full text-left p-3 rounded-md border-2 transition-all ${crisisChoice === o.key ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/50"}`}>
                    <div className="text-sm font-semibold flex items-center gap-2"><span className="uppercase text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{o.key}</span>{o.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 pl-7">{o.effect}</div>
                  </button>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end bg-muted/20">
                <Button disabled={!crisisChoice} onClick={() => resolveCrisis(pendingCrisis, crisisChoice)}>Submit Decision</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Assignment mode: non-blocking crisis modal ── */}
      <Dialog open={assignCrisisOpen} onOpenChange={setAssignCrisisOpen}>
        <DialogContent className="max-w-[600px] p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>{assignCrisisSpec?.title ?? "Crisis Decision"}</DialogTitle>
          </DialogHeader>
          {assignCrisisSpec && (
            <>
              <div className={`px-6 py-3 text-white text-xs font-semibold tracking-wide flex items-center justify-between ${assignCrisisSpec.tone === "red" ? "bg-red-600" : assignCrisisSpec.tone === "orange" ? "bg-orange-500" : "bg-blue-600"}`}>
                <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />CRISIS {assignCrisisSpec.num} — RESPOND BY DAY {assignCrisisSpec.day + CRISIS_DEADLINE_DAYS}</div>
                <div className="flex flex-col items-end gap-0.5">
                  {crisisSecsLeft !== null ? (
                    <><span className={`font-mono text-sm font-bold ${crisisSecsLeft < 120 ? "text-yellow-300 animate-pulse" : ""}`}>⏱ {fmtCountdown(crisisSecsLeft)}</span><span className="text-[10px] font-normal opacity-80">until worst option auto-applies</span></>
                  ) : (
                    <span className="bg-white/20 rounded px-2 py-0.5 text-[11px]">{CRISIS_DEADLINE_DAYS - (currentDay - assignCrisisSpec.day)} day{CRISIS_DEADLINE_DAYS - (currentDay - assignCrisisSpec.day) !== 1 ? "s" : ""} left</span>
                  )}
                </div>
              </div>
              <div className="px-6 pt-5 pb-4 text-center">
                <div className="text-4xl mb-2">{assignCrisisSpec.icon}</div>
                <div className="text-lg font-bold">{assignCrisisSpec.title}</div>
                {assignCrisisSpec.subtitle && <div className="text-xs text-muted-foreground mt-1">{assignCrisisSpec.subtitle}</div>}
              </div>
              <div className="px-6 pb-4"><p className="text-sm text-foreground/90 leading-relaxed bg-muted/40 rounded-md p-3 border border-border">{assignCrisisSpec.message}</p></div>
              <div className="px-6 pb-2 space-y-2">
                {assignCrisisSpec.options.map((o) => (
                  <button key={o.key} onClick={() => setAssignCrisisChoice(o.key)}
                    className={`w-full text-left p-3 rounded-md border-2 transition-all ${assignCrisisChoice === o.key ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/50"}`}>
                    <div className="text-sm font-semibold flex items-center gap-2"><span className="uppercase text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{o.key}</span>{o.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 pl-7">{o.effect}</div>
                  </button>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/20">
                <Button variant="ghost" size="sm" onClick={() => setAssignCrisisOpen(false)}>Decide later</Button>
                <Button disabled={!assignCrisisChoice} onClick={() => resolveCrisis(assignCrisisSpec, assignCrisisChoice)}>Submit Decision</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reset simulation confirm ── */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reset simulation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will clear the current run and return to pre-launch. Your campaigns stay intact so you can adjust and re-launch.
          </p>
          <p className="text-sm font-medium text-amber-700 bg-amber-50 rounded-md px-3 py-2 border border-amber-200">
            Costs <strong>1 token</strong> · You have {tokensRemaining} token{tokensRemaining !== 1 ? "s" : ""} remaining.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              setResetConfirmOpen(false);
              consumeToken(1);
              clearActiveRun();
              setCurrentDay(1);
              toast.success("Simulation reset — adjust your campaigns and re-launch.");
            }}>
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── End Now modal ── */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>End simulation at Day {currentDay}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Your performance up to Day {currentDay} will be evaluated. You can still run all {simLength} days for a full score.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEndOpen(false); if (simMode === "demo") setPlaying(true); }}>Cancel</Button>
            <Button onClick={() => {
              setEndOpen(false);
              setPlaying(false);
              if (activeRunId) saveRunResult({ runId: activeRunId, days: allDaysRef.current, savedAt: new Date().toISOString() });
              nav("/results");
            }}>End Simulation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Simulation complete overlay ── */}
      {!isPreLaunch && !isCompleted && currentDay >= simLength && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <Card className="p-8 text-center max-w-sm">
            <Rocket className="h-10 w-10 text-primary mx-auto mb-3" />
            <div className="text-lg font-semibold">🏁 Simulation Complete!</div>
            <div className="text-sm text-muted-foreground mt-1">Loading your results…</div>
          </Card>
        </div>
      )}

      {/* ── Re-entry overlay ── */}
      {showReentry && (
        <ReentryOverlay
          daysAdvanced={reentryInfo.daysAdvanced} fromDay={reentryInfo.fromDay}
          toDay={reentryInfo.toDay} missedCrises={reentryInfo.newMissed}
          onDismiss={() => setShowReentry(false)}
        />
      )}
    </div>
  );
}
