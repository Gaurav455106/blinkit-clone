import { FLOW_STEPS, flowStepOfPath, stepDone, stepLock, type FlowStepKey } from "@/lib/flowSteps";
import { useFlowProgress } from "@/lib/useFlowProgress";
import {
  Home, FileText, MessageSquare, LayoutGrid, Trophy,
  BarChart3, LogOut, ChevronRight, Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, useLocation } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { relationshipTier, CmRelationshipTier } from "@/lib/cmPitchLogic";
import { sidebarRelationship } from "@/market/liveRun";
import { signOutOfServer } from "@/lib/session";

// ── Nav items ──────────────────────────────────────────────────────────────────
const STEP_ICONS: Record<FlowStepKey, typeof Home> = { brief: FileText, deal: MessageSquare, live: LayoutGrid, results: Trophy };

const HOME_ITEMS: NavItem[] = [
  { title: "Dashboard",   icon: Home,     path: "/dashboard", step: null },
  { title: "Leaderboard", icon: BarChart3, path: "/leaderboard", step: null },
];

interface NavItem { title: string; icon: typeof Home; path: string; step: number | null; key?: FlowStepKey }

const FLOW_ITEMS: NavItem[] = [
  { title: "Dashboard",    icon: Home,          path: "/dashboard",   step: null },
  // Names and order come from the shared flow (lib/flowSteps.ts)
  ...FLOW_STEPS.map((s, i) => ({ title: s.label, icon: STEP_ICONS[s.key], path: s.path, step: i + 1, key: s.key })),
  { title: "Leaderboard",  icon: BarChart3,      path: "/leaderboard", step: null },
];

