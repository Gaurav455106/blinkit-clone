import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Scenario, generateScenario, CityName } from "@/data/scenarios";

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
}

interface SimState {
  student: Student | null;
  scenario: Scenario | null;
  cmPitch: CmPitchResult | null;
  campaigns: SavedCampaign[];
  tokensRemaining: number;
  setStudent: (s: Student) => void;
  newScenario: () => void;
  setCmPitch: (p: CmPitchResult | null) => void;
  addCampaign: (c: SavedCampaign) => void;
  updateCampaign: (id: string, c: Partial<SavedCampaign>) => void;
  deleteCampaign: (id: string) => void;
  consumeToken: () => void;
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
    // Migrate old scenarios that don't have the new fields
    if (s && (!(s as any).cityStockMap || !(s as any).clientGoals)) return generateScenario();
    return s;
  });
  const [cmPitch, setCmPitchState] = useState<CmPitchResult | null>(() => load("sim_cm_pitch", null));
  const [campaigns, setCampaigns] = useState<SavedCampaign[]>(() => load("sim_campaigns", []));
  const [tokensRemaining, setTokens] = useState<number>(() => load("sim_tokens", 10));

  useEffect(() => { if (student) localStorage.setItem("sim_student", JSON.stringify(student)); }, [student]);
  useEffect(() => { if (scenario) localStorage.setItem("sim_scenario", JSON.stringify(scenario)); }, [scenario]);
  useEffect(() => { localStorage.setItem("sim_cm_pitch", JSON.stringify(cmPitch)); }, [cmPitch]);
  useEffect(() => { localStorage.setItem("sim_campaigns", JSON.stringify(campaigns)); }, [campaigns]);
  useEffect(() => { localStorage.setItem("sim_tokens", JSON.stringify(tokensRemaining)); }, [tokensRemaining]);

  const setStudent = (s: Student) => {
    setStudentState(s);
    if (!scenario) {
      setScenario(generateScenario());
    }
  };

  const clearCampaignWizard = () => {
    [
      "campaign_step", "campaign_name", "campaign_objective", "campaign_adAsset",
      "sim_selected_skus", "sim_selected_keywords", "sim_geography", "sim_budget_type", "sim_sku_strategy"
    ].forEach((k) => localStorage.removeItem(k));
  };

  const newScenario = () => {
    setScenario(generateScenario());
    setCmPitchState(null);
    setCampaigns([]);
    setTokens(10);
    clearCampaignWizard();
  };

  const setCmPitch = (p: CmPitchResult | null) => setCmPitchState(p);

  const addCampaign = (c: SavedCampaign) => setCampaigns((prev) => [...prev, c]);
  const updateCampaign = (id: string, patch: Partial<SavedCampaign>) =>
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCampaign = (id: string) => setCampaigns((prev) => prev.filter((c) => c.id !== id));
  const consumeToken = () => setTokens((t) => Math.max(0, t - 1));

  const reset = () => {
    ["sim_student", "sim_scenario", "sim_cm_pitch", "sim_campaigns", "sim_tokens"].forEach((k) => localStorage.removeItem(k));
    clearCampaignWizard();
    setStudentState(null);
    setScenario(null);
    setCmPitchState(null);
    setCampaigns([]);
    setTokens(10);
  };

  return (
    <SimCtx.Provider value={{ student, scenario, cmPitch, campaigns, tokensRemaining, setStudent, newScenario, setCmPitch, addCampaign, updateCampaign, deleteCampaign, consumeToken, reset }}>
      {children}
    </SimCtx.Provider>
  );
}

export function useSim() {
  const ctx = useContext(SimCtx);
  if (!ctx) throw new Error("useSim must be used inside SimProvider");
  return ctx;
}
