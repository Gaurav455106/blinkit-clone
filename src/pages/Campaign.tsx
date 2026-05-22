import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSim } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
import { CampaignForm } from "@/components/CampaignForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Rocket, Trash2, Pencil, Loader2 } from "lucide-react";
import { buildInitialStock } from "@/lib/weeklyMetrics";
import { ArchitectureCard } from "@/components/ArchitectureCard";

export default function Campaign() {
  const nav = useNavigate();
  const { student, scenario, campaigns, deleteCampaign, tokensRemaining, initSimulation, startRun, activeRunId, cmPitch } = useSim();
  const [showLaunch, setShowLaunch] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showPartialConfirm, setShowPartialConfirm] = useState(false);

  useEffect(() => {
    if (!student) nav("/", { replace: true });
    else if (!scenario) nav("/brief", { replace: true });
    else if (!cmPitch) nav("/cm-pitch", { replace: true });
  }, [student, scenario, cmPitch, nav]);

  if (!student || !scenario || !cmPitch) return null;

  const totalAllocated = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const remaining = scenario.budget - totalAllocated;
  const launchDisabled = campaigns.length === 0;
  const partialBudget = totalAllocated < scenario.budget;

  const startNew = () => {
    [
      "campaign_step", "campaign_name", "campaign_objective", "campaign_adAsset",
      "sim_selected_skus", "sim_selected_keywords", "sim_geography", "sim_budget_type",
      "sim_sku_strategy", "sim_selected_cities", "sim_budget_value",
      "sim_dayparting", "sim_daypart_preset",
    ].forEach((k) => localStorage.removeItem(k));
    setShowCreate(true);
  };

  const doLaunch = () => {
    setLaunching(true);
    if (scenario) initSimulation(buildInitialStock(scenario));
    if (!activeRunId) startRun();
    setTimeout(() => {
      setLaunching(false);
      setShowLaunch(false);
      setShowPartialConfirm(false);
      nav("/simulation");
    }, 1200);
  };

  const onLaunchClick = () => {
    if (partialBudget) setShowPartialConfirm(true);
    else setShowLaunch(true);
  };

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        <FlowHeader crumb="Campaigns" step="campaign" backTo="/cm-pitch" backLabel="CM Pitch" />
        <div className="px-8 pt-4 pb-2">
          <h1 className="text-xl font-semibold text-foreground">My Campaigns</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Budget Remaining: ₹{remaining.toLocaleString("en-IN")} · Tokens: {tokensRemaining}
          </p>
        </div>

        <div className="px-8 py-6 max-w-6xl space-y-4">
          {campaigns.length > 0 && <ArchitectureCard />}

          {campaigns.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                You haven't created any campaigns. Click below to start.
              </p>
              <Button size="lg" onClick={startNew} className="gap-2">
                <Plus className="h-4 w-4" /> Create Your First Campaign
              </Button>
            </Card>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={startNew} className="gap-2">
                  <Plus className="h-4 w-4" /> Create New Campaign
                </Button>
                <Button onClick={onLaunchClick} disabled={launchDisabled} className="gap-2">
                  <Rocket className="h-4 w-4" /> Launch All Campaigns →
                </Button>
              </div>

              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left px-4 py-3">Campaign Name</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Ad Format</th>
                      <th className="text-left px-4 py-3">States</th>
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
                          <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)} title="Edit">
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
            </>
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <CampaignForm onDone={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Partial Budget Confirm */}
      <Dialog open={showPartialConfirm} onOpenChange={setShowPartialConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch with partial budget?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            You've allocated ₹{totalAllocated.toLocaleString("en-IN")} of ₹{scenario.budget.toLocaleString("en-IN")}.
            ₹{remaining.toLocaleString("en-IN")} will not be spent. Continue with launch?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowPartialConfirm(false)}>Cancel</Button>
            <Button onClick={doLaunch}>Launch with Partial Budget</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Launch Modal */}
      <Dialog open={showLaunch} onOpenChange={setShowLaunch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🚀 Launch Campaigns?</DialogTitle>
          </DialogHeader>
          {launching ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="font-semibold">Launching…</div>
              <div className="text-xs text-muted-foreground">Initializing live simulation…</div>
            </div>
          ) : (
            <>
              <p className="text-sm">
                Launching {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}. You'll see live data
                populate over 30 simulated days. Crisis events may pause the run for you to react.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowLaunch(false)}>Cancel</Button>
                <Button onClick={doLaunch}>Launch & Simulate</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
