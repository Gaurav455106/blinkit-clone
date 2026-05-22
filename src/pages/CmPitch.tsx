import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim, CmPitchResult } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BLINKIT_STATES, CityName } from "@/data/scenarios";
import { User, ArrowRight } from "lucide-react";

const REASONS = [
  "Proven high velocity offline",
  "Strategic loss leader for customer acquisition",
  "Premium SKU for brand image",
  "Cross-sell driver with hero SKU",
  "Inventory clearance priority",
];

interface PitchRow {
  enabled: boolean;
  cities: CityName[];
  reasoning: string;
  justification: string;
}

export default function CmPitch() {
  const nav = useNavigate();
  const { student, scenario, setCmPitch, consumeToken, tokensRemaining } = useSim();

  if (!student || !scenario) { nav("/"); return null; }
  const { profile, cityStockMap } = scenario;

  const [rows, setRows] = useState<Record<string, PitchRow>>(() => {
    const init: Record<string, PitchRow> = {};
    profile.skus.forEach((s) => init[s.id] = { enabled: false, cities: [], reasoning: "", justification: "" });
    return init;
  });
  const [result, setResult] = useState<CmPitchResult | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  const update = (id: string, patch: Partial<PitchRow>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const availableStates = BLINKIT_STATES;

  const evaluate = (): CmPitchResult => {
    const pitched = profile.skus.filter((s) => rows[s.id].enabled);
    const flags: string[] = [];

    pitched.forEach((s) => {
      const r = rows[s.id];
      if ((s.velocity === "Low" || s.velocity === "Very Low") && r.reasoning === "Proven high velocity offline") {
        flags.push(`${s.name}: claimed "high velocity offline" but data shows ${s.velocity} velocity`);
      }
      r.cities.forEach((c) => {
        if (cityStockMap[c] === 0) flags.push(`${s.name}: pitched in ${c} where you have NO stock`);
      });
      if (r.cities.length === 0) flags.push(`${s.name}: no states selected`);
      if (r.cities.length >= BLINKIT_STATES.length - 2) flags.push(`${s.name}: pitched to nearly every state — spreading too thin`);
      if (!r.reasoning) flags.push(`${s.name}: no reasoning provided`);
    });

    if (pitched.length === profile.skus.length && pitched.every((s) => rows[s.id].cities.length >= BLINKIT_STATES.length - 2)) {
      flags.push("Spreading thin — pitched every SKU in nearly every state");
    }
    if (pitched.length <= 1) flags.push("Too conservative — pitched 0 or 1 SKU");

    let status: CmPitchResult["status"];
    let pitchScore = 0;
    let osaBoost = false;
    let message = "";

    if (pitched.length === 0 || (flags.some((f) => f.includes("NO stock")) && flags.length >= 3)) {
      status = "rejected";
      message = `This doesn't make sense. ${flags[0] ?? "Re-pitch with better data."}`;
    } else if (flags.length === 0 && pitched.length >= 1 && pitched.length <= 2) {
      status = "strong";
      pitchScore = 15;
      osaBoost = true;
      message = "Excellent pitch. The reasoning is sound and you've picked the right cities. I'm giving you premium shelf placement and a 10% OSA boost in those cities.";
    } else if (flags.length >= 3) {
      status = "weak";
      pitchScore = 5;
      message = `I'm approving but I have concerns about: ${flags[0]}. Standard shelf, but I'll watch this closely.`;
    } else if (flags.length >= 1) {
      // velocity-mismatch only = decent vs weak distinction
      status = "decent";
      pitchScore = 10;
      message = "This works. Standard shelf placement approved.";
    } else {
      status = "decent";
      pitchScore = 10;
      message = "This works. Standard shelf placement approved.";
    }

    const approvedSKUs = status === "rejected" ? [] : pitched.map((s) => s.id);
    const approvedCities = status === "rejected"
      ? []
      : Array.from(new Set(pitched.flatMap((s) => rows[s.id].cities.filter((c) => cityStockMap[c] > 0))));

    return { status, approvedSKUs, approvedCities, pitchScore, osaBoost, message, flags };
  };

  const submit = () => {
    const r = evaluate();
    setResult(r);
    if (r.status === "rejected") setShowRetry(true);
  };

  const acceptDefault = () => {
    // Hero SKU only in city with highest OSA
    const hero = [...profile.skus].sort((a, b) => {
      const order = { High: 3, Medium: 2, Low: 1, "Very Low": 0 } as Record<string, number>;
      return order[b.velocity] - order[a.velocity];
    })[0];
    const topCity = (Object.keys(cityStockMap) as CityName[]).reduce((a, b) =>
      cityStockMap[a] > cityStockMap[b] ? a : b
    );
    const defaultResult: CmPitchResult = {
      status: "weak",
      approvedSKUs: [hero.id],
      approvedCities: [topCity],
      pitchScore: 0,
      osaBoost: false,
      message: "Default approval applied — hero SKU only in highest-OSA city.",
      flags: ["Accepted default after rejection"],
    };
    setCmPitch(defaultResult);
    setShowRetry(false);
    nav("/campaigns-dashboard");
  };

  const retryPitch = () => {
    consumeToken();
    setResult(null);
    setShowRetry(false);
  };

  const confirmContinue = () => {
    if (result) setCmPitch(result);
    nav("/campaigns-dashboard");
  };

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 bg-background overflow-y-auto">
        <div className="px-8 pt-6 pb-2">
          <div className="text-xs text-muted-foreground">Brand Central › Category Manager Meeting</div>
          <h1 className="text-xl font-semibold text-foreground mt-1">Pitch to Category Manager</h1>
        </div>

        <div className="px-8 py-6 max-w-5xl space-y-5">
          {/* CM character */}
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Rohit Sharma</span>
                  <Badge variant="outline" className="text-xs">Category Manager — {profile.category}</Badge>
                </div>
                <div className="mt-2 rounded-2xl rounded-tl-none bg-muted px-4 py-3 text-sm text-foreground max-w-2xl">
                  Hi {student.name}! I control shelf allocation for the {profile.category} category at Blinkit.
                  Tell me which SKUs you want pushed in which cities, and your reasoning. I'll approve or reject
                  based on the business case you make.
                </div>
              </div>
            </div>
          </Card>

          {/* Pitch form */}
          <div className="space-y-3">
            {profile.skus.map((s) => {
              const row = rows[s.id];
              return (
                <Card key={s.id} className={`p-4 ${row.enabled ? "border-primary" : ""}`}>
                  <div className="flex items-start gap-4">
                    <label className="flex items-center gap-2 cursor-pointer min-w-[120px] pt-1">
                      <Checkbox checked={row.enabled} onCheckedChange={(v) => update(s.id, { enabled: !!v })} />
                      <span className="text-sm font-medium">{row.enabled ? "Pitch this SKU" : "Skip"}</span>
                    </label>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground">MRP ₹{s.mrp} · Margin ₹{s.margin}</span>
                        <Badge variant="outline" className={
                          s.velocity === "High" ? "border-primary text-primary" :
                          s.velocity === "Medium" ? "border-orange-500 text-orange-600" :
                          "border-muted-foreground text-muted-foreground"
                        }>{s.velocity}</Badge>
                      </div>

                      {row.enabled && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium mb-1">Target states</div>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded border border-border">
                              {BLINKIT_STATES.map((c) => {
                                const selected = row.cities.includes(c as CityName);
                                return (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                      const next = selected ? row.cities.filter((x) => x !== c) : [...row.cities, c as CityName];
                                      update(s.id, { cities: next });
                                    }}
                                    className={`px-2 py-1 rounded border text-[11px] ${
                                      selected ? "border-primary bg-primary/10 text-primary" :
                                      "border-border hover:border-primary/40"
                                    }`}
                                  >
                                    {c}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium mb-1">Reasoning</div>
                            <Select value={row.reasoning} onValueChange={(v) => update(s.id, { reasoning: v })}>
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Select reasoning..." />
                              </SelectTrigger>
                              <SelectContent>
                                {REASONS.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              value={row.justification}
                              onChange={(e) => update(s.id, { justification: e.target.value })}
                              placeholder="Optional: 1-line justification"
                              className="mt-2 h-9 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" onClick={() => nav("/brief")}>Back to Brief</Button>
            <Button onClick={submit} className="gap-2">Submit Pitch to CM <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {/* Result modal */}
      <Dialog open={!!result && !showRetry} onOpenChange={() => { if (result) confirmContinue(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Rohit Sharma — CM Response
            </DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <Badge className={
                result.status === "strong" ? "bg-primary text-primary-foreground" :
                result.status === "decent" ? "bg-blue-500 text-white" :
                result.status === "weak" ? "bg-amber-500 text-white" :
                "bg-destructive text-destructive-foreground"
              }>{result.status.toUpperCase()} PITCH</Badge>
              <p className="text-sm text-foreground">{result.message}</p>
              <div className="text-xs">
                <div className="font-semibold">Approved SKUs:</div>
                <div className="text-muted-foreground">
                  {result.approvedSKUs.length === 0 ? "None" : result.approvedSKUs.map((id) => profile.skus.find((s) => s.id === id)?.name).join(", ")}
                </div>
                <div className="font-semibold mt-2">Approved States:</div>
                <div className="text-muted-foreground">{result.approvedCities.join(", ") || "None"}</div>
                {result.osaBoost && <div className="mt-2 text-primary font-semibold">+10% OSA boost in approved states</div>}
              </div>
              <Button className="w-full" onClick={confirmContinue}>Continue to Brand Central →</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Retry modal */}
      <Dialog open={showRetry} onOpenChange={setShowRetry}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pitch Rejected</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{result?.message}</p>
          <div className="text-xs text-muted-foreground">
            Tokens remaining: <span className="font-semibold text-foreground">{tokensRemaining}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={acceptDefault}>Accept Default Approval</Button>
            <Button onClick={retryPitch} disabled={tokensRemaining <= 0}>Retry Pitch (costs 1 token)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
