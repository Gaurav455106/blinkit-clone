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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Redirecting to Kraftshala Hub…</p>
        </div>
      </div>
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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-xs space-y-3">
        <div className="text-center mb-5">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center mx-auto mb-2">
            <span className="text-white text-lg font-bold">⚡</span>
          </div>
          <p className="text-sm font-semibold text-foreground">Master Access</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Internal use only · this browser is remembered
          </p>
        </div>

        <Button className="w-full" onClick={enterAsStudent}>
          Enter as Student
        </Button>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          onClick={() => { localStorage.setItem("sim_role", "trainer"); nav("/trainer"); }}
        >
          Enter as Trainer
        </Button>

        <Button
          className="w-full bg-amber-500 hover:bg-amber-600 text-white border-0"
          onClick={() => { localStorage.setItem("sim_role", "admin"); nav("/admin"); }}
        >
          Enter as Admin
        </Button>

        {/* Custom identity — handy for checking that per-student isolation works:
            enter as one email, build a campaign, then switch to another. */}
        {custom ? (
          <div className="space-y-2 pt-2 border-t border-border mt-3">
            <Input value={testName}  onChange={(e) => setTestName(e.target.value)}  placeholder="Name"  className="h-8 text-xs" />
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Email" className="h-8 text-xs" />
            <Input value={testBatch} onChange={(e) => setTestBatch(e.target.value)} placeholder="Batch" className="h-8 text-xs" />
            <p className="text-[10px] text-muted-foreground">
              Entering as a different email wipes the previous student's local session.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setCustom(true)}
            className="w-full text-[11px] text-muted-foreground hover:text-foreground pt-1"
          >
            Student identity: {testEmail} · change
          </button>
        )}

        <p className="text-[10px] text-muted-foreground/70 text-center pt-3">
          Add <span className="font-mono">?master=off</span> to remove access from this browser.
        </p>
      </div>
    </div>
  );
}
