import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, AlertTriangle, ListOrdered } from "lucide-react";
import { useSim } from "@/context/SimContext";
import { detectArchitecture, optimalArchitecture, ARCH_NAMES, detectCannibalization, detectSequence } from "@/lib/phase3";

export function ArchitectureCard() {
  const { scenario, campaigns } = useSim();
  if (!scenario || campaigns.length === 0) return null;

  const detected = detectArchitecture(campaigns);
  const { optimal, alternative, reason } = optimalArchitecture(scenario, scenario.profile.id);
  const matched = detected === optimal;
  const acceptable = !matched && alternative === detected;

  const pairs = detectCannibalization(campaigns);
  const seq = detectSequence(campaigns);

  const tone =
    matched ? { ring: "border-primary/40 bg-primary/5", text: "text-primary", label: "✓ Optimal architecture" } :
    acceptable ? { ring: "border-amber-300 bg-amber-50", text: "text-amber-700", label: "△ Acceptable architecture" } :
    { ring: "border-destructive/30 bg-destructive/5", text: "text-destructive", label: "✗ Suboptimal architecture" };

  const seqLabel: Record<string, string> = {
    reach_then_perf: "Reach → Performance",
    perf_then_reach: "Performance → Reach",
    parallel: "Launched in parallel",
    perf_only: "Performance only",
    reach_only: "Reach only",
    none: "—",
  };

  return (
    <Card className={`p-4 border-l-4 ${tone.ring}`}>
      <div className="flex items-start gap-3">
        <Network className={`h-5 w-5 mt-0.5 ${tone.text}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">Campaign Architecture: {ARCH_NAMES[detected]}</span>
            <Badge variant="outline" className={`text-[10px] ${tone.text}`}>{tone.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Recommended for this scenario: <span className="font-medium text-foreground">{ARCH_NAMES[optimal]}</span>
            {alternative && <> (acceptable: <span className="font-medium text-foreground">{ARCH_NAMES[alternative]}</span>)</>}.
            {" "}{reason}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="flex items-center gap-2 text-xs">
              <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Launch sequence:</span>
              <span className="font-medium">{seqLabel[seq]}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className={`h-3.5 w-3.5 ${pairs.length ? "text-amber-600" : "text-muted-foreground"}`} />
              <span className="text-muted-foreground">Keyword overlaps:</span>
              <span className={`font-medium ${pairs.length ? "text-amber-700" : ""}`}>
                {pairs.length === 0 ? "None ✓" : `${pairs.length} pair${pairs.length > 1 ? "s" : ""} — resolve after launch`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
