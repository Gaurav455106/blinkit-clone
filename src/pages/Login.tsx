import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSim } from "@/context/SimContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { HUB_URL, syncMasterFlag } from "@/lib/masterAccess";

/**
 * Login is now a router, not a form.
 *
 * Students arrive via hub SSO (/sso), which sets sim_role and the student, then
 * redirects onward. Anyone landing here directly is sent to the hub — except a
 * browser with sticky master access, which gets the internal role picker.
 *
 * Unlock master once with ?master=<key>; it persists (see lib/masterAccess.ts),
 * so there's nothing to remember or re-enter on subsequent visits.
 */
export default function Login() {
  const nav = useNavigate();
  const { student, setStudent } = useSim();

  const [master,  setMaster]  = useState(false);
  const [checked, setChecked] = useState(false);

  // Remembered across visits so testing as a given student is one click.
  const [testName,  setTestName]  = useLocalStorage("sim_master_test_name",  "Prerna");
  const [testEmail, setTestEmail] = useLocalStorage("sim_master_test_email", "alumni@kraftshala.com");
  const [testBatch, setTestBatch] = useLocalStorage("sim_master_test_batch", "MASTER");
  const [custom,    setCustom]    = useState(false);

  useEffect(() => {
    // Already signed in → straight to the right place
    const simRole = localStorage.getItem("sim_role");
    if (simRole === "admin")   { nav("/admin",     { replace: true }); return; }
    if (simRole === "trainer") { nav("/trainer",   { replace: true }); return; }
    if (student)               { nav("/dashboard", { replace: true }); return; }

    // Handles ?master=<key> (unlock), ?master=off (clear), or the sticky flag
    if (syncMasterFlag()) { setMaster(true); setChecked(true); return; }

    setChecked(true);
    window.location.replace(HUB_URL);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Spinner while deciding, and while the hub redirect is in flight
  if (!checked || !master) {
    return (
      <main className="sim-ui flex min-h-[100dvh] items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
          <BrandMark />
          <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Taking you to the Kraftshala Hub to sign in…</p>
        </div>
      </main>
    );
  }

  const enterAsStudent = () => {
    const email = testEmail.trim().toLowerCase();
    if (!testName.trim() || !email) return;
    localStorage.setItem("sim_role", "student");
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
