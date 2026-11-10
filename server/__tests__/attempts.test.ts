// @vitest-environment node
import { describe, expect, it } from "vitest";
import { handleAttempts } from "../handlers/attempts.js";
import { handleRunSession } from "../handlers/runSession.js";
import { ADMIN, NOW, STUDENT, TRAINER, context, memoryStore, request } from "./helpers.js";

const ATTEMPT = {
  email: "stu@x.com", name: "Stu", batch_code: "B1", profile_id: "henlo",
  score_total: 56.5, choices: { campaigns: 2 }, score_breakdown: { grandTotal: 56.5 },
};

const save = (body: unknown) => request("POST", { body });

describe("POST /api/attempts", () => {
  it("rejects a visitor with no session", async () => {
    const result = await handleAttempts(save({ attempt: ATTEMPT, runId: "r1" }), context(null));
    expect(result.status).toBe(401);
    expect(result.body.code).toBe("unauthenticated");
  });

  it("saves, rounds the total, stamps the run id and keeps the exact breakdown", async () => {
    const store = memoryStore();
    const result = await handleAttempts(save({ attempt: ATTEMPT, runId: "r1" }), context(STUDENT, store));

    expect(result.body).toMatchObject({ success: true, data: { outcome: "saved" } });
    expect(store.attempts).toHaveLength(1);
    expect(store.attempts[0]).toMatchObject({
      score_total: 57,
      choices: { campaigns: 2, runId: "r1" },
      score_breakdown: { grandTotal: 56.5 },
    });
  });

  it("forces a student's own identity, whatever the browser sent", async () => {
    const store = memoryStore();
    const forged = { ...ATTEMPT, email: "victim@x.com", name: "Victim", batch_code: "OTHER" };
    await handleAttempts(save({ attempt: forged, runId: "r1" }), context(STUDENT, store));
    expect(store.attempts[0]).toMatchObject({ email: "stu@x.com", name: "Stu", batch_code: "B1" });
  });

  it("lets staff save under a test identity (Student view)", async () => {
    const store = memoryStore();
    const test = { ...ATTEMPT, email: "alumni@kraftshala.com", batch_code: "MASTER" };
    await handleAttempts(save({ attempt: test, runId: "r1" }), context(TRAINER, store));
    expect(store.attempts[0]).toMatchObject({ email: "alumni@kraftshala.com", batch_code: "MASTER" });
  });

  it("keeps every staff test run in the test batch, whatever batch was typed", async () => {
    const store = memoryStore();
    const test = { ...ATTEMPT, email: "tester@kraftshala.com", batch_code: "mlp_52_ft" };
    await handleAttempts(save({ attempt: test, runId: "r1" }), context(TRAINER, store));
    expect(store.attempts[0]).toMatchObject({ email: "tester@kraftshala.com", batch_code: "MASTER" });
  });

  it("won't let staff save a test run under a real student's email", async () => {
    const store = memoryStore();
    await store.insertAttempt({ ...ATTEMPT, email: "real@x.com", batch_code: "mlp_52_ft", choices: { runId: "old" } });
    const result = await handleAttempts(save({ attempt: { ...ATTEMPT, email: "real@x.com" }, runId: "r1" }), context(ADMIN, store));
    expect(result.status).toBe(409);
    expect(store.attempts).toHaveLength(1);
  });

  it("won't let staff overwrite a real student's live run", async () => {
    const store = memoryStore();
    await store.upsertRunSession({ email: "real@x.com", name: "Real", batch_code: "mlp_52_ft", run_id: "theirs", state: {} });
    const live = { email: "real@x.com", name: "Tester", batch_code: "MASTER", run_id: "mine", state: {} };
    const result = await handleRunSession(request("PUT", { body: live }), context(TRAINER, store));
    expect(result.status).toBe(409);
    expect(store.runSessions[0]).toMatchObject({ run_id: "theirs" });
  });

  it("drops fields the browser must not set", async () => {
    const store = memoryStore();
    const sneaky = { ...ATTEMPT, id: "chosen-id", created_at: "2020-01-01T00:00:00Z", last_seen_at: "2099-01-01T00:00:00Z" };
    await handleAttempts(save({ attempt: sneaky, runId: "r1" }), context(STUDENT, store));
    expect(store.attempts[0].id).not.toBe("chosen-id");
    expect(store.attempts[0].created_at).not.toBe("2020-01-01T00:00:00Z");
  });

  it("reports a second save of the same run as already saved, without a duplicate", async () => {
    const store = memoryStore();
    await handleAttempts(save({ attempt: ATTEMPT, runId: "r1" }), context(STUDENT, store));
    const again = await handleAttempts(save({ attempt: ATTEMPT, runId: "r1" }), context(STUDENT, store));
    expect(again.body.data).toEqual({ outcome: "already_saved" });
    expect(store.attempts).toHaveLength(1);
  });

  it("clears only this run's live row after saving", async () => {
    const store = memoryStore();
    await store.upsertRunSession({ email: "stu@x.com", name: "Stu", batch_code: "B1", run_id: "r1" });
    await store.upsertRunSession({ email: "other@x.com", name: "O", batch_code: "B1", run_id: "r9" });
    await handleAttempts(save({ attempt: ATTEMPT, runId: "r1" }), context(STUDENT, store));
    expect(store.runSessions.map((r) => r.email)).toEqual(["other@x.com"]);
  });

  it("keeps the live row when it belongs to a newer run", async () => {
    const store = memoryStore();
    await store.upsertRunSession({ email: "stu@x.com", name: "Stu", batch_code: "B1", run_id: "r2" });
    await handleAttempts(save({ attempt: ATTEMPT, runId: "r1" }), context(STUDENT, store));
    expect(store.runSessions).toHaveLength(1);
  });

  it("still reports the save when clearing the live row fails", async () => {
    const store = memoryStore();
    store.failNext.add("deleteRunSession");
    const result = await handleAttempts(save({ attempt: ATTEMPT, runId: "r1" }), context(STUDENT, store));
    expect(result.body.data).toEqual({ outcome: "saved" });
  });

  it("rejects a malformed attempt with a 400 and saves nothing", async () => {
    const store = memoryStore();
    const result = await handleAttempts(save({ attempt: { ...ATTEMPT, score_total: "lots" }, runId: "r1" }), context(STUDENT, store));
    expect(result.status).toBe(400);
    expect(store.attempts).toHaveLength(0);
  });

  it("propagates a database failure so the browser keeps the run unsaved", async () => {
    const store = memoryStore();
    store.failNext.add("insertAttempt");
    await expect(handleAttempts(save({ attempt: ATTEMPT, runId: "r1" }), context(STUDENT, store))).rejects.toThrow();
  });
});

