import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { useSim } from "@/context/SimContext";

const HUB_URL  = "https://ksstudentshub.vercel.app";
const SIM_SLUG = "blinkit-sim";

/**
 * Fetches and caches the hub's public key — no credentials needed.
 *
 * The hub's /.well-known/jwks.json is a Vercel serverless route, so a cold start
 * can easily blow past jose's 5s default timeout. We raise the timeout and shrink
 * the cooldown so a retry is actually allowed to re-fetch (default cooldown is 30s,
 * which made a single cold-start failure look like a permanent broken login).
 */
const JWKS = createRemoteJWKSet(
  new URL(`${HUB_URL}/.well-known/jwks.json`),
  {
    timeoutDuration:  15_000, // default 5_000 — too tight for Vercel cold starts
    cooldownDuration:  2_000, // default 30_000 — let retries actually retry
    cacheMaxAge:     600_000, // cache the key for 10 min to avoid repeat cold hits
  },
);

/** Which kind of failure we hit — drives the message and whether Retry is offered */
type FailKind = "timeout" | "expired" | "invalid" | "no_token" | "unknown_role";

interface Failure {
  kind: FailKind;
  detail?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** jose error code helper — codes are stable across minified builds, class names are not */
const codeOf = (err: unknown): string =>
  (err as { code?: string })?.code ?? "";

export default function SSOCallback() {
  const nav = useNavigate();
  const { setStudent } = useSim();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setFailure(null);

      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setFailure({ kind: "no_token" });
        return;
      }

      /**
       * Verify, retrying once if the JWKS fetch timed out.
       * The first attempt warms the hub's serverless function; the retry lands warm.
       * Only ERR_JWKS_TIMEOUT is retried — a genuinely bad token still fails fast.
       */
      const verify = async () => {
        try {
          return await jwtVerify(token, JWKS, {
            issuer:   HUB_URL,
            audience: SIM_SLUG,
          });
        } catch (err) {
          if (codeOf(err) !== "ERR_JWKS_TIMEOUT") throw err;
          console.warn("JWKS fetch timed out (likely hub cold start) — retrying once…");
          await sleep(2_500); // clear the cooldown window before the second try
          return await jwtVerify(token, JWKS, {
            issuer:   HUB_URL,
            audience: SIM_SLUG,
          });
        }
      };

      try {
        const { payload } = await verify();
        if (cancelled) return;

        const name    = payload.name     as string;
        const email   = payload.email    as string;
        const simRole = payload.sim_role as string;
        const batch   = (payload.batch   as string | null) ?? "";
        const course  = (payload.course  as string | null) ?? "";

        // Map sim_role → internal role + redirect
        if (simRole === "super_admin") {
          localStorage.setItem("sim_role", "admin");
          nav("/admin", { replace: true });

        } else if (simRole === "instructor") {
          localStorage.setItem("sim_role", "trainer");
          nav("/trainer", { replace: true });

        } else if (simRole === "student") {
          localStorage.setItem("sim_role", "student");
          setStudent({
            name:  name,
            email: email.toLowerCase(),
            batch: batch || course || "HUB",
          });
          nav("/dashboard", { replace: true });

        } else {
          setFailure({ kind: "unknown_role", detail: simRole });
        }

      } catch (err) {
        if (cancelled) return;

        const code = codeOf(err);
        // Keep the real reason in the console — the UI copy is deliberately vague,
        // and we lost time once already chasing an "expired token" that was a timeout.
        console.error("SSO token rejected:", code || err, err);

        if (code === "ERR_JWKS_TIMEOUT" || code === "ERR_JWKS_NO_MATCHING_KEY") {
          setFailure({ kind: "timeout", detail: code });
        } else if (code === "ERR_JWT_EXPIRED") {
          setFailure({ kind: "expired" });
        } else {
          setFailure({ kind: "invalid", detail: code });
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failure) {
    const { title, body, canRetry } = describe(failure);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">{failure.kind === "timeout" ? "🐢" : "⚠️"}</div>
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{body}</p>

          <div className="flex items-center justify-center gap-2 pt-2">
            {canRetry && (
              <button
                onClick={() => setAttempt((n) => n + 1)}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                Try again
              </button>
            )}
            <a
              href={HUB_URL}
              className={`px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 ${
                canRetry
                  ? "border border-border text-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              Back to Kraftshala Hub
            </a>
          </div>

          {failure.detail && (
            <p className="text-[10px] text-muted-foreground/60 pt-2 font-mono">
              {failure.detail}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}

/** Maps a failure to user-facing copy. Kept separate so the messages read as a set. */
function describe(f: Failure): { title: string; body: string; canRetry: boolean } {
  switch (f.kind) {
    case "timeout":
      return {
        title: "Couldn't reach the Hub",
        body: "The Kraftshala Hub took too long to respond — this is usually temporary. Please try again.",
        canRetry: true,
      };
    case "expired":
      return {
        title: "Link expired",
        body: "This launch link has expired. Head back to the Kraftshala Hub and launch the simulation again.",
        canRetry: false,
      };
    case "no_token":
      return {
        title: "No login token",
        body: "Please launch the simulation from the Kraftshala Hub rather than opening this page directly.",
        canRetry: false,
      };
    case "unknown_role":
      return {
        title: "Unrecognised role",
        body: `Your account role "${f.detail}" isn't set up for this simulation. Please contact your Kraftshala admin.`,
        canRetry: false,
      };
    case "invalid":
    default:
      return {
        title: "Login failed",
        body: "Your session link couldn't be verified. Please go back to the Kraftshala Hub and launch again.",
        canRetry: true,
      };
  }
}
