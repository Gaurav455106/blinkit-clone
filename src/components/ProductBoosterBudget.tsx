import { Input } from "@/components/ui/input";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";

export function ProductBoosterBudget() {
  const { scenario, campaigns } = useSim();
  const [budgetType, setBudgetType] = useLocalStorage<"overall" | "daily">("sim_budget_type", "overall");
  const [budgetValue, setBudgetValue] = useLocalStorage<string>("sim_budget_value", "");

  const totalAllocated = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const totalBudget = scenario?.budget ?? 200000;
  const remaining = totalBudget - totalAllocated;
  const numericBudget = Number(budgetValue) || 0;
  const wouldExceed = numericBudget > remaining;

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-md bg-muted/50 border border-border p-3 text-xs space-y-1">
        <div>Total brand budget: <span className="font-semibold">₹{totalBudget.toLocaleString("en-IN")}</span></div>
        <div>Allocated across all campaigns so far: <span className="font-semibold">₹{totalAllocated.toLocaleString("en-IN")}</span></div>
        <div>Remaining: <span className={`font-semibold ${remaining <= 0 ? "text-destructive" : "text-primary"}`}>₹{remaining.toLocaleString("en-IN")}</span></div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground">Select a campaign budget</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Select the budget strategy and specify this campaign's budget amount.</p>
      </div>

      <div
        onClick={() => setBudgetType("overall")}
        className={`rounded-lg border p-5 cursor-pointer transition-colors ${budgetType === "overall" ? "border-primary" : "border-border"}`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${budgetType === "overall" ? "border-primary" : "border-muted-foreground"}`}>
            {budgetType === "overall" && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Overall campaign budget</h3>
              <p className="text-xs text-muted-foreground">Set an amount you want to spend on the entire campaign's lifetime</p>
            </div>
            {budgetType === "overall" && (
              <div className="relative w-56">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
                <Input value={budgetValue} onChange={(e) => setBudgetValue(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Enter Budget Value" className="pl-7 text-sm" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        onClick={() => setBudgetType("daily")}
        className={`rounded-lg border p-5 cursor-pointer transition-colors ${budgetType === "daily" ? "border-primary" : "border-border"}`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${budgetType === "daily" ? "border-primary" : "border-muted-foreground"}`}>
            {budgetType === "daily" && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Daily budget</h3>
            <p className="text-xs text-muted-foreground">Set an amount you want to spend on the campaign every day</p>
            {budgetType === "daily" && (
              <div className="relative w-56 mt-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
                <Input value={budgetValue} onChange={(e) => setBudgetValue(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Enter Budget Value" className="pl-7 text-sm" />
              </div>
            )}
          </div>
        </div>
      </div>

      {wouldExceed && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          This campaign's budget exceeds the remaining ₹{remaining.toLocaleString("en-IN")}. Reduce the amount before saving.
        </div>
      )}
    </div>
  );
}
