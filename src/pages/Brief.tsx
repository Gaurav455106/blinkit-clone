import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { ArrowRight } from "lucide-react";

export default function Brief() {
  const nav = useNavigate();
  const { student, scenario } = useSim();
  const [ack, setAck] = useState(false);

  if (!student || !scenario) {
    nav("/");
    return null;
  }
  const { profile, city, season, inventory, market, budget } = scenario;

  const tone = {
    critical: "text-destructive bg-destructive/10",
    warning: "text-orange-600 bg-orange-100",
    healthy: "text-primary bg-primary/10",
    overstocked: "text-blue-600 bg-blue-100",
  }[inventory.tone];

  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <div className="flex-1 flex flex-col bg-background">
        <div className="px-8 pt-6 pb-2">
          <div className="text-xs text-muted-foreground">Brand Central › Client Brief</div>
          <h1 className="text-xl font-semibold text-foreground mt-1">Your Brand Brief</h1>
          <p className="text-xs text-muted-foreground">Hi {student.name} — here's the client you're running this campaign for.</p>
        </div>

        <div className="flex-1 px-8 py-6 overflow-y-auto space-y-5 max-w-5xl">
          {/* Hero brand card */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-accent flex items-center justify-center text-3xl">
                  {profile.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
                    <Badge variant="outline">{profile.category}</Badge>
                    <Badge className={
                      profile.difficulty === "Medium" ? "bg-primary text-primary-foreground" :
                      profile.difficulty === "Hard" ? "bg-orange-500 text-white" :
                      "bg-destructive text-destructive-foreground"
                    }>{profile.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{profile.context}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Campaign Budget</div>
                <div className="text-2xl font-bold text-primary">₹{budget.toLocaleString("en-IN")}</div>
              </div>
            </div>
          </Card>

          {/* Context cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">City</div>
              <div className="text-base font-semibold text-foreground mt-1">{city}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Primary launch market</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Season</div>
              <div className="text-base font-semibold text-foreground mt-1">{season.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{season.note}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Market Condition</div>
              <div className="text-base font-semibold text-foreground mt-1">{market.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{market.note}</div>
            </Card>
          </div>

          {/* Inventory */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Inventory Snapshot</h3>
              <span className={`text-xs font-medium px-2 py-1 rounded ${tone}`}>{inventory.label}</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Stat label="OSA %" value={`${inventory.osa}%`} bad={inventory.osa < 70} />
              <Stat label="Fill Rate %" value={`${inventory.fillRate}%`} bad={inventory.fillRate < 75} />
              <Stat label="Active Dark Stores" value={String(inventory.activeStores)} bad={inventory.activeStores < 30} />
              <Stat label="Aging Units" value={String(inventory.agingUnits)} bad={inventory.agingUnits > 800} />
            </div>
          </Card>

          {/* SKU portfolio */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">SKU Portfolio</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2">Product</th>
                    <th className="text-right py-2">MRP</th>
                    <th className="text-right py-2">Margin</th>
                    <th className="text-right py-2">Velocity</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.skus.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-foreground">{s.name}</td>
                      <td className="py-2 text-right">₹{s.mrp}</td>
                      <td className="py-2 text-right">₹{s.margin}</td>
                      <td className="py-2 text-right">{s.velocity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">{profile.unitEconomics}</p>
          </Card>

          {/* Ack & continue */}
          <Card className="p-5 flex items-center justify-between bg-accent">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={ack} onCheckedChange={(v) => setAck(!!v)} />
              <span className="text-sm font-medium text-foreground">I have read the brief and understand the brand context.</span>
            </label>
            <Button disabled={!ack} onClick={() => nav("/campaign")} className="gap-2">
              Start Campaign <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${bad ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
