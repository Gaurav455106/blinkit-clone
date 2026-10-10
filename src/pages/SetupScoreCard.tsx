import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useSim } from "@/context/SimContext";
import { scoreSetup, SCORE_MAX } from "@/lib/newScoring";
import type { SetupScore, ScoreLine } from "@/lib/newScoring";
import { buildInitialStock } from "@/lib/weeklyMetrics";
import { plainText } from "@/lib/briefData";
import { SimPage, PageHeader, Section, ScoreBar, Tag } from "@/components/sim/primitives";
import { scoreTone, type Tone } from "@/components/sim/tone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Mode picker ──────────────────────────────────────────────────────────────

const PACE_OPTIONS = [
  { key: "very_fast" as const, label: "Very fast", sub: "1 day = 5 min", detail: "The whole run takes a few hours. Best for demos." },
  { key: "normal" as const, label: "Normal", sub: "1 day = 10 min", detail: "Good for an assignment over 2 or 3 days." },
  { key: "slow" as const, label: "Slow", sub: "1 day = 30 min", detail: "Good for a week-long project." },
] as const;

/** Points still to earn after setup, in the order they come. */
const LATER_PARTS = [
  { label: "Changes during the run", pts: SCORE_MAX.liveOpt },
  { label: "Handling surprises", pts: SCORE_MAX.crisis },
  { label: "Final results", pts: SCORE_MAX.results },
] as const;

const REVEAL_DELAY_MS = 150;
const LAUNCH_DELAY_MS = 900;

// ── Helpers ──────────────────────────────────────────────────────────────────

const GRADE_LABEL: Record<Tone, string> = {
  good: "Strong setup",
  warn: "Some fixes needed",
  bad: "Weak setup",
  neutral: "Not scored yet",
};

function ScoreLineRow({ line }: { line: ScoreLine }) {
  const tone = scoreTone(line.earned, line.max);
  return (
    <li className="grid gap-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-6">
      <div className="flex items-center justify-between gap-2 md:block">
        <p className="text-sm font-medium text-foreground">{line.label}</p>
        <div className="md:mt-1"><Tag tone={tone}>{tone === "good" ? "Good" : tone === "warn" ? "Partly right" : "Missed"}</Tag></div>
      </div>
      <div>
        <ScoreBar earned={line.earned} max={line.max} label={`${line.label} score`} />
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plainText(line.note)}</p>
      </div>
    </li>
  );
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
    setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (storedScore && !revealed) {
      setScore(storedScore);
      setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    }
  }, [storedScore]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student || !scenario || !cmPitch) return null;

  const max = score?.maxTotal ?? SCORE_MAX.setup;
  const total = score?.total ?? 0;
  const tone: Tone = score ? scoreTone(total, max) : "neutral";

  const handleLaunch = () => {
    setLaunching(true);
    const stock = buildInitialStock(scenario);
    initSimulation(stock);
    if (!activeRunId) startRun();
    setTimeout(() => {
      nav("/simulation");
    }, LAUNCH_DELAY_MS);
  };

  return (
    <SimPage>
      <PageHeader
        eyebrow={`${scenario.profile.name} · ${scenario.profile.category}`}
        title="Your setup score"
        description={`How well your campaigns are set up before going live. Setup is worth ${SCORE_MAX.setup} of the 100 points.`}
      />

      <div className={cn("grid gap-6 transition-[opacity,transform] duration-500 lg:grid-cols-[minmax(0,1fr)_340px]", revealed || score ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
        <div className="space-y-6">
          <Section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="sim-num text-5xl font-semibold tracking-tight text-foreground">
                  {total}<span className="text-2xl text-muted-foreground">/{max}</span>
                </p>
                <p className={cn("mt-1 text-sm font-medium", tone === "good" ? "text-sim-good" : tone === "warn" ? "text-sim-warn" : tone === "bad" ? "text-sim-bad" : "text-muted-foreground")}>
                  {GRADE_LABEL[tone]}
                </p>
              </div>
              <ScoreBar earned={total} max={max} label="Setup score" className="w-full sm:max-w-xs" />
            </div>
          </Section>

          <Section title="Line by line" description="What you got right, and what to fix before launch.">
            {score ? (
              <ul className="divide-y divide-border">
                {score.lines.map((line) => <ScoreLineRow key={line.key} line={line} />)}
              </ul>
            ) : (
              <div className="space-y-3" aria-busy="true" aria-label="Working out your score">
                {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary" />)}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Still to play for" description={`${100 - SCORE_MAX.setup} points come during the run.`}>
            <dl className="space-y-2">
              {LATER_PARTS.map(({ label, pts }) => (
                <div key={label} className="flex items-baseline justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="sim-num font-semibold text-foreground">{pts}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="How the run plays">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSimMode("assignment")}
                aria-pressed={simMode === "assignment"}
                className={cn("w-full rounded-xl border p-4 text-left", simMode === "assignment" ? "border-primary bg-accent" : "border-border hover:bg-secondary/60")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Assignment mode</span>
                  <Tag tone="good">Recommended</Tag>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Runs in real time, even when you're logged out. If you don't answer a surprise in time, it's decided for you.
                </p>
              </button>

              {simMode === "assignment" && (
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pace">
                  {PACE_OPTIONS.map(({ key, label, sub, detail }) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={assignmentPace === key}
                      onClick={() => setAssignmentPace(key)}
                      title={detail}
                      className={cn("rounded-lg border p-2.5 text-left", assignmentPace === key ? "border-primary bg-accent" : "border-border hover:bg-secondary/60")}
                    >
                      <span className="block text-xs font-semibold text-foreground">{label}</span>
                      <span className="block text-[11px] text-muted-foreground">{sub}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowDemo((v) => !v)}
                aria-expanded={showDemo}
                className="flex w-full items-center gap-2 rounded-md py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Demo or trainer mode
                <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", showDemo && "rotate-180")} />
              </button>
              {showDemo && (
                <button
                  type="button"
                  onClick={() => setSimMode("demo")}
                  aria-pressed={simMode === "demo"}
                  className={cn("w-full rounded-xl border p-4 text-left", simMode === "demo" ? "border-primary bg-accent" : "border-border hover:bg-secondary/60")}
                >
                  <span className="text-sm font-semibold text-foreground">Demo mode</span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    You control the speed (2 to 8 seconds a day) and can jump to any day. Best for showing a class.
                  </p>
                </button>
              )}
            </div>
          </Section>

          <div className="space-y-2">
            <Button onClick={handleLaunch} disabled={launching} size="lg" className="w-full gap-2">
              {launching ? "Starting the run…" : <>Launch the 30-day run <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <Button variant="ghost" onClick={() => nav("/campaign")} className="w-full gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Go back and change campaigns
            </Button>
          </div>
        </div>
      </div>
    </SimPage>
  );
}
