// Deal sheet parts 2 and 3: what the student asks Rohit for, and offers back.

import { useState, type ReactNode } from "react";
import type { SKU } from "@/data/scenarios";
import {
  DISCOUNT_DAYS, FAST_RESTOCK_DAY, FAST_RESTOCK_SHARE, MAX_ASKS, MORE_STORES_SHARE,
  type DealAsk, type DealGive,
} from "@/market/deal";
import { Section } from "@/components/sim/primitives";
import { cn } from "@/lib/utils";
import { formatRupees } from "@/lib/money";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const inr = formatRupees;
const SELECT = "rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground";

function Choice({ checked, disabled, onToggle, title, note, children }: {
  checked: boolean; disabled?: boolean; onToggle: () => void; title: string; note: string; children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4", checked ? "border-primary bg-accent/40" : "border-border", disabled && "opacity-50")}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={checked} disabled={disabled} onChange={onToggle} />
        <span>
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="block text-xs text-muted-foreground">{note}</span>
        </span>
      </label>
      {children && <div className="mt-3 flex flex-wrap items-center gap-2 pl-7 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

type StateAsk = Exclude<DealAsk["kind"], "shelfSpot">;
const STATE_LABEL: Record<StateAsk, string> = {
  moreStores: "State for more stores",
  busyStores: "State for busier dark stores",
  fastRestock: "State for the fast restock",
};

type AskProps = { states: readonly string[]; asks: readonly DealAsk[]; onChange: (asks: DealAsk[]) => void };

export function AsksPicker({ states, asks, onChange }: AskProps) {
  const [storeState, setStoreState] = useState(states[0]);
  const [busyState, setBusyState] = useState(states[0]);
  const [restockState, setRestockState] = useState(states[0]);
  const has = (k: DealAsk["kind"]) => asks.some((a) => a.kind === k);
  const full = asks.length >= MAX_ASKS;
  const toggle = (ask: DealAsk) => onChange(has(ask.kind) ? asks.filter((a) => a.kind !== ask.kind) : [...asks, ask]);
  const retarget = (kind: StateAsk, state: string) =>
    onChange(asks.map((a) => (a.kind === kind ? { kind, state } : a)));
  const stateSelect = (value: string, set: (s: string) => void, kind: StateAsk) => (
    <select aria-label={STATE_LABEL[kind]} className={SELECT} value={value}
      onChange={(e) => { set(e.target.value); retarget(kind, e.target.value); }}>
      {states.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
  return (
    <Section tour="deal-asks" title="2. What you ask Rohit for" description={`Pick up to ${MAX_ASKS}. Each one costs Rohit something, so he'll want something back.`}>
      <div className="grid gap-3 lg:grid-cols-3">
        <Choice checked={has("moreStores")} disabled={full && !has("moreStores")} onToggle={() => toggle({ kind: "moreStores", state: storeState })}
          title="More stores" note={`Rohit adds ${pct(MORE_STORES_SHARE)} more of the stock you placed there, on day 1.`}>
          in {stateSelect(storeState, setStoreState, "moreStores")}
        </Choice>
        <Choice checked={has("busyStores")} disabled={full && !has("busyStores")} onToggle={() => toggle({ kind: "busyStores", state: busyState })}
          title="Busier dark stores" note="Your stock goes to the dark stores with the most orders, so the same units reach more shoppers.">
          in {stateSelect(busyState, setBusyState, "busyStores")}
        </Choice>
        <Choice checked={has("fastRestock")} disabled={full && !has("fastRestock")} onToggle={() => toggle({ kind: "fastRestock", state: restockState })}
          title="A fast restock" note={`${pct(FAST_RESTOCK_SHARE)} of what you placed there arrives again on day ${FAST_RESTOCK_DAY}.`}>
          in {stateSelect(restockState, setRestockState, "fastRestock")}
        </Choice>
      </div>
    </Section>
  );
}

type GiveProps = { skus: readonly SKU[]; states: readonly string[]; gives: readonly DealGive[]; onChange: (gives: DealGive[]) => void };

export function GivesPicker({ skus, states, gives, onChange }: GiveProps) {
  const [spend, setSpend] = useState({ perDay: 1500, days: 14 });
  const [discount, setDiscount] = useState<{ pct: number; skuIds: string[] }>({ pct: 0.1, skuIds: [skus[0]?.id].filter(Boolean) as string[] });
  const [supply, setSupply] = useState({ state: states[0], osaPct: 60, byDay: 15 });
  const has = (k: DealGive["kind"]) => gives.some((g) => g.kind === k);
  const put = (g: DealGive) => onChange([...gives.filter((x) => x.kind !== g.kind), g]);
  const toggle = (g: DealGive) => (has(g.kind) ? onChange(gives.filter((x) => x.kind !== g.kind)) : put(g));
  const update = (g: DealGive) => { if (has(g.kind)) put(g); };

  const spendGive: DealGive = { kind: "adSpend", ...spend };
  const discountGive: DealGive = { kind: "discount", ...discount };
  const supplyGive: DealGive = { kind: "supply", ...supply };

  return (
    <Section tour="deal-gives" title="3. What you offer in return" description="Offers are promises. Rohit tracks them during the run, and breaking one costs his trust.">
      <div className="space-y-3">
        <Choice checked={has("adSpend")} onToggle={() => toggle(spendGive)} title="Promise ad spend in his category"
          note="Blinkit earns from your ads, so Rohit values this. You must actually spend it.">
          <span>₹</span>
          <input type="number" min={0} step={500} aria-label="Ad spend per day" className={cn(SELECT, "w-24")} value={spend.perDay}
            onChange={(e) => { const next = { ...spend, perDay: Math.max(0, Number(e.target.value) || 0) }; setSpend(next); update({ kind: "adSpend", ...next }); }} />
          <span>a day for</span>
          <select aria-label="Days of ad spend" className={SELECT} value={spend.days}
            onChange={(e) => { const next = { ...spend, days: Number(e.target.value) }; setSpend(next); update({ kind: "adSpend", ...next }); }}>
            {[7, 14, 21].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
          <span>= {inr(spend.perDay * spend.days)}</span>
        </Choice>

        <Choice checked={has("discount")} onToggle={() => toggle(discountGive)} title={`Fund a launch discount for ${DISCOUNT_DAYS} days`}
          note="More shoppers buy, but every unit sold earns you less.">
          <select aria-label="Discount size" className={SELECT} value={discount.pct}
            onChange={(e) => { const next = { ...discount, pct: Number(e.target.value) }; setDiscount(next); update({ kind: "discount", ...next }); }}>
            {[0.05, 0.1, 0.15, 0.2].map((p) => <option key={p} value={p}>{pct(p)} off</option>)}
          </select>
          <span>on</span>
          {skus.map((s) => (
            <label key={s.id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
              <input type="checkbox" checked={discount.skuIds.includes(s.id)}
                onChange={() => {
                  const skuIds = discount.skuIds.includes(s.id) ? discount.skuIds.filter((x) => x !== s.id) : [...discount.skuIds, s.id];
                  const next = { ...discount, skuIds }; setDiscount(next); update({ kind: "discount", ...next });
                }} />
              {s.name} <span className="text-muted-foreground">(₹{Math.round(s.mrp * discount.pct)} off, you keep ₹{Math.round(s.margin - s.mrp * discount.pct)})</span>
            </label>
          ))}
        </Choice>

        <Choice checked={has("supply")} onToggle={() => toggle(supplyGive)} title="Promise to keep stores stocked"
          note="Rohit hates empty shelves. You'll need stock and restocks to keep it.">
          <span>Keep</span>
          <select aria-label="Share of stores stocked" className={SELECT} value={supply.osaPct}
            onChange={(e) => { const next = { ...supply, osaPct: Number(e.target.value) }; setSupply(next); update({ kind: "supply", ...next }); }}>
            {[50, 60, 70, 80].map((p) => <option key={p} value={p}>{p}%</option>)}
          </select>
          <span>of stores stocked in</span>
          <select aria-label="State to keep stocked" className={SELECT} value={supply.state}
            onChange={(e) => { const next = { ...supply, state: e.target.value }; setSupply(next); update({ kind: "supply", ...next }); }}>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span>on day</span>
          <select aria-label="Day of the supply promise" className={SELECT} value={supply.byDay}
            onChange={(e) => { const next = { ...supply, byDay: Number(e.target.value) }; setSupply(next); update({ kind: "supply", ...next }); }}>
            {[10, 15, 20].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Choice>
      </div>
    </Section>
  );
}
