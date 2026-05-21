import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export function ProductBoosterBudget() {
  const [budgetType, setBudgetType] = useLocalStorage<"overall" | "daily">("sim_budget_type", "overall");
  const [budgetValue, setBudgetValue] = useState("");

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Select a campaign budget</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select the budget strategy and specify this campaign's budget amount.
        </p>
      </div>

      {/* Overall campaign budget */}
      <div
        onClick={() => setBudgetType("overall")}
        className={`rounded-lg border p-5 cursor-pointer transition-colors ${
          budgetType === "overall" ? "border-primary" : "border-border"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            budgetType === "overall" ? "border-primary" : "border-muted-foreground"
          }`}>
            {budgetType === "overall" && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Overall campaign budget</h3>
              <p className="text-xs text-muted-foreground">
                Set an amount you want to spend on the entire campaign's lifetime
              </p>
            </div>

            {budgetType === "overall" && (
              <>
                <div className="relative w-56">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
                  <Input
                    value={budgetValue}
                    onChange={(e) => setBudgetValue(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Enter Budget Value"
                    className="pl-7 text-sm"
                  />
                </div>
                <p className="text-xs">
                  <span className="text-primary font-medium">This is the maximum you'll spend for the entire campaign.</span>
                  <span className="text-muted-foreground"> Spend may vary by day - more on high-performing days, less on others. It won't be split evenly.</span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Daily budget */}
      <div
        onClick={() => setBudgetType("daily")}
        className={`rounded-lg border p-5 cursor-pointer transition-colors ${
          budgetType === "daily" ? "border-primary" : "border-border"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            budgetType === "daily" ? "border-primary" : "border-muted-foreground"
          }`}>
            {budgetType === "daily" && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Daily budget <span className="text-muted-foreground font-normal">ⓘ</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Set an amount you want to spend on the campaign every day
            </p>

            {budgetType === "daily" && (
              <div className="relative w-56 mt-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
                <Input
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Enter Budget Value"
                  className="pl-7 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
