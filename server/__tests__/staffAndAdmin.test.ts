// @vitest-environment node
import { describe, expect, it } from "vitest";
import { handleAdmin } from "../handlers/admin.js";
import { handleLeaderboard, pseudonym } from "../handlers/leaderboard.js";
import { handleStaff } from "../handlers/staff.js";
import { MAX_PAGE_SIZE, pageOf } from "../validate.js";
import { ADMIN, CONFIG, NOW, STUDENT, TRAINER, context, memoryStore, request } from "./helpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString();

async function seeded() {
  const store = memoryStore();
  await store.insertAttempt({ email: "stu@x.com", name: "Stu", batch_code: "B1", profile_id: "henlo", score_total: 60, choices: { runId: "1" } });
  await store.insertAttempt({ email: "amy@x.com", name: "Amy", batch_code: "B1", profile_id: "henlo", score_total: 80, choices: { runId: "2" } });
  await store.insertAttempt({ email: "zed@x.com", name: "Zed", batch_code: "B2", profile_id: "henlo", score_total: 40, choices: { runId: "3" } });
  await store.upsertRunSession({ email: "old@x.com", name: "Old", batch_code: "B1", run_id: "o", last_seen_at: daysAgo(10) });
  await store.upsertRunSession({ email: "new@x.com", name: "New", batch_code: "B2", run_id: "n", last_seen_at: daysAgo(1) });
  store.batchScoreRows = [{ batch_code: "B1", score_total: 60 }];
  return store;
}

describe("GET /api/leaderboard", () => {
  const view = (v: string, extra: Record<string, string> = {}) => request("GET", { query: { view: v, ...extra } });

  it("shows a student their own email but pseudonyms for classmates", async () => {
    const result = await handleLeaderboard(view("attempts"), context(STUDENT, await seeded()));
    const attempts = result.body.data as { email: string; name: string }[];
    const emails = attempts.map((a) => a.email);
    expect(emails).toContain("stu@x.com");
    expect(emails).not.toContain("amy@x.com");
    expect(emails).toContain(pseudonym("amy@x.com", CONFIG.sessionSecret));
    expect(attempts.map((a) => a.name)).toContain("Amy");
  });

  it("shows staff real emails", async () => {
    const result = await handleLeaderboard(view("attempts"), context(TRAINER, await seeded()));
    expect((result.body.data as { email: string }[]).map((a) => a.email)).toContain("amy@x.com");
  });

  it("pages attempts best-first", async () => {
    const store = await seeded();
    const first = await handleLeaderboard(view("attempts", { limit: "2", offset: "0" }), context(TRAINER, store));
    const second = await handleLeaderboard(view("attempts", { limit: "2", offset: "2" }), context(TRAINER, store));
    expect((first.body.data as { score_total: number }[]).map((a) => a.score_total)).toEqual([80, 60]);
    expect((second.body.data as { score_total: number }[]).map((a) => a.score_total)).toEqual([40]);
  });

  it("returns batch scores separately", async () => {
    const result = await handleLeaderboard(view("batches"), context(STUDENT, await seeded()));
    expect(result.body.data).toEqual([{ batch_code: "B1", score_total: 60 }]);
  });

  it("gives the same student the same pseudonym every time", () => {
    expect(pseudonym("amy@x.com", "k".repeat(40))).toBe(pseudonym("amy@x.com", "k".repeat(40)));
    expect(pseudonym("amy@x.com", "k".repeat(40))).not.toBe(pseudonym("bob@x.com", "k".repeat(40)));
  });

  it("needs a session and a known view", async () => {
    expect((await handleLeaderboard(view("attempts"), context(null))).status).toBe(401);
    expect((await handleLeaderboard(request("GET"), context(STUDENT))).status).toBe(400);
  });
});

