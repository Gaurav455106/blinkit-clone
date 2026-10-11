// Deal sheet part 1: split each product's stock across the states Rohit serves.

import { RotateCcw } from "lucide-react";
import type { SKU } from "@/data/scenarios";
import type { StockSplit } from "@/market/deal";
import { Section, Tag } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";
import { stagger } from "@/components/game/GameBits";

const pct = (x: number) => `${Math.round(x * 100)}%`;
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
                      step={1}
                      inputMode="numeric"
                      aria-label={`${sku.name} units in ${st}`}
                      className="mt-1 block w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground"
                      value={Math.round(row[st] ?? 0)}
                      onChange={(e) => set(sku.id, st, Number(e.target.value) || 0)}
                    />
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
