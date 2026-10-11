// ── Live dashboard v2 (SPEC §2, §5, §6, §7) ───────────────────────────────────
// Simulation layer around the frozen platform: the clock, alerts, Rohit's
// check-ins, weekly checkpoints, optimisation tables and reports. New
// campaigns still open the unchanged wizard in the side sheet.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trophy } from "lucide-react";
import { useSim, type SavedCampaign, type Student } from "@/context/SimContext";
import type { Scenario } from "@/data/scenarios";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
import { CampaignForm } from "@/components/CampaignForm";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader, Section, SimPage, StatTile } from "@/components/sim/primitives";
import { useDealRun } from "@/components/live/useDealRun";
import { useLiveRun, RUN_DAYS } from "@/components/live/useLiveRun";
import { ClockBar, AlertsFeed, CheckpointPanel, ReportsPanel, CompetitionPanel, SPEEDS } from "@/components/live/LivePanels";
import { RoasChart, VisibilityChart, SovChart, HourHeatmap, PacingChart, StockPanel } from "@/components/live/LiveCharts";
import { UnitTable, CampaignPanel } from "@/components/live/LiveControls";
import { AlertCard, CalendarStrip, CommitmentsPanel, EventsFeed } from "@/components/live/LiveEvents";
import { PreLaunch } from "@/components/live/PreLaunch";
import { useTour, useTourOpen } from "@/components/tour/useTour";
import { RohitPanel } from "@/components/rohit/RohitPanel";
import { detectMoments } from "@/market/moments";
import { sumMetrics } from "@/market/aggregate";
import type { ReportInput } from "@/market/reports";
import { AchievementToasts, CountUp, FloatDelta } from "@/components/game/GameBits";
import { earnedAchievements } from "@/components/game/achievements";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const DEFAULT_SPEED = SPEEDS[1].ms;

type Props = { student: Student; scenario: Scenario };

