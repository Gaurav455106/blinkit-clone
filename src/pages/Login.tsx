import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSim } from "@/context/SimContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { HUB_URL, hasMasterAccess, readMasterParam, setMasterFlag, stripMasterParam } from "@/lib/masterAccess";
import { ApiError } from "@/lib/api";
import { currentSession, signInWithMasterKey, signOutOfServer } from "@/lib/session";
import { clearStudentView } from "@/lib/staffView";

type View = "checking" | "redirecting" | "picker" | "key";

function keyErrorText(err: unknown): string {
  if (err instanceof ApiError && err.code === "too_many_attempts") return "Too many tries. Wait 15 minutes and try again.";
  if (err instanceof ApiError && err.code === "bad_key") return "That key wasn't accepted.";
  if (err instanceof ApiError && err.code === "not_configured") return "Master access isn't set up on the server.";
  return "Couldn't check the key. Please try again.";
}

/**
 * Login is now a router, not a form.
 *
 * Students arrive via hub SSO (/sso), which signs them in on the server, then
 * redirects onward. Anyone landing here directly is sent to the hub — except
 * Kraftshala staff using master access, which gets the internal role picker.
 *
 * Unlock with ?master=<key> or by typing the key on this page. The server checks
 * the key (MASTER_KEY env var) and sets a 30-day staff session; this browser
 * then remembers to show the picker. ?master=off locks it again.
 */
