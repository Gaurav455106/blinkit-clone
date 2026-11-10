// ── Results and debrief v2 (SPEC §7.3.2, §8) ──────────────────────────────────
// Rebuilds the run from its log, scores it in a worker, explains every point,
// shows the decision moments and costliest mistakes in ₹, exports the
// workbook and saves the attempt once with score_breakdown.version = 2.

import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Download, RotateCcw } from "lucide-react";
import { useSim, type Student } from "@/context/SimContext";
import type { Scenario } from "@/data/scenarios";
import { isRunSaved, saveAttempt } from "@/lib/attemptSave";
import type { Json } from "@/integrations/supabase/types";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Section, SimPage, StatTile, Tag } from "@/components/sim/primitives";
import { ScoreBreakdown } from "@/components/results/ScoreBreakdown";
import { ScoreSummary } from "@/components/results/ScoreSummary";
import { GradeScale } from "@/components/results/GradeScale";
import { GoalTable } from "@/components/results/ResultTables";
import { useDealRun } from "@/components/live/useDealRun";
import { useLiveRun, RUN_DAYS } from "@/components/live/useLiveRun";
import { useScoreV2 } from "@/market/useScoreV2";
import type { ScoreRequest } from "@/market/scoreProtocol";
import { formatObjective, type MomentScore } from "@/market/moments";
import { buildSavedBreakdownV2, type SavedBreakdownV2 } from "@/lib/attemptAnalysis";
import { snapshotCampaigns, type CampaignSnapshot } from "@/lib/attemptDetail";
import { qualitativeSummary } from "@/lib/rubrics";
import { debriefFilename, debriefSheets, VERDICT_LABEL } from "@/lib/debriefV2Export";
import { REPORT_README } from "@/market/reports";
import { downloadWorkbook } from "@/lib/excel";
import { describeDeal } from "@/components/deal/describeDeal";
import { useTour } from "@/components/tour/useTour";
import { CountUp } from "@/components/game/GameBits";
import { fireConfetti } from "@/components/game/confetti";
import { earnedAchievements } from "@/components/game/achievements";
import { PartCards } from "@/components/results/cards/PartCards";
import { BadgeShelf } from "@/components/results/cards/BadgeShelf";
import { formatRupees } from "@/lib/money";

/** Confetti for "Growing Fast" (60) and up, once the score has counted up. */
const CONFETTI_FROM = 60;
const CONFETTI_DELAY_MS = 1400;

const PITCH_MAX = 15;
const rupees = formatRupees;
const VERDICT_TONE = { right: "good", nothingNeeded: "good", partial: "warn", wrong: "bad", ignored: "bad" } as const;

type Props = { student: Student; scenario: Scenario };

