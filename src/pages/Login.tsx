import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSim } from "@/context/SimContext";
import { Zap, GraduationCap, ShieldCheck } from "lucide-react";

// ── Role credentials (frontend-gated training tool) ───────────────────────────
const TRAINER_EMAIL = "trainer@kraftshala.com";
const TRAINER_PASS  = "kraft2024";
const ADMIN_EMAIL   = "admin@kraftshala.com";
const ADMIN_PASS    = "admin2024";

type RoleHint = "student" | "trainer" | "admin";

function detectRole(email: string): RoleHint {
  const e = email.trim().toLowerCase();
  if (e === ADMIN_EMAIL)   return "admin";
  if (e === TRAINER_EMAIL) return "trainer";
  return "student";
}

export default function Login() {
  const nav = useNavigate();
  const { student, setStudent, reset } = useSim();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [batch,    setBatch]    = useState("");
  const [password, setPassword] = useState("");
  const [err,      setErr]      = useState("");

  const role = detectRole(email);

  useEffect(() => {
    const simRole = localStorage.getItem("sim_role");
    if (simRole === "admin")   { nav("/admin",   { replace: true }); return; }
    if (simRole === "trainer") { nav("/trainer", { replace: true }); return; }
    if (student)               { nav("/dashboard", { replace: true }); }
  }, [student, nav]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (role === "admin") {
      if (password !== ADMIN_PASS) { setErr("Incorrect admin password"); return; }
      localStorage.setItem("sim_role", "admin");
      nav("/admin");
      return;
    }

    if (role === "trainer") {
      if (password !== TRAINER_PASS) { setErr("Incorrect trainer password"); return; }
      localStorage.setItem("sim_role", "trainer");
      nav("/trainer");
      return;
    }

    // Student
    if (!name.trim() || !email.trim() || !batch.trim()) {
      setErr("Please fill in your name, email, and batch code");
      return;
    }
    localStorage.setItem("sim_role", "student");
    setStudent({ name: name.trim(), email: email.trim().toLowerCase(), batch: batch.trim() });
    nav("/dashboard");
  };

  // ── Role badge shown above card ────────────────────────────────────────────
  const roleMeta = {
    student: { icon: <Zap className="h-5 w-5 text-primary-foreground" />,         bg: "bg-primary",      label: "Student",        hint: "Enter Simulator" },
    trainer: { icon: <GraduationCap className="h-5 w-5 text-white" />,            bg: "bg-emerald-600",  label: "Trainer",        hint: "Open Trainer Dashboard" },
    admin:   { icon: <ShieldCheck className="h-5 w-5 text-white" />,              bg: "bg-amber-500",    label: "Administrator",  hint: "Open Admin Panel" },
  }[role];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`h-9 w-9 rounded-lg ${roleMeta.bg} flex items-center justify-center transition-colors`}>
            {roleMeta.icon}
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Blinkit Brand Central</h1>
            <p className="text-xs text-muted-foreground">QCommerce Campaign Simulator</p>
          </div>
          {role !== "student" && (
            <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${roleMeta.bg}`}>
              {roleMeta.label}
            </span>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Student-only fields */}
          {role === "student" && (
            <>
              <div>
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Riya Sharma" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Batch Code</label>
                <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="MKT-24" className="mt-1" />
              </div>
            </>
          )}

          {/* Email — always shown */}
          <div>
            <label className="text-xs font-semibold text-foreground">Email ID</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(""); }}
              placeholder="you@kraftshala.com"
              className="mt-1"
            />
          </div>

          {/* Password — trainer & admin only */}
          {role !== "student" && (
            <div>
              <label className="text-xs font-semibold text-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
                autoComplete="current-password"
              />
            </div>
          )}

          {err && <p className="text-xs text-destructive">{err}</p>}

          <Button type="submit" className={`w-full text-white ${role !== "student" ? roleMeta.bg + " hover:opacity-90 border-0" : ""}`}>
            {roleMeta.hint}
          </Button>

          {/* Quick-access divider */}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-[11px]">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={() => {
            localStorage.setItem("sim_role", "student");
            setStudent({ name: "Prerna", email: "alumni@kraftshala.com", batch: "MASTER" });
            nav("/dashboard");
          }}>
            ⚡ Master Access
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            Trainer? <span className="font-mono">{TRAINER_EMAIL}</span>
            {" · "}Admin? <span className="font-mono">{ADMIN_EMAIL}</span>
          </p>
        </form>
      </Card>
    </div>
  );
}
