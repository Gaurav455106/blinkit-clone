// @vitest-environment node
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { readConfig } from "../env.js";
import { handleSession, type HubVerifier } from "../handlers/session.js";
import { HubTokenError, SIM_SLUG, verifyHubToken } from "../hubToken.js";
import { FailureLimiter, masterKeyMatches } from "../masterKey.js";
import { runHandler } from "../runner.js";
import { SESSION_COOKIE, readCookie, signSession, verifySession } from "../session.js";
import { CONFIG, STUDENT, context, memoryStore, request } from "./helpers.js";

const HUB = CONFIG.hubUrl;

async function hubSetup() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, opts: { audience?: string; issuer?: string; exp?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.issuer ?? HUB)
      .setAudience(opts.audience ?? SIM_SLUG)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "5m")
      .sign(privateKey);
  return { keys, sign };
}

describe("verifyHubToken", () => {
  it("maps hub roles and fills the batch from course, then HUB", async () => {
    const { keys, sign } = await hubSetup();
    const student = await verifyHubToken(await sign({ name: "Stu", email: "STU@X.com", sim_role: "student", course: "C1" }), HUB, keys);
    expect(student).toEqual({ role: "student", email: "stu@x.com", name: "Stu", batch: "C1" });
    const trainer = await verifyHubToken(await sign({ name: "T", email: "t@k.com", sim_role: "instructor" }), HUB, keys);
    expect(trainer).toMatchObject({ role: "trainer", batch: "HUB" });
    const admin = await verifyHubToken(await sign({ name: "A", email: "a@k.com", sim_role: "super_admin" }), HUB, keys);
    expect(admin.role).toBe("admin");
  });

  it.each([
    ["an unknown role", { sim_role: "janitor", email: "x@y.z" }, {}, "unknown_role"],
    ["another sim's audience", { sim_role: "student", email: "x@y.z" }, { audience: "amazon-sim" }, "invalid"],
    ["another issuer", { sim_role: "student", email: "x@y.z" }, { issuer: "https://evil.example" }, "invalid"],
    ["an expired token", { sim_role: "student", email: "x@y.z" }, { exp: "-1m" }, "expired"],
    ["no email", { sim_role: "student" }, {}, "invalid"],
  ])("rejects %s", async (_label, claims, opts, kind) => {
    const { keys, sign } = await hubSetup();
    const token = await sign(claims, opts as { audience?: string; issuer?: string; exp?: string });
    await expect(verifyHubToken(token, HUB, keys)).rejects.toMatchObject({ kind });
  });

  it("rejects a token signed by someone else's key", async () => {
    const { keys } = await hubSetup();
    const forger = await hubSetup();
    const token = await forger.sign({ sim_role: "super_admin", email: "x@y.z" });
    await expect(verifyHubToken(token, HUB, keys)).rejects.toBeInstanceOf(HubTokenError);
  });
});

describe("session cookie", () => {
  it("round-trips and rejects tampering or the wrong secret", async () => {
    const token = await signSession(STUDENT, CONFIG.sessionSecret, 60);
    expect(await verifySession(token, CONFIG.sessionSecret)).toEqual(STUDENT);
    expect(await verifySession(token, "x".repeat(40))).toBeNull();
    expect(await verifySession(token.slice(0, -2) + "xx", CONFIG.sessionSecret)).toBeNull();
    expect(await verifySession(undefined, CONFIG.sessionSecret)).toBeNull();
  });

  it("rejects an expired session", async () => {
    const token = await signSession(STUDENT, CONFIG.sessionSecret, -10);
    expect(await verifySession(token, CONFIG.sessionSecret)).toBeNull();
  });

  it("reads one cookie out of a header", () => {
    expect(readCookie("a=1; bk_session=abc%3D; b=2", SESSION_COOKIE)).toBe("abc=");
    expect(readCookie("a=1", SESSION_COOKIE)).toBeUndefined();
    expect(readCookie(undefined, SESSION_COOKIE)).toBeUndefined();
  });
});