describe("GET /api/attempts", () => {
  async function seeded() {
    const store = memoryStore();
    await store.insertAttempt({ ...ATTEMPT, choices: { runId: "a" } });
    await store.insertAttempt({ ...ATTEMPT, email: "other@x.com", choices: { runId: "b" } });
    return store;
  }

  it("returns a student's own attempts and bumps last seen when asked", async () => {
    const store = await seeded();
    const result = await handleAttempts(request("GET", { query: { email: "STU@x.com", touch: "1" } }), context(STUDENT, store));
    expect((result.body.data as unknown[]).length).toBe(1);
    expect(store.attempts.find((a) => a.email === "stu@x.com")?.last_seen_at).toBe(NOW.toISOString());
  });

  it("refuses a student reading someone else's attempts", async () => {
    const result = await handleAttempts(request("GET", { query: { email: "other@x.com" } }), context(STUDENT, await seeded()));
    expect(result.status).toBe(403);
  });

  it("lets staff read any student", async () => {
    const result = await handleAttempts(request("GET", { query: { email: "other@x.com" } }), context(TRAINER, await seeded()));
    expect((result.body.data as unknown[]).length).toBe(1);
  });

  it("still returns attempts when the last-seen bump fails", async () => {
    const store = await seeded();
    store.failNext.add("touchAttempts");
    const result = await handleAttempts(request("GET", { query: { email: "stu@x.com", touch: "1" } }), context(STUDENT, store));
    expect(result.status).toBe(200);
  });

  it("needs an email", async () => {
    const result = await handleAttempts(request("GET"), context(ADMIN));
    expect(result.status).toBe(400);
  });
});