export default function Login() {
  const nav = useNavigate();
  const { student, setStudent } = useSim();

  const [view, setView] = useState<View>("checking");
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);

  // Remembered across visits so testing as a given student is one click.
  const [testName,  setTestName]  = useLocalStorage("sim_master_test_name",  "Prerna");
  const [testEmail, setTestEmail] = useLocalStorage("sim_master_test_email", "alumni@kraftshala.com");
  const [testBatch, setTestBatch] = useLocalStorage("sim_master_test_batch", "MASTER");
  const [custom,    setCustom]    = useState(false);

  useEffect(() => {
    let cancelled = false;
    const goToHub = () => { if (!cancelled) { setView("redirecting"); window.location.replace(HUB_URL); } };

    const decide = async () => {
      const param = readMasterParam();
      stripMasterParam();

      if (param?.kind === "off") {
        setMasterFlag(false);
        await signOutOfServer();
        goToHub();
        return;
      }

      // Already signed in → straight to the right place
      const simRole = localStorage.getItem("sim_role");
      if (simRole === "admin")   { nav("/admin",     { replace: true }); return; }
      if (simRole === "trainer") { nav("/trainer",   { replace: true }); return; }
      if (student)               { nav("/dashboard", { replace: true }); return; }

      if (param?.kind === "unlock") {
        try {
          await signInWithMasterKey(param.key);
          setMasterFlag(true);
          if (!cancelled) setView("picker");
        } catch (err) {
          console.warn("[login] master key rejected", err);
          if (!cancelled) { setKeyError(keyErrorText(err)); setView("key"); }
        }
        return;
      }

      if (!hasMasterAccess()) { goToHub(); return; }

      // Remembered browser: the picker only works while the server session lasts
      try {
        const session = await currentSession();
        if (!cancelled) setView(session?.via === "master" ? "picker" : "key");
      } catch (err) {
        console.warn("[login] session check failed", err);
        if (!cancelled) setView("key");
      }
    };

    void decide();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!keyInput.trim() || keyBusy) return;
    setKeyBusy(true);
    setKeyError(null);
    try {
      await signInWithMasterKey(keyInput.trim());
      setMasterFlag(true);
      setKeyInput("");
      setView("picker");
    } catch (err) {
      console.warn("[login] master key rejected", err);
      setKeyError(keyErrorText(err));
    } finally {
      setKeyBusy(false);
    }
  };

  if (view === "key") {
    return (
      <main className="sim-ui flex min-h-[100dvh] items-center justify-center px-6 py-10">
        <form onSubmit={submitKey} className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]">
          <BrandMark />
          <h1 className="mt-6 text-xl font-semibold text-foreground">Master access</h1>
          <p className="mt-1 text-sm text-muted-foreground">For the Kraftshala team only. Enter the master key to continue.</p>
          <label htmlFor="master-key" className="mt-5 block text-xs font-medium text-muted-foreground">Master key</label>
          <Input
            id="master-key"
            type="password"
            autoComplete="current-password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className="mt-1.5 h-9 text-sm"
            aria-invalid={!!keyError}
            aria-describedby={keyError ? "master-key-error" : undefined}
          />
          {keyError && <p id="master-key-error" role="alert" className="mt-2 text-xs text-destructive">{keyError}</p>}
          <Button type="submit" className="mt-4 w-full" disabled={keyBusy || !keyInput.trim()}>
            {keyBusy ? "Checking…" : "Unlock"}
          </Button>
          <a href={HUB_URL} className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">
            Students: go to the Kraftshala Hub
          </a>
        </form>
      </main>
    );
  }

  // Spinner while deciding, and while the hub redirect is in flight
  if (view !== "picker") {
    return (
      <main className="sim-ui flex min-h-[100dvh] items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
          <BrandMark />
          <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {view === "checking" ? "Checking your sign-in…" : "Taking you to the Kraftshala Hub to sign in…"}
          </p>
        </div>
      </main>
    );
  }

  const enterAsStudent = () => {
    const email = testEmail.trim().toLowerCase();
    if (!testName.trim() || !email) return;
    localStorage.setItem("sim_role", "student");
    clearStudentView();
    // setStudent isolates this email's session from whoever used the browser last
    setStudent({ name: testName.trim(), email, batch: testBatch.trim() || "MASTER" });
    nav("/dashboard");
  };

  // ── Master role picker (internal only) ────────────────────────────────────
  return (
    <main className="sim-ui flex min-h-[100dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]">
        <BrandMark />
        <h1 className="mt-6 text-xl font-semibold text-foreground">Master access</h1>
        <p className="mt-1 text-sm text-muted-foreground">For the Kraftshala team only. This browser stays unlocked until you turn it off.</p>

        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={enterAsStudent}>Enter as student</Button>
          <Button variant="outline" className="w-full" onClick={() => { localStorage.setItem("sim_role", "trainer"); nav("/trainer"); }}>
            Enter as trainer
          </Button>
          <Button variant="outline" className="w-full" onClick={() => { localStorage.setItem("sim_role", "admin"); nav("/admin"); }}>
            Enter as admin
          </Button>
        </div>

        {/* Custom identity: handy for checking that per-student isolation works.
            Enter as one email, build a campaign, then switch to another. */}
        {custom ? (
          <div className="mt-5 space-y-3 border-t border-border pt-5">
            <div className="space-y-1.5">
              <label htmlFor="master-name" className="text-xs font-medium text-muted-foreground">Student name</label>
              <Input id="master-name" value={testName} onChange={(e) => setTestName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="master-email" className="text-xs font-medium text-muted-foreground">Email</label>
              <Input id="master-email" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="master-batch" className="text-xs font-medium text-muted-foreground">Batch code</label>
              <Input id="master-batch" value={testBatch} onChange={(e) => setTestBatch(e.target.value)} className="h-9 text-sm" />
            </div>
            <p className="text-xs text-muted-foreground">Signing in with a different email clears the last student's saved progress on this browser.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCustom(true)}
            className="mt-4 w-full rounded-md py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Student: {testEmail}. Change
          </button>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          To lock this browser again, add <span className="sim-mono">?master=off</span> to the address.
        </p>
      </div>
    </main>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8CB2E] text-sm font-black text-[#1a1a1a]">b</div>
      <div className="text-left leading-tight">
        <p className="text-sm font-bold text-foreground">blinkit</p>
        <p className="text-[11px] text-muted-foreground">Ads Simulation</p>
      </div>
    </div>
  );
}
