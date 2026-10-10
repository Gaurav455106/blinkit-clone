// ── One v2 live run: campaigns, actions, insights and the day-by-day engine ──
// The run is stored as a small log (actions, insights, launch days, days done)
// and rebuilt by replaying the deterministic engine after a refresh.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SavedCampaign, Student } from "@/context/SimContext";
import type { Scenario } from "@/data/scenarios";
import type { CampaignConfig, DayResult, MarketState } from "@/market/engineTypes";
import { marketContextFor } from "@/market/context";
import { savedCampaignToConfig } from "@/market/adapter";
import { applyActions, recordAction, type ChangeLogEntry, type LiveAction } from "@/market/actions";
import { initialMarketState } from "@/market/state";
import { stepDay } from "@/market/step";
import { useMarket } from "@/market/useMarket";
import type { Insight } from "@/market/insights";

export const RUN_DAYS = 30;
export const CHECKPOINT_DAYS: readonly number[] = [7, 14, 21];

interface StoredRun {
  launchDayById: Record<string, number>;
  actions: LiveAction[];
  insights: Insight[];
  changeLog: ChangeLogEntry[];
  daysDone: number;
}

const EMPTY: StoredRun = { launchDayById: {}, actions: [], insights: [], changeLog: [], daysDone: 0 };

const storageKey = (student: Student | null, scenario: Scenario | null) =>
  `sim_v2_run:${student?.email ?? "anon"}:${scenario?.seed ?? "none"}`;

function load(key: string): StoredRun {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<StoredRun>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(key: string, run: StoredRun): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(run));
  } catch {
    // Storage full or blocked: the run continues in memory; a refresh would restart it
  }
}

export function useLiveRun(scenario: Scenario | null, student: Student | null, campaigns: readonly SavedCampaign[]) {
  const ctx = useMemo(() => (scenario ? marketContextFor(scenario, student?.batch ?? "") : null), [scenario, student?.batch]);
  const key = storageKey(student, scenario);
  const [run, setRun] = useState<StoredRun>(() => load(key));
  const market = useMarket(ctx);
  const restored = useRef(false);

  useEffect(() => save(key, run), [key, run]);

  // Campaigns created during the run start the day after they're made
  const live = useMemo(() => campaigns.filter((c) => !c.isDraft), [campaigns]);
  useEffect(() => {
    const missing = live.filter((c) => run.launchDayById[c.id] === undefined);
    if (missing.length === 0) return;
    setRun((prev) => ({
      ...prev,
      launchDayById: { ...prev.launchDayById, ...Object.fromEntries(missing.map((c) => [c.id, prev.daysDone === 0 ? 1 : prev.daysDone + 1])) },
    }));
  }, [live, run.launchDayById]);

  const launched: CampaignConfig[] = useMemo(() => {
    if (!scenario) return [];
    return live.map((c) => ({ ...savedCampaignToConfig(c, scenario, student?.batch ?? ""), launchDay: run.launchDayById[c.id] ?? 1 }));
  }, [live, scenario, student?.batch, run.launchDayById]);

  // After a refresh: replay the stored days so the run resumes exactly
  useEffect(() => {
    if (restored.current || !ctx || run.daysDone === 0 || market.results.length > 0 || launched.length === 0) return;
    restored.current = true;
    let state: MarketState = initialMarketState(ctx);
    const states: MarketState[] = [state];
    const results: DayResult[] = [];
    for (let d = 1; d <= run.daysDone; d++) {
      const out = stepDay(ctx, state, applyActions(launched, run.actions, d));
      state = out.state;
      states.push(state);
      results.push(out.result);
    }
    market.restore(states, results);
  }, [ctx, run.daysDone, run.actions, launched, market]);

  const day = market.results.length;
  const finished = day >= RUN_DAYS;

  const advance = useCallback(async () => {
    if (finished || market.busy) return null;
    const result = await market.step(applyActions(launched, run.actions, day + 1));
    if (result) setRun((prev) => ({ ...prev, daysDone: result.day }));
    return result;
  }, [finished, market, launched, run.actions, day]);

  /** Changes made today apply from tomorrow. */
  const act = useCallback((campaignId: string, change: LiveAction["change"]) => {
    const action: LiveAction = { campaignId, dayMade: Math.max(1, day), change };
    const current = applyActions(launched, run.actions, day + 1);
    setRun((prev) => ({ ...prev, actions: [...prev.actions, action], changeLog: [...prev.changeLog, recordAction(current, action)] }));
  }, [day, launched, run.actions]);

  const logInsight = useCallback((insight: Omit<Insight, "day">) => {
    setRun((prev) => ({ ...prev, insights: [...prev.insights, { ...insight, day: Math.max(1, day) }] }));
  }, [day]);

  const configsByDay = useMemo(() => market.results.map((r) => applyActions(launched, run.actions, r.day)), [market.results, launched, run.actions]);
  const nextDayConfigs = useMemo(() => applyActions(launched, run.actions, day + 1), [launched, run.actions, day]);

  return {
    ctx, day, finished, busy: market.busy, error: market.error,
    results: market.results, statesByDay: market.statesByDay,
    launched, nextDayConfigs, configsByDay,
    actions: run.actions, insights: run.insights, changeLog: run.changeLog,
    advance, act, logInsight,
    isCheckpoint: CHECKPOINT_DAYS.includes(day),
  };
}

export type LiveRun = ReturnType<typeof useLiveRun>;
