// One product in the CM pitch form: include it, pick states, give a reason,
// promise stock for states that have none.

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "@/components/sim/primitives";
import type { Tone } from "@/components/sim/tone";
import { BLINKIT_STATES, getSkuStatePresence, type CityName, type Scenario, type SKU, type StateName, type Velocity } from "@/data/scenarios";
import { PITCH_REASONS, REASON_LABELS, isExpansionReason } from "@/lib/cmPitchLogic";
import { commitmentRange, commitValidity, PRESENCE_LABEL, type PitchRow } from "@/components/rohit/pitchForm";

const VELOCITY_TONE: Record<Velocity, Tone> = { "High": "good", "Medium": "neutral", "Low": "warn", "Very Low": "bad" };
const VELOCITY_LABEL: Record<Velocity, string> = {
  "High": "Sells fast on Blinkit",
  "Medium": "Sells at a steady pace on Blinkit",
  "Low": "Sells slowly on Blinkit",
  "Very Low": "Sells very slowly on Blinkit",
};

type Props = {
  sku: SKU;
  row: PitchRow;
  scenario: Scenario;
  onChange: (patch: Partial<PitchRow>) => void;
};

export function PitchSkuCard({ sku, row, scenario, onChange }: Props) {
  const id = useId();
  const { profile, cityStockMap } = scenario;
  const stockOf = (s: string) => cityStockMap[s as CityName] ?? 0;
  const toggleState = (s: CityName) =>
    onChange({ cities: row.cities.includes(s) ? row.cities.filter((x) => x !== s) : [...row.cities, s] });

  return (
    <article
      className={cn(
        "rounded-2xl bg-card p-5 transition-shadow duration-200",
        row.enabled
          ? "shadow-[inset_0_0_0_1.5px_hsl(var(--primary)/0.55),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]"
          : "shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]",
      )}
    >
      <label htmlFor={`${id}-on`} className="flex cursor-pointer items-start gap-3">
        <Checkbox id={`${id}-on`} checked={row.enabled} onCheckedChange={(v) => onChange({ enabled: !!v })} className="mt-1" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">{sku.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="sim-num">Price ₹{sku.mrp}</span>
            <span aria-hidden>·</span>
            <span className="sim-num">You keep ₹{sku.margin} per unit</span>
            <Tag tone={VELOCITY_TONE[sku.velocity]}>{VELOCITY_LABEL[sku.velocity]}</Tag>
          </span>
        </span>
        <span className="pt-1 text-xs font-medium text-muted-foreground">{row.enabled ? "In the pitch" : "Not included"}</span>
      </label>

      {row.enabled && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <fieldset>
            <legend className="text-sm font-medium text-foreground">States to sell in</legend>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Green states have stock on Blinkit, with the share of stores that have it (OSA). The second line shows how it sells in regular shops.
            </p>
            <div className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-secondary/50 p-2">
              {BLINKIT_STATES.map((s) => {
                const selected = row.cities.includes(s);
                const osa = stockOf(s);
                const presence = getSkuStatePresence(profile, sku.id, s as StateName);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleState(s)}
                    className={cn(
                      "flex flex-col items-start rounded-lg px-2.5 py-1.5 text-left text-xs leading-tight",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : osa > 0
                        ? "bg-card text-foreground shadow-[inset_0_0_0_1px_hsl(var(--sim-good)/0.5)] hover:bg-accent"
                        : "bg-card text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:text-foreground",
                    )}
                  >
                    <span className="font-medium">
                      {s}
                      {osa > 0 && <span className="sim-num ml-1 opacity-80">{osa}%</span>}
                    </span>
                    <span className={cn("mt-0.5 text-[11px]", selected ? "opacity-80" : "text-muted-foreground")}>{PRESENCE_LABEL[presence]}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={`${id}-reason`} className="text-sm font-medium text-foreground">Why should Rohit stock it?</label>
              <Select value={row.reasoning} onValueChange={(v) => onChange({ reasoning: v })}>
                <SelectTrigger id={`${id}-reason`} className="h-9 text-sm">
                  <SelectValue placeholder="Pick a reason" />
                </SelectTrigger>
                <SelectContent>
                  {PITCH_REASONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-sm">{REASON_LABELS[r] ?? r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-evidence`} className="text-sm font-medium text-foreground">Proof (optional)</label>
              <Input
                id={`${id}-evidence`}
                value={row.justification}
                onChange={(e) => onChange({ justification: e.target.value })}
                placeholder="For example: 34% of stock sells each week in big stores"
                className="h-9 text-sm"
              />
            </div>
            <PitchWarnings sku={sku} row={row} scenario={scenario} />
            <StockPromises sku={sku} row={row} scenario={scenario} onChange={onChange} />
          </div>
        </div>
      )}
    </article>
  );
}

function Note({ tone, children }: { tone: Tone; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    neutral: "bg-secondary text-foreground",
    good: "bg-sim-good/10 text-sim-good",
    warn: "bg-sim-warn/10 text-sim-warn",
    bad: "bg-sim-bad/10 text-sim-bad",
  };
  return <p className={cn("rounded-lg px-3 py-2 text-xs leading-relaxed", styles[tone])}>{children}</p>;
}

function PitchWarnings({ sku, row, scenario }: Omit<Props, "onChange">) {
  const { profile } = scenario;
  const slow = (sku.velocity === "Low" || sku.velocity === "Very Low") && row.reasoning === "Proven high velocity offline";
  const presenceOf = (c: string) => getSkuStatePresence(profile, sku.id, c as StateName);
  const noShop = row.cities.filter((c) => presenceOf(c) === "none");
  const weakShop = row.cities.filter((c) => presenceOf(c) === "weak" || presenceOf(c) === "none");
  const expansion = isExpansionReason(row.reasoning);
  const list = (xs: string[]) => `${xs.slice(0, 2).join(", ")}${xs.length > 2 ? ` and ${xs.length - 2} more` : ""}`;

  return (
    <>
      {slow && <Note tone="warn">Blinkit data says this sells {sku.velocity.toLowerCase()}. Rohit will likely question "sells fast in shops".</Note>}
      {row.reasoning && !expansion && weakShop.length > 0 && (
        <Note tone="warn">
          {noShop.length > 0
            ? `It isn't sold in shops in ${list(noShop)}. Rohit will push back on this reason there. "Entering a new market" fits better.`
            : `It barely sells in shops in ${list(weakShop)}. Think about "Entering a new market" as your reason.`}
        </Note>
      )}
      {row.reasoning === "New market expansion" && row.cities.length > 0 && (
        <Note tone="good">Rohit accepts new markets, but he'll give you little stock there until sales prove demand.</Note>
      )}
    </>
  );
}

function StockPromises({ sku, row, scenario, onChange }: Props) {
  const zero = row.cities.filter((c) => (scenario.cityStockMap[c] ?? 0) === 0);
  if (zero.length === 0) return null;
  const range = commitmentRange(sku.velocity);
  const hint: Record<ReturnType<typeof commitValidity>, { text: string; tone: Tone }> = {
    empty: { text: `Enter at least ${range.min}`, tone: "warn" },
    too_low: { text: `Too few. At least ${range.min} to be believable.`, tone: "bad" },
    too_high: { text: `Too many. At most ${range.max} for a product that sells ${sku.velocity.toLowerCase()}.`, tone: "bad" },
    ok: { text: "Believable promise", tone: "good" },
  };
  return (
    <div className="space-y-3 rounded-xl bg-sim-warn/10 p-3">
      <p className="text-xs font-medium text-sim-warn">
        {zero.join(", ")} {zero.length > 1 ? "have" : "has"} no stock today. Promise how many units you will send, so Rohit knows you are serious.
      </p>
      {zero.map((c) => {
        const units = row.stockCommitments[c] ?? 0;
        const v = commitValidity(units, sku.velocity);
        const inputId = `promise-${sku.id}-${c}`;
        return (
          <div key={c} className="space-y-1">
            <label htmlFor={inputId} className="text-xs font-medium text-foreground">Units for {c}</label>
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={range.min}
              max={range.max}
              step={10}
              placeholder={`${range.min} to ${range.max}`}
              value={units || ""}
              aria-invalid={v === "too_low" || v === "too_high"}
              onChange={(e) => onChange({ stockCommitments: { ...row.stockCommitments, [c]: parseInt(e.target.value, 10) || 0 } })}
              className="h-8 w-36 bg-card text-sm"
            />
            <p className={cn("text-[11px]", hint[v].tone === "good" ? "text-sim-good" : hint[v].tone === "bad" ? "text-sim-bad" : "text-sim-warn")}>{hint[v].text}</p>
          </div>
        );
      })}
    </div>
  );
}
