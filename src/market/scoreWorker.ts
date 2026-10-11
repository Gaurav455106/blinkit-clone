// ── Scoring Web Worker: scores a finished run off the main thread ─────────────
/// <reference lib="webworker" />

import { handleScore, type ScoreRequest } from "@/market/scoreProtocol";

self.onmessage = (event: MessageEvent<ScoreRequest>) => {
  self.postMessage(handleScore(event.data));
};
