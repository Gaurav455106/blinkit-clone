import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Scenario, pickScenario } from "@/data/scenarios";

export interface Student {
  name: string;
  email: string;
  batch: string;
}

interface SimState {
  student: Student | null;
  scenario: Scenario | null;
  setStudent: (s: Student) => void;
  newScenario: (seedSuffix?: string) => void;
  reset: () => void;
}

const SimCtx = createContext<SimState | null>(null);

function load<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export function SimProvider({ children }: { children: ReactNode }) {
  const [student, setStudentState] = useState<Student | null>(() => load("sim_student"));
  const [scenario, setScenario] = useState<Scenario | null>(() => load("sim_scenario"));

  useEffect(() => {
    if (student) localStorage.setItem("sim_student", JSON.stringify(student));
  }, [student]);
  useEffect(() => {
    if (scenario) localStorage.setItem("sim_scenario", JSON.stringify(scenario));
  }, [scenario]);

  const setStudent = (s: Student) => {
    setStudentState(s);
    if (!scenario || scenario.seed !== s.email.toLowerCase()) {
      setScenario(pickScenario(s.email));
    }
  };

  const newScenario = (suffix = String(Date.now())) => {
    if (!student) return;
    const seed = student.email + ":" + suffix;
    setScenario(pickScenario(seed));
    // Clear campaign-step localStorage so the wizard restarts
    [
      "campaign_step", "campaign_name", "campaign_objective", "campaign_adAsset",
      "sim_selected_skus", "sim_selected_keywords", "sim_geography", "sim_budget_type", "sim_sku_strategy"
    ].forEach((k) => localStorage.removeItem(k));
  };

  const reset = () => {
    localStorage.removeItem("sim_student");
    localStorage.removeItem("sim_scenario");
    setStudentState(null);
    setScenario(null);
  };

  return (
    <SimCtx.Provider value={{ student, scenario, setStudent, newScenario, reset }}>
      {children}
    </SimCtx.Provider>
  );
}

export function useSim() {
  const ctx = useContext(SimCtx);
  if (!ctx) throw new Error("useSim must be used inside SimProvider");
  return ctx;
}
