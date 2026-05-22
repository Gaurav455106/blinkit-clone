import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Scenario, generateScenario, CityName } from "@/data/scenarios";
import { Competitor, CompetitorAction, initCompetitor } from "@/data/competitor";

export interface Student {
  name: string;
  email: string;
  batch: string;
}

export interface CmPitchSku {
  skuId: string;
  cities: CityName[];
  reasoning: string;
  justification?: string;
}

export interface CmPitchResult {
  status: "strong" | "decent" | "weak" | "rejected";
  approvedSKUs: string[];
  approvedCities: CityName[];
  pitchScore: number;
  osaBoost: boolean;
  message: string;
  flags: string[];
}

export interface SavedCampaign {
  id: string;
  name: string;
  objective: "performance" | "reach" | null;
  adFormat: string | null;
  cities: string[]; // legacy name: now holds STATE names
  skuIds: string[];
  keywords: string[];
  budget: number;
  budgetType: "daily" | "overall" | null;
  geography: "select_cities" | "pan_india" | null;
  launchDay?: number; // day-of-30 when launched (default 1)
  dayparting?: number[]; // active hour-block indices (0..7); empty/undefined = 24/7
  daypartPreset?: "peak" | "daytime" | "24_7" | "custom";
}

export interface CampaignOptimization {
  paused: boolean;
  scaleMultiplier: number; // 1.0, 1.25
  dayparting: "24_7" | "peak_only";
  extraBudget?: number; // not currently applied to cost engine
}

export type StockMap = Record<string, Record<string, number>>; // skuId -> city -> units

export interface DecisionLogEntry {
  week: number;
  type: "continue" | "pause" | "scale" | "edit" | "restock" | "new" | "event";
  campaignId?: string;
  description: string;
  tokenCost: number;
}

export interface EventResponse {
  eventId: string;
  optionKey: string;
  tokenCost: number;
}

export interface CrisisResponse {
  crisisId: string;
  eventId: string;
  optionKey: string;
  tokenCost: number;
  day: number;
  crisisNum?: 1 | 2 | 3;
  score?: number;
  maxScore?: number;
  optionLabel?: string;
  effectLabel?: string;
  title?: string;
  bestChoice?: boolean;
}

export interface RunSnapshot {
  scenario: Scenario;
  cmPitch: CmPitchResult | null;
  campaigns: SavedCampaign[];
  weekTotals: WeekResultStored[];
  decisionsLog: DecisionLogEntry[];
  crisisResponses: Record<string, CrisisResponse>;
  abTests: AbTest[];
  cannibalResolved: string[];
  clusterReactions: ClusterReactionStored[];
  tokensSpent: number;
  tokensRemaining: number;
  microDecisionsLog: { day: number; decision: string }[];
  exhaustedCampaigns: { campaignId: string; exhaustedDay: number; was: "winning" | "losing"; caught: boolean }[];
  cumulativeSpendByCampaign: Record<string, number>;
  events: { week2?: EventResponse; week3?: EventResponse };
  optimizations: Record<string, CampaignOptimization>;
  stockLevels: StockMap;
  competitor: Competitor | null;
  competitorActions: CompetitorAction[];
}

export interface RunHistoryEntry {
  id: string;
  scenarioSeed: string;
  brandName: string;
  brandEmoji: string;
  startedAt: string;
  completedAt?: string;
  status: "in_progress" | "completed";
  score?: number;
  achievementPct?: number;
  snapshot?: RunSnapshot;
}

export interface WeekResultStored {
  week: number;
  totals: { spend: number; impressions: number; clicks: number; atcs: number; units: number; revenue: number; roas: number };
}

export interface AbTest { campaignId: string; week: number; variable: string; winner: "A" | "B"; ctrMultiplier: number }
export interface ClusterReactionStored { city: string; action: "cluster_bid" | "cluster_daypart" | "expand_similar" | "stay_broad"; tokenCost: number }
export interface PacingSnapshot { campaignId: string; cumulativeSpend: number; budget: number; pacePct: number; projectedExhaustionDay: number | null; exhausted: boolean; wasWinning?: boolean; caught?: boolean }