describe("pageOf", () => {
  it("caps the page size at 100 and keeps offsets in range", () => {
    expect(pageOf({})).toEqual({ limit: MAX_PAGE_SIZE, offset: 0 });
    expect(pageOf({ limit: "5000", offset: "-3" })).toEqual({ limit: MAX_PAGE_SIZE, offset: 0 });
    expect(pageOf({ limit: "abc", offset: "1.5" })).toEqual({ limit: MAX_PAGE_SIZE, offset: 0 });
    expect(pageOf({ limit: "10", offset: "20" })).toEqual({ limit: 10, offset: 20 });
  });
});

describe("GET /api/staff", () => {
  it("refuses students", async () => {
    const result = await handleStaff(request("GET", { query: { view: "attempts" } }), context(STUDENT, await seeded()));
    expect(result.status).toBe(403);
  });

  it("lists attempts for trainers, one page at a time", async () => {
    const store = await seeded();
    const first = await handleStaff(request("GET", { query: { view: "attempts", limit: "2" } }), context(TRAINER, store));
    const rest = await handleStaff(request("GET", { query: { view: "attempts", limit: "2", offset: "2" } }), context(TRAINER, store));
    expect((first.body.data as unknown[]).length).toBe(2);
    expect((rest.body.data as unknown[]).length).toBe(1);
  });

  it("lists live runs", async () => {
    const result = await handleStaff(request("GET", { query: { view: "live" } }), context(TRAINER, await seeded()));
    expect((result.body.data as unknown[]).length).toBe(2);
  });

  it("counts live rows older than the given days", async () => {
    const result = await handleStaff(request("GET", { query: { view: "stale-count", days: "7" } }), context(ADMIN, await seeded()));
    expect(result.body.data).toEqual({ count: 1 });
  });

  it("rejects an unknown view", async () => {
    expect((await handleStaff(request("GET", { query: { view: "secrets" } }), context(ADMIN))).status).toBe(400);
  });
});

describe("DELETE /api/admin", () => {
  const del = (query: Record<string, string>) => request("DELETE", { query });

  it("refuses trainers and students", async () => {
    const store = await seeded();
    expect((await handleAdmin(del({ target: "batch", batch: "B1" }), context(TRAINER, store))).status).toBe(403);
    expect((await handleAdmin(del({ target: "batch", batch: "B1" }), context(STUDENT, store))).status).toBe(403);
    expect(store.attempts).toHaveLength(3);
  });

  it("deletes every attempt for one email and nothing else", async () => {
    const store = await seeded();
    await handleAdmin(del({ target: "student", email: "amy@x.com" }), context(ADMIN, store));
    expect(store.attempts.map((a) => a.email).sort()).toEqual(["stu@x.com", "zed@x.com"]);
  });

  it("deletes a batch's attempts and live rows only", async () => {
    const store = await seeded();
    await handleAdmin(del({ target: "batch", batch: "B1" }), context(ADMIN, store));
    expect(store.attempts.map((a) => a.batch_code)).toEqual(["B2"]);
    expect(store.runSessions.map((r) => r.batch_code)).toEqual(["B2"]);
  });

  it("clears only stale live rows and never touches scores", async () => {
    const store = await seeded();
    await handleAdmin(del({ target: "stale", days: "7" }), context(ADMIN, store));
    expect(store.runSessions.map((r) => r.email)).toEqual(["new@x.com"]);
    expect(store.attempts).toHaveLength(3);
  });

  it("refuses to delete without a target value", async () => {
    const store = await seeded();
    expect((await handleAdmin(del({ target: "student" }), context(ADMIN, store))).status).toBe(400);
    expect((await handleAdmin(del({ target: "batch", batch: "  " }), context(ADMIN, store))).status).toBe(400);
    expect((await handleAdmin(del({ target: "everything" }), context(ADMIN, store))).status).toBe(400);
    expect(store.attempts).toHaveLength(3);
  });

  it("only accepts DELETE", async () => {
    expect((await handleAdmin(request("GET", { query: { target: "stale" } }), context(ADMIN))).status).toBe(405);
  });
});