describe("/api/session", () => {
  const verifier = (result: Awaited<ReturnType<HubVerifier>> | HubTokenError): HubVerifier => async () => {
    if (result instanceof HubTokenError) throw result;
    return result;
  };

  it("signs a hub user in with an HttpOnly, Secure, Lax cookie scoped to /api", async () => {
    const result = await handleSession(
      request("POST", { body: { token: "t" } }), context(null),
      verifier({ role: "student", email: "stu@x.com", name: "Stu", batch: "B1" }),
    );
    expect(result.body.data).toEqual({ ...STUDENT });
    expect(result.setCookie).toMatch(/^bk_session=[^;]+; Path=\/api; Max-Age=43200; HttpOnly; SameSite=Lax; Secure$/);
  });

  it("reports a hub timeout as 504 so the browser retries", async () => {
    const result = await handleSession(request("POST", { body: { token: "t" } }), context(null), verifier(new HubTokenError("timeout")));
    expect(result.status).toBe(504);
    expect(result.body.code).toBe("timeout");
    expect(result.setCookie).toBeUndefined();
  });

  it("signs staff in with the master key and refuses a wrong one", async () => {
    const limiter = new FailureLimiter();
    const good = await handleSession(request("POST", { body: { masterKey: CONFIG.masterKey } }), context(null), undefined, limiter);
    expect(good.body.data).toMatchObject({ role: "admin", via: "master" });
    const bad = await handleSession(request("POST", { body: { masterKey: "guess" } }), context(null), undefined, limiter);
    expect(bad.status).toBe(401);
    expect(bad.setCookie).toBeUndefined();
  });

  it("blocks master sign-in after too many wrong keys, even with the right key", async () => {
    const limiter = new FailureLimiter(2, 60_000);
    for (let i = 0; i < 2; i += 1) await handleSession(request("POST", { body: { masterKey: "guess" } }), context(null), undefined, limiter);
    const result = await handleSession(request("POST", { body: { masterKey: CONFIG.masterKey } }), context(null), undefined, limiter);
    expect(result.status).toBe(429);
  });

  it("returns the current session, and clears the cookie on sign-out", async () => {
    expect((await handleSession(request("GET"), context(STUDENT))).body.data).toMatchObject({ email: "stu@x.com" });
    expect((await handleSession(request("GET"), context(null))).body.data).toBeNull();
    expect((await handleSession(request("DELETE"), context(STUDENT))).setCookie).toMatch(/Max-Age=0/);
  });

  it("rejects a body with neither token nor key", async () => {
    expect((await handleSession(request("POST", { body: {} }), context(null))).status).toBe(400);
  });
});

describe("master key", () => {
  it("is off when MASTER_KEY is unset", () => {
    expect(masterKeyMatches("anything", null)).toBe(false);
    expect(masterKeyMatches("", "secret-key-123456")).toBe(false);
    expect(masterKeyMatches("secret-key-123456", "secret-key-123456")).toBe(true);
  });
});

describe("runHandler", () => {
  const ENV = {
    SUPABASE_URL: CONFIG.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: "key",
    SESSION_SECRET: CONFIG.sessionSecret,
  };
  const echo = async (_req: unknown, ctx: { session: unknown }) => ({ status: 200, body: { success: true, data: ctx.session, error: null } });

  it("blocks a data-changing request without the CSRF header", async () => {
    const result = await runHandler(echo, { ...request("POST"), headers: {} }, { env: ENV, store: memoryStore() });
    expect(result.status).toBe(403);
  });

  it("allows GET without the header and reads the session from the cookie", async () => {
    const token = await signSession(STUDENT, CONFIG.sessionSecret, 60);
    const result = await runHandler(echo, { ...request("GET"), headers: { cookie: `bk_session=${token}` } }, { env: ENV, store: memoryStore() });
    expect(result.body.data).toEqual(STUDENT);
  });

  it("answers 500 with a safe message when the server isn't configured", async () => {
    const result = await runHandler(echo, request("GET"), { env: {}, store: memoryStore() });
    expect(result.status).toBe(500);
    expect(result.body.code).toBe("not_configured");
  });

  it("hides internal errors behind a generic message", async () => {
    const boom = async () => { throw new Error("password=hunter2"); };
    const result = await runHandler(boom, request("GET"), { env: ENV, store: memoryStore() });
    expect(result.status).toBe(500);
    expect(result.body.error).not.toContain("hunter2");
  });
});

describe("readConfig", () => {
  it("requires a long session secret and a long master key when one is set", () => {
    const base = { SUPABASE_URL: "u", SUPABASE_SERVICE_ROLE_KEY: "k", SESSION_SECRET: "s".repeat(32) };
    expect(readConfig(base).masterKey).toBeNull();
    expect(() => readConfig({ ...base, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
    expect(() => readConfig({ ...base, MASTER_KEY: "short" })).toThrow(/MASTER_KEY/);
    expect(readConfig({ ...base, HUB_URL: "https://hub.example/" }).hubUrl).toBe("https://hub.example");
  });
});
