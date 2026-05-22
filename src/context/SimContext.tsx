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
  cities: string[];
  skuIds: string[];
  keywords: string[];
  budget: number;
  budgetType: "daily" | "overall" | null;
  geography: "select_cities" | "pan_india" | null;
  launchDay?: number; // day-of-30 when launched (default 1)
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

export interface WeekResultStored {
  week: number;
  totals: { spend: number; impressions: number; clicks: number; atcs: number; units: number; revenue: number; roas: number };
  // we keep the rich result transient in memory; only totals/highlights persist
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
    resetSimRuntime();
    clearCampaignWizard();
  };

  const setCmPitch = (p: CmPitchResult | null) => setCmPitchState(p);
  const addCampaign = (c: SavedCampaign) => {
    setCampaigns((prev) => [...prev, c]);
    setOptimizationsState((prev) => ({ ...prev, [c.id]: { paused: false, scaleMultiplier: 1, dayparting: "24_7" } }));
  };
  const updateCampaign = (id: string, patch: Partial<SavedCampaign>) =>
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    setOptimizationsState((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };
  const consumeToken = (n = 1) => setTokens((t) => Math.max(0, t - n));

  const initSimulation = (stock: StockMap) => {
    setStockLevelsState(stock);
    setCurrentDayState(7);
    // ensure all campaigns have default optimization
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

  const reset = () => {
    ["sim_student", "sim_scenario", "sim_cm_pitch", "sim_campaigns", "sim_tokens",
     "sim_currentDay", "sim_opts", "sim_stock", "sim_decisions", "sim_weekTotals", "sim_events"]
      .forEach((k) => localStorage.removeItem(k));
    clearCampaignWizard();
    setStudentState(null);
    setScenario(null);
    setCmPitchState(null);
    setCampaigns([]);
    setTokens(10);
    resetSimRuntime();
  };

  return (
    <SimCtx.Provider value={{
      student, scenario, cmPitch, campaigns, tokensRemaining,
      currentDay, optimizations, stockLevels, decisionsLog, weekTotals, events,
      setStudent, newScenario, setCmPitch, addCampaign, updateCampaign, deleteCampaign, consumeToken,
      initSimulation, setOptimization, setStockLevels, setCurrentDay, logDecision, recordWeekTotals, setEventResponse,
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
