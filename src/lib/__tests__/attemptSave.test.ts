// The save now goes through /api/attempts. Rounding, the run id stamp, the
// unique-index clash and clearing the live row are server-side and tested in
// server/__tests__/attempts.test.ts; this covers the browser's half.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRunSaved, saveAttempt } from "@/lib/attemptSave";
import { ApiError, SESSION_EXPIRED_EVENT } from "@/lib/api";

const ROW = { email: "a@x.com", name: "A", batch_code: "b1", profile_id: "henlo", choices: { campaigns: 2 }, score_total: 56.5 };

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveAttempt", () => {
  it("posts the attempt and run id with the CSRF header, then remembers the run", async () => {
    const fetchMock = respond(200, { success: true, data: { outcome: "saved" }, error: null });
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveAttempt(ROW, "run-1")).resolves.toBe("saved");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/attempts");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toMatchObject({ "X-Requested-With": "blinkit-sim", "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ attempt: ROW, runId: "run-1" });
    expect(isRunSaved("run-1")).toBe(true);
  });

  it("treats an already-saved run as saved", async () => {
    vi.stubGlobal("fetch", respond(200, { success: true, data: { outcome: "already_saved" }, error: null }));
    await expect(saveAttempt(ROW, "run-1")).resolves.toBe("already_saved");
    expect(isRunSaved("run-1")).toBe(true);
  });

  it("throws on a server error and leaves the run unsaved so it is retried", async () => {
    vi.stubGlobal("fetch", respond(500, { success: false, data: null, error: "Something went wrong", code: "server_error" }));
    await expect(saveAttempt(ROW, "run-1")).rejects.toMatchObject({ status: 500, code: "server_error" });
    expect(isRunSaved("run-1")).toBe(false);
  });

  it("announces an ended sign-in and keeps the run unsaved", async () => {
    vi.stubGlobal("fetch", respond(401, { success: false, data: null, error: "Please launch again", code: "unauthenticated" }));
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    await expect(saveAttempt(ROW, "run-1")).rejects.toBeInstanceOf(ApiError);

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(isRunSaved("run-1")).toBe(false);
  });

  it("turns a network failure into an ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(saveAttempt(ROW, "run-1")).rejects.toMatchObject({ status: 0, code: "network" });
    expect(isRunSaved("run-1")).toBe(false);
  });

  it("reports unknown and null runs as unsaved", () => {
    expect(isRunSaved(null)).toBe(false);
    expect(isRunSaved("run-x")).toBe(false);
  });
});
