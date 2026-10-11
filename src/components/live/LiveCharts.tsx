// ── Live dashboard graphs (SPEC §7.1) ─────────────────────────────────────────
// Each graph answers one question the student must act on. Days run along the
// x-axis; days when an action took effect are marked.

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DayResult, MarketContext } from "@/market/engineTypes";
import type { LiveAction } from "@/market/actions";
import { byCampaign, bySlot, sumMetrics, rivalInsights } from "@/market/aggregate";
import { SLOT_LABELS } from "@/market/slots";
import { Section } from "@/components/sim/primitives";
import { AXIS, OUTCOME_COLORS, PROFIT, SERIES } from "@/components/live/palette";

const CHART_HEIGHT = 240;
const axisProps = { stroke: AXIS.stroke, tick: { fill: AXIS.text, fontSize: 12 }, tickLine: false } as const;
const fmt2 = (n: number) => n.toFixed(2);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function ActionMarkers({ actions }: { actions: readonly LiveAction[] }) {
  const days = [...new Set(actions.map((a) => a.dayMade + 1))];
  return <>{days.map((d) => <ReferenceLine key={d} x={d} stroke={AXIS.stroke} strokeDasharray="2 4" />)}</>;
}

type Props = {
  ctx: MarketContext;
  results: readonly DayResult[];
  actions: readonly LiveAction[];
  campaignNames: Readonly<Record<string, string>>;
};

/** Am I making or losing money, and since when? */
export function RoasChart({ results, actions, campaignNames }: Omit<Props, "ctx">) {
  const ids = useMemo(() => [...new Set(results.flatMap((r) => r.cells.map((c) => c.campaignId)))], [results]);
  const data = results.map((r) => {
    const row: Record<string, number> = { day: r.day };
    for (const g of byCampaign(r.cells)) row[g.key] = Number(fmt2(g.roas));
    row.breakEven = Number(fmt2(sumMetrics(r.cells).breakEvenRoas));
    return row;
  });
  return (
    <Section title="ROAS vs break-even" description="ROAS is the sales you make for every ₹1 of ads. Below the dashed line, the ads lose money.">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={AXIS.grid} vertical={false} />
          <XAxis dataKey="day" {...axisProps} />
          <YAxis {...axisProps} width={40} />
          <Tooltip formatter={(v: number) => fmt2(v)} labelFormatter={(d) => `Day ${d}`} />
          <Legend />
          <ActionMarkers actions={actions} />
          {ids.map((id, i) => (
            <Line key={id} type="monotone" dataKey={id} name={campaignNames[id] ?? id} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} />
          ))}
          <Line type="monotone" dataKey="breakEven" name="Break-even" stroke={AXIS.stroke} strokeDasharray="6 4" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Section>
  );
}

/** Why am I losing visibility? */
export function VisibilityChart({ results, actions }: Omit<Props, "ctx" | "campaignNames">) {
  const data = results.map((r) => {
    const m = sumMetrics(r.cells);
    const share = (x: number) => (m.searches > 0 ? Math.round((x / m.searches) * 1000) / 10 : 0);
    return { day: r.day, won: share(m.won), rank: share(m.lostToRank), budget: share(m.lostToBudget), stock: share(m.lostToStock) };
  });
  return (
    <Section title="Where your ad showed, and why it didn't" description="Each bar is 100% of searches. Lost to rank: someone bid more. Lost to budget: your money ran out. Lost to stock: no stock in that state.">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={AXIS.grid} vertical={false} />
          <XAxis dataKey="day" {...axisProps} />
          <YAxis {...axisProps} width={40} unit="%" />
          <Tooltip formatter={(v: number) => `${v}%`} labelFormatter={(d) => `Day ${d}`} />
          <Legend />
          <ActionMarkers actions={actions} />
          <Bar dataKey="won" name="Shown" stackId="a" fill={OUTCOME_COLORS.won} stroke="#fff" strokeWidth={1} />
          <Bar dataKey="rank" name="Lost to rank" stackId="a" fill={OUTCOME_COLORS.rank} stroke="#fff" strokeWidth={1} />
          <Bar dataKey="budget" name="Lost to budget" stackId="a" fill={OUTCOME_COLORS.budget} stroke="#fff" strokeWidth={1} />
          <Bar dataKey="stock" name="Lost to stock" stackId="a" fill={OUTCOME_COLORS.stock} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Section>
  );
}

