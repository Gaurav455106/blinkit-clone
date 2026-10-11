// ── React hook for the market engine (SPEC §2.1) ──────────────────────────────
// Steps one day at a time in a Web Worker so the UI never freezes; falls back
// to the main thread (still one day per call) where workers aren't available.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { initialMarketState } from "@/market/state";
import { handleStep, type StepRequest, type StepResponse } from "@/market/workerProtocol";
import type { StepOptions } from "@/market/step";

export interface MarketRun {
  state: MarketState | null;
  /** statesByDay[d] = state after day d (index 0 = before day 1); used for scoring replays. */
  statesByDay: readonly MarketState[];
  results: readonly DayResult[];
  busy: boolean;
  error: string | null;
  /** Simulate the next day with these campaigns; resolves with that day's result. */
  step: (campaigns: readonly CampaignConfig[], opts?: StepOptions) => Promise<DayResult | null>;
  reset: () => void;
  /** Replace the run with a replayed history (e.g. after a page refresh). */
  restore: (statesByDay: readonly MarketState[], results: readonly DayResult[]) => void;
}

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

export function useMarket(ctx: MarketContext | null): MarketRun {
  const [statesByDay, setStatesByDay] = useState<readonly MarketState[]>(() => (ctx ? [initialMarketState(ctx)] : []));
  const [results, setResults] = useState<readonly DayResult[]>([]);
  const state = statesByDay.length ? statesByDay[statesByDay.length - 1] : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const nextId = useRef(1);
  const pending = useRef(new Map<number, (r: StepResponse) => void>());

  useEffect(() => {
    const worker = createWorker();
    workerRef.current = worker;
    if (worker) {
      worker.onmessage = (e: MessageEvent<StepResponse>) => {
        pending.current.get(e.data.id)?.(e.data);
        pending.current.delete(e.data.id);
      };
    }
    return () => worker?.terminate();
  }, []);

  const reset = useCallback(() => {
    setStatesByDay(ctx ? [initialMarketState(ctx)] : []);
    setResults([]);
    setError(null);
  }, [ctx]);

  const restore = useCallback((states: readonly MarketState[], days: readonly DayResult[]) => {
    setStatesByDay(states);
    setResults(days);
    setError(null);
  }, []);

  useEffect(reset, [reset]);

  const send = useCallback((req: StepRequest): Promise<StepResponse> => {
    const worker = workerRef.current;
    if (!worker) return Promise.resolve(handleStep(req));
    return new Promise((resolve) => {
      pending.current.set(req.id, resolve);
      worker.postMessage(req);
    });
  }, []);

  const step = useCallback(async (campaigns: readonly CampaignConfig[], opts?: StepOptions) => {
    if (!ctx || !state) return null;
    setBusy(true);
    const res = await send({ id: nextId.current++, ctx, state, campaigns, opts });
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return null;
    }
    setStatesByDay((prev) => [...prev, res.state]);
    setResults((prev) => [...prev, res.result]);
    return res.result;
  }, [ctx, state, send]);

  return { state, statesByDay, results, busy, error, step, reset, restore };
}
