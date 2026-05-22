import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Rocket, Trash2, Pencil, Loader2 } from "lucide-react";
import { buildInitialStock } from "@/lib/weeklyMetrics";
import { ArchitectureCard } from "@/components/ArchitectureCard";

export default function CampaignsDashboard() {
  const nav = useNavigate();
  const { student, scenario, campaigns, deleteCampaign, tokensRemaining, initSimulation, startRun, activeRunId } = useSim();
  const [showLaunch, setShowLaunch] = useState(false);
  const [launching, setLaunching] = useState(false);

  if (!student || !scenario) { nav("/"); return null; }

  const totalAllocated = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const remaining = scenario.budget - totalAllocated;
  const launchDisabled = campaigns.length === 0 || totalAllocated < scenario.budget;
  const launchReason = campaigns.length === 0
    ? "Create at least one campaign before launching."
    : totalAllocated < scenario.budget
    ? `Allocate the full ₹${scenario.budget.toLocaleString("en-IN")} budget before launching (₹${remaining.toLocaleString("en-IN")} remaining).`
    : "";

  const startNew = () => {
    [
      "campaign_step", "campaign_name", "campaign_objective", "campaign_adAsset",
      "sim_selected_skus", "sim_selected_keywords", "sim_geography", "sim_budget_type", "sim_sku_strategy"
    ].forEach((k) => localStorage.removeItem(k));
    nav("/campaign");
  };

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        <div className="px-8 pt-6 pb-2 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Brand Central › My Campaigns</div>
            <h1 className="text-xl font-semibold text-foreground mt-1">My Campaigns</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Day 1 of 30 · Budget Remaining: ₹{remaining.toLocaleString("en-IN")} · Tokens: {tokensRemaining}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={startNew} className="gap-2">
              <Plus className="h-4 w-4" /> Create New Campaign
            </Button>
            <Button
              onClick={() => setShowLaunch(true)}
              disabled={launchDisabled}
              title={launchDisabled ? launchReason : ""}
              className="gap-2"
            >
              <Rocket className="h-4 w-4" /> Launch All Campaigns →
            </Button>
          </div>
        </div>

        <div className="px-8 py-6 max-w-6xl space-y-4">
          {campaigns.length > 0 && <ArchitectureCard />}
          {campaigns.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                You haven't created any campaigns yet. Click "Create New Campaign" to start.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3">Campaign Name</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Ad Format</th>
                    <th className="text-left px-4 py-3">Cities</th>
                    <th className="text-left px-4 py-3">SKUs</th>
                    <th className="text-right px-4 py-3">Budget</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 capitalize">{c.objective ?? "-"}</td>
                      <td className="px-4 py-3 text-xs">{c.adFormat ?? "-"}</td>
                      <td className="px-4 py-3 text-xs">{c.cities.length ? c.cities.join(", ") : "—"}</td>
                      <td className="px-4 py-3 text-xs">{c.skuIds.length}</td>
                      <td className="px-4 py-3 text-right">₹{c.budget.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => nav("/campaign")} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteCampaign(c.id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {launchDisabled && (
            <p className="text-xs text-muted-foreground mt-3">{launchReason}</p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Allocated</div>
              <div className="text-lg font-semibold">₹{totalAllocated.toLocaleString("en-IN")}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="text-lg font-semibold">₹{remaining.toLocaleString("en-IN")}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Tokens</div>
              <div className="text-lg font-semibold">{tokensRemaining}</div>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showLaunch} onOpenChange={setShowLaunch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⏰ Launch Campaigns?</DialogTitle>
          </DialogHeader>
          {launching ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="font-semibold">Simulating Week 1 (Days 1-7)...</div>
              <div className="text-xs text-muted-foreground">Your campaigns are running. Pulling performance data...</div>
            </div>
          ) : (
            <>
              <p className="text-sm">
                Launching campaigns. You'll review Week 1 performance and make optimization decisions
                each week (Day 7, 14, 21) before the final Day 30 results.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowLaunch(false)}>Cancel</Button>
                <Button onClick={() => {
                  setLaunching(true);
                  if (scenario) initSimulation(buildInitialStock(scenario));
                  setTimeout(() => { setLaunching(false); setShowLaunch(false); nav("/run-results?day=7"); }, 2000);
                }}>Launch & Simulate</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
