/**
 * CmPitch.tsx — Two-phase CM negotiation screen.
 *
 * Phase 1 ("form"): Student builds their pitch — which SKUs, which states, what reasoning.
 * Phase 2 ("chat"): Conversational back-and-forth with Rohit the CM.
 *   - CM opens with a data card summary of the pitch.
 *   - 1–3 pushbacks: CM flags a real issue (with data), student picks from 3 responses.
 *   - CM acknowledges each response.
 *   - Final verdict based on pitch quality + defense quality.
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSim, CmPitchResult } from "@/context/SimContext";
import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BLINKIT_STATES, CityName, StateName, stockedStates, getSkuStatePresence, OfflinePresence } from "@/data/scenarios";
import { FlowHeader } from "@/components/FlowHeader";
import { User, ArrowRight, CheckCircle2, AlertTriangle, XCircle, RotateCcw } from "lucide-react";
import {
  PitchedSKU,
  DataCard,
  Pushback,
  ResponseOption,
  buildPushbacks,
  buildOpeningMessage,
  calcFinalResult,
  buildClosingMessage,
} from "@/lib/cmPitchLogic";

// ─── Constants ────────────────────────────────────────────────────────────────

const REASONS = [
  "Proven high velocity offline",
  "Strategic loss leader for customer acquisition",
  "Premium SKU for brand image",
  "Cross-sell driver with hero SKU",
  "Inventory clearance priority",
  "New market expansion",
];

// Reasons that signal intentional new-market entry — exempt from offline presence pushback
const EXPANSION_REASONS = ["New market expansion", "Strategic loss leader for customer acquisition"];

// Offline presence display helpers
function presenceLabel(p: OfflinePresence): string {
  return p === "strong" ? "MT✓✓" : p === "moderate" ? "MT✓" : p === "weak" ? "MT~" : "";
}
function presenceColor(p: OfflinePresence): string {
  return p === "strong" ? "text-green-600" : p === "moderate" ? "text-blue-500" : p === "weak" ? "text-amber-500" : "text-red-400";
}

/** Min/max credible unit commitment for a new-state pitch, keyed by SKU velocity. */
function commitmentRange(velocity: string): { min: number; max: number } {
  if (velocity === "High")   return { min: 100, max: 1000 };
  if (velocity === "Medium") return { min: 60,  max: 600  };
  return                            { min: 30,  max: 300  }; // Low / Very Low
}

type CommitValidity = "empty" | "too_low" | "ok" | "too_high";

function commitValidity(units: number, velocity: string): CommitValidity {
  if (!units || units <= 0) return "empty";
  const { min, max } = commitmentRange(velocity);
  if (units < min)  return "too_low";
  if (units > max)  return "too_high";
  return "ok";
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${
      status === "good"    ? "bg-green-500" :
      status === "warn"    ? "bg-amber-400" :
      status === "bad"     ? "bg-red-500" :
                            "bg-muted-foreground"
    }`} />
  );
}

function DataCardView({ card }: { card: DataCard }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-background overflow-hidden">
      <div className="px-3 py-2 bg-muted border-b border-border">
        <span className="text-[11px] font-bold text-foreground">{card.title}</span>
      </div>
      <div className="divide-y divide-border">
        {card.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-3 py-1.5 gap-3">
            <span className="text-[11px] text-muted-foreground">{row.label}</span>
            <div className="flex items-center gap-1.5">
              <StatusDot status={row.status} />
              <span className={`text-[11px] font-medium ${
                row.status === "good" ? "text-green-700" :
                row.status === "warn" ? "text-amber-700" :
                row.status === "bad"  ? "text-red-700" :
                                        "text-foreground"
              }`}>{row.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CmBubble({ message, dataCard, isNew }: { message: string; dataCard?: DataCard; isNew?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""}`}>
      <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 max-w-2xl">
        <div className="text-[11px] text-muted-foreground mb-1 font-medium">Rohit Sharma · Category Manager</div>
        <div className="rounded-2xl rounded-tl-none bg-muted px-4 py-3">
          <p className="text-sm text-foreground leading-relaxed">{message}</p>
          {dataCard && <DataCardView card={dataCard} />}
        </div>
      </div>
    </div>
  );
}

