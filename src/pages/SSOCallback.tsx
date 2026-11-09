import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { HUB_URL } from "@/lib/masterAccess";
import { ApiError } from "@/lib/api";
import { signInWithHub } from "@/lib/session";
import { clearStudentView } from "@/lib/staffView";

/** Which kind of failure we hit — drives the message and whether Retry is offered */
type FailKind = "timeout" | "expired" | "invalid" | "no_token" | "unknown_role";

interface Failure {
  kind: FailKind;
  detail?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** The hub's key route is serverless; the first try can time out while it wakes up. */
const COLD_START_RETRY_MS = 2_500;

const SERVER_FAILURES: Record<string, FailKind> = {
  timeout: "timeout",
  expired: "expired",
  invalid: "invalid",
  unknown_role: "unknown_role",
};

function failureOf(err: unknown): Failure {
  if (err instanceof ApiError) {
    if (err.code === "network") return { kind: "timeout", detail: "network" };
    return { kind: SERVER_FAILURES[err.code] ?? "invalid", detail: err.code };
  }
  return { kind: "invalid" };
}

/**
 * The hub sends `?token=`. The server checks it (signature, issuer, audience,
 * expiry), decides the role and sets a signed session cookie. The role kept in
 * localStorage only picks which screens to show; the server enforces access.
 */
export default function SSOCallback() {
  const nav = useNavigate();
  const { setStudent } = useSim();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setFailure(null);
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        setFailure({ kind: "no_token" });
        return;
      }

      // Retry once on a timeout only; a genuinely bad token still fails fast
      const verify = async () => {
        try {
          return await signInWithHub(token);
        } catch (err) {
          if (failureOf(err).kind !== "timeout") throw err;
          console.warn("Hub check timed out (likely hub cold start): retrying once…");
          await sleep(COLD_START_RETRY_MS);
          return await signInWithHub(token);
        }
      };

      try {
        const session = await verify();
        if (cancelled) return;
        clearStudentView();

        if (session.role === "admin") {
          localStorage.setItem("sim_role", "admin");
          nav("/admin", { replace: true });
        } else if (session.role === "trainer") {
          localStorage.setItem("sim_role", "trainer");
          nav("/trainer", { replace: true });
        } else {
          localStorage.setItem("sim_role", "student");
          setStudent({ name: session.name, email: session.email, batch: session.batch });
          nav("/dashboard", { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        // Keep the real reason in the console — the UI copy is deliberately vague
        console.error("SSO sign-in rejected:", err);
        setFailure(failureOf(err));
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
        body: "The Kraftshala Hub took too long to respond: this is usually temporary. Please try again.",
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
        body: "Your account role isn't set up for this simulation. Please contact your Kraftshala admin.",
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
