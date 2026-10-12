// Staff launcher for the student view: pick who to play as and which brand,
// then go straight into the simulation. "Back to console" in the student view
// returns here.

import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSim } from "@/context/SimContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { BRAND_PROFILES } from "@/data/scenarios";
import { enterStudentView, type StaffRole } from "@/lib/staffView";
import { cn } from "@/lib/utils";

const ANY_BRAND = "any";
const DEFAULT_BATCH = "MASTER";

interface StudentViewDialogProps {
  role: StaffRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BrandChipProps {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  icon?: ReactNode;
}

function BrandChip({ active, onClick, title, sub, icon }: BrandChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "sim-lift rounded-lg border px-3 py-2 text-left",
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">{icon}{title}</span>
      <span className="block text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}

export function StudentViewDialog({ role, open, onOpenChange }: StudentViewDialogProps) {
  const nav = useNavigate();
  const { setStudent, newScenario } = useSim();
  // Same keys as the master sign-in, so both remember one test identity.
  const [name, setName] = useLocalStorage("sim_master_test_name", "Prerna");
  const [email, setEmail] = useLocalStorage("sim_master_test_email", "alumni@kraftshala.com");
  const [batch, setBatch] = useLocalStorage("sim_master_test_batch", DEFAULT_BATCH);
  const [brand, setBrand] = useState(ANY_BRAND);

  const cleanEmail = email.trim().toLowerCase();
  const canLaunch = name.trim().length > 0 && /\S+@\S+\.\S+/.test(cleanEmail);

  const launch = () => {
    if (!canLaunch) return;
    enterStudentView(role);
    setStudent({ name: name.trim(), email: cleanEmail, batch: batch.trim() || DEFAULT_BATCH });
    // A picked brand starts a fresh brief; "Any" keeps this student's current one.
    if (brand !== ANY_BRAND) newScenario(brand);
    onOpenChange(false);
    nav("/dashboard");
  };

  const field = "space-y-1.5";
  const label = "text-xs font-medium text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sim-ui max-w-lg">
        <DialogHeader>
          <DialogTitle>Student view</DialogTitle>
          <DialogDescription>Play the simulation as a student. Runs save under this batch.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_1.6fr_0.8fr]">
          <div className={field}>
            <label htmlFor="sv-name" className={label}>Name</label>
            <Input id="sv-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className={field}>
            <label htmlFor="sv-email" className={label}>Email</label>
            <Input id="sv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className={field}>
            <label htmlFor="sv-batch" className={label}>Batch</label>
            <Input id="sv-batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <div>
          <p className={cn(label, "mb-2")}>Brand</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Brand">
            <BrandChip active={brand === ANY_BRAND} onClick={() => setBrand(ANY_BRAND)} title="Any" sub="Keep or random" icon={<Shuffle className="h-3.5 w-3.5" aria-hidden />} />
            {BRAND_PROFILES.map((p) => (
              <BrandChip key={p.id} active={brand === p.id} onClick={() => setBrand(p.id)} title={p.name} sub={p.category} />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={launch} disabled={!canLaunch} className="gap-2"><Play className="h-4 w-4" /> Launch simulation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