// ── CM tier config ─────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<CmRelationshipTier, {
  label: string; color: string; bar: string; bg: string; dot: string;
}> = {
  trusted:  { label: "Trusted",  color: "text-emerald-600", bar: "bg-emerald-500", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  neutral:  { label: "Neutral",  color: "text-blue-600",    bar: "bg-blue-500",    bg: "bg-blue-50",    dot: "bg-blue-400"   },
  strained: { label: "Strained", color: "text-amber-600",   bar: "bg-amber-400",   bg: "bg-amber-50",   dot: "bg-amber-400"  },
  broken:   { label: "Broken",   color: "text-red-600",     bar: "bg-red-500",     bg: "bg-red-50",     dot: "bg-red-500"    },
};


export function BlinkitSidebar({ highlightCm = false }: { highlightCm?: boolean }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { student, reset, mode, cmPitch, cmRelationship: pitchRelationship, liveCmRelationship, activeRunId, runHistory } = useSim();
  // During a v2 run the meter moves with Rohit's replies and kept promises
  const cmRelationship = sidebarRelationship(liveCmRelationship, pitchRelationship);

  // Locks and ticks come from what the student has really done (lib/flowSteps.ts)
  const progress = useFlowProgress();
  function isStepLocked(path: string): { locked: boolean; reason: string } {
    const key = flowStepOfPath(path);
    const reason = key ? stepLock(key, progress) : null;
    return { locked: reason !== null, reason: reason ?? "" };
  }

  const onCmPitchPage = loc.pathname === "/cm-pitch";
  const isHomeRoute   = loc.pathname === "/dashboard" || loc.pathname === "/leaderboard";
  const navItems      = isHomeRoute || mode === "home" ? HOME_ITEMS : FLOW_ITEMS;

  const currentKey = flowStepOfPath(loc.pathname);
  const currentStepIdx = FLOW_STEPS.findIndex((s) => s.key === currentKey);

  const signOut = () => {
    localStorage.removeItem("sim_trainer");
    void signOutOfServer();
    reset();
    nav("/", { replace: true });
  };

  // ── CM meter ───────────────────────────────────────────────────────────────
  const showCm  = cmPitch || onCmPitchPage;
  const tier    = cmPitch ? relationshipTier(cmRelationship) : "neutral";
  const cmCfg   = TIER_CONFIG[tier];
  const isPending = !cmPitch;

  const panel = (
    <div className="flex flex-col bg-white h-full">

      {/* ── Logo / Brand ── */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        {/* Blinkit yellow pill logo mark */}
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#F8CB2E] shrink-0">
          <span className="text-[#1a1a1a] font-black text-sm leading-none">b</span>
        </div>
        <div>
          <div className="text-sm font-bold text-foreground leading-tight">blinkit</div>
          <div className="text-[10px] text-muted-foreground leading-tight">Ads Manager</div>
        </div>
      </div>

      {/* ── Flow progress strip (only on flow pages) ── */}
      {!isHomeRoute && mode !== "home" && currentStepIdx >= 0 && (
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-0.5 mb-1">
            {FLOW_STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i !== currentStepIdx && stepDone(s.key, progress) ? "bg-green-500" :
                  i === currentStepIdx ? "bg-green-400" :
                  "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground">
            Step {currentStepIdx + 1} of {FLOW_STEPS.length}
          </p>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav data-tour="sidebar-nav" className="flex-1 min-h-0 py-3 space-y-0.5 overflow-y-auto">
        {/* Section label for flow items */}
        {!isHomeRoute && mode !== "home" && (
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest px-4 pb-1">
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const itemPath = item.path;
          const active = loc.pathname === itemPath;
          const { locked, reason } = isStepLocked(itemPath);
          return (
            <button
              key={item.path}
              onClick={locked ? undefined : () => nav(itemPath)}
              disabled={locked}
              title={locked ? reason : undefined}
              aria-label={locked ? `${item.title}. Locked: ${reason}` : undefined}
              className={`w-full group flex items-center gap-3 px-4 py-2.5 text-sm transition-all rounded-none relative ${
                locked
                  ? "opacity-40 cursor-not-allowed text-slate-400"
                  : active
                    ? "bg-green-50 text-green-800 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {/* Active indicator bar */}
              {active && !locked && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-green-600 rounded-r-full" />
              )}

              {/* Step badge for flow items */}
              {"step" in item && typeof item.step === "number" ? (
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border transition-all ${
                  locked
                    ? "bg-transparent text-slate-300 border-slate-200"
                    : active
                      ? "bg-green-600 text-white border-green-600"
                      : item.key && stepDone(item.key, progress)
                        ? "bg-green-100 text-green-700 border-green-300"
                        : "bg-transparent text-muted-foreground border-border"
                }`}>
                  {item.step}
                </span>
              ) : (
                <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-green-700" : "text-slate-400"}`} />
              )}

              <span className="flex-1 text-left">{item.title}</span>

              {active && !locked && (
                <ChevronRight className="h-3 w-3 text-green-600 shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── CM Relationship ── */}
      {showCm && (
        <div
          id="cm-relationship-section"
          className={`mx-3 mb-2 rounded-xl border px-3 py-2.5 transition-all ${
            highlightCm
              ? "ring-2 ring-primary bg-card z-[60] relative"
              : isPending
                ? "bg-slate-50 border-slate-200"
                : `${cmCfg.bg} border-transparent`
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              CM Relationship
            </span>
            <span className={`text-[10px] font-bold ${isPending ? "text-muted-foreground" : cmCfg.color}`}>
              {isPending ? "Pending" : cmCfg.label}
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isPending ? "bg-slate-300" : cmCfg.bar}`}
              style={{ width: isPending ? "0%" : `${cmRelationship}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[9px] text-muted-foreground">Score</span>
            <span className={`text-[10px] font-semibold ${isPending ? "text-muted-foreground" : cmCfg.color}`}>
              {isPending ? "—" : `${cmRelationship}/100`}
            </span>
          </div>
        </div>
      )}

      {/* ── Sign out ── */}
      <div className="border-t border-border">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-slate-600">
              {student?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-xs font-medium text-foreground truncate">
              {student?.name ?? "Student"}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <LogOut className="h-2.5 w-2.5" /> Sign out
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Phones: a slim top bar; the same navigation opens in a sheet */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F8CB2E]">
            <span className="text-xs font-black leading-none text-[#1a1a1a]">b</span>
          </div>
          <span className="text-sm font-bold text-foreground">blinkit</span>
          {currentStepIdx >= 0 && <span className="text-xs text-muted-foreground">Step {currentStepIdx + 1} of {FLOW_STEPS.length}</span>}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" aria-label="Open menu" className="rounded-md p-2 text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      </div>
      {/* Laptops and up: the sidebar column */}
      <div className="hidden h-full w-56 shrink-0 border-r border-border shadow-sm md:block">{panel}</div>
    </>
  );
}
