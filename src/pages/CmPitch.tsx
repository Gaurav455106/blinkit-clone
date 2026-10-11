/**
 * CmPitch.tsx: the pre-run meeting with Rohit, the category manager (SPEC §6).
 *
 * 1. Form: the student picks products, states and a reason for each.
 * 2. Conversation: Rohit opens with the numbers, pushes back up to 3 times;
 *    every line shows its data as chips, every reply shows its cost first,
 *    and the relationship meter moves as the student answers.
 * 3. Verdict: what was approved, then on to campaigns.
 *
 * The v1 logic in cmPitchLogic.ts decides everything; what reaches
 * SimContext (CmPitchResult) is unchanged.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useSim, type CmPitchResult } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { FlowHeader } from "@/components/FlowHeader";
import { Button } from "@/components/ui/button";
import { PageHeader, ScoreBar, Section, SimPage, Tag } from "@/components/sim/primitives";
import { cn } from "@/lib/utils";
import { stockedStates, type CityName, type Scenario } from "@/data/scenarios";
import {
  buildPushbacks, buildOpeningMessage, calcFinalResult, buildClosingMessage, pitchScoreToRelationship, PUSHBACK_TOPICS,
  type DataCard, type PitchedSKU, type Pushback, type ResponseOption,
} from "@/lib/cmPitchLogic";
import { RohitLine, StudentLine } from "@/components/rohit/ChatLines";
import { ReplyChoice } from "@/components/rohit/ReplyChoice";
import { RelationshipMeter } from "@/components/rohit/RelationshipMeter";
import { PitchSkuCard } from "@/components/rohit/PitchSkuCard";
import { PitchVerdict } from "@/components/rohit/PitchVerdict";
import type { ChipData } from "@/components/rohit/DataChips";
import { commitmentRange, commitValidity, emptyPitchRow, type PitchRow } from "@/components/rohit/pitchForm";

/** Short pauses so Rohit's replies read like a conversation. */
const THINK_MS = 700;
const ACK_MS = 400;
const VELOCITY_ORDER: Record<string, number> = { High: 3, Medium: 2, Low: 1, "Very Low": 0 };

type Turn =
  | { kind: "rohit"; text: string; card?: DataCard }
  | { kind: "student"; text: string; cost: string };

const chipsOf = (card: DataCard): ChipData[] => card.rows.map((r) => ({ label: r.label, value: r.value, tone: r.status }));

export default function CmPitch() {
  const nav = useNavigate();
  const { student, scenario } = useSim();

  useEffect(() => {
    if (!student) nav("/", { replace: true });
    else if (!scenario) nav("/brief", { replace: true });
    else if (localStorage.getItem("sim_brief_ack") !== "1") nav("/brief", { replace: true });
  }, [student, scenario, nav]);

  if (!student || !scenario) return null;
  return <CmPitchScreen studentName={student.name} scenario={scenario} />;
}

