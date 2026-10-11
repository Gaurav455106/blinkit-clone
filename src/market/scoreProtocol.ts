// ── Messages between the results page and the scoring worker (SPEC §2.1, §8) ──
// Scoring replays each decision moment several ways (F13), which takes a few
// seconds, so it runs off the main thread. Functions can't cross to a worker,
// so the action describer is rebuilt on the worker side.

import { recordAction } from "@/market/actions";
import { scoreRunV2, type ScoreV2, type ScoreV2Input } from "@/market/scoringV2";

export type ScoreRequest = Omit<ScoreV2Input, "describeAction">;

export type ScoreResponse = { ok: true; score: ScoreV2 } | { ok: false; error: string };

export function handleScore(req: ScoreRequest): ScoreResponse {
  try {
    return { ok: true, score: scoreRunV2({ ...req, describeAction: (a) => recordAction(req.launched, a).what }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
