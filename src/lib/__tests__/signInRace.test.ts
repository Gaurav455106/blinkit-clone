// A hub launch on a browser that still holds an older, expired sign-in: the
// app restores the last run from this browser and tries to save it at once.
// Those calls must wait out the new sign-in instead of failing with the old
// cookie and putting up "your sign-in has ended" over a sign-in that worked.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, SESSION_EXPIRED_EVENT, SESSION_STARTED_EVENT, api, whileSigningIn } from "@/lib/api";
import { signInWithHub } from "@/lib/session";

const SESSION = { email: "a@x.com", name: "A", batch: "b1", role: "student", via: "hub" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requests during a hub sign-in", () => {
  it("are not sent and don't announce an expired sign-in", async () => {
    let finishSignIn!: (r: Response) => void;
    const fetchMock = vi.fn((url: string) =>
      url === "/api/session" ? new Promise<Response>((resolve) => { finishSignIn = resolve; }) : Promise.resolve(json(401, { success: false, data: null, error: "x", code: "unauthenticated" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    const signingIn = whileSigningIn(() => signInWithHub("tok"));
    await expect(api("PUT", "/api/run-session", { body: {} })).rejects.toMatchObject({ code: "signing_in" });

    finishSignIn(json(200, { success: true, data: SESSION, error: null }));
    await expect(signingIn).resolves.toEqual(SESSION);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/session"]);
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it("go through again once the sign-in is done, whether it worked or not", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url === "/api/session" ? json(401, { success: false, data: null, error: "x", code: "invalid" }) : json(200, { success: true, data: "ok", error: null }),
    ));
    await expect(whileSigningIn(() => signInWithHub("bad"))).rejects.toBeInstanceOf(ApiError);
    await expect(api("GET", "/api/attempts")).resolves.toBe("ok");
  });

  it("announces a started sign-in so the expired-sign-in warning can clear", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { success: true, data: SESSION, error: null })));
    const started = vi.fn();
    window.addEventListener(SESSION_STARTED_EVENT, started);
    await whileSigningIn(() => signInWithHub("tok"));
    expect(started).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_STARTED_EVENT, started);
  });
});
