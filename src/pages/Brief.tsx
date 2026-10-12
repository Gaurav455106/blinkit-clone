import { Reveal } from "@/components/game/GameBits";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useSim } from "@/context/SimContext";
import { stockedStates } from "@/data/scenarios";
import { FlowHeader } from "@/components/FlowHeader";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { SimPage, PageHeader } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MARKET_DATA } from "@/market/data";
import { marketContextFor } from "@/market/context";
import { briefRivals, shoppingHours, stateDemandRows } from "@/lib/briefData";
import { BriefSummary, clueCountFor } from "@/components/brief/BriefSummary";
import { useClues } from "@/components/brief/useClues";
import { EconomicsTab } from "@/components/brief/EconomicsTab";
import { MarketTab } from "@/components/brief/MarketTab";
import { KeywordsTab } from "@/components/brief/KeywordsTab";
import { CalendarTab } from "@/components/brief/CalendarTab";
import { StakeholdersTab } from "@/components/brief/StakeholdersTab";
import { PinnedNotes } from "@/components/brief/PinnedNotes";
import { BriefQuiz } from "@/components/brief/BriefQuiz";
import { BudgetSplit } from "@/components/brief/BudgetSplit";
import { defaultConversionPct } from "@/components/brief/budgetPlan";
import { useTour } from "@/components/tour/useTour";

const TABS = [
  { value: "economics", label: "Economics" },
  { value: "market", label: "Market" },
  { value: "keywords", label: "Keywords" },
  { value: "calendar", label: "Calendar" },
  { value: "stakeholders", label: "Stakeholders" },
] as const;

type BriefTab = typeof TABS[number]["value"];

export default function Brief() {
  const nav = useNavigate();
  const { student, scenario } = useSim();
  const [convPct, setConvPct] = useState(() => defaultConversionPct(scenario?.profile.goalType ?? "ROAS-First"));
  const [quizDone, setQuizDone] = useState(false);
  const [tab, setTab] = useState<BriefTab>("economics");

  useEffect(() => {
    if (!student || !scenario) nav("/", { replace: true });
  }, [student, scenario, nav]);

  const market = scenario ? MARKET_DATA[scenario.profile.id] : undefined;
  const ctx = useMemo(() => (scenario && student ? marketContextFor(scenario, student.batch) : null), [scenario, student]);
  const rivals = useMemo(() => (scenario && market ? briefRivals(scenario.profile, market) : []), [scenario, market]);
  useTour("brief", student?.email, !!student && !!scenario);
  const states = useMemo(() => (scenario && market ? stateDemandRows(scenario, market) : []), [scenario, market]);
  const hours = useMemo(() => (market ? shoppingHours(market.category) : null), [market]);
  const clues = useClues(scenario?.seed ?? "none");

  if (!student || !scenario) return null;

  const { profile, budget, cityStockMap } = scenario;
  const stocked = stockedStates(scenario);
  const unturned = Math.max(0, clueCountFor(rivals) - clues.count);

  const handleContinue = () => {
    const convNum = Math.round((budget * convPct) / 100);
    localStorage.setItem("sim_brief_ack", "1");
    localStorage.setItem("sim_budget_intent_conversion", String(convNum));
    localStorage.setItem("sim_budget_intent_reach", String(budget - convNum));
    localStorage.setItem("sim_budget_intent_conv_pct", String(convPct));
    nav("/cm-pitch");
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <BlinkitSidebar />
      <div className="sim-ui flex flex-1 flex-col overflow-y-auto">
        <FlowHeader crumb="Client brief" step="brief" backTo="/dashboard" backLabel="Dashboard" />
        <SimPage wide>
          <PageHeader
            eyebrow="Client brief"
            title={`${profile.name}: your client for the next 30 days`}
            description={`Hi ${student.name}. Start with the summary, then work through the tabs. Pin anything you'll want during setup and the live run.`}
          />

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-8">
              <div data-tour="brief-summary"><BriefSummary scenario={scenario} stocked={stocked} rivals={rivals} hours={hours} clues={clues} /></div>

              <Tabs data-tour="brief-tabs" value={tab} onValueChange={(v) => setTab(v as BriefTab)}>
                <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
                  {TABS.map((t) => (
                    <TabsTrigger
                      key={t.value}
                      value={t.value}
                      className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
                    >
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="economics" className="sim-rise mt-6"><EconomicsTab profile={profile} /></TabsContent>
                <TabsContent value="market" className="sim-rise mt-6"><MarketTab scenario={scenario} rivals={rivals} states={states} /></TabsContent>
                <TabsContent value="keywords" className="sim-rise mt-6"><KeywordsTab profile={profile} ctx={ctx} /></TabsContent>
                <TabsContent value="calendar" className="sim-rise mt-6"><CalendarTab scenario={scenario} hours={hours} /></TabsContent>
                <TabsContent value="stakeholders" className="sim-rise mt-6"><StakeholdersTab profile={profile} /></TabsContent>
              </Tabs>

              <div data-tour="brief-budget"><Reveal><BudgetSplit goalType={profile.goalType} budget={budget} convPct={convPct} onChange={setConvPct} /></Reveal></div>

              <div data-tour="brief-quiz"><Reveal><BriefQuiz goalType={profile.goalType} primaryState={profile.primaryState} stock={cityStockMap} onStatusChange={setQuizDone} /></Reveal></div>

              <div data-tour="brief-continue" className="flex flex-col gap-4 rounded-2xl bg-accent px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-accent-foreground">
                  <p>{quizDone ? "Next: meet Rohit, the category manager, and agree where your stock goes." : "Answer both questions above to continue."}</p>
                  {unturned > 0 && <p className="mt-1 text-xs text-muted-foreground">{unturned} clue {unturned === 1 ? "card is" : "cards are"} still face down above.</p>}
                </div>
                <Button disabled={!quizDone} onClick={handleContinue} className="shrink-0 gap-2">
                  Continue to category manager <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div data-tour="brief-notes" className="xl:sticky xl:top-6 xl:self-start">
              <PinnedNotes />
            </div>
          </div>
        </SimPage>
      </div>
    </div>
  );
}
