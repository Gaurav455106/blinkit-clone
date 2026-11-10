// Shared test helpers: an in-memory Store, a config, sessions and requests.

import type { HandlerContext } from "../context.js";
import type { ServerConfig } from "../env.js";
import type { ApiRequest } from "../http.js";
import type { Session } from "../session.js";
import type { AttemptInsert, AttemptRow, LeaderboardAttempt, Page, RunSessionInsert, RunSessionRow, SaveResult, Store } from "../store.js";

const slice = <T>(rows: T[], page: Page): T[] => rows.slice(page.offset, page.offset + page.limit);

export const CONFIG: ServerConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceKey: "service-key",
  sessionSecret: "s".repeat(40),
  hubUrl: "https://hub.example",
  masterKey: "master-key-0123456789",
  secureCookies: true,
};

export const STUDENT: Session = { email: "stu@x.com", name: "Stu", batch: "B1", role: "student", via: "hub" };
export const TRAINER: Session = { email: "tr@kraftshala.com", name: "Tr", batch: "", role: "trainer", via: "hub" };
export const ADMIN: Session = { email: "ad@kraftshala.com", name: "Ad", batch: "", role: "admin", via: "hub" };

export const NOW = new Date("2026-11-08T10:00:00.000Z");

export function request(method: string, extra: Partial<ApiRequest> = {}): ApiRequest {
  return { method, query: {}, body: undefined, headers: { "x-requested-with": "blinkit-sim" }, ...extra };
}

export interface MemoryStore extends Store {
  attempts: AttemptRow[];
  runSessions: RunSessionRow[];
  batchScoreRows: { batch_code: string; score_total: number }[];
  /** Makes the next call to this method throw. */
  failNext: Set<keyof Store>;
}

function attemptRow(row: AttemptInsert, index: number): AttemptRow {
  return {
    id: row.id ?? `a${index}`,
    email: row.email,
    name: row.name,
    batch_code: row.batch_code,
    profile_id: row.profile_id,
    score_total: row.score_total ?? 0,
    badge: row.badge ?? null,
    choices: row.choices ?? {},
    scenario: row.scenario ?? {},
    score_breakdown: row.score_breakdown ?? {},
    snapshot: row.snapshot ?? null,
    crisis_choice: row.crisis_choice ?? null,
    crisis_id: row.crisis_id ?? null,
    crisis_points: row.crisis_points ?? 0,
    created_at: row.created_at ?? new Date(NOW.getTime() + index * 1000).toISOString(),
    last_seen_at: row.last_seen_at ?? NOW.toISOString(),
  } as AttemptRow;
}

export function memoryStore(): MemoryStore {
  const store: MemoryStore = {
    attempts: [],
    runSessions: [],
    batchScoreRows: [],
    failNext: new Set(),
    async insertAttempt(row): Promise<SaveResult> {
      guard("insertAttempt");
      const runId = (row.choices as { runId?: string } | undefined)?.runId;
      if (store.attempts.some((a) => (a.choices as { runId?: string })?.runId === runId)) return "already_saved";
      store.attempts = [...store.attempts, attemptRow(row, store.attempts.length)];
      return "saved";
    },
    async attemptsByEmail(email, page) {
      guard("attemptsByEmail");
      return slice(store.attempts.filter((a) => a.email === email).reverse(), page);
    },
    async touchAttempts(email, at) {
      guard("touchAttempts");
      store.attempts = store.attempts.map((a) => (a.email === email ? { ...a, last_seen_at: at } : a));
    },
    async allAttempts(page) {
      guard("allAttempts");
      return slice([...store.attempts].reverse(), page);
    },
    async leaderboardAttempts(page) {
      guard("leaderboardAttempts");
      return slice([...store.attempts].sort((a, b) => b.score_total - a.score_total), page) as LeaderboardAttempt[];
    },
    async batchScores(limit) {
      guard("batchScores");
      return store.batchScoreRows.slice(0, limit);
    },
    async upsertRunSession(row: RunSessionInsert) {
      guard("upsertRunSession");
      const next = { started_at: NOW.toISOString(), last_seen_at: NOW.toISOString(), state: {}, ...row } as RunSessionRow;
      store.runSessions = [...store.runSessions.filter((r) => r.email !== row.email), next];
    },
    async runSessionByEmail(email) {
      guard("runSessionByEmail");
      return store.runSessions.find((r) => r.email === email) ?? null;
    },
    async isRealStudent(email) {
      guard("isRealStudent");
      return store.attempts.some((a) => a.email === email && a.batch_code !== "MASTER")
        || store.runSessions.some((r) => r.email === email && r.batch_code !== "MASTER");
    },
    async runIsSaved(runId) {
      guard("runIsSaved");
      return store.attempts.some((a) => (a.choices as { runId?: string })?.runId === runId);
    },
    async deleteRunSession(email, runId) {
      guard("deleteRunSession");
      store.runSessions = store.runSessions.filter((r) => !(r.email === email && r.run_id === runId));
    },
    async liveSessions(limit) {
      guard("liveSessions");
      return store.runSessions.slice(0, limit);
    },
    async countSessionsSeenBefore(cutoff) {
      guard("countSessionsSeenBefore");
      return store.runSessions.filter((r) => r.last_seen_at < cutoff).length;
    },
    async deleteSessionsSeenBefore(cutoff) {
      guard("deleteSessionsSeenBefore");
      store.runSessions = store.runSessions.filter((r) => r.last_seen_at >= cutoff);
    },
    async deleteAttemptsByEmail(email) {
      guard("deleteAttemptsByEmail");
      store.attempts = store.attempts.filter((a) => a.email !== email);
    },
    async deleteAttemptsByBatch(batch) {
      guard("deleteAttemptsByBatch");
      store.attempts = store.attempts.filter((a) => a.batch_code !== batch);
    },
    async deleteRunSessionsByBatch(batch) {
      guard("deleteRunSessionsByBatch");
      store.runSessions = store.runSessions.filter((r) => r.batch_code !== batch);
    },
  };

  function guard(method: keyof Store) {
    if (!store.failNext.has(method)) return;
    store.failNext.delete(method);
    throw new Error(`${String(method)} failed`);
  }

  return store;
}

export function context(session: Session | null, store: Store = memoryStore()): HandlerContext {
  return { session, store, config: CONFIG, now: () => NOW, clientId: "1.2.3.4" };
}
