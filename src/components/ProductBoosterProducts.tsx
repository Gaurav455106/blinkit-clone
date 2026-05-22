import { useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";
import { Package } from "lucide-react";

interface ProductBoosterProductsProps {
  onProductsValid?: (valid: boolean) => void;
}

export function ProductBoosterProducts({ onProductsValid }: ProductBoosterProductsProps) {
  const { scenario, cmPitch } = useSim();
  const [selectedIds, setSelectedIds] = useLocalStorage<string[]>("sim_selected_skus", []);
  const [strategy, setStrategy] = useLocalStorage<"hero" | "top3" | "all" | null>("sim_sku_strategy", null);

  useEffect(() => { onProductsValid?.(selectedIds.length > 0); }, [selectedIds, onProductsValid]);

  if (!scenario) return null;
  const { profile } = scenario;
  const approvedIds = cmPitch?.approvedSKUs ?? profile.skus.map((s) => s.id);

  const toggle = (id: string) => {
    if (!approvedIds.includes(id)) return;
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setStrategy(null);
  };

  const approvedSkus = profile.skus.filter((s) => approvedIds.includes(s.id));
  const applyStrategy = (s: "hero" | "top3" | "all") => {
    setStrategy(s);
    if (s === "hero") setSelectedIds(approvedSkus.slice(0, 1).map((x) => x.id));
    else if (s === "top3") setSelectedIds(approvedSkus.slice(0, 3).map((x) => x.id));
    else setSelectedIds(approvedSkus.map((x) => x.id));
  };

  return (
    <div className="flex gap-6 max-w-6xl">
      <div className="flex-1 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Choose products for {profile.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Only your assigned brand's SKUs are eligible for this campaign
          </p>
        </div>

        {/* Quick strategy chips */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "hero", label: "Hero SKU only", desc: "Focus budget on the top performer" },
            { key: "top3", label: "Top 3 SKUs", desc: "Balanced spread across the catalogue" },
            { key: "all", label: "All SKUs", desc: "Maximum coverage" },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => applyStrategy(s.key)}
              className={`text-left p-3 rounded-lg border text-xs transition-colors flex-1 ${
                strategy === s.key ? "border-primary bg-accent" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="font-semibold text-foreground">{s.label}</div>
              <div className="text-muted-foreground">{s.desc}</div>
            </button>
          ))}
        </div>

        {/* SKU list */}
        <div className="space-y-2">
          {profile.skus.map((s) => {
            const sel = selectedIds.includes(s.id);
            const approved = approvedIds.includes(s.id);
            return (
              <Card
                key={s.id}
                onClick={() => toggle(s.id)}
                title={!approved ? "Not approved by Category Manager" : ""}
                className={`p-4 transition-all border-2 ${
                  !approved ? "border-border bg-muted/40 opacity-50 cursor-not-allowed" :
                  sel ? "border-primary bg-accent cursor-pointer" : "border-border cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={sel} disabled={!approved} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">MRP ₹{s.mrp} · Margin ₹{s.margin}</div>
                  </div>
                  {!approved && <span className="text-[10px] text-muted-foreground">Not CM-approved</span>}
                  <Badge variant="outline" className={
                    s.velocity === "High" ? "border-primary text-primary" :
                    s.velocity === "Medium" ? "border-orange-500 text-orange-600" :
                    "border-muted-foreground text-muted-foreground"
                  }>{s.velocity}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="w-[320px] shrink-0">
        <Card className="p-5 border-primary/30 bg-primary/5 min-h-[300px]">
          <h3 className="text-sm font-semibold text-foreground">Selected products</h3>
          <p className="text-xs text-muted-foreground mb-3">{selectedIds.length} of {profile.skus.length}</p>
          {selectedIds.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10">
              <Package className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Pick at least one SKU to continue</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {selectedIds.map((id) => {
                const s = profile.skus.find((x) => x.id === id);
                if (!s) return null;
                return <li key={id} className="text-xs text-foreground">• {s.name}</li>;
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
