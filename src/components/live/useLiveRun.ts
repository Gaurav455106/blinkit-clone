// ── One v2 live run: campaigns, actions, events, Rohit and the engine ─────────
// The run is stored as a small log (actions, insights, launch days, events
// raised, Rohit's replies, days done) and rebuilt by replaying the
// deterministic engine after a refresh.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SavedCampaign, Student } from "@/context/SimContext";
import type { Scenario } from "@/data/scenarios";
import type { CampaignConfig, DayResult, MarketState } from "@/market/engineTypes";
import { marketContextFor } from "@/market/context";
import { savedCampaignToConfig } from "@/market/adapter";
import { applyActions, recordAction, type ChangeLogEntry, type LiveAction } from "@/market/actions";
import { initialMarketState } from "@/market/state";
import { stepDay, type StepOptions } from "@/market/step";
import { useMarket } from "@/market/useMarket";
import type { Insight } from "@/market/insights";
import type { EventActivation } from "@/market/events";
import { marketCalendar } from "@/market/calendar";
import { afterDay, dropStatesActions, relationshipNow, servedStates } from "@/market/liveRun";
import { checkCommitments, commitmentFor, type AskId, type Commitment, type ReplyOption, type ReplyQuality, type RohitAsk } from "@/market/rohit";
import { EMPTY_ADJUSTMENTS, adjustmentsFromReply, mergeAdjustments, type Adjustments } from "@/market/adjustments";

export const RUN_DAYS = 30;
export const CHECKPOINT_DAYS: readonly number[] = [7, 14, 21];

export interface StoredReply {
  askId: AskId;
  title: string;
  optionId: string;
  label: string;
  quality: ReplyQuality;
  delta: number;
  day: number;
}

interface RohitLog {
  asked: AskId[];
  pendingAsk: RohitAsk | null;
  /** The reply picked for the pending ask (the panel shows it until closed). */
  pendingChoice: string | null;
  replies: StoredReply[];
  commitments: Commitment[];
  adjustments: Adjustments;
}

interface StoredRun {
  launchDayById: Record<string, number>;
  actions: LiveAction[];
  insights: Insight[];
  changeLog: ChangeLogEntry[];
  daysDone: number;
  activations: EventActivation[];
  /** Last day whose after-day check (events, alerts, Rohit) has run; -1 = none. */
  evaluatedAfterDay: number;
  /** Keys of the alerts that paused the clock (SPEC §2 alert budget). */
  pausingKeys: string[];
  pendingAlertKey: string | null;
  checkpointsDone: number[];
  rohit: RohitLog;
}

const EMPTY_ROHIT: RohitLog = { asked: [], pendingAsk: null, pendingChoice: null, replies: [], commitments: [], adjustments: EMPTY_ADJUSTMENTS };
const EMPTY: StoredRun = {
  launchDayById: {}, actions: [], insights: [], changeLog: [], daysDone: 0,
  activations: [], evaluatedAfterDay: -1, pausingKeys: [], pendingAlertKey: null, checkpointsDone: [], rohit: EMPTY_ROHIT,
};

const storageKey = (student: Student | null, scenario: Scenario | null, runId: string | null) =>
  `sim_v2_run:${student?.email ?? "anon"}:${scenario?.seed ?? "none"}:${runId ?? "none"}`;

