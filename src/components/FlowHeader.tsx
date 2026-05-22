import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Home, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { useSim } from "@/context/SimContext";

const FLOW = [
  { key: "brief", label: "Brief", path: "/brief" },
  { key: "cm-pitch", label: "CM Pitch", path: "/cm-pitch" },
  { key: "campaign", label: "Campaigns", path: "/campaign" },
  { key: "simulation", label: "Simulation", path: "/simulation" },
  { key: "results", label: "Results", path: "/results" },
];

interface FlowHeaderProps {
  crumb: string;
  step: "brief" | "cm-pitch" | "campaign" | "simulation" | "results";
  backTo?: string;
  backLabel?: string;
}

export function FlowHeader({ crumb, step, backTo, backLabel }: FlowHeaderProps) {
  const nav = useNavigate();
  const loc = useLocation();
  const { mode, reviewRunId, runHistory, exitReview } = useSim();
  const reviewEntry = reviewRunId ? runHistory.find((r) => r.id === reviewRunId) : null;
  const currentIdx = FLOW.findIndex((s) => s.key === step);

  return (
    <div className="border-b border-border bg-card/50">
      {mode === "review" && reviewEntry && (
        <div className="px-8 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-900">
            <Eye className="h-3.5 w-3.5" />
            <span>
              Reviewing past run · <strong>{reviewEntry.brandEmoji} {reviewEntry.brandName}</strong>
              {reviewEntry.score != null && <> · Score {reviewEntry.score}/100</>}
              {reviewEntry.achievementPct != null && <> · {reviewEntry.achievementPct}% goal</>}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-900 hover:bg-amber-100 gap-1"
            onClick={() => { exitReview(); nav("/dashboard"); }}>
            <X className="h-3.5 w-3.5" /> Exit review
          </Button>
        </div>
      )}
      {/* Top strip: breadcrumb + actions */}
      <div className="px-8 pt-3 pb-2 flex items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">Brand Central › {crumb}</div>
        <div className="flex items-center gap-1">
          {backTo && step !== "simulation" && step !== "results" && (
            <Button variant="ghost" size="sm" onClick={() => nav(backTo)} className="gap-1 h-7 px-2">
              <ChevronLeft className="h-3.5 w-3.5" /> {backLabel ?? "Back"}
            </Button>
          )}
          {step !== "simulation" && (
            <Button variant="ghost" size="sm" onClick={() => nav("/dashboard")} className="gap-1 h-7 px-2">
              <Home className="h-3.5 w-3.5" /> Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      <div className="px-8 pb-3 pt-1 flex items-center gap-1 overflow-x-auto">
        {FLOW.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => done && nav(s.path)}
                disabled={!done}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : done
                    ? "text-foreground hover:bg-muted cursor-pointer"
                    : "text-muted-foreground/60"
                }`}
              >
                <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${
                  done ? "bg-primary text-primary-foreground" :
                  active ? "border-2 border-primary text-primary" :
                  "border border-muted-foreground/40"
                }`}>
                  {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                <span>{s.label}</span>
              </button>
              {i < FLOW.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
