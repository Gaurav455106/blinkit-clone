// ── The opening deal with Rohit (SPEC §6.1, v2) ───────────────────────────────
// Deal sheet (stock split, asks, offers) → talk (Rohit's objections and
// counters, every reply priced) → agreed or walked away. The result is saved
// with the session and shapes the run.

import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Handshake } from "lucide-react";
import { useSim, type Student } from "@/context/SimContext";
import type { Scenario } from "@/data/scenarios";
import type { MarketContext } from "@/market/engineTypes";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
import { PageHeader, Section, SimPage, Tag } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";
import { RohitLine, StudentLine } from "@/components/rohit/ChatLines";
import { ReplyChoice } from "@/components/rohit/ReplyChoice";
import { RelationshipMeter } from "@/components/rohit/RelationshipMeter";
import { StockSplitEditor } from "@/components/deal/StockSplitEditor";
import { AsksPicker, GivesPicker } from "@/components/deal/DealTermsPicker";
import { describeDeal } from "@/components/deal/describeDeal";
import { useTour } from "@/components/tour/useTour";
import {
  allowedStates, briefStock, defaultDeal, stockPool, validateDeal,
  type DealTerms, type OpeningDeal,
} from "@/market/deal";
import { chooseOption, dealOutcome, demandShares, hasPromises, rohitTurn, startNegotiation, type DealOption, type NegotiationState } from "@/market/dealRohit";
import { formatRupees } from "@/lib/money";

const inr = formatRupees;
const pctOf = (x: number) => `${Math.round(x * 100)}%`;

type Props = { student: Student; scenario: Scenario; ctx: MarketContext };

export default function DealV2({ student, scenario, ctx }: Props) {
  const nav = useNavigate();
  const { setOpeningDeal } = useSim();
  const profile = scenario.profile;
  const states = allowedStates(ctx);
  const demand = useMemo(() => demandShares(ctx), [ctx]);
  const pool = useMemo(() => stockPool(ctx), [ctx]);

  const [sheet, setSheet] = useState<DealTerms>(() => defaultDeal(ctx));
  const [showErrors, setShowErrors] = useState(false);
  const [talk, setTalk] = useState<NegotiationState | null>(null);
  const [done, setDone] = useState<OpeningDeal | null>(null);
  const problems = validateDeal(ctx, sheet);
  useTour("deal", student.email, talk === null);
  const turn = talk ? rohitTurn(ctx, talk) : null;

  const send = () => {
    if (problems.length) { setShowErrors(true); return; }
    setTalk(startNegotiation(ctx, sheet));
  };

  const pick = (option: DealOption) => {
    if (!talk) return;
    const next = chooseOption(ctx, talk, option);
    setTalk(next);
    if (next.status === "open") return;
    const out = dealOutcome(ctx, next);
    const deal: OpeningDeal = { terms: out.terms, relationship: out.relationship, log: next.log };
    setOpeningDeal(deal);
    setDone(deal);
  };

  const intro = (
    <RohitLine
      typeIn={!talk}
      text={`Hi ${student.name}. I run ${profile.category} on Blinkit. Tell me where you want your stock, what you need from me and what you'll give back. I'll check it against my numbers.`}
      chipsCaption="What Rohit can see"
      chips={[
        { label: "States I serve for you", value: states.join(", "), tone: "neutral" },
        ...states.map((s) => ({ label: `Searches from ${s}`, value: pctOf(demand[s] ?? 0), tone: "neutral" as const })),
        { label: "Your ad budget", value: inr(scenario.budget), tone: "neutral" },
      ]}
    />
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <BlinkitSidebar />
      <div className="flex-1 overflow-y-auto">
        <FlowHeader crumb="Deal with Rohit" step="cm-pitch" backTo="/brief" backLabel="Brief" />
        <SimPage wide={talk !== null}>
          <PageHeader
            eyebrow={`${profile.name} · before you build campaigns`}
            title="Strike a deal with Rohit"
            description="Rohit decides how many stores stock you and where your products sit. Your stock and promises here shape the whole run, and Rohit holds you to them."
          />

          {!talk && (
            <div className="space-y-6">
              <div data-tour="deal-rohit">{intro}</div>
              <StockSplitEditor
                skus={profile.skus} states={states} demand={demand} pool={pool} value={sheet.stock}
                onChange={(stock) => setSheet({ ...sheet, stock })}
                onReset={() => setSheet({ ...sheet, stock: briefStock(ctx) })}
              />
              <AsksPicker states={states} asks={sheet.asks} onChange={(asks) => setSheet({ ...sheet, asks })} />
              <GivesPicker skus={profile.skus} states={states} gives={sheet.gives} onChange={(gives) => setSheet({ ...sheet, gives })} />
              <div data-tour="deal-send" className="flex flex-col gap-3 rounded-2xl bg-accent px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-accent-foreground">
                  {showErrors && problems.length > 0
                    ? <ul className="space-y-1 text-sim-bad">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                    : "Rohit will push back where your numbers don't add up. You can always walk away and keep the brief's terms."}
                </div>
                <Button onClick={send} className={cn("shrink-0 gap-2", problems.length === 0 && "sim-pulse")}>Send the deal to Rohit <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {talk && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section aria-label="Negotiation with Rohit" aria-live="polite" className="min-w-0 space-y-5 pb-10">
                {intro}
                {talk.log.map((l, i) => (l.speaker === "rohit"
                  ? <RohitLine key={i} text={l.text} isContinuation={i > 0 && talk.log[i - 1].speaker === "rohit"} />
                  : <StudentLine key={i} text={l.text} />))}
                {turn && (
                  <>
                    <RohitLine key={turn.line} typeIn text={turn.line} chips={turn.chips} chipsCaption="Rohit's numbers" />
                    <fieldset key={`opts-${turn.line}`} className="sim-slide-in space-y-2 sm:pl-12 [animation-delay:750ms]">
                      <legend className="mb-2 text-sm font-medium text-foreground">Your reply. Each one shows what it costs you.</legend>
                      {turn.options.map((o) => <ReplyChoice key={o.id} label={o.label} cost={o.cost} onSelect={() => pick(o)} />)}
                    </fieldset>
                  </>
                )}
                {done && (
                  <Section title={done.terms.walkedAway ? "No deal" : "Deal agreed"} className="border-2 border-sim-good">
                    <ul className="mb-4 space-y-1 text-sm text-foreground">{describeDeal(ctx, done.terms).map((l) => <li key={l}>{l}</li>)}</ul>
                    {hasPromises(done.terms) && <p className="mb-4 text-sm text-muted-foreground">Your promises appear on the live dashboard under "Promises to Rohit".</p>}
                    <Button onClick={() => nav("/campaign")} className="gap-2"><Handshake className="h-4 w-4" />Build your campaigns</Button>
                  </Section>
                )}
              </section>
              <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                {done && <Section><RelationshipMeter value={done.relationship} /></Section>}
                <Section title="On the table">
                  <ul className="space-y-1.5 text-sm text-foreground">{describeDeal(ctx, talk.terms).map((l) => <li key={l}>{l}</li>)}</ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Stock in {states.map((s) => `${s} ${Math.round(Object.values(talk.terms.stock).reduce((t, row) => t + (row[s] ?? 0), 0)).toLocaleString("en-IN")}`).join(" · ")} units
                  </p>
                  {talk.counters > 0 && <p className="mt-2"><Tag tone="warn">Counter {talk.counters}</Tag></p>}
                </Section>
              </aside>
            </div>
          )}
        </SimPage>
      </div>
    </div>
  );
}
