// ── React hook for the market engine (SPEC §2.1) ──────────────────────────────
// Steps one day at a time in a Web Worker so the UI never freezes; falls back
// to the main thread (still one day per call) where workers aren't available.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignConfig, DayResult, MarketContext, MarketState } from "@/market/engineTypes";
import { initialMarketState } from "@/market/state";
import { handleStep, type StepRequest, type StepResponse } from "@/market/workerProtocol";

export interface MarketRun {
  state: MarketState | null;
  results: readonly DayResult[];
  busy: boolean;
  error: string | null;
  /** Simulate the next day with these campaigns; resolves with that day's result. */
  step: (campaigns: readonly CampaignConfig[]) => Promise<DayResult | null>;
  reset: () => void;
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
  const [state, setState] = useState<MarketState | null>(() => (ctx ? initialMarketState(ctx) : null));
  const [results, setResults] = useState<readonly DayResult[]>([]);
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
    setState(ctx ? initialMarketState(ctx) : null);
    setResults([]);
    setError(null);
  }, [ctx]);

  useEffect(reset, [reset]);

  const send = useCallback((req: StepRequest): Promise<StepResponse> => {
    const worker = workerRef.current;
    if (!worker) return Promise.resolve(handleStep(req));
    return new Promise((resolve) => {
      pending.current.set(req.id, resolve);
      worker.postMessage(req);
    });
  }, []);

  const step = useCallback(async (campaigns: readonly CampaignConfig[]) => {
    if (!ctx || !state) return null;
    setBusy(true);
    const res = await send({ id: nextId.current++, ctx, state, campaigns });
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return null;
    }
    setState(res.state);
    setResults((prev) => [...prev, res.result]);
    return res.result;
  }, [ctx, state, send]);

  return { state, results, busy, error, step, reset };
}
