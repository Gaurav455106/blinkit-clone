// Deal sheet part 1: split each product's stock across the states Rohit serves.

import { RotateCcw } from "lucide-react";
import type { SKU } from "@/data/scenarios";
import type { StockSplit } from "@/market/deal";
import { Section, Tag } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";
import { stagger } from "@/components/game/GameBits";

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** Stock share within this many points of the search share counts as a match. */
const MATCH_GAP = 0.1;

/** This state's share of the product's stock against its share of searches (SPEC §15). */
function FitBar({ stockShare, searchShare, state }: { stockShare: number; searchShare: number; state: string }) {
  const match = Math.abs(stockShare - searchShare) <= MATCH_GAP;
  return (
    <span className="mt-2 block" aria-label={`${state}: ${pct(stockShare)} of this stock, ${pct(searchShare)} of searches`}>
      <span className="relative block h-2 overflow-hidden rounded-full bg-secondary">
        <span className={`sim-bar absolute inset-y-0 left-0 rounded-full ${match ? "bg-sim-good" : "bg-sim-warn"}`} style={{ width: `${Math.min(100, stockShare * 100)}%` }} />
        <span aria-hidden className="absolute inset-y-[-2px] w-0.5 bg-foreground/70" style={{ left: `${Math.min(100, searchShare * 100)}%` }} />
      </span>
      <span className="mt-1 flex justify-between text-[11px]">
        <span className={match ? "text-sim-good" : "text-sim-warn"}>{pct(stockShare)} of stock</span>
        <span>{match ? "Matches searches" : stockShare > searchShare ? "More than searches" : "Less than searches"}</span>
      </span>
    </span>
  );
}
const units = (n: number) => Math.round(n).toLocaleString("en-IN");

type Props = {
  skus: readonly SKU[];
  states: readonly string[];
  /** Each state's share of searches across these states. */
  demand: Readonly<Record<string, number>>;
  pool: Readonly<Record<string, number>>;
  value: StockSplit;
  onChange: (next: StockSplit) => void;
  onReset: () => void;
};

export function StockSplitEditor({ skus, states, demand, pool, value, onChange, onReset }: Props) {
  const set = (sku: string, state: string, n: number) =>
    onChange({ ...value, [sku]: { ...value[sku], [state]: Math.max(0, n) } });
  return (
    <Section
      tour="deal-stock"
      title="1. Where your stock goes"
      description="Each product has a fixed amount of stock. Place it in the states Rohit serves. Ads only run where there is stock, so put it where people search. Units you don't place stay in the warehouse and don't sell."
      actions={<Button variant="ghost" size="sm" onClick={onReset}><RotateCcw className="mr-1 h-4 w-4" />Back to the brief's split</Button>}
    >
      <div className="space-y-5">
        {skus.map((sku, skuIndex) => {
          const row = value[sku.id] ?? {};
          const placed = states.reduce((s, st) => s + (row[st] ?? 0), 0);
          const left = (pool[sku.id] ?? 0) - placed;
          const over = left < -0.5;
          return (
            <fieldset key={sku.id} className="sim-rise rounded-xl border border-border p-4" style={stagger(skuIndex, 110)}>
              <legend className="px-1 text-sm font-medium text-foreground">{sku.name}</legend>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Price ₹{sku.mrp} · you keep ₹{sku.margin} a unit</span>
                <span key={over ? "over" : left > 0.5 ? "left" : "done"} className={over || left > 0.5 ? "inline-block" : "sim-pop-in inline-block"}>
                  <Tag tone={over ? "bad" : left > 0.5 ? "warn" : "good"}>
                    {over ? `${units(-left)} too many` : left > 0.5 ? `${units(left)} left to place` : "All placed"}
                  </Tag>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {states.map((st) => (
                  <label key={st} className="text-xs text-muted-foreground">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground">{st}</span>
                      <span>{pct(demand[st] ?? 0)} of searches</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      inputMode="numeric"
                      aria-label={`${sku.name} units in ${st}`}
                      className="mt-1 block w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground"
                      value={Math.round(row[st] ?? 0)}
                      onChange={(e) => set(sku.id, st, Number(e.target.value) || 0)}
                    />
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, Math.round(pool[sku.id] ?? 0))}
                      step={1}
                      aria-label={`Drag ${sku.name} units in ${st}`}
                      className="mt-2 block w-full accent-[hsl(var(--primary))]"
                      value={Math.round(row[st] ?? 0)}
                      onChange={(e) => set(sku.id, st, Number(e.target.value) || 0)}
                    />
                    <FitBar state={st} stockShare={placed > 0 ? (row[st] ?? 0) / placed : 0} searchShare={demand[st] ?? 0} />
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </Section>
  );
}