function StudentBubble({ message, quality, isNew }: { message: string; quality?: "strong" | "ok" | "weak"; isNew?: boolean }) {
  const qualityStyle =
    quality === "strong" ? "bg-primary text-primary-foreground" :
    quality === "ok"     ? "bg-blue-500 text-white" :
    quality === "weak"   ? "bg-amber-500 text-white" :
                           "bg-primary text-primary-foreground";

  return (
    <div className={`flex items-start gap-3 flex-row-reverse ${isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""}`}>
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1 text-sm font-bold text-muted-foreground">
        You
      </div>
      <div className="max-w-xl">
        <div className={`rounded-2xl rounded-tr-none px-4 py-3 ${qualityStyle}`}>
          <p className="text-sm leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 1 — Pitch Form ────────────────────────────────────────────────────

interface PitchRow {
  enabled: boolean;
  cities: CityName[];
  reasoning: string;
  justification: string;
  /** Units committed for 0-OSA states — city → units */
  stockCommitments: Record<string, number>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CmPitch() {
  const nav = useNavigate();
  const { student, scenario, setCmPitch, consumeToken, tokensRemaining } = useSim();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!student) nav("/", { replace: true });
    else if (!scenario) nav("/brief", { replace: true });
    else if (localStorage.getItem("sim_brief_ack") !== "1") nav("/brief", { replace: true });
  }, [student, scenario, nav]);

  if (!student || !scenario) return null;
  const { profile, cityStockMap } = scenario;

  // ── CM spotlight — shown on first visit, dismissed on Okay ───────────────
  const [showCmSpotlight, setShowCmSpotlight] = useState(true);

  // ── Phase 1 state ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"form" | "chat">("form");
  const [rows, setRows] = useState<Record<string, PitchRow>>(() => {
    const init: Record<string, PitchRow> = {};
    profile.skus.forEach((s) => {
      init[s.id] = { enabled: false, cities: [], reasoning: "", justification: "", stockCommitments: {} };
    });
    return init;
  });

  // ── Phase 2 state ─────────────────────────────────────────────────────────
  // Conversation turns rendered in order
  type ConvTurn =
    | { kind: "cm_open"; message: string; dataCard: DataCard }
    | { kind: "cm_push"; pushback: Pushback }
    | { kind: "student"; message: string; quality: "strong" | "ok" | "weak" }
    | { kind: "cm_ack"; message: string }
    | { kind: "verdict"; result: CmPitchResult; closing: string };

  const [turns, setTurns]                 = useState<ConvTurn[]>([]);
  const [pushbacks, setPushbacks]         = useState<Pushback[]>([]);
  const [currentPushIdx, setCurrentPushIdx] = useState(0);
  const [responses, setResponses]         = useState<Record<string, string>>({});
  const [pitchedSKUs, setPitchedSKUs]     = useState<PitchedSKU[]>([]);
  const [finalResult, setFinalResult]     = useState<CmPitchResult | null>(null);
  const [awaitingChoice, setAwaitingChoice] = useState(false); // true when showing response buttons
  const [tokenDeducted, setTokenDeducted] = useState(false); // true when a token was auto-deducted

  // Auto-scroll on new turns
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const update = (id: string, patch: Partial<PitchRow>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  // ── Commitment validation — block submit if any committed value is out of range ──
  const commitmentErrors: string[] = [];
  profile.skus.filter((s) => rows[s.id].enabled).forEach((s) => {
    const row = rows[s.id];
    row.cities.filter((c) => (cityStockMap[c] ?? 0) === 0).forEach((c) => {
      const validity = commitValidity(row.stockCommitments[c] ?? 0, s.velocity);
      if (validity === "too_low") {
        const { min } = commitmentRange(s.velocity);
        commitmentErrors.push(`${s.name} → ${c}: commit at least ${min} units`);
      }
      if (validity === "too_high") {
        const { max } = commitmentRange(s.velocity);
        commitmentErrors.push(`${s.name} → ${c}: max ${max} units for ${s.velocity.toLowerCase()} velocity`);
      }
    });
  });
  const hasCommitmentErrors = commitmentErrors.length > 0;

  // Block submit if any enabled SKU has no reasoning selected
  const missingReasoningSkus = profile.skus.filter(
    (s) => rows[s.id].enabled && (!rows[s.id].reasoning || rows[s.id].reasoning.trim() === "")
  );
  const hasMissingReasoning = missingReasoningSkus.length > 0;

  // ── Submit pitch → switch to chat ─────────────────────────────────────────
  const submitPitch = () => {
    if (hasCommitmentErrors) return;
    const pitched: PitchedSKU[] = profile.skus
      .filter((s) => rows[s.id].enabled)
      .map((s) => ({
        skuId: s.id,
        skuName: s.name,
        velocity: s.velocity,
        mrp: s.mrp,
        margin: s.margin,
        reasoning: rows[s.id].reasoning,
        justification: rows[s.id].justification,
        cities: rows[s.id].cities,
        stockCommitments: rows[s.id].stockCommitments,
      }));

    const pbs = buildPushbacks(pitched, scenario);
    const opening = buildOpeningMessage(pitched, scenario);

    setPitchedSKUs(pitched);
    setPushbacks(pbs);
    setCurrentPushIdx(0);
    setTurns([{ kind: "cm_open", message: opening.message, dataCard: opening.dataCard }]);
    setPhase("chat");

    // If no pushbacks, move to verdict immediately after a tick
    if (pbs.length === 0) {
      const result = calcFinalResult(pitched, scenario, [], {});
      const closing = buildClosingMessage(result, profile.name);
      setTimeout(() => {
        setTurns((t) => [...t, { kind: "verdict", result, closing }]);
        setFinalResult(result);
        if (result.status === "weak") { consumeToken(); setTokenDeducted(true); }
      }, 800);
    } else {
      // Show first pushback after a short delay (feels like CM is "thinking")
      setTimeout(() => {
        setTurns((t) => [...t, { kind: "cm_push", pushback: pbs[0] }]);
        setAwaitingChoice(true);
      }, 800);
    }
  };

  // ── Student picks a response ──────────────────────────────────────────────
  const pickResponse = (pushback: Pushback, option: ResponseOption) => {
    setAwaitingChoice(false);
    const newResponses = { ...responses, [pushback.id]: option.key };
    setResponses(newResponses);

    // Add student turn
    setTurns((t) => [...t, { kind: "student", message: option.text, quality: option.quality }]);

    // Add CM ack after a tick
    setTimeout(() => {
      setTurns((t) => [...t, { kind: "cm_ack", message: option.cmAck }]);

      const nextIdx = currentPushIdx + 1;
      if (nextIdx < pushbacks.length) {
        // Next pushback
        setTimeout(() => {
          setCurrentPushIdx(nextIdx);
          setTurns((t) => [...t, { kind: "cm_push", pushback: pushbacks[nextIdx] }]);
          setAwaitingChoice(true);
        }, 600);
      } else {
        // All pushbacks done → compute final verdict
        setTimeout(() => {
          const result = calcFinalResult(pitchedSKUs, scenario, pushbacks, newResponses);
          const closing = buildClosingMessage(result, profile.name);
          setTurns((t) => [...t, { kind: "verdict", result, closing }]);
          setFinalResult(result);
          if (result.status === "weak") { consumeToken(); setTokenDeducted(true); }
        }, 600);
      }
    }, 400);
  };

  // ── Accept result and proceed ─────────────────────────────────────────────
  const confirmAndProceed = () => {
    if (finalResult) {
      setCmPitch(finalResult);
      nav("/campaign");
    }
  };

  // ── Accept default and proceed after rejection ────────────────────────────
  const acceptDefault = () => {
    const hero = [...profile.skus].sort((a, b) => {
      const order: Record<string, number> = { High: 3, Medium: 2, Low: 1, "Very Low": 0 };
      return (order[b.velocity] ?? 0) - (order[a.velocity] ?? 0);
    })[0];
    const topCity = (Object.keys(cityStockMap) as CityName[]).reduce<CityName | null>((best, c) =>
      best === null || (cityStockMap[c] ?? 0) > (cityStockMap[best] ?? 0) ? c : best
    , null);

    const defaultResult: CmPitchResult = {
      status: "weak",
      approvedSKUs: [hero.id],
      approvedCities: topCity ? [topCity] : [],
      pitchScore: 0,
      osaBoost: false,
      message: "Default approval — hero SKU only in highest-OSA state.",
      flags: ["Accepted default after rejection"],
    };
    setCmPitch(defaultResult);
    nav("/campaign");
  };

  // ── Retry (costs a token) ─────────────────────────────────────────────────
  const retryPitch = () => {
    consumeToken();
    setPhase("form");
    setTurns([]);
    setPushbacks([]);
    setCurrentPushIdx(0);
    setResponses({});
    setPitchedSKUs([]);
    setFinalResult(null);
    setAwaitingChoice(false);
    setTokenDeducted(false);
  };

  // ─── Status helpers ───────────────────────────────────────────────────────
  const statusColor = (s: CmPitchResult["status"]) =>
    s === "strong"  ? "bg-green-100 text-green-800 border-green-300" :
    s === "decent"  ? "bg-blue-100 text-blue-800 border-blue-300" :
    s === "weak"    ? "bg-amber-100 text-amber-800 border-amber-300" :
                     "bg-red-100 text-red-800 border-red-300";

  const statusIcon = (s: CmPitchResult["status"]) =>
    s === "strong" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
    s === "decent" ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> :
    s === "weak"   ? <AlertTriangle className="h-5 w-5 text-amber-600" /> :
                     <XCircle className="h-5 w-5 text-red-600" />;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden w-full">
      <BlinkitSidebar highlightCm={showCmSpotlight} />
      <div className="flex-1 bg-background overflow-y-auto">
        <FlowHeader crumb="Category Manager Meeting" step="cm-pitch" backTo="/brief" backLabel="Brief" />

        {/* ═══════════════ CM RELATIONSHIP SPOTLIGHT ═══════════════════════ */}
        {showCmSpotlight && (
          <>
            {/* Backdrop — dims everything except the highlighted sidebar section */}
            <div
              className="fixed inset-0 z-50 bg-black/55"
              onClick={() => setShowCmSpotlight(false)}
            />

            {/* Callout card — anchored left-56 (224px) bottom-12 to sit beside the meter */}
            <div className="fixed bottom-10 left-[232px] z-[70] w-80 animate-in fade-in slide-in-from-left-2 duration-300">
              {/* Arrow pointing left to sidebar */}
              <div className="absolute -left-2 bottom-6 h-4 w-4 rotate-45 bg-card border-l border-b border-border" />

              <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                <div className="px-4 py-3 bg-primary/10 border-b border-border flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary-foreground">!</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground">CM Relationship — what is this?</span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Rohit Sharma</strong> is your Category Manager — he controls shelf placement
                    and On-Shelf Availability (OSA) for the <strong className="text-foreground">{profile.category}</strong> category.
                  </p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    This meter tracks how well your pitch lands. A stronger relationship means:
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-[11px] text-foreground">+10% OSA in approved states → fewer out-of-stock losses</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-[11px] text-foreground">+15% ad delivery multiplier across your full 30-day run</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-[11px] text-foreground">Premium shelf placement in search results</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border pt-2">
                    A <span className="text-amber-700 font-medium">weak pitch</span> costs 1 token and gives you no benefits.
                    A <span className="text-red-700 font-medium">rejected pitch</span> penalises your final score.
                  </p>
                  <Button
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => setShowCmSpotlight(false)}
                  >
                    Okay, got it
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════ PHASE 1: FORM ═══════════════ */}
        {phase === "form" && (
          <div className="px-8 py-6 max-w-5xl space-y-5 pb-12">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Pitch to Category Manager</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Rohit controls shelf space and OSA for the {profile.category} category. Choose your SKUs, select target states, and give him a reason to approve.
              </p>
            </div>

            {/* CM intro card */}
            <Card className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-sm text-foreground">Rohit Sharma</span>
                    <Badge variant="outline" className="text-xs">Category Manager — {profile.category}</Badge>
                  </div>
                  <div className="rounded-2xl rounded-tl-none bg-muted px-4 py-3 text-sm text-foreground max-w-2xl">
                    Hi {student.name}. I control shelf placement and OSA for the <strong>{profile.category}</strong> category.
                    Tell me which SKUs you want me to push, in which states, and <strong>why</strong>. I'll push back on anything that doesn't make sense from the data.
                    <span className="block mt-1 text-xs text-muted-foreground">Be precise — I'll check your claims against the actual numbers.</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Token explainer */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start">
              <span className="text-lg shrink-0">🎫</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-900">You have {tokensRemaining} token{tokensRemaining !== 1 ? "s" : ""} for this simulation</span>
                  <span className="text-[10px] text-amber-700 font-medium shrink-0">{tokensRemaining}/10 remaining</span>
                </div>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  Tokens are your <strong>do-over currency</strong>. A weak pitch (score 4–7) auto-deducts 1 token. Re-pitching costs 1 more.
                  During the live simulation, tokens unlock A/B tests, resolve cannibalisation conflicts, and let you react to cluster opportunities.
                  <strong> You cannot earn more — spend them wisely.</strong>
                </p>
              </div>
            </div>

            {/* Pitch rows per SKU */}
            <div className="space-y-3">
              {profile.skus.map((s) => {
                const row = rows[s.id];
                const osaInPrimary = cityStockMap[profile.primaryState] ?? 0;
                return (
                  <Card key={s.id} className={`p-4 transition-colors ${row.enabled ? "border-primary/60 bg-primary/[0.02]" : ""}`}>
                    <div className="flex items-start gap-4">
                      {/* Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer min-w-[110px] pt-0.5">
                        <Checkbox
                          checked={row.enabled}
                          onCheckedChange={(v) => update(s.id, { enabled: !!v })}
                        />
                        <span className="text-xs font-medium text-foreground">{row.enabled ? "Pitching" : "Skip"}</span>
                      </label>

                      <div className="flex-1">
                        {/* SKU header */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{s.name}</span>
                          <span className="text-xs text-muted-foreground">₹{s.mrp} MRP · ₹{s.margin} margin</span>
                          <Badge variant="outline" className={
                            s.velocity === "High"     ? "border-green-500 text-green-700 bg-green-50" :
                            s.velocity === "Medium"   ? "border-blue-400 text-blue-700 bg-blue-50" :
                            s.velocity === "Low"      ? "border-amber-400 text-amber-700 bg-amber-50" :
                                                       "border-red-400 text-red-700 bg-red-50"
                          }>{s.velocity} velocity</Badge>
                        </div>

                        {row.enabled && (
                          <div className="mt-3 grid grid-cols-2 gap-4">
                            {/* State picker */}
                            <div>
                              <div className="text-[11px] font-semibold text-foreground mb-1">Target states</div>
                              {/* Legend */}
                              <div className="text-[9px] text-muted-foreground mb-1.5 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-x-2">
                                  <span className="font-semibold text-foreground">MT = Modern Trade</span>
                                  <span className="italic">offline retail (DMart, Reliance Smart, etc.)</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span>🟩 Green border = Blinkit stock</span>
                                  <span className="text-green-600 font-medium">MT✓✓ Strong offline</span>
                                  <span className="text-blue-500 font-medium">MT✓ Moderate</span>
                                  <span className="text-amber-500 font-medium">MT~ Weak</span>
                                  <span className="text-red-400 font-medium">— No offline presence</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 rounded-lg border border-border bg-muted/30">
                                {BLINKIT_STATES.map((c) => {
                                  const selected = row.cities.includes(c as CityName);
                                  const osa = cityStockMap[c] ?? 0;
                                  const hasStock = osa > 0;
                                  const presence = getSkuStatePresence(profile, s.id, c as StateName);
                                  const pLabel = presenceLabel(presence);
                                  const pColor = presenceColor(presence);
                                  return (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => {
                                        const next = selected
                                          ? row.cities.filter((x) => x !== c)
                                          : [...row.cities, c as CityName];
                                        update(s.id, { cities: next });
                                      }}
                                      className={`px-2 py-1 rounded text-[10px] border transition-colors flex flex-col items-start leading-tight ${
                                        selected
                                          ? "border-primary bg-primary/15 text-primary font-medium"
                                          : hasStock
                                          ? "border-green-300 text-green-800 bg-green-50 hover:border-green-500"
                                          : "border-border text-muted-foreground hover:border-primary/40"
                                      }`}
                                    >
                                      <span>
                                        {c}
                                        {hasStock && <span className="ml-1 text-[9px] opacity-70">{osa}%</span>}
                                      </span>
                                      <span className={`text-[8px] ${selected ? "opacity-60" : pLabel ? pColor : "text-muted-foreground"}`}>
                                        {pLabel || "—"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Reasoning */}
                            <div className="space-y-2">
                              <div>
                                <div className="text-[11px] font-semibold text-foreground mb-1">Your reasoning</div>
                                <Select
                                  value={row.reasoning}
                                  onValueChange={(v) => update(s.id, { reasoning: v })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Pick a reason..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {REASONS.map((r) => (
                                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold text-foreground mb-1">Supporting evidence (optional)</div>
                                <Input
                                  value={row.justification}
                                  onChange={(e) => update(s.id, { justification: e.target.value })}
                                  placeholder="e.g. 34% sell-through in offline modern trade..."
                                  className="h-8 text-xs"
                                />
                              </div>
                              {/* Warning if low-velocity + wrong reasoning */}
                              {(s.velocity === "Low" || s.velocity === "Very Low") &&
                               row.reasoning === "Proven high velocity offline" && (
                                <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
                                  ⚠️ Your velocity data says {s.velocity} — Rohit will likely question this reasoning.
                                </div>
                              )}
                              {/* Warning if pitching states with no/weak offline presence + wrong reasoning */}
                              {row.reasoning && !EXPANSION_REASONS.includes(row.reasoning) && (() => {
                                const weakOrNone = row.cities.filter((c) => {
                                  const p = getSkuStatePresence(profile, s.id, c as StateName);
                                  return p === "none" || p === "weak";
                                });
                                const noneStates = row.cities.filter((c) => getSkuStatePresence(profile, s.id, c as StateName) === "none");
                                if (weakOrNone.length === 0) return null;
                                return (
                                  <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
                                    ⚠️ {noneStates.length > 0
                                      ? `No offline presence in ${noneStates.slice(0, 2).join(", ")}${noneStates.length > 2 ? ` +${noneStates.length - 2}` : ""} — Rohit will push back on "${row.reasoning}" here. Use "New market expansion" to avoid this.`
                                      : `Weak MT sell-through in ${weakOrNone.slice(0, 2).join(", ")} — consider "New market expansion" as your reasoning.`
                                    }
                                  </div>
                                );
                              })()}
                              {/* Affirm new market expansion reasoning */}
                              {row.reasoning === "New market expansion" && row.cities.length > 0 && (
                                <div className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded p-1.5">
                                  ✓ "New market expansion" exempts you from offline presence pushback — Rohit will accept it but give minimal inventory in untested states.
                                </div>
                              )}
                              {/* Stock commitments for 0-OSA selected states */}
                              {(() => {
                                const zeroCities = row.cities.filter((c) => (cityStockMap[c] ?? 0) === 0);
                                if (zeroCities.length === 0) return null;
                                const range = commitmentRange(s.velocity);
                                return (
                                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                                    <div className="text-[10px] text-amber-800 font-medium">
                                      ⚠️ {zeroCities.join(", ")} {zeroCities.length > 1 ? "have" : "has"} 0% OSA.
                                      Commit units below so Rohit knows you're serious.
                                    </div>
                                    {zeroCities.map((c) => {
                                      const committed = row.stockCommitments[c] ?? 0;
                                      const validity = commitValidity(committed, s.velocity);
                                      const inputRing =
                                        validity === "ok"       ? "ring-2 ring-green-500 border-green-400" :
                                        validity === "too_low"  ? "ring-2 ring-red-400 border-red-300" :
                                        validity === "too_high" ? "ring-2 ring-red-400 border-red-300" :
                                                                  "";
                                      const hint =
                                        validity === "empty"    ? <span className="text-[9px] text-amber-600">Enter units (min {range.min})</span> :
                                        validity === "too_low"  ? <span className="text-[9px] text-red-600">Too few — min {range.min} to be credible</span> :
                                        validity === "too_high" ? <span className="text-[9px] text-red-600">Unrealistic — max {range.max} for {s.velocity.toLowerCase()} velocity</span> :
                                                                  <span className="text-[9px] text-green-700">✓ Credible commitment</span>;
                                      return (
                                        <div key={c} className="space-y-0.5">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground w-28 shrink-0">{c} units:</span>
                                            <Input
                                              type="number"
                                              min={range.min}
                                              max={range.max}
                                              step={10}
                                              placeholder={`${range.min}–${range.max}`}
                                              value={committed || ""}
                                              onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                update(s.id, {
                                                  stockCommitments: { ...row.stockCommitments, [c]: val },
                                                });
                                              }}
                                              className={`h-7 text-xs w-28 ${inputRing}`}
                                            />
                                            <span className="text-[9px] text-muted-foreground">units</span>
                                          </div>
                                          <div className="ml-[7.5rem]">{hint}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-between items-center pb-8">
              <Button variant="outline" onClick={() => nav("/brief")}>← Back to Brief</Button>
              <div className="flex flex-col items-end gap-1">
                {hasMissingReasoning && (
                  <div className="text-[10px] text-red-600 text-right max-w-xs">
                    Provide reasoning for: {missingReasoningSkus.map((s) => s.name).join(", ")}
                  </div>
                )}
                {hasCommitmentErrors && (
                  <div className="text-[10px] text-red-600 text-right max-w-xs">
                    Fix {commitmentErrors.length} commitment error{commitmentErrors.length > 1 ? "s" : ""} before submitting
                  </div>
                )}
                <Button
                  onClick={submitPitch}
                  disabled={!profile.skus.some((s) => rows[s.id].enabled) || hasCommitmentErrors || hasMissingReasoning}
                  className="gap-2"
                >
                  Submit Pitch to Rohit <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════ PHASE 2: CHAT ═══════════════ */}
        {phase === "chat" && (
          <div className="flex h-[calc(100vh-56px)]">
            {/* Chat area */}
            <div className="flex-1 flex flex-col">
              {/* Scrollable conversation */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
                {turns.map((turn, i) => {
                  const isNew = i === turns.length - 1;

                  if (turn.kind === "cm_open") {
                    return (
                      <CmBubble
                        key={i}
                        message={turn.message}
                        dataCard={turn.dataCard}
                        isNew={isNew}
                      />
                    );
                  }

                  if (turn.kind === "cm_push") {
                    return (
                      <div key={i}>
                        <CmBubble
                          message={turn.pushback.cmMessage}
                          dataCard={turn.pushback.dataCard}
                          isNew={isNew}
                        />
                        {/* Response options — only show for the CURRENT unanswered pushback */}
                        {awaitingChoice && i === turns.length - 1 && (
                          <div className="ml-12 mt-3 space-y-2 animate-in fade-in duration-300">
                            <div className="text-[11px] text-muted-foreground font-medium mb-2">Your response:</div>
                            {turn.pushback.responses.map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => pickResponse(turn.pushback, opt)}
                                className="w-full max-w-2xl text-left text-xs rounded-xl border border-border bg-background px-4 py-3 hover:border-primary hover:bg-primary/5 transition-colors group"
                              >
                                <span className="flex items-start gap-2">
                                  <span className={`mt-0.5 shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${
                                    opt.quality === "strong" ? "border-green-500 text-green-500" :
                                    opt.quality === "ok"     ? "border-blue-500 text-blue-500" :
                                                               "border-amber-500 text-amber-500"
                                  }`}>
                                    {opt.quality === "strong" ? "A" : opt.quality === "ok" ? "B" : "C"}
                                  </span>
                                  <span className="text-foreground leading-relaxed">{opt.text}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (turn.kind === "student") {
                    return (
                      <StudentBubble
                        key={i}
                        message={turn.message}
                        quality={turn.quality}
                        isNew={isNew}
                      />
                    );
                  }

                  if (turn.kind === "cm_ack") {
                    return (
                      <CmBubble
                        key={i}
                        message={turn.message}
                        isNew={isNew}
                      />
                    );
                  }

                  if (turn.kind === "verdict") {
                    const r = turn.result;
                    return (
                      <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <CmBubble message={turn.closing} />
                        {/* Verdict card */}
                        <div className="ml-12 mt-4 max-w-2xl">
                          <Card className="p-5 border-2 border-primary/30">
                            <div className="flex items-start gap-3">
                              {statusIcon(r.status)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-bold text-foreground">Pitch Outcome</span>
                                  <Badge className={`text-xs ${statusColor(r.status)}`}>
                                    {r.status.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Score: {r.pitchScore}/15
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                                  <div>
                                    <div className="text-[11px] font-semibold text-foreground mb-1">Approved SKUs</div>
                                    <div className="text-muted-foreground">
                                      {r.approvedSKUs.length === 0
                                        ? "None"
                                        : r.approvedSKUs.map((id) => profile.skus.find((s) => s.id === id)?.name).join(", ")}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-semibold text-foreground mb-1">Approved States</div>
                                    <div className="text-muted-foreground">
                                      {r.approvedCities.length === 0 ? "None" : r.approvedCities.join(", ")}
                                    </div>
                                  </div>
                                </div>

                                {r.osaBoost && (
                                  <div className="mt-3 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                                    🚀 +10% OSA boost in approved states — your campaigns will deliver more impressions
                                  </div>
                                )}

                                {r.flags.length > 0 && (
                                  <div className="mt-3">
                                    <div className="text-[11px] font-semibold text-amber-700 mb-1">Issues noted:</div>
                                    <ul className="space-y-0.5">
                                      {r.flags.map((f, fi) => (
                                        <li key={fi} className="text-[11px] text-amber-800">• {f}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {tokenDeducted && (
                                  <div className="mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-center gap-2">
                                    <span>🎫</span>
                                    <span><strong>−1 token deducted</strong> — a weak pitch costs a token automatically. {tokensRemaining} token{tokensRemaining !== 1 ? "s" : ""} remaining.</span>
                                  </div>
                                )}

                                <div className="mt-4 flex gap-2">
                                  {r.status !== "rejected" ? (
                                    <Button onClick={confirmAndProceed} className="gap-2">
                                      Continue to Campaign Builder <ArrowRight className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <>
                                      <Button variant="outline" onClick={acceptDefault}>
                                        Accept Default (hero SKU only)
                                      </Button>
                                      <Button
                                        onClick={retryPitch}
                                        disabled={tokensRemaining <= 0}
                                        variant="outline"
                                        className="gap-2"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                        Re-pitch ({tokensRemaining} tokens left)
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
                <div ref={chatBottomRef} />
              </div>
            </div>

            {/* ── Right sidebar — pitch summary ─────────────────────────────── */}
            <div className="w-72 border-l border-border bg-muted/20 p-4 overflow-y-auto shrink-0">
              <div className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">Your Pitch</div>

              {profile.skus.filter((s) => rows[s.id].enabled).length === 0 ? (
                <p className="text-xs text-muted-foreground">No SKUs pitched.</p>
              ) : (
                <div className="space-y-3">
                  {profile.skus.filter((s) => rows[s.id].enabled).map((s) => {
                    const row = rows[s.id];
                    const goodCities = row.cities.filter((c) => (cityStockMap[c] ?? 0) > 0);
                    const badCities  = row.cities.filter((c) => (cityStockMap[c] ?? 0) === 0);
                    return (
                      <div key={s.id} className="rounded-lg border border-border bg-background p-3">
                        <div className="text-xs font-semibold text-foreground">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{s.velocity} velocity · ₹{s.mrp}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{row.reasoning || "No reasoning"}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {goodCities.map((c) => (
                            <span key={c} className="text-[9px] px-1 py-0.5 rounded bg-green-50 border border-green-200 text-green-700">{c}</span>
                          ))}
                          {badCities.map((c) => (
                            <span key={c} className="text-[9px] px-1 py-0.5 rounded bg-red-50 border border-red-200 text-red-700">{c} ⚠️</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Progress */}
              {pushbacks.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">Negotiation</div>
                  {pushbacks.map((pb, i) => {
                    const done = responses[pb.id] !== undefined;
                    const isCurrent = i === currentPushIdx && !finalResult;
                    return (
                      <div key={pb.id} className={`flex items-center gap-2 mb-1.5 text-[11px] ${isCurrent ? "text-primary font-medium" : done ? "text-green-700" : "text-muted-foreground"}`}>
                        <span className={`h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          done ? "bg-green-100 border-green-400 text-green-700" :
                          isCurrent ? "bg-primary/10 border-primary text-primary" :
                          "border-border text-muted-foreground"
                        }`}>{i + 1}</span>
                        {pb.id === "zero_stock"        ? "Stock coverage" :
                         pb.id === "offline_presence"  ? "Offline market data" :
                         pb.id === "velocity_mismatch" ? "Velocity claim" :
                         pb.id === "fill_rate"         ? "Fill rate & supply" :
                         pb.id === "dilution"          ? "Budget dilution" :
                         pb.id === "competition"       ? "Competitive pressure" :
                                                         "Inventory health"}
                      </div>
                    );
                  })}
                  {finalResult && (
                    <div className="mt-2 text-[11px] font-semibold text-foreground">
                      Final score: {finalResult.pitchScore}/15 · {finalResult.status}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