/** Who took my slot, and when? */
export function SovChart({ ctx, results }: Omit<Props, "actions" | "campaignNames">) {
  const terms = useMemo(() => [...new Set(results.flatMap((r) => r.cells.filter((c) => c.inventory === "keyword").map((c) => c.term)))], [results]);
  const [term, setTerm] = useState<string>("");
  const selected = term || terms[0] || "";
  const names = new Map(ctx.market.rivals.map((r) => [r.id, r.name]));
  const series = ["you", ...ctx.market.rivals.map((r) => r.id)].slice(0, 4);
  const data = results.map((r) => {
    const row: Record<string, number> = { day: r.day };
    for (const x of rivalInsights([r], selected)) if (series.includes(x.rivalId)) row[x.rivalId] = Math.round(x.sov * 1000) / 10;
    return row;
  });
  return (
    <Section
      title="Share of voice vs rivals"
      description="Out of all ads shoppers saw for this keyword, how many were yours. Rival bids are never shown, only what they won."
      actions={
        <label className="text-sm text-muted-foreground">
          Keyword{" "}
          <select className="ml-2 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground" value={selected} onChange={(e) => setTerm(e.target.value)}>
            {terms.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      }
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={AXIS.grid} vertical={false} />
          <XAxis dataKey="day" {...axisProps} />
          <YAxis {...axisProps} width={40} unit="%" />
          <Tooltip formatter={(v: number) => `${v}%`} labelFormatter={(d) => `Day ${d}`} />
          <Legend />
          {series.map((id, i) => (
            <Line key={id} type="monotone" dataKey={id} name={id === "you" ? "You" : names.get(id) ?? id} stroke={SERIES[i]} strokeWidth={id === "you" ? 3 : 2} dot={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Section>
  );
}

/** Is my schedule spending in the right hours? Last 7 days, by time slot. */
export function HourHeatmap({ results }: Pick<Props, "results">) {
  const recent = results.slice(-7);
  const rows = bySlot(recent.flatMap((r) => r.cells));
  const bySlotKey = new Map(rows.map((r) => [Number(r.key), r]));
  return (
    <Section title="Hours: where the money went (last 7 days)" description="Blue hours make money, orange hours lose it. Budget lost means your money ran out before that hour.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {SLOT_LABELS.map((label, slot) => {
          const m = bySlotKey.get(slot);
          const ratio = m && m.breakEvenRoas > 0 ? m.roas / m.breakEvenRoas : 0;
          const bg = !m || m.spend === 0 ? PROFIT.neutral : ratio >= 1 ? PROFIT.gain : PROFIT.loss;
          const budgetLost = m && m.searches > 0 ? m.lostToBudget / m.searches : 0;
          return (
            <div key={label} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 h-1.5 rounded-full" style={{ background: bg }} aria-hidden />
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="sim-num mt-1 text-sm font-semibold text-foreground">{m ? rupees(m.spend) : "₹0"}</p>
              <p className="sim-num text-xs text-muted-foreground">{m && m.spend > 0 ? `ROAS ${fmt2(m.roas)}` : "No spend"}</p>
              <p className="sim-num text-xs text-muted-foreground">Budget lost {pct(budgetLost)}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Will my budget last the month? */
export function PacingChart({ ctx, results }: Omit<Props, "actions" | "campaignNames">) {
  let cumulative = 0;
  const even = ctx.scenario.budget / ctx.totalDays;
  const data = results.map((r) => {
    cumulative += sumMetrics(r.cells).spend;
    return { day: r.day, spent: Math.round(cumulative), even: Math.round(even * r.day) };
  });
  return (
    <Section title="Budget pacing" description={`If your line runs above the even line, the ${rupees(ctx.scenario.budget)} may run out before day ${ctx.totalDays}.`}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={AXIS.grid} vertical={false} />
          <XAxis dataKey="day" {...axisProps} />
          <YAxis {...axisProps} width={64} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}K`} />
          <Tooltip formatter={(v: number) => rupees(v)} labelFormatter={(d) => `Day ${d}`} />
          <Legend />
          <Line type="monotone" dataKey="spent" name="Spent so far" stroke={SERIES[0]} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="even" name="Even pace" stroke={AXIS.stroke} strokeDasharray="6 4" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Section>
  );
}

/** Where am I about to go dark? */
export function StockPanel({ ctx, results }: Omit<Props, "actions" | "campaignNames">) {
  const last = results[results.length - 1];
  const skus = new Map(ctx.scenario.profile.skus.map((s) => [s.id, s.name]));
  const rows = (last?.stock ?? []).filter((s) => s.osa > 0 || s.opening > 0).sort((a, b) => a.osa - b.osa);
  return (
    <Section title="Stock by state" description="OSA is how many Blinkit stores in a state have your product. Under 30%, your ads there will soon stop.">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Stock appears after day 1.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Product</th>
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 pr-4 font-medium">OSA</th>
                <th className="py-2 pr-4 font-medium">Units left</th>
                <th className="py-2 font-medium">Days of stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const sold = s.adUnits + s.organicUnits;
                const low = s.osa < 0.3;
                return (
                  <tr key={`${s.skuId}-${s.state}`} className="border-t border-border">
                    <td className="py-2 pr-4">{skus.get(s.skuId) ?? s.skuId}</td>
                    <td className="py-2 pr-4">{s.state}</td>
                    <td className={`py-2 pr-4 font-medium ${low ? "text-sim-bad" : "text-foreground"}`}>{pct(s.osa)}{low ? " (low)" : ""}</td>
                    <td className="py-2 pr-4">{Math.round(s.closing)}</td>
                    <td className="py-2">{sold > 0 ? (s.closing / sold).toFixed(1) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
