// ── React hook: score a finished v2 run in a worker (main thread if none) ─────

import { useEffect, useState } from "react";
import { handleScore, type ScoreRequest, type ScoreResponse } from "@/market/scoreProtocol";
import type { ScoreV2 } from "@/market/scoringV2";

export interface ScoreState {
  score: ScoreV2 | null;
  busy: boolean;
  error: string | null;
}

function scoreInWorker(req: ScoreRequest): { promise: Promise<ScoreResponse>; cancel: () => void } {
  let worker: Worker | null = null;
  try {
    worker = typeof Worker === "undefined" ? null : new Worker(new URL("./scoreWorker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }
  if (!worker) {
    // No worker: yield one frame so the "working it out" state paints first
    let cancelled = false;
    const promise = new Promise<ScoreResponse>((resolve) => setTimeout(() => {
      if (!cancelled) resolve(handleScore(req));
    }, 0));
    return { promise, cancel: () => { cancelled = true; } };
  }
  const w = worker;
  const promise = new Promise<ScoreResponse>((resolve) => {
    w.onmessage = (e: MessageEvent<ScoreResponse>) => resolve(e.data);
    w.onerror = (e) => resolve({ ok: false, error: e.message || "The scoring worker stopped." });
    w.postMessage(req);
  });
  return { promise, cancel: () => w.terminate() };
}

/** Scores `req` once it's ready (null = not ready yet). Re-scores when `key` changes. */
export function useScoreV2(req: ScoreRequest | null, key: string): ScoreState {
  const [state, setState] = useState<ScoreState>({ score: null, busy: false, error: null });
  useEffect(() => {
    if (!req) return;
    setState({ score: null, busy: true, error: null });
    const job = scoreInWorker(req);
    let live = true;
    job.promise.then((res) => {
      if (!live) return;
      setState("error" in res ? { score: null, busy: false, error: res.error } : { score: res.score, busy: false, error: null });
    });
    return () => { live = false; job.cancel(); };
    // `req` is rebuilt every render; `key` says when the run behind it changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, req !== null]);
  return state;
}