function CmPitchScreen({ studentName, scenario }: { studentName: string; scenario: Scenario }) {
  const nav = useNavigate();
  const { setCmPitch, consumeToken, tokensRemaining } = useSim();
  const { profile, cityStockMap } = scenario;

  const [isSpotlightOpen, setIsSpotlightOpen] = useState(true);
  const [phase, setPhase] = useState<"form" | "chat">("form");
  const [rows, setRows] = useState<Record<string, PitchRow>>(() => Object.fromEntries(profile.skus.map((s) => [s.id, emptyPitchRow()])));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pushbacks, setPushbacks] = useState<Pushback[]>([]);
  const [pushIdx, setPushIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [pitched, setPitched] = useState<PitchedSKU[]>([]);
  const [finalResult, setFinalResult] = useState<CmPitchResult | null>(null);
  const [isAwaitingChoice, setIsAwaitingChoice] = useState(false);
  const [isTokenDeducted, setIsTokenDeducted] = useState(false);
  const [lastDelta, setLastDelta] = useState<number | undefined>(undefined);

  const timers = useRef<number[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, isAwaitingChoice, finalResult]);

  const update = (id: string, patch: Partial<PitchRow>) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  // ── Form checks ────────────────────────────────────────────────────────────
  const enabledSkus = profile.skus.filter((s) => rows[s.id].enabled);
  const commitmentErrors = enabledSkus.flatMap((s) =>
    rows[s.id].cities
      .filter((c) => (cityStockMap[c] ?? 0) === 0)
      .filter((c) => ["too_low", "too_high"].includes(commitValidity(rows[s.id].stockCommitments[c] ?? 0, s.velocity)))
      .map((c) => `${s.name}, ${c}: between ${commitmentRange(s.velocity).min} and ${commitmentRange(s.velocity).max} units`));
  const missingReason = enabledSkus.filter((s) => !rows[s.id].reasoning.trim());
  const canSubmit = enabledSkus.length > 0 && commitmentErrors.length === 0 && missingReason.length === 0;

  // ── Live relationship: v1 scoring applied to the answers so far ───────────
  const provisional = useMemo(() => {
    if (finalResult) return finalResult;
    if (phase !== "chat") return null;
    const answered = pushbacks.filter((pb) => responses[pb.id] !== undefined);
    return calcFinalResult(pitched, scenario, answered, responses);
  }, [finalResult, phase, pushbacks, responses, pitched, scenario]);

  const finish = (pitchedSkus: PitchedSKU[], pbs: Pushback[], answers: Record<string, string>) => {
    const result = calcFinalResult(pitchedSkus, scenario, pbs, answers);
    setTurns((t) => [...t, { kind: "rohit", text: buildClosingMessage(result, profile.name) }]);
    setFinalResult(result);
    if (result.status === "weak") { consumeToken(); setIsTokenDeducted(true); }
  };

  const submitPitch = () => {
    if (!canSubmit) return;
    const list: PitchedSKU[] = enabledSkus.map((s) => ({
      skuId: s.id, skuName: s.name, velocity: s.velocity, mrp: s.mrp, margin: s.margin,
      reasoning: rows[s.id].reasoning, justification: rows[s.id].justification,
      cities: rows[s.id].cities, stockCommitments: rows[s.id].stockCommitments,
    }));
    const pbs = buildPushbacks(list, scenario);
    const opening = buildOpeningMessage(list, scenario);
    setPitched(list);
    setPushbacks(pbs);
    setPushIdx(0);
    setTurns([{ kind: "rohit", text: opening.message, card: opening.dataCard }]);
    setPhase("chat");
    if (pbs.length === 0) {
      later(() => finish(list, [], {}), THINK_MS);
      return;
    }
    later(() => {
      setTurns((t) => [...t, { kind: "rohit", text: pbs[0].cmMessage, card: pbs[0].dataCard }]);
      setIsAwaitingChoice(true);
    }, THINK_MS);
  };

  const pickResponse = (pushback: Pushback, option: ResponseOption) => {
    setIsAwaitingChoice(false);
    const answers = { ...responses, [pushback.id]: option.key };
    const answeredBefore = pushbacks.filter((pb) => responses[pb.id] !== undefined);
    const answeredAfter = pushbacks.filter((pb) => answers[pb.id] !== undefined);
    const before = pitchScoreToRelationship(calcFinalResult(pitched, scenario, answeredBefore, responses).pitchScore);
    const after = pitchScoreToRelationship(calcFinalResult(pitched, scenario, answeredAfter, answers).pitchScore);
    setLastDelta(after - before);
    setResponses(answers);
    setTurns((t) => [...t, { kind: "student", text: option.text, cost: option.cost }]);

    later(() => {
      setTurns((t) => [...t, { kind: "rohit", text: option.cmAck }]);
      const next = pushIdx + 1;
      if (next < pushbacks.length) {
        later(() => {
          setPushIdx(next);
          setTurns((t) => [...t, { kind: "rohit", text: pushbacks[next].cmMessage, card: pushbacks[next].dataCard }]);
          setIsAwaitingChoice(true);
        }, THINK_MS);
      } else {
        later(() => finish(pitched, pushbacks, answers), THINK_MS);
      }
    }, ACK_MS);
  };

  const confirmAndProceed = () => {
    if (!finalResult) return;
    setCmPitch(finalResult);
    nav("/campaign");
  };

  const acceptDefault = () => {
    const hero = [...profile.skus].sort((a, b) => (VELOCITY_ORDER[b.velocity] ?? 0) - (VELOCITY_ORDER[a.velocity] ?? 0))[0];
    const topState = (Object.keys(cityStockMap) as CityName[]).reduce<CityName | null>((best, c) =>
      best === null || (cityStockMap[c] ?? 0) > (cityStockMap[best] ?? 0) ? c : best, null);
    setCmPitch({
      status: "weak",
      approvedSKUs: [hero.id],
      approvedCities: topState ? [topState] : [],
      pitchScore: 0,
      osaBoost: false,
      message: "Basic approval: your fastest-selling product in your best-stocked state only.",
      flags: ["Took the basic approval after a rejected pitch"],
    });
    nav("/campaign");
  };

  const retryPitch = () => {
    consumeToken();
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPhase("form");
    setTurns([]);
    setPushbacks([]);
    setPushIdx(0);
    setResponses({});
    setPitched([]);
    setFinalResult(null);
    setIsAwaitingChoice(false);
    setIsTokenDeducted(false);
    setLastDelta(undefined);
  };

  const stocked = stockedStates(scenario);
  const current = isAwaitingChoice ? pushbacks[pushIdx] : undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <BlinkitSidebar highlightCm={isSpotlightOpen} />
      <div className="flex-1 overflow-y-auto bg-background">
        <FlowHeader crumb="Category Manager Meeting" step="cm-pitch" backTo="/brief" backLabel="Brief" />
        {isSpotlightOpen && <RelationshipSpotlight category={profile.category} onClose={() => setIsSpotlightOpen(false)} />}

        <SimPage wide={phase === "chat"}>
          {phase === "form" ? (
            <>
              <PageHeader
                title="Pitch your products to Rohit"
                description={`Rohit decides shelf space and stock for ${profile.category}. Pick your products and states, and give a reason for each. He checks every claim against his numbers.`}
              />
              <div className="space-y-6">
                <RohitLine
                  text={`Hi ${studentName}. Tell me which products you want me to push, where, and why. I'll check what you say against my data, so be precise.`}
                  chipsCaption="What Rohit can see"
                  chips={[
                    { label: "Category", value: profile.category, tone: "neutral" },
                    { label: "Your budget", value: `₹${scenario.budget.toLocaleString("en-IN")}`, tone: "neutral" },
                    { label: "States with stock today", value: `${stocked.length}: ${stocked.join(", ")}`, tone: stocked.length > 0 ? "good" : "bad" },
                  ]}
                />

                <p className="max-w-[68ch] rounded-xl bg-secondary px-4 py-3 text-sm leading-relaxed text-foreground">
                  You have <span className="sim-num font-semibold">{tokensRemaining}</span> {tokensRemaining === 1 ? "token" : "tokens"}.
                  A weak pitch (4 to 7 points out of 15) uses 1 token, and pitching again uses 1 more. You can't earn more.
                </p>

                <div className="space-y-4">
                  {profile.skus.map((s) => (
                    <PitchSkuCard key={s.id} sku={s} row={rows[s.id]} scenario={scenario} onChange={(patch) => update(s.id, patch)} />
                  ))}
                </div>

                <div className="flex flex-col-reverse gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <Button variant="outline" onClick={() => nav("/brief")} className="gap-2 self-start">
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to the brief
                  </Button>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <Button onClick={submitPitch} disabled={!canSubmit} className="gap-2">
                      Send pitch to Rohit <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                    {enabledSkus.length === 0 && <p className="text-xs text-muted-foreground">Include at least one product.</p>}
                    {missingReason.length > 0 && <p className="max-w-xs text-xs text-sim-bad sm:text-right">Pick a reason for: {missingReason.map((s) => s.name).join(", ")}</p>}
                    {commitmentErrors.map((e) => <p key={e} className="max-w-xs text-xs text-sim-bad sm:text-right">{e}</p>)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section aria-label="Conversation with Rohit" aria-live="polite" className="min-w-0 space-y-5 pb-10">
                {turns.map((turn, i) =>
                  turn.kind === "rohit" ? (
                    <RohitLine
                      key={i}
                      text={turn.text}
                      chips={turn.card ? chipsOf(turn.card) : undefined}
                      chipsCaption={turn.card?.title}
                      isContinuation={i > 0 && turns[i - 1].kind === "rohit"}
                    />
                  ) : (
                    <StudentLine key={i} text={turn.text} cost={turn.cost} />
                  ))}

                {current && (
                  <fieldset className="space-y-2 sm:pl-12">
                    <legend className="mb-2 text-sm font-medium text-foreground">Your reply. Each one shows what it costs you or what you promise.</legend>
                    {current.responses.map((opt) => (
                      <ReplyChoice key={opt.key} label={opt.text} cost={opt.cost} onSelect={() => pickResponse(current, opt)} />
                    ))}
                  </fieldset>
                )}

                {finalResult && (
                  <PitchVerdict
                    result={finalResult}
                    skus={profile.skus}
                    isTokenDeducted={isTokenDeducted}
                    tokensRemaining={tokensRemaining}
                    onContinue={confirmAndProceed}
                    onAcceptDefault={acceptDefault}
                    onRetry={retryPitch}
                  />
                )}
                <div ref={bottomRef} />
              </section>

              <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                <Section>
                  {provisional && (
                    <>
                      <RelationshipMeter value={pitchScoreToRelationship(provisional.pitchScore)} delta={lastDelta} />
                      <div className="mt-5">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pitch score so far</p>
                        <ScoreBar earned={provisional.pitchScore} max={15} label="Pitch score so far" />
                      </div>
                    </>
                  )}
                </Section>

                {pushbacks.length > 0 && (
                  <Section title="Rohit's questions">
                    <ol className="space-y-2">
                      {pushbacks.map((pb, i) => {
                        const isDone = responses[pb.id] !== undefined;
                        const isCurrent = i === pushIdx && !isDone && !finalResult;
                        return (
                          <li key={pb.id} className={cn("flex items-center gap-2.5 text-sm", isCurrent ? "font-medium text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/70")}>
                            <span className={cn("sim-num flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs",
                              isDone ? "bg-sim-good/10 text-sim-good" : isCurrent ? "bg-primary text-primary-foreground" : "bg-secondary")}>{i + 1}</span>
                            {PUSHBACK_TOPICS[pb.id] ?? pb.id}
                            {isDone && <span className="sr-only">(answered)</span>}
                          </li>
                        );
                      })}
                    </ol>
                  </Section>
                )}

                <Section title="Your pitch">
                  <ul className="space-y-3">
                    {pitched.map((p) => (
                      <li key={p.skuId}>
                        <p className="text-sm font-medium text-foreground">{p.skuName}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {p.cities.map((c) => (
                            <Tag key={c} tone={(cityStockMap[c] ?? 0) > 0 ? "good" : (p.stockCommitments?.[c] ?? 0) > 0 ? "warn" : "bad"}>{c}</Tag>
                          ))}
                          {p.cities.length === 0 && <span className="text-xs text-muted-foreground">No states picked</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">Green: has stock. Amber: stock promised. Red: no stock.</p>
                </Section>
              </aside>
            </div>
          )}
        </SimPage>
      </div>
    </div>
  );
}

/** First-visit callout pointing at the relationship meter in the sidebar. */
function RelationshipSpotlight({ category, onClose }: { category: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/55" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-spotlight-title"
        className="sim-ui fixed bottom-10 left-[232px] z-[70] w-80 rounded-2xl bg-card shadow-[0_24px_64px_-24px_hsl(24_30%_20%/0.6)] animate-in fade-in slide-in-from-left-2 duration-300 motion-reduce:animate-none"
      >
        <span aria-hidden className="absolute -left-2 bottom-6 h-4 w-4 rotate-45 bg-card" />
        <div className="space-y-3 p-5">
          <p id="cm-spotlight-title" className="text-base font-semibold text-foreground">Your relationship with Rohit</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Rohit Sharma is the category manager for {category}. He decides your shelf space and how many stores stock your products (OSA).
          </p>
          <p className="text-sm text-muted-foreground">This meter shows how much he trusts you. A strong pitch gets you:</p>
          <ul className="space-y-1.5 text-sm text-foreground">
            <li>10% more stores stocked in the states he approves</li>
            <li>15% more ad delivery for all 30 days</li>
            <li>Top shelf spots in search results</li>
          </ul>
          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            A weak pitch uses 1 token and gets no extras. A rejected pitch lowers your final score.
          </p>
          <Button size="sm" className="w-full" onClick={onClose} autoFocus>Got it</Button>
        </div>
      </div>
    </>
  );
}
