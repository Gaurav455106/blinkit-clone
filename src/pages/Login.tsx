import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSim } from "@/context/SimContext";
import { Zap } from "lucide-react";

export default function Login() {
  const nav = useNavigate();
  const { student, setStudent, reset } = useSim();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [batch, setBatch] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (localStorage.getItem("sim_trainer") === "1") {
      nav("/trainer", { replace: true });
    } else if (student) {
      nav("/brief", { replace: true });
    }
  }, [student, nav]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (email.trim().toLowerCase() === "trainer@kraftshala.com") {
      if (password !== "kraft2024") { setErr("Incorrect trainer password"); return; }
      localStorage.setItem("sim_trainer", "1");
      nav("/trainer");
      return;
    }
    if (!name.trim() || !email.trim() || !batch.trim()) {
      setErr("Please fill name, email and batch code");
      return;
    }
    setStudent({ name: name.trim(), email: email.trim().toLowerCase(), batch: batch.trim() });
    nav("/brief");
  };

  const isTrainer = email.trim().toLowerCase() === "trainer@kraftshala.com";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Blinkit Brand Central</h1>
            <p className="text-xs text-muted-foreground">QCommerce Campaign Simulator</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {!isTrainer && (
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
          <div>
            <label className="text-xs font-semibold text-foreground">Email ID</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kraftshala.com" className="mt-1" />
          </div>
          {isTrainer && (
            <div>
              <label className="text-xs font-semibold text-foreground">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
            </div>
          )}
          {err && <p className="text-xs text-destructive">{err}</p>}
          <Button type="submit" className="w-full">
            {isTrainer ? "Open Trainer Dashboard" : "Enter Simulator"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Trainer? Use <span className="font-mono">trainer@kraftshala.com</span>
          </p>
        </form>
      </Card>
    </div>
  );
}
