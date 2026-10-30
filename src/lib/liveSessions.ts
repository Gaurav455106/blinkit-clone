// ── Live sessions: who is mid-run right now (staff "Live now" tab) ────────────
// One `run_sessions` row per student holds their latest unfinished run. The row
// is deleted once the run's score is saved, so a row with all days played means
// the student finished but the score never reached `attempts`.

import type { AttemptRow } from "@/lib/attemptAnalysis";

export const RUN_DAYS = 30;
/** A student counts as playing when their browser synced within this window. */
export const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

/** The columns the staff view reads (JSON paths flattened by the select). */
export interface LiveSessionRow {
  email: string;
  name: string;
  batch_code: string;
  run_id: string;
  started_at: string;
  last_seen_at: string;
  brand: string | null;
  engine: string | null;
  has_pitch: unknown;
  has_deal: unknown;
  v2_days: number | null;
  v1_day: number | null;
}

/** PostgREST select producing LiveSessionRow; keeps the large `state` JSON off the wire. */
export const LIVE_SESSION_SELECT = [
  "email", "name", "batch_code", "run_id", "started_at", "last_seen_at",
  "brand:state->scenario->profile->>name",
  "engine:state->scenario->>engine",
  "has_pitch:state->cmPitch",
  "has_deal:state->openingDeal",
  "v2_days:state->v2Run->daysDone",
  "v1_day:state->currentDay",
].join(",");

export type LiveStatus = "unsaved" | "playing" | "idle";

export interface LiveSession {
  email: string;
  name: string;
  batch: string;
  brand: string;
  engine: "v1" | "v2";
  /** Where the student is, in words ("Day 12 of 30", "Building campaigns"). */
  stage: string;
  daysDone: number | null;
  status: LiveStatus;
  lastSeenAt: string;
}

const STATUS_ORDER: Record<LiveStatus, number> = { unsaved: 0, playing: 1, idle: 2 };

function stageOf(row: LiveSessionRow, engine: "v1" | "v2"): { stage: string; daysDone: number | null } {
  if (engine === "v1") return { stage: "v1 run in progress", daysDone: null };
  const days = typeof row.v2_days === "number" ? row.v2_days : null;
  if (days !== null && days > 0) return { stage: `Day ${Math.min(days, RUN_DAYS)} of ${RUN_DAYS}`, daysDone: days };
  if (row.has_deal || row.has_pitch) return { stage: "Building campaigns", daysDone: 0 };
  return { stage: "Reading the brief", daysDone: 0 };
}

/** True when an attempt for this student was saved after the session started. */
function savedSince(attempts: readonly AttemptRow[], row: LiveSessionRow): boolean {
  return attempts.some((a) => a.email === row.email && a.created_at >= row.started_at);
}

/** Turns raw rows into the staff view, most urgent first (unsaved, playing, idle). */
export function summariseSessions(rows: readonly LiveSessionRow[], attempts: readonly AttemptRow[], now: number): LiveSession[] {
  return rows
    .map((row): LiveSession => {
      const engine = row.engine === "v2" ? "v2" : "v1";
      const { stage, daysDone } = stageOf(row, engine);
      const finished = daysDone !== null && daysDone >= RUN_DAYS;
      const active = now - new Date(row.last_seen_at).getTime() <= ACTIVE_WINDOW_MS;
      const status: LiveStatus = finished && !savedSince(attempts, row) ? "unsaved" : active ? "playing" : "idle";
      return {
        email: row.email, name: row.name, batch: row.batch_code, brand: row.brand ?? "Unknown brand",
        engine, stage, daysDone, status, lastSeenAt: row.last_seen_at,
      };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/** "just now", "4 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