interface SimState {
  student: Student | null;
  scenario: Scenario | null;
  cmPitch: CmPitchResult | null;
  campaigns: SavedCampaign[];
  tokensRemaining: number;
  tokensSpent: number;

  // simulation state
  currentDay: number;
  optimizations: Record<string, CampaignOptimization>;
  stockLevels: StockMap;
  decisionsLog: DecisionLogEntry[];
  weekTotals: WeekResultStored[];
  events: { week2?: EventResponse; week3?: EventResponse };

  // Phase 3
  competitor: Competitor | null;
  competitorActions: CompetitorAction[];
  cannibalResolved: string[]; // keys of resolved keyword|city
  clusterReactions: ClusterReactionStored[];
  abTests: AbTest[];
  cumulativeSpendByCampaign: Record<string, number>;
  exhaustedCampaigns: { campaignId: string; exhaustedDay: number; was: "winning" | "losing"; caught: boolean }[];
  microDecisionsLog: { day: number; decision: string }[];

  // Crises (Phase 2 add-on)
  crisisResponses: Record<string, CrisisResponse>;
  runHistory: RunHistoryEntry[];
  activeRunId: string | null;
  reviewRunId: string | null;
  mode: "home" | "run" | "review";

  setStudent: (s: Student) => void;
  newScenario: () => void;
  setCmPitch: (p: CmPitchResult | null) => void;
  addCampaign: (c: SavedCampaign) => void;
  updateCampaign: (id: string, c: Partial<SavedCampaign>) => void;
  deleteCampaign: (id: string) => void;
  consumeToken: (n?: number) => void;

  // sim actions
  initSimulation: (stock: StockMap) => void;
  setOptimization: (id: string, opt: Partial<CampaignOptimization>) => void;
  setStockLevels: (s: StockMap) => void;
  setCurrentDay: (d: number) => void;
  logDecision: (d: DecisionLogEntry) => void;
  recordWeekTotals: (w: WeekResultStored) => void;
  setEventResponse: (week: 2 | 3, r: EventResponse) => void;

  // Phase 3 setters
  setCompetitor: (c: Competitor) => void;
  addCompetitorAction: (a: CompetitorAction) => void;
  resolveCannibal: (key: string) => void;
  addClusterReaction: (r: ClusterReactionStored) => void;
  addAbTest: (t: AbTest) => void;
  recordCumulativeSpend: (campaignId: string, addedSpend: number) => void;
  markExhausted: (e: { campaignId: string; exhaustedDay: number; was: "winning" | "losing"; caught: boolean }) => void;
  logMicroDecision: (m: { day: number; decision: string }) => void;

  // Crisis actions
  recordCrisisResponse: (r: CrisisResponse) => void;
  startRun: () => void;
  completeRun: (info: { score: number; achievementPct: number }) => void;
  clearActiveRun: () => void;
  enterReview: (runId: string) => boolean;
  exitReview: () => void;

  reset: () => void;
}

const SimCtx = createContext<SimState | null>(null);

