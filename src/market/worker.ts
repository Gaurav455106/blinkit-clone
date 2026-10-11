// ── Engine Web Worker: runs stepDay off the main thread (SPEC §2.1) ───────────
/// <reference lib="webworker" />

import { handleStep, type StepRequest } from "@/market/workerProtocol";

self.onmessage = (event: MessageEvent<StepRequest>) => {
  self.postMessage(handleStep(event.data));
};