function MomentList({ moments }: { moments: readonly MomentScore[] }) {
  if (moments.length === 0) {
    return <p className="text-sm text-muted-foreground">The run never reached a point where a change would have helped.</p>;
  }
  return (
    <ol className="space-y-3">
      {moments.map((m) => (
        <li key={m.moment.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-foreground">Day {m.moment.day}: {m.moment.title}</p>
            <Tag tone={VERDICT_TONE[m.verdict]}>{VERDICT_LABEL[m.verdict]} · {Math.round(m.points * 10) / 10} / {Math.round(m.max * 10) / 10}</Tag>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.moment.evidence}</p>
          <p className="mt-2 text-sm text-foreground">
            You: {m.studentAction ?? "no change"}. Best move: {m.bestLever}.
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Automatic retries after a failed save, before the student is asked to retry. */
const SAVE_AUTO_RETRIES = 3;
const SAVE_RETRY_MS = 4000;

/** Saves the run once; retries a failed save, then offers a manual retry. */
function useSaveAttempt(student: Student, scenario: Scenario, saved: SavedBreakdownV2 | null, campaigns: readonly CampaignSnapshot[]) {
  const { activeRunId, completeRun, mode } = useSim();
  const savedRef = useRef(false);
  const failuresRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (savedRef.current || !saved || !activeRunId || mode === "review") return;
    // Re-opening the debrief must not save the same run again
    if (isRunSaved(activeRunId)) { savedRef.current = true; return; }
    savedRef.current = true;
    let retryTimer: number | undefined;
    saveAttempt({
      email: student.email,
      name: student.name,
      batch_code: student.batch,
      profile_id: scenario.profile.id,
      scenario: { seed: scenario.seed, profile: scenario.profile.name, engine: "v2" },
      choices: { campaigns: campaigns.length },
      score_total: saved.grandTotal,
      score_breakdown: saved as unknown as Json,
      badge: saved.achievementPct >= 90 ? "gold" : saved.achievementPct >= 70 ? "silver" : saved.achievementPct >= 50 ? "bronze" : null,
      snapshot: { scenario: { seed: scenario.seed, profile: { id: scenario.profile.id, name: scenario.profile.name } }, engine: "v2", campaigns } as unknown as Json,
    }, activeRunId).then(() => {
      // Marked complete only once the permanent record exists, so a failed save is retried
      setFailed(false);
      completeRun({ score: saved.grandTotal, achievementPct: saved.achievementPct });
    }).catch((error: unknown) => {
      console.error("[sim] v2 attempt save failed", error);
      savedRef.current = false;
      failuresRef.current += 1;
      setFailed(true);
      if (failuresRef.current <= SAVE_AUTO_RETRIES) {
        retryTimer = window.setTimeout(() => setRetryTick((n) => n + 1), SAVE_RETRY_MS * failuresRef.current);
      }
    });
    return () => { if (retryTimer) window.clearTimeout(retryTimer); };
  }, [saved, activeRunId, mode, completeRun, student, scenario, campaigns, retryTick]);
  const retry = () => { failuresRef.current = 0; setRetryTick((n) => n + 1); };
  return { failed, retry };
}

export default function DebriefV2({ student, scenario }: Props) {
  const nav = useNavigate();
  const { campaigns, activeRunId, reviewRunId, cmRelationship, cmPitch, setLiveCmRelationship, openingDeal } = useSim();
  // The run on screen: the one just played, or a past one opened for review
  const runId = activeRunId ?? reviewRunId;
  const deal = useDealRun(scenario, student);
  const run = useLiveRun(scenario, student, campaigns, runId, cmRelationship, setLiveCmRelationship, deal);
  const ready = run.finished && !run.replaying && !!run.ctx;

  const formats = useMemo(
    () => Object.fromEntries(campaigns.filter((c) => !c.isDraft).map((c) => [c.id, { adFormat: c.adFormat, objective: c.objective }])),
    [campaigns],
  );
  const pausing = new Set(run.pausingKeys);
  const request: ScoreRequest | null = ready && run.ctx ? {
    ctx: run.ctx, launched: run.launched, formats, actions: run.actions, results: run.results,
    configsByDay: run.configsByDay, statesByDay: run.statesByDay,
    pitch: cmPitch ? { score: cmPitch.pitchScore, max: PITCH_MAX } : null,
    deal: openingDeal,
    insights: run.insights, stepOptions: run.stepOptions,
    alerts: run.activations.filter((a) => pausing.has(a.key)),
    rohit: { replies: run.rohit.replies, commitments: run.commitmentResults },
  } : null;
  const { score, busy, error } = useScoreV2(request, `${runId}:${run.results.length}`);
  const saved = useMemo(() => (score ? buildSavedBreakdownV2(score) : null), [score]);
  const summaries = useMemo(() => (saved ? qualitativeSummary(saved.lines, 2) : []), [saved]);
  const launched = useMemo(() => snapshotCampaigns(campaigns), [campaigns]);
  const save = useSaveAttempt(student, scenario, saved, launched);
  const badges = useMemo(() => earnedAchievements({
    launched: run.launched, actions: run.actions, insights: run.insights.length,
    rohitReplies: run.rohit.replies.length, day: run.day, results: run.results,
  }), [run.launched, run.actions, run.insights.length, run.rohit.replies.length, run.day, run.results]);
  useTour("resultsV2", student.email, !!score);
  const grand = saved?.grandTotal ?? 0;
  useEffect(() => {
    if (grand < CONFETTI_FROM) return;
    const t = window.setTimeout(fireConfetti, CONFETTI_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [grand]);

  const shell = (content: React.ReactNode) => (
    <div className="flex h-screen w-full flex-col overflow-hidden md:flex-row">
      <BlinkitSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <FlowHeader crumb="Results" step="results" />
        <SimPage>{content}</SimPage>
      </div>
    </div>
  );

  // No run to show (e.g. Back after the dashboard started a new brief): go home
  if (!runId) return <Navigate to="/dashboard" replace />;

  if (!run.replaying && !run.finished && run.day < RUN_DAYS && !busy) {
    return shell(
      <EmptyState
        title="Your run isn't finished yet"
        description={`Results appear after day ${RUN_DAYS}. You're on day ${run.day}.`}
        action={<Button onClick={() => nav("/simulation")}>Back to live campaigns</Button>}
      />,
    );
  }
  if (error) {
    return shell(<EmptyState title="We couldn't work out your score" description={`Please tell your trainer. Details: ${error}`} />);
  }
  if (!score || !saved || !run.ctx) {
    return shell(
      <div className="py-16">
        <p className="text-lg font-medium text-foreground">Working out your score…</p>
        <p className="mt-1 text-sm text-muted-foreground">We replay each key moment with your move, no move and the best move. This takes a few seconds.</p>
      </div>,
    );
  }

  const reportInput = { ctx: run.ctx, results: run.results, configsByDay: run.configsByDay, campaignNames: run.campaignNames, changeLog: run.changeLog };

  const exportAll = () => downloadWorkbook(debriefFilename(student.name, scenario.profile.name), debriefSheets(score, reportInput), REPORT_README);

  return shell(
    <>
      <PageHeader
        tour="results-header"
        eyebrow={`${scenario.profile.name} · 30 days`}
        title={<><CountUp value={saved.grandTotal} from={0} ms={1400} format={(n) => Math.round(n).toString()} /> / 100 · <span className="sim-pop-in inline-block [animation-delay:1.3s]">{saved.gradeLabel}</span></>}
        description="Every point below says what we looked at, what you did and what would have earned more."
        actions={
          <>
            <Button data-tour="results-download" variant="outline" onClick={exportAll}><Download className="mr-1 h-4 w-4" />Download results (Excel)</Button>
            <Button variant="ghost" onClick={() => nav("/dashboard")}><RotateCcw className="mr-1 h-4 w-4" />Back to dashboard</Button>
          </>
        }
      />
      <div className="space-y-6">
        {save.failed && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sim-bad/40 bg-sim-bad/10 px-4 py-3 text-sm text-foreground">
            <p><span className="font-medium">Your score isn't saved yet.</span> Keep this page open: we're trying again. If it keeps failing, tell your trainer.</p>
            <Button size="sm" variant="outline" onClick={save.retry}>Try saving again</Button>
          </div>
        )}
        <GradeScale total={saved.grandTotal} />
        <PartCards lines={saved.lines} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Spent on ads" value={rupees(score.run.spend)} />
          <StatTile label="Sales from ads" value={rupees(score.run.revenue)} />
          <StatTile label="ROAS" value={score.run.roas.toFixed(2)} hint={`Break-even ${score.run.breakEvenRoas.toFixed(2)}`} tone={score.run.roas >= score.run.breakEvenRoas ? "good" : "bad"} />
          <StatTile label="Profit after ads" value={rupees(score.run.profit)} tone={score.run.profit >= 0 ? "good" : "bad"} />
        </div>
        {score.costliestMistakes.length > 0 && (
          <Section tour="results-mistakes" title="Your costliest mistakes" description="The moments where a different move would have earned the most, measured by replaying the same days.">
            <ol className="space-y-2">
              {score.costliestMistakes.map((c, i) => (
                <li key={c.title} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="sim-num text-muted-foreground">{i + 1}.</span>
                  <span className="font-medium text-foreground">{c.title}</span>
                  <span className="text-sm text-muted-foreground">You: {c.what}.</span>
                  <Tag tone="bad">Lost about {formatObjective(c.lost, c.unit)} vs the best move</Tag>
                </li>
              ))}
            </ol>
          </Section>
        )}
        <BadgeShelf earned={badges} />
        <div data-tour="results-summary"><ScoreSummary summaries={summaries} /></div>
        {openingDeal && (
          <Section tour="results-deal" title="Your deal with Rohit" description={`Rohit's trust started at ${openingDeal.relationship} of 100.`}>
            <ul className="space-y-1 text-sm text-foreground">{describeDeal(run.ctx, openingDeal.terms).map((l) => <li key={l}>{l}</li>)}</ul>
          </Section>
        )}
        <Section tour="results-moments" title="Decision moments" description="Each time the data called for action, what you did and how it compared with the best move.">
          <MomentList moments={score.moments} />
        </Section>
        <GoalTable goals={saved.goalRows} achievementPct={saved.achievementPct} />
        <div data-tour="results-breakdown"><ScoreBreakdown lines={saved.lines} version={2} /></div>
      </div>
    </>,
  );
}