function load(key: string): StoredRun {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<StoredRun>;
    return { ...EMPTY, ...parsed, rohit: { ...EMPTY_ROHIT, ...(parsed.rohit ?? {}) } };
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

/** Removes a stored run (e.g. when the student restarts). */
export function clearStoredRun(student: Student | null, scenario: Scenario | null, runId: string | null): void {
  try {
    window.localStorage.removeItem(storageKey(student, scenario, runId));
  } catch {
    // Nothing to clear
  }
}

export function useLiveRun(
  scenario: Scenario | null,
  student: Student | null,
  campaigns: readonly SavedCampaign[],
  runId: string | null,
  relationshipBase = 50,
  onRelationship?: (n: number) => void,
) {
  const ctx = useMemo(() => (scenario ? marketContextFor(scenario, student?.batch ?? "") : null), [scenario, student?.batch]);
  const calendar = useMemo(() => (scenario ? marketCalendar(scenario) : []), [scenario]);
  const key = storageKey(student, scenario, runId);
  const [run, setRun] = useState<StoredRun>(() => load(key));
  const market = useMarket(ctx);
  const restored = useRef(false);
  const started = runId !== null;

  // A different run (restart) loads its own log
  const loadedKey = useRef(key);
  useEffect(() => {
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    restored.current = false;
    setRun(load(key));
    market.reset();
  }, [key, market]);

  useEffect(() => { if (started) save(key, run); }, [key, run, started]);

  const campaignNames = useMemo(() => Object.fromEntries(campaigns.map((c) => [c.id, c.name])), [campaigns]);

  // Campaigns created during the run start the day after they're made
  const live = useMemo(() => campaigns.filter((c) => !c.isDraft), [campaigns]);
  useEffect(() => {
    if (!started) return;
    const missing = live.filter((c) => run.launchDayById[c.id] === undefined);
    if (missing.length === 0) return;
    setRun((prev) => ({
      ...prev,
      launchDayById: { ...prev.launchDayById, ...Object.fromEntries(missing.map((c) => [c.id, prev.daysDone === 0 ? 1 : prev.daysDone + 1])) },
    }));
  }, [live, run.launchDayById, started]);

  const launched: CampaignConfig[] = useMemo(() => {
    if (!scenario) return [];
    return live.map((c) => ({ ...savedCampaignToConfig(c, scenario, student?.batch ?? ""), launchDay: run.launchDayById[c.id] ?? 1 }));
  }, [live, scenario, student?.batch, run.launchDayById]);

  const stepOptions: StepOptions = useMemo(
    () => ({ events: run.activations, adjustments: run.rohit.adjustments }),
    [run.activations, run.rohit.adjustments],
  );

  // After a refresh: replay the stored days so the run resumes exactly
  useEffect(() => {
    if (restored.current || !ctx || run.daysDone === 0 || market.results.length > 0 || launched.length === 0) return;
    restored.current = true;
    let state: MarketState = initialMarketState(ctx);
    const states: MarketState[] = [state];
    const results: DayResult[] = [];
    for (let d = 1; d <= run.daysDone; d++) {
      const out = stepDay(ctx, state, applyActions(launched, run.actions, d), stepOptions);
      state = out.state;
      states.push(state);
      results.push(out.result);
    }
    market.restore(states, results);
  }, [ctx, run.daysDone, run.actions, launched, market, stepOptions]);

  const day = market.results.length;
  const finished = day >= RUN_DAYS;
  const replaying = run.daysDone > day;
  const nextDayConfigs = useMemo(() => applyActions(launched, run.actions, day + 1), [launched, run.actions, day]);

  const commitmentResults = useMemo(
    () => (market.state ? checkCommitments(run.rohit.commitments, market.state, market.results) : []),
    [run.rohit.commitments, market.state, market.results],
  );
  const relationship = relationshipNow(relationshipBase, run.rohit.replies, commitmentResults);
  useEffect(() => { if (started) onRelationship?.(relationship); }, [started, relationship, onRelationship]);

  // After each finished day (and once before day 1): raise events, pick the alert, maybe a Rohit check-in
  useEffect(() => {
    if (!started || !ctx || !market.state || market.busy || replaying || finished) return;
    if (run.evaluatedAfterDay >= day || market.state.day !== day) return;
    const out = afterDay({
      ctx, state: market.state, history: market.results, campaigns: nextDayConfigs, calendar,
      existing: run.activations, pausingShown: run.pausingKeys.length, asked: run.rohit.asked, relationship, campaignNames,
    });
    setRun((prev) => ({
      ...prev,
      evaluatedAfterDay: day,
      activations: [...prev.activations, ...out.fresh],
      pausingKeys: out.pausing ? [...prev.pausingKeys, out.pausing.key] : prev.pausingKeys,
      pendingAlertKey: out.pausing ? out.pausing.key : prev.pendingAlertKey,
      rohit: out.ask ? { ...prev.rohit, pendingAsk: out.ask, pendingChoice: null } : prev.rohit,
    }));
  }, [started, ctx, market.state, market.busy, market.results, replaying, finished, run.evaluatedAfterDay, run.activations, run.pausingKeys.length, run.rohit.asked, day, nextDayConfigs, calendar, relationship, campaignNames]);

  const pendingAlert = run.pendingAlertKey ? run.activations.find((a) => a.key === run.pendingAlertKey) ?? null : null;
  const checkpointDue = CHECKPOINT_DAYS.includes(day) && !run.checkpointsDone.includes(day);
  const blockedBy: "alert" | "rohit" | "checkpoint" | null =
    pendingAlert ? "alert" : run.rohit.pendingAsk ? "rohit" : checkpointDue ? "checkpoint" : null;
  const readyToStep = started && !finished && !market.busy && !replaying && run.evaluatedAfterDay >= day && blockedBy === null;

  const advance = useCallback(async () => {
    if (!readyToStep) return null;
    const result = await market.step(nextDayConfigs, stepOptions);
    if (result) setRun((prev) => ({ ...prev, daysDone: result.day }));
    return result;
  }, [readyToStep, market, nextDayConfigs, stepOptions]);

  /** Changes made today apply from tomorrow. */
  const act = useCallback((campaignId: string, change: LiveAction["change"]) => {
    const action: LiveAction = { campaignId, dayMade: day, change };
    setRun((prev) => ({ ...prev, actions: [...prev.actions, action], changeLog: [...prev.changeLog, recordAction(nextDayConfigs, action)] }));
  }, [day, nextDayConfigs]);

  const logInsight = useCallback((insight: Omit<Insight, "day">) => {
    setRun((prev) => ({ ...prev, insights: [...prev.insights, { ...insight, day: Math.max(1, day) }] }));
  }, [day]);

  const dismissAlert = useCallback(() => setRun((prev) => ({ ...prev, pendingAlertKey: null })), []);
  const finishCheckpoint = useCallback(() => setRun((prev) => ({ ...prev, checkpointsDone: [...prev.checkpointsDone, day] })), [day]);

  const replyToRohit = useCallback((option: ReplyOption) => {
    const ask = run.rohit.pendingAsk;
    if (!ask || !ctx || !market.state || run.rohit.pendingChoice) return;
    const commitment = commitmentFor(ask, option);
    const adjustments = [option.effect, ...(ask.situationEffect ? [ask.situationEffect] : [])]
      .reduce((acc, e) => mergeAdjustments(acc, adjustmentsFromReply(e, day)), run.rohit.adjustments);
    const drops = option.effect.dropStates?.length
      ? dropStatesActions(nextDayConfigs, servedStates(ctx, market.state), option.effect.dropStates, day)
      : [];
    const reply: StoredReply = { askId: ask.id, title: ask.title, optionId: option.id, label: option.label, quality: option.quality, delta: option.effect.relationshipDelta, day };
    setRun((prev) => ({
      ...prev,
      actions: [...prev.actions, ...drops],
      changeLog: [...prev.changeLog, ...drops.map((a) => recordAction(nextDayConfigs, a))],
      rohit: {
        ...prev.rohit,
        pendingChoice: option.id,
        replies: [...prev.rohit.replies, reply],
        commitments: commitment ? [...prev.rohit.commitments, commitment] : prev.rohit.commitments,
        adjustments,
      },
    }));
  }, [run.rohit.pendingAsk, run.rohit.pendingChoice, run.rohit.adjustments, ctx, market.state, day, nextDayConfigs]);

  const closeRohit = useCallback(() => {
    setRun((prev) => {
      const ask = prev.rohit.pendingAsk;
      if (!ask) return prev;
      return { ...prev, rohit: { ...prev.rohit, pendingAsk: null, pendingChoice: null, asked: [...prev.rohit.asked, ask.id] } };
    });
  }, []);

  const configsByDay = useMemo(() => market.results.map((r) => applyActions(launched, run.actions, r.day)), [market.results, launched, run.actions]);
  const extraSpend = run.rohit.adjustments.extraSpend.filter((s) => s.day <= day).reduce((t, s) => t + s.amount, 0);

  return {
    ctx, day, finished, started, replaying, busy: market.busy, error: market.error,
    results: market.results, state: market.state, statesByDay: market.statesByDay,
    launched, nextDayConfigs, configsByDay, campaignNames, calendar, stepOptions,
    actions: run.actions, insights: run.insights, changeLog: run.changeLog,
    activations: run.activations, pausingKeys: run.pausingKeys, pendingAlert,
    rohit: run.rohit, commitmentResults, relationship, extraSpend,
    checkpointDue, blockedBy, readyToStep,
    advance, act, logInsight, dismissAlert, finishCheckpoint, replyToRohit, closeRohit,
    isCheckpoint: CHECKPOINT_DAYS.includes(day),
  };
}

export type LiveRun = ReturnType<typeof useLiveRun>;
