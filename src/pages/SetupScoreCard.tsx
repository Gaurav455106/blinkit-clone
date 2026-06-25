import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSim } from "@/context/SimContext";
import { scoreSetup } from "@/lib/newScoring";
import type { SetupScore } from "@/lib/newScoring";
import { buildInitialStock } from "@/lib/weeklyMetrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, Rocket, ChevronRight, Info,
  Tv2, BookOpen, Zap, Clock, Timer, ChevronDown,
} from "lucide-react";

// ── Mode picker ──────────────────────────────────────────────────────────────

const PACE_OPTIONS = [
  {
    key: "very_fast" as const,
    icon: Zap,
    label: "Very Fast",
    sub: "1 day = 5 min",
    detail: "120 days in ~10 hrs — best for demos & quick reviews",
  },
  {
    key: "normal" as const,
    icon: Clock,
    label: "Normal",
    sub: "1 day = 10 min",
    detail: "120 days in ~20 hrs — good for 2–3 day assignments",
  },
  {
    key: "slow" as const,
    icon: Timer,
    label: "Slow",
    sub: "1 day = 30 min",
    detail: "120 days in ~2.5 days — ideal for week-long projects",
  },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBar({ earned, max, good }: { earned: number; max: number; good: boolean }) {
  const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-1.5">
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          good ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ScoreLine({
  icon: Icon,
  label,
  earned,
  max,
  note,
  good,
}: {
  icon: typeof CheckCircle2;
  label: string;
  earned: number;
  max: number;
  note: string;
  good: boolean;
}) {
  return (
    <div className="flex gap-3 py-4 border-b border-border last:border-0">
      <div className="mt-0.5 shrink-0">
        <Icon
          className={`h-4 w-4 ${good ? "text-green-500" : earned > 0 ? "text-amber-500" : "text-red-400"}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className={`text-sm font-bold tabular-nums ${good ? "text-green-600" : "text-foreground"}`}>
            {earned}/{max}
          </span>
        </div>
        <ScoreBar earned={earned} max={max} good={good} />
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{note}</p>
      </div>
    </div>
  );
}

// ── Grade ring ────────────────────────────────────────────────────────────────

function GradeRing({ total, max }: { total: number; max: number }) {
  const pct = max > 0 ? (total / max) * 100 : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const color =
    pct >= 80 ? "#22c55e" :
    pct >= 60 ? "#3b82f6" :
    pct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
      <circle cx="56" cy="56" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
      <circle
        cx="56" cy="56" r={r}
        fill="none"
        strokeWidth="8"
        stroke={color}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
    </svg>
  );
}

// ── Grade label ───────────────────────────────────────────────────────────────

function gradeInfo(total: number, max: number) {
  const pct = max > 0 ? (total / max) * 100 : 0;
  if (pct >= 85) return { emoji: "🏆", label: "Excellent Setup", color: "text-green-600" };
  if (pct >= 70) return { emoji: "🎯", label: "Good Setup",      color: "text-blue-600"  };
  if (pct >= 50) return { emoji: "📈", label: "Needs Work",      color: "text-amber-600" };
  return              { emoji: "📚", label: "Weak Setup",        color: "text-red-500"   };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SetupScoreCard() {
  const nav = useNavigate();
  const {
    student, scenario, campaigns, cmPitch,
    setupScore: storedScore, setSetupScore,
    initSimulation, startRun, activeRunId,
    simMode, assignmentPace, setSimMode, setAssignmentPace,
  } = useSim();

  const [launching, setLaunching] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  // Guard
  useEffect(() => {
    if (!student) nav("/", { replace: true });
    else if (!scenario) nav("/brief", { replace: true });
    else if (!cmPitch) nav("/cm-pitch", { replace: true });
  }, [student, scenario, cmPitch, nav]);

  // Compute score if not already stored
  const [score, setScore] = useState<SetupScore | null>(storedScore);

  useEffect(() => {
    if (!scenario || !campaigns.length) return;
    const computed = scoreSetup(scenario, campaigns.filter(c => !c.isDraft));
    setScore(computed);
    setSetupScore(computed);
    // Animate in after a short delay
    setTimeout(() => setRevealed(true), 150);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (storedScore && !revealed) {
      setScore(storedScore);
      setTimeout(() => setRevealed(true), 150);
    }
  }, [storedScore]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student || !scenario || !cmPitch) return null;

  const grade = score ? gradeInfo(score.total, score.maxTotal) : null;

  const handleLaunch = () => {
    setLaunching(true);
    const stock = buildInitialStock(scenario);
    initSimulation(stock);
    if (!activeRunId) startRun();
    setTimeout(() => {
      nav("/simulation");
    }, 900);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      {/* ── Brand header ── */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{scenario.profile.emoji}</span>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {scenario.profile.category}
          </div>
          <div className="text-lg font-bold text-foreground">{scenario.profile.name}</div>
        </div>
      </div>

      {/* ── Score card ── */}
      <Card
        className={`w-full max-w-lg shadow-lg transition-all duration-500 ${
          revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-border rounded-t-lg px-6 py-5 flex items-center gap-5">
          {/* Ring */}
          <div className="relative shrink-0">
            <GradeRing total={score?.total ?? 0} max={35} />
            <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90 translate-y-1">
              <span className="text-2xl font-black text-foreground leading-none">
                {score?.total ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">/ 35</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm font-bold text-amber-800 uppercase tracking-wide">
                Setup Score
              </span>
              <span className="text-xs text-muted-foreground bg-white/60 border border-amber-200 rounded px-1.5 py-0.5">
                35 pts
              </span>
            </div>
            {grade && (
              <div className={`text-lg font-bold ${grade.color}`}>
                {grade.emoji} {grade.label}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              This reflects your campaign setup before going live. You'll earn the remaining 65 pts during the run.
            </p>
          </div>
        </div>

        {/* Score lines */}
        <div className="px-6 py-2">
          {score?.lines.map((line) => (
            <ScoreLine
              key={line.key}
              icon={line.good ? CheckCircle2 : line.earned > 0 ? Info : XCircle}
              label={line.label}
              earned={line.earned}
              max={line.max}
              note={line.note}
              good={line.good}
            />
          ))}
          {!score && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Computing score…
            </div>
          )}
        </div>

        {/* Remaining score breakdown hint */}
        <div className="mx-6 mb-4 rounded-lg bg-muted/40 border border-border px-4 py-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Remaining 65 pts earned during simulation
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Live Optimisation", pts: 25 },
              { label: "Crisis Responses",  pts: 25 },
              { label: "Results",           pts: 15 },
            ].map(({ label, pts }) => (
              <div key={label} className="rounded-md bg-background border border-border py-2 px-1">
                <div className="text-base font-black text-foreground">{pts}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mode picker ── */}
        <div className="px-6 pb-4">
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Assignment mode (default) */}
            <button
              onClick={() => setSimMode("assignment")}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                simMode === "assignment" ? "bg-primary/5 border-b border-primary/20" : "bg-muted/20 border-b border-border hover:bg-muted/40"
              }`}
            >
              <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                simMode === "assignment" ? "border-primary" : "border-muted-foreground/40"
              }`}>
                {simMode === "assignment" && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold">Assignment Mode</span>
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Recommended</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Runs in real time — advances even when you're logged out. Crises auto-resolve if you don't respond in time.
                </p>
                {/* Pace selector */}
                {simMode === "assignment" && (
                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    {PACE_OPTIONS.map(({ key, icon: Icon, label, sub, detail }) => (
                      <button
                        key={key}
                        onClick={(e) => { e.stopPropagation(); setAssignmentPace(key); }}
                        title={detail}
                        className={`rounded-md border p-2 text-left transition-all ${
                          assignmentPace === key
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-muted-foreground/40"
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 mb-1 ${assignmentPace === key ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="text-[11px] font-semibold">{label}</div>
                        <div className="text-[10px] text-muted-foreground">{sub}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </button>

            {/* Demo mode — collapsed under Advanced */}
            <div>
              <button
                onClick={() => setShowDemo((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Tv2 className="h-3.5 w-3.5" />
                <span>Demo / Trainer mode</span>
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${showDemo ? "rotate-180" : ""}`} />
              </button>
              {showDemo && (
                <button
                  onClick={() => setSimMode("demo")}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    simMode === "demo" ? "bg-amber-50/60" : "hover:bg-muted/30"
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    simMode === "demo" ? "border-amber-500" : "border-muted-foreground/40"
                  }`}>
                    {simMode === "demo" && <div className="h-2 w-2 rounded-full bg-amber-500" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Tv2 className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-sm font-semibold">Demo Mode</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      In-app speed controls (2–8s per day). Jump to any day instantly. Best for live classroom presentations.
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <Button
            onClick={handleLaunch}
            disabled={launching}
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white h-11 text-base font-semibold"
          >
            {launching ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Launching simulation…
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Launch Simulation
                <ChevronRight className="h-4 w-4 ml-auto" />
              </>
            )}
          </Button>
          <button
            onClick={() => nav("/campaign")}
            className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            ← Go back and adjust campaigns
          </button>
        </div>
      </Card>
    </div>
  );
}