function load<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function SimProvider({ children }: { children: ReactNode }) {
  const [student, setStudentState] = useState<Student | null>(() => load("sim_student", null));
  const [scenario, setScenario] = useState<Scenario | null>(() => {
    const s = load<Scenario | null>("sim_scenario", null);
    if (s && (!(s as any).cityStockMap || !(s as any).clientGoals)) return generateScenario();
    return s;
  });
  const [cmPitch, setCmPitchState] = useState<CmPitchResult | null>(() => load("sim_cm_pitch", null));
  const [campaigns, setCampaigns] = useState<SavedCampaign[]>(() => load("sim_campaigns", []));
  const [tokensRemaining, setTokens] = useState<number>(() => load("sim_tokens", 10));

  const [currentDay, setCurrentDayState] = useState<number>(() => load("sim_currentDay", 1));
  const [optimizations, setOptimizationsState] = useState<Record<string, CampaignOptimization>>(() => load("sim_opts", {}));
  const [stockLevels, setStockLevelsState] = useState<StockMap>(() => load("sim_stock", {}));
  const [decisionsLog, setDecisionsLog] = useState<DecisionLogEntry[]>(() => load("sim_decisions", []));
  const [weekTotals, setWeekTotals] = useState<WeekResultStored[]>(() => load("sim_weekTotals", []));
  const [events, setEvents] = useState<{ week2?: EventResponse; week3?: EventResponse }>(() => load("sim_events", {}));

  // Phase 3 state
  const [tokensSpent, setTokensSpent] = useState<number>(() => load("sim_tokensSpent", 0));
  const [competitor, setCompetitorState] = useState<Competitor | null>(() => load("sim_competitor", null));
  const [competitorActions, setCompetitorActions] = useState<CompetitorAction[]>(() => load("sim_competitorActions", []));
  const [cannibalResolved, setCannibalResolved] = useState<string[]>(() => load("sim_cannibalResolved", []));
  const [clusterReactions, setClusterReactions] = useState<ClusterReactionStored[]>(() => load("sim_clusterReactions", []));
  const [abTests, setAbTests] = useState<AbTest[]>(() => load("sim_abTests", []));
  const [cumulativeSpendByCampaign, setCumulativeSpendByCampaign] = useState<Record<string, number>>(() => load("sim_cumSpend", {}));
  const [exhaustedCampaigns, setExhaustedCampaigns] = useState<{ campaignId: string; exhaustedDay: number; was: "winning" | "losing"; caught: boolean }[]>(() => load("sim_exhausted", []));
  const [microDecisionsLog, setMicroDecisionsLog] = useState<{ day: number; decision: string }[]>(() => load("sim_micro", []));
  const [crisisResponses, setCrisisResponses] = useState<Record<string, CrisisResponse>>(() => load("sim_crises", {}));
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>(() => load("sim_runHistory", []));
  const [activeRunId, setActiveRunId] = useState<string | null>(() => load("sim_activeRunId", null));
  const [reviewRunId, setReviewRunId] = useState<string | null>(() => load("sim_reviewRunId", null));

  useEffect(() => { if (student) localStorage.setItem("sim_student", JSON.stringify(student)); }, [student]);
  useEffect(() => { if (scenario) localStorage.setItem("sim_scenario", JSON.stringify(scenario)); }, [scenario]);
  useEffect(() => { localStorage.setItem("sim_cm_pitch", JSON.stringify(cmPitch)); }, [cmPitch]);
  useEffect(() => { localStorage.setItem("sim_campaigns", JSON.stringify(campaigns)); }, [campaigns]);
  useEffect(() => { localStorage.setItem("sim_tokens", JSON.stringify(tokensRemaining)); }, [tokensRemaining]);
  useEffect(() => { localStorage.setItem("sim_currentDay", JSON.stringify(currentDay)); }, [currentDay]);
  useEffect(() => { localStorage.setItem("sim_opts", JSON.stringify(optimizations)); }, [optimizations]);
  useEffect(() => { localStorage.setItem("sim_stock", JSON.stringify(stockLevels)); }, [stockLevels]);
  useEffect(() => { localStorage.setItem("sim_decisions", JSON.stringify(decisionsLog)); }, [decisionsLog]);
  useEffect(() => { localStorage.setItem("sim_weekTotals", JSON.stringify(weekTotals)); }, [weekTotals]);
  useEffect(() => { localStorage.setItem("sim_events", JSON.stringify(events)); }, [events]);
  useEffect(() => { localStorage.setItem("sim_tokensSpent", JSON.stringify(tokensSpent)); }, [tokensSpent]);
  useEffect(() => { localStorage.setItem("sim_competitor", JSON.stringify(competitor)); }, [competitor]);
  useEffect(() => { localStorage.setItem("sim_competitorActions", JSON.stringify(competitorActions)); }, [competitorActions]);
  useEffect(() => { localStorage.setItem("sim_cannibalResolved", JSON.stringify(cannibalResolved)); }, [cannibalResolved]);
  useEffect(() => { localStorage.setItem("sim_clusterReactions", JSON.stringify(clusterReactions)); }, [clusterReactions]);
  useEffect(() => { localStorage.setItem("sim_abTests", JSON.stringify(abTests)); }, [abTests]);
  useEffect(() => { localStorage.setItem("sim_cumSpend", JSON.stringify(cumulativeSpendByCampaign)); }, [cumulativeSpendByCampaign]);
  useEffect(() => { localStorage.setItem("sim_exhausted", JSON.stringify(exhaustedCampaigns)); }, [exhaustedCampaigns]);
  useEffect(() => { localStorage.setItem("sim_micro", JSON.stringify(microDecisionsLog)); }, [microDecisionsLog]);
  useEffect(() => { localStorage.setItem("sim_crises", JSON.stringify(crisisResponses)); }, [crisisResponses]);
  useEffect(() => { localStorage.setItem("sim_runHistory", JSON.stringify(runHistory)); }, [runHistory]);
  useEffect(() => { localStorage.setItem("sim_activeRunId", JSON.stringify(activeRunId)); }, [activeRunId]);
  useEffect(() => { localStorage.setItem("sim_reviewRunId", JSON.stringify(reviewRunId)); }, [reviewRunId]);

  const setStudent = (s: Student) => {
    setStudentState(s);
    if (!scenario) setScenario(generateScenario());
  };

  const clearCampaignWizard = () => {
    [
      "campaign_step", "campaign_name", "campaign_objective", "campaign_adAsset",
      "sim_selected_skus", "sim_selected_keywords", "sim_geography", "sim_budget_type", "sim_sku_strategy"
    ].forEach((k) => localStorage.removeItem(k));
  };

  const resetSimRuntime = () => {
    setCurrentDayState(1);
    setOptimizationsState({});
    setStockLevelsState({});
    setDecisionsLog([]);
    setWeekTotals([]);
    setEvents({});
  };

  const newScenario = () => {
    setScenario(generateScenario());
    setCmPitchState(null);
    setCampaigns([]);
    setTokens(10);
    setTokensSpent(0);
    setCompetitorState(null);
    setCompetitorActions([]);
    setCannibalResolved([]);
    setClusterReactions([]);
    setAbTests([]);
    setCumulativeSpendByCampaign({});
    setExhaustedCampaigns([]);
    setMicroDecisionsLog([]);
    setCrisisResponses({});
    setActiveRunId(null);
    resetSimRuntime();
    clearCampaignWizard();
  };

  const setCmPitch = (p: CmPitchResult | null) => setCmPitchState(p);
  const addCampaign = (c: SavedCampaign) => {
    setCampaigns((prev) => [...prev, { ...c, launchDay: c.launchDay ?? Math.max(1, currentDay) }]);
    setOptimizationsState((prev) => ({ ...prev, [c.id]: { paused: false, scaleMultiplier: 1, dayparting: "24_7" } }));
  };
  const updateCampaign = (id: string, patch: Partial<SavedCampaign>) =>
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    setOptimizationsState((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };
  const consumeToken = (n = 1) => {
    setTokens((t) => Math.max(0, t - n));
    setTokensSpent((s) => s + n);
  };

  const initSimulation = (stock: StockMap) => {
    setStockLevelsState(stock);
    setCurrentDayState(7);
    setOptimizationsState((prev) => {
      const next = { ...prev };
      for (const c of campaigns) {
        if (!next[c.id]) next[c.id] = { paused: false, scaleMultiplier: 1, dayparting: "24_7" };
      }
      return next;
    });
    setDecisionsLog([]);
    setWeekTotals([]);
    setEvents({});
    setCompetitorActions([]);
    setCannibalResolved([]);
    setClusterReactions([]);
    setAbTests([]);
    setCumulativeSpendByCampaign({});
    setExhaustedCampaigns([]);
    setMicroDecisionsLog([]);
    if (!competitor && scenario) setCompetitorState(initCompetitor(scenario.market.name === "Aggressive Competitor"));
  };
  const setOptimization = (id: string, opt: Partial<CampaignOptimization>) =>
    setOptimizationsState((prev) => ({ ...prev, [id]: { paused: false, scaleMultiplier: 1, dayparting: "24_7", ...prev[id], ...opt } }));
  const setStockLevels = (s: StockMap) => setStockLevelsState(s);
  const setCurrentDay = (d: number) => setCurrentDayState(d);
  const logDecision = (d: DecisionLogEntry) => setDecisionsLog((prev) => [...prev, d]);
  const recordWeekTotals = (w: WeekResultStored) => setWeekTotals((prev) => {
    const filtered = prev.filter((x) => x.week !== w.week);
    return [...filtered, w].sort((a, b) => a.week - b.week);
  });
  const setEventResponse = (week: 2 | 3, r: EventResponse) =>
    setEvents((prev) => ({ ...prev, [week === 2 ? "week2" : "week3"]: r }));

  // Phase 3 setters
  const setCompetitor = (c: Competitor) => setCompetitorState(c);
  const addCompetitorAction = (a: CompetitorAction) => setCompetitorActions((prev) => [...prev, a]);
  const resolveCannibal = (key: string) => setCannibalResolved((prev) => prev.includes(key) ? prev : [...prev, key]);
  const addClusterReaction = (r: ClusterReactionStored) => setClusterReactions((prev) => [...prev.filter((x) => x.city !== r.city), r]);
  const addAbTest = (t: AbTest) => setAbTests((prev) => [...prev.filter((x) => x.campaignId !== t.campaignId), t]);
  const recordCumulativeSpend = (campaignId: string, addedSpend: number) =>
    setCumulativeSpendByCampaign((prev) => ({ ...prev, [campaignId]: (prev[campaignId] || 0) + addedSpend }));
  const markExhausted = (e: { campaignId: string; exhaustedDay: number; was: "winning" | "losing"; caught: boolean }) =>
    setExhaustedCampaigns((prev) => prev.some((x) => x.campaignId === e.campaignId) ? prev : [...prev, e]);
  const logMicroDecision = (m: { day: number; decision: string }) => setMicroDecisionsLog((prev) => [...prev, m]);

  const recordCrisisResponse = (r: CrisisResponse) =>
    setCrisisResponses((prev) => ({ ...prev, [r.crisisId]: r }));

  const startRun = () => {
    if (!scenario) return;
    const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setActiveRunId(id);
    setCrisisResponses({});
    setRunHistory((prev) => [
      ...prev,
      {
        id,
        scenarioSeed: scenario.seed,
        brandName: scenario.profile.name,
        brandEmoji: scenario.profile.emoji,
        startedAt: new Date().toISOString(),
        status: "in_progress",
      },
    ]);
  };

  const completeRun = (info: { score: number; achievementPct: number }) => {
    if (!activeRunId) return;
    const snapshot: RunSnapshot | undefined = scenario ? {
      scenario, cmPitch, campaigns, weekTotals, decisionsLog, crisisResponses,
      abTests, cannibalResolved, clusterReactions, tokensSpent, tokensRemaining,
      microDecisionsLog, exhaustedCampaigns, cumulativeSpendByCampaign, events,
      optimizations, stockLevels, competitor, competitorActions,
    } : undefined;
    setRunHistory((prev) =>
      prev.map((r) =>
        r.id === activeRunId
          ? { ...r, status: "completed", completedAt: new Date().toISOString(), score: info.score, achievementPct: info.achievementPct, snapshot }
          : r,
      ),
    );
    // Keep activeRunId set so /results stays viewable until the student leaves.
    // It is cleared when they land on /dashboard or start a new scenario.
  };

  const enterReview = (runId: string): boolean => {
    if (activeRunId) return false;
    const entry = runHistory.find((r) => r.id === runId);
    if (!entry || !entry.snapshot) return false;
    const s = entry.snapshot;
    setScenario(s.scenario);
    setCmPitchState(s.cmPitch);
    setCampaigns(s.campaigns);
    setWeekTotals(s.weekTotals);
    setDecisionsLog(s.decisionsLog);
    setCrisisResponses(s.crisisResponses);
    setAbTests(s.abTests);
    setCannibalResolved(s.cannibalResolved);
    setClusterReactions(s.clusterReactions);
    setTokensSpent(s.tokensSpent);
    setTokens(s.tokensRemaining);
    setMicroDecisionsLog(s.microDecisionsLog);
    setExhaustedCampaigns(s.exhaustedCampaigns);
    setCumulativeSpendByCampaign(s.cumulativeSpendByCampaign);
    setEvents(s.events);
    setOptimizationsState(s.optimizations);
    setStockLevelsState(s.stockLevels);
    setCompetitorState(s.competitor);
    setCompetitorActions(s.competitorActions);
    setCurrentDayState(30);
    setReviewRunId(runId);
    return true;
  };

  const exitReview = () => {
    setReviewRunId(null);
    setScenario(null);
    setCmPitchState(null);
    setCampaigns([]);
    setWeekTotals([]);
    setDecisionsLog([]);
    setCrisisResponses({});
    setAbTests([]);
    setCannibalResolved([]);
    setClusterReactions([]);
    setTokensSpent(0);
    setTokens(10);
    setMicroDecisionsLog([]);
    setExhaustedCampaigns([]);
    setCumulativeSpendByCampaign({});
    setEvents({});
    setOptimizationsState({});
    setStockLevelsState({});
    setCompetitorState(null);
    setCompetitorActions([]);
    resetSimRuntime();
    clearCampaignWizard();
  };

  const mode: "home" | "run" | "review" = reviewRunId ? "review" : activeRunId ? "run" : "home";

  const reset = () => {
    ["sim_student", "sim_scenario", "sim_cm_pitch", "sim_campaigns", "sim_tokens",
     "sim_currentDay", "sim_opts", "sim_stock", "sim_decisions", "sim_weekTotals", "sim_events",
     "sim_tokensSpent", "sim_competitor", "sim_competitorActions", "sim_cannibalResolved",
     "sim_clusterReactions", "sim_abTests", "sim_cumSpend", "sim_exhausted", "sim_micro",
     "sim_crises", "sim_runHistory", "sim_activeRunId", "sim_reviewRunId"]
      .forEach((k) => localStorage.removeItem(k));
    clearCampaignWizard();
    setStudentState(null);
    setScenario(null);
    setCmPitchState(null);
    setCampaigns([]);
    setTokens(10);
    setTokensSpent(0);
    setCompetitorState(null);
    setCompetitorActions([]);
    setCannibalResolved([]);
    setClusterReactions([]);
    setAbTests([]);
    setCumulativeSpendByCampaign({});
    setExhaustedCampaigns([]);
    setMicroDecisionsLog([]);
    setCrisisResponses({});
    setRunHistory([]);
    setActiveRunId(null);
    setReviewRunId(null);
    resetSimRuntime();
  };

  return (
    <SimCtx.Provider value={{
      student, scenario, cmPitch, campaigns, tokensRemaining, tokensSpent,
      currentDay, optimizations, stockLevels, decisionsLog, weekTotals, events,
      competitor, competitorActions, cannibalResolved, clusterReactions, abTests,
      cumulativeSpendByCampaign, exhaustedCampaigns, microDecisionsLog,
      crisisResponses, runHistory, activeRunId, reviewRunId, mode,
      setStudent, newScenario, setCmPitch, addCampaign, updateCampaign, deleteCampaign, consumeToken,
      initSimulation, setOptimization, setStockLevels, setCurrentDay, logDecision, recordWeekTotals, setEventResponse,
      setCompetitor, addCompetitorAction, resolveCannibal, addClusterReaction, addAbTest,
      recordCumulativeSpend, markExhausted, logMicroDecision,
      recordCrisisResponse, startRun, completeRun, enterReview, exitReview,
      reset,
    }}>
      {children}
    </SimCtx.Provider>
  );
}

export function useSim() {
  const ctx = useContext(SimCtx);
  if (!ctx) throw new Error("useSim must be used inside SimProvider");
  return ctx;
}