export default function LiveDashboardV2({ student, scenario }: Props) {
  const nav = useNavigate();
  const { campaigns, deleteCampaign, startRun, activeRunId, runHistory, cmRelationship, setLiveCmRelationship } = useSim();
  const completed = !!activeRunId && runHistory.find((r) => r.id === activeRunId)?.status === "completed";
  const deal = useDealRun(scenario, student);
  const run = useLiveRun(scenario, student, campaigns, activeRunId, cmRelationship, setLiveCmRelationship, deal);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<SavedCampaign | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(DEFAULT_SPEED);
  const [tab, setTab] = useState("overview");

  // Guided tours: one before launch, one for the live run (once each per student)
  const inSetup = !run.started || completed;
  const panelsClear = !sheetOpen && run.blockedBy === null && !run.rohit.pendingAsk && !run.replaying;
  useTour("liveV2Setup", student.email, !sheetOpen, inSetup);
  useTour("liveV2Run", student.email, panelsClear, !inSetup);
  const tourOpen = useTourOpen();

  // Auto-play: one day every `speedMs`, unless something needs the student
  const { advance, readyToStep, day } = run;
  useEffect(() => {
    if (!playing || !readyToStep || sheetOpen || tourOpen) return;
    const t = setTimeout(() => { void advance(); }, speedMs);
    return () => clearTimeout(t);
  }, [playing, readyToStep, sheetOpen, tourOpen, speedMs, day, advance]);

  useEffect(() => { if (run.finished) setPlaying(false); }, [run.finished]);

  const moments = useMemo(
    () => (run.ctx ? detectMoments({ ctx: run.ctx, results: run.results, configsByDay: run.configsByDay }) : []),
    [run.ctx, run.results, run.configsByDay],
  );
  const totals = useMemo(() => sumMetrics(run.results.flatMap((r) => r.cells)), [run.results]);
  const achievements = useMemo(() => earnedAchievements({
    launched: run.launched, actions: run.actions, insights: run.insights.length,
    rohitReplies: run.rohit.replies.length, day: run.day, results: run.results,
  }), [run.launched, run.actions, run.insights.length, run.rohit.replies.length, run.day, run.results]);
  const reportInput: ReportInput | null = run.ctx
    ? { ctx: run.ctx, results: run.results, configsByDay: run.configsByDay, campaignNames: run.campaignNames, changeLog: run.changeLog }
    : null;

  const openWizard = (c?: SavedCampaign) => { setEditing(c); setSheetOpen(true); };
  const sheet = (
    <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) setEditing(undefined); setSheetOpen(open); }}>
      <SheetContent side="right" className="!w-screen !max-w-none p-0 overflow-hidden h-full [&>button]:hidden">
        <CampaignForm asSheet editCampaign={editing} onDone={() => { setSheetOpen(false); setEditing(undefined); }} />
      </SheetContent>
    </Sheet>
  );

  const shell = (content: React.ReactNode) => (
    <div className="flex h-screen w-full overflow-hidden">
      <BlinkitSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <FlowHeader crumb="Live campaigns" step="simulation" />
        <SimPage wide>{content}</SimPage>
      </div>
      {sheet}
    </div>
  );

  if (inSetup) {
    return shell(
      <PreLaunch
        brandName={scenario.profile.name}
        campaigns={campaigns}
        calendar={run.calendar}
        onNew={() => openWizard()}
        onEdit={(c) => openWizard(c)}
        onDelete={deleteCampaign}
        onGoLive={() => { startRun(); setPlaying(true); }}
      />,
    );
  }

  if (!run.ctx || !reportInput) {
    return shell(<Section title="This brand has no market data yet">The v2 engine needs market data for {scenario.profile.name}.</Section>);
  }

  const pausedReason = run.replaying ? "Loading your run…"
    : run.blockedBy === "alert" ? "Paused: read the alert below."
    : run.blockedBy === "rohit" ? "Paused: Rohit wants a word."
    : run.blockedBy === "checkpoint" ? `Paused: week ${Math.round(run.day / 7)} check-in.`
    : sheetOpen ? "Paused while you build a campaign."
    : tourOpen ? "Paused while the tour is open."
    : run.error ? `Something went wrong: ${run.error}` : null;

  const spent = totals.spend + run.extraSpend;
  const ask = run.rohit.pendingAsk;

  return shell(
    <>
      <div data-tour="v2-clock"><ClockBar
        day={run.day}
        totalDays={RUN_DAYS}
        playing={playing}
        busy={!run.readyToStep}
        speedMs={speedMs}
        pausedReason={pausedReason}
        onToggle={() => setPlaying((p) => !p)}
        onAdvance={() => { void run.advance(); }}
        onSpeed={setSpeedMs}
      /></div>

      {run.pendingAlert && <AlertCard alert={run.pendingAlert} onDismiss={run.dismissAlert} />}

      {run.finished && (
        <Section className="mb-6 border-2 border-sim-good" title="Day 30 is done" description="Your run is complete. See your score, what each mark was for, and the moments that cost you most.">
          <Button onClick={() => nav("/results")}><Trophy className="mr-1 h-4 w-4" />See your results</Button>
        </Section>
      )}

      {run.blockedBy === "checkpoint" && (
        <div className="mb-6">
          <CheckpointPanel
            day={run.day}
            reportInput={reportInput}
            studentName={student.name}
            insights={run.insights}
            onLog={run.logInsight}
            onContinue={run.finishCheckpoint}
          />
        </div>
      )}

      <AchievementToasts earned={achievements} />
      <PageHeader
        eyebrow={`${scenario.profile.name} · day ${run.day} of ${RUN_DAYS}`}
        title="Live campaigns"
        description="Changes you make today start tomorrow, as on the real platform."
        actions={<Button data-tour="v2-new-campaign" variant="outline" onClick={() => openWizard()}><Plus className="mr-1 h-4 w-4" />New campaign</Button>}
      />

      <div data-tour="v2-stats" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Spent" value={<CountUp value={spent} format={rupees} />} hint={`of ${rupees(scenario.budget)}${run.extraSpend > 0 ? `, incl. ${rupees(run.extraSpend)} paid to Rohit` : ""}`} />
        <StatTile label="Sales from ads" value={<CountUp value={totals.revenue} format={rupees} />}>
          <FloatDelta value={totals.revenue} format={(d) => `${d >= 0 ? "+" : "−"}${rupees(Math.abs(d))}`} />
        </StatTile>
        <StatTile label="ROAS" value={totals.spend > 0 ? <CountUp value={totals.roas} format={(n) => n.toFixed(2)} /> : "–"} hint={totals.breakEvenRoas > 0 ? `Break-even ${totals.breakEvenRoas.toFixed(2)}` : "Sales for every ₹1 of ads"} tone={totals.spend > 0 ? (totals.roas >= totals.breakEvenRoas ? "good" : "bad") : "neutral"} />
        <StatTile label="Profit after ads" value={<CountUp value={totals.profit} format={rupees} />} tone={totals.profit >= 0 ? "good" : "bad"} />
        <StatTile label="Units sold" value={<CountUp value={totals.units} format={(n) => Math.round(n).toLocaleString("en-IN")} />}>
          <FloatDelta value={Math.round(totals.units)} format={(d) => `${d >= 0 ? "+" : "−"}${Math.abs(d)} units`} />
        </StatTile>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-tour="v2-tabs" className="mb-4 flex-wrap">
          {[["overview", "Overview"], ["keywords", "Keywords"], ["campaigns", "Campaigns"], ["competition", "Competition"], ["stock", "Stock"], ["reports", "Reports"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v}>{l}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <RoasChart results={run.results} actions={run.actions} campaignNames={run.campaignNames} />
            <VisibilityChart results={run.results} actions={run.actions} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <div data-tour="v2-news"><EventsFeed activations={run.activations} day={run.day} /></div>
              <AlertsFeed moments={moments} day={run.day} />
            </div>
            <div className="space-y-6">
              <PacingChart ctx={run.ctx} results={run.results} />
              <div data-tour="v2-calendar"><CalendarStrip calendar={run.calendar} day={run.day} /></div>
              <div data-tour="v2-promises"><CommitmentsPanel results={run.commitmentResults} relationship={run.relationship} /></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="keywords">
          <UnitTable ctx={run.ctx} results={run.results} configs={run.nextDayConfigs} campaignNames={run.campaignNames} act={run.act} />
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <CampaignPanel ctx={run.ctx} configs={run.nextDayConfigs} campaignNames={run.campaignNames} act={run.act} />
          <HourHeatmap results={run.results} />
        </TabsContent>

        <TabsContent value="competition" className="space-y-6">
          <SovChart ctx={run.ctx} results={run.results} />
          <CompetitionPanel ctx={run.ctx} results={run.results} />
        </TabsContent>

        <TabsContent value="stock">
          <StockPanel ctx={run.ctx} results={run.results} />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsPanel reportInput={reportInput} studentName={student.name} day={run.day} />
        </TabsContent>
      </Tabs>

      {ask && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md p-4">
          <RohitPanel
            ask={ask}
            day={run.day}
            relationship={run.relationship}
            isClockPaused
            chosenOptionId={run.rohit.pendingChoice}
            onChoose={run.replyToRohit}
            onClose={run.closeRohit}
            className="h-full"
          />
        </div>
      )}
    </>,
  );
}