describe("/api/run-session", () => {
  const live = { email: "stu@x.com", name: "Stu", batch_code: "B1", run_id: "r1", started_at: "2026-11-08T09:00:00Z", state: { currentDay: 3 } };

  it("upserts a student's own row with a server timestamp", async () => {
    const store = memoryStore();
    const result = await handleRunSession(request("PUT", { body: { ...live, email: "victim@x.com" } }), context(STUDENT, store));
    expect(result.status).toBe(200);
    expect(store.runSessions[0]).toMatchObject({ email: "stu@x.com", run_id: "r1", last_seen_at: NOW.toISOString(), started_at: "2026-11-08T09:00:00.000Z" });
  });

  it("falls back to now for an unreadable start date instead of dropping the sync", async () => {
    const store = memoryStore();
    await handleRunSession(request("PUT", { body: { ...live, started_at: "yesterday-ish" } }), context(STUDENT, store));
    expect(store.runSessions[0].started_at).toBe(NOW.toISOString());
  });

  it("reads back only the student's own row", async () => {
    const store = memoryStore();
    await handleRunSession(request("PUT", { body: live }), context(STUDENT, store));
    const mine = await handleRunSession(request("GET", { query: { email: "stu@x.com" } }), context(STUDENT, store));
    expect(mine.body.data).toMatchObject({ run_id: "r1" });
    const theirs = await handleRunSession(request("GET", { query: { email: "other@x.com" } }), context(STUDENT, store));
    expect(theirs.status).toBe(403);
  });

  it("returns null when there is no live run", async () => {
    const result = await handleRunSession(request("GET", { query: { email: "stu@x.com" } }), context(STUDENT));
    expect(result.body).toMatchObject({ success: true, data: null });
  });

  it("rejects a state that isn't an object", async () => {
    const result = await handleRunSession(request("PUT", { body: { ...live, state: "nope" } }), context(STUDENT));
    expect(result.status).toBe(400);
  });

  it("rejects a visitor with no session", async () => {
    const result = await handleRunSession(request("PUT", { body: live }), context(null));
    expect(result.status).toBe(401);
  });

  // A late auto-save used to re-create the live row of a run whose score was
  // already saved, and every sign-in then restored that finished run.
  it("won't keep a live copy of a run whose score is already saved", async () => {
    const store = memoryStore();
    await store.insertAttempt({ email: "stu@x.com", name: "Stu", batch_code: "B1", profile_id: "glow", score_total: 70, choices: { runId: "r1" } });
    const result = await handleRunSession(request("PUT", { body: live }), context(STUDENT, store));
    expect(result.status).toBe(200);
    expect(store.runSessions).toHaveLength(0);
  });

  it("drops a leftover live copy of a saved run instead of restoring it", async () => {
    const store = memoryStore();
    await store.upsertRunSession({ email: "stu@x.com", name: "Stu", batch_code: "B1", run_id: "r1", state: {} });
    await store.insertAttempt({ email: "stu@x.com", name: "Stu", batch_code: "B1", profile_id: "glow", score_total: 70, choices: { runId: "r1" } });
    const result = await handleRunSession(request("GET", { query: { email: "stu@x.com" } }), context(STUDENT, store));
    expect(result.body).toMatchObject({ success: true, data: null });
    expect(store.runSessions).toHaveLength(0);
  });

  it("drops the live copy of a run the student set aside, and only that run", async () => {
    const store = memoryStore();
    await handleRunSession(request("PUT", { body: live }), context(STUDENT, store));
    await handleRunSession(request("DELETE", { query: { run_id: "other-run" } }), context(STUDENT, store));
    expect(store.runSessions).toHaveLength(1);
    const result = await handleRunSession(request("DELETE", { query: { run_id: "r1" } }), context(STUDENT, store));
    expect(result.status).toBe(200);
    expect(store.runSessions).toHaveLength(0);
  });

  it("needs a run id to drop a live copy, and a session", async () => {
    expect((await handleRunSession(request("DELETE", { query: {} }), context(STUDENT))).status).toBe(400);
    expect((await handleRunSession(request("DELETE", { query: { run_id: "r1" } }), context(null))).status).toBe(401);
  });

  it("still restores a run that hasn't been saved", async () => {
    const store = memoryStore();
    await store.insertAttempt({ email: "stu@x.com", name: "Stu", batch_code: "B1", profile_id: "glow", score_total: 70, choices: { runId: "old" } });
    await handleRunSession(request("PUT", { body: live }), context(STUDENT, store));
    const result = await handleRunSession(request("GET", { query: { email: "stu@x.com" } }), context(STUDENT, store));
    expect(result.body.data).toMatchObject({ run_id: "r1" });
  });
});
