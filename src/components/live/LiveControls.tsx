// ── Live optimisation controls (SPEC §7) ──────────────────────────────────────
// Everything here changes campaigns from tomorrow, as on a real ads platform.

import { useState } from "react";
import type { CampaignConfig, DayResult, MarketContext } from "@/market/engineTypes";
import type { ActionChange } from "@/market/actions";
import { byUnit } from "@/market/aggregate";
import { SLOT_LABELS } from "@/market/slots";
import { Section, Tag } from "@/components/sim/primitives";
import { Button } from "@/components/ui/button";

const LAST_DAYS = 7;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

type Act = (campaignId: string, change: ActionChange) => void;

function BidEditor({ value, onSave, label }: { value: number; onSave: (bid: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  const n = Number(draft);
  const valid = Number.isFinite(n) && n >= 200;
  const changed = valid && Math.round(n) !== Math.round(value);
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => { e.preventDefault(); if (changed) onSave(Math.round(n)); }}
    >
      <label className="sr-only" htmlFor={`bid-${label}`}>New bid for {label}</label>
      <input
        id={`bid-${label}`}
        inputMode="numeric"
        className={`w-20 rounded-md border bg-card px-2 py-1 text-sm ${valid ? "border-input" : "border-sim-bad"}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!changed} className="h-7 px-2 text-xs">Set</Button>
    </form>
  );
}

type TableProps = {
  ctx: MarketContext;
  results: readonly DayResult[];
  configs: readonly CampaignConfig[];
  campaignNames: Readonly<Record<string, string>>;
  act: Act;
};

/** Per keyword or placement, last 7 days, with bid and pause controls. */
export function UnitTable({ ctx, results, configs, campaignNames, act }: TableProps) {
  const recent = results.slice(-LAST_DAYS);
  const rows = configs.flatMap((cfg) => {
    const cells = recent.flatMap((r) => r.cells.filter((c) => c.campaignId === cfg.id && c.matchType !== "smart"));
    const metrics = new Map(byUnit(cells).map((u) => [u.key, u]));
    const kw = cfg.keywords.map((k) => ({ cfg, id: k.term, kind: "keyword" as const, bid: k.exactBid, m: metrics.get(k.term) }));
    const pl = (cfg.placements ?? []).map((p) => ({ cfg, id: p.id, kind: "placement" as const, bid: p.bid, m: metrics.get(p.id) }));
    return [...kw, ...pl];
  });
  const categoryCtr = (id: string) => ctx.market.category.baseCTR * (ctx.market.placements.find((p) => p.id === id)?.ctrMult ?? 1);

  return (
    <Section
      title="Keywords and placements (last 7 days)"
      description="Compare CPM (what you paid per 1,000 views) with max profitable CPM (the most you can pay and still make money). Changes start tomorrow."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              {["Campaign", "Keyword or placement", "Shown", "Lost: rank / budget / stock", "SOV", "CPM", "Max profitable CPM", "CTR (category)", "ROAS (break-even)", "Bid", ""].map((h) => (
                <th key={h} className="py-2 pr-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cfg, id, kind, bid, m }) => {
              const losing = m && m.spend > 0 && m.contribution < m.spend;
              const overpaying = m && m.viewableImpressions > 0 && m.cpm > m.maxProfitableCpm;
              const share = (x: number) => (m && m.searches > 0 ? pct(x / m.searches) : "–");
              return (
                <tr key={`${cfg.id}-${id}`} className="border-t border-border align-middle">
                  <td className="py-2 pr-3 text-muted-foreground">{campaignNames[cfg.id] ?? cfg.id}</td>
                  <td className="py-2 pr-3 font-medium text-foreground">{id}{kind === "placement" && <span className="ml-1"><Tag>placement</Tag></span>}</td>
                  <td className="py-2 pr-3">{m ? pct(m.impressionShare) : "–"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{m ? `${share(m.lostToRank)} / ${share(m.lostToBudget)} / ${share(m.lostToStock)}` : "–"}</td>
                  <td className="py-2 pr-3">{m ? pct(m.sov) : "–"}</td>
                  <td className={`py-2 pr-3 ${overpaying ? "font-medium text-sim-bad" : ""}`}>{m && m.viewableImpressions > 0 ? rupees(m.cpm) : "–"}</td>
                  <td className="py-2 pr-3">{m && m.viewableImpressions > 0 ? rupees(m.maxProfitableCpm) : "–"}</td>
                  <td className="py-2 pr-3">{m && m.viewableImpressions > 0 ? `${(m.ctr * 100).toFixed(1)}% (${(categoryCtr(id) * 100).toFixed(1)}%)` : "–"}</td>
                  <td className={`py-2 pr-3 ${losing ? "font-medium text-sim-bad" : ""}`}>{m && m.spend > 0 ? `${m.roas.toFixed(2)} (${m.breakEvenRoas.toFixed(2)})` : "–"}</td>
                  <td className="py-2 pr-3">
                    <BidEditor
                      value={bid}
                      label={id}
                      onSave={(b) => act(cfg.id, kind === "keyword" ? { kind: "keywordBid", term: id, bid: b } : { kind: "placementBid", id, bid: b })}
                    />
                  </td>
                  <td className="py-2">
                    {kind === "keyword" && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => act(cfg.id, { kind: "pauseKeyword", term: id, paused: true })}>Pause</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-sm text-muted-foreground">No keywords or placements yet. Launch a campaign to start.</p>}
      </div>
    </Section>
  );
}

type CampaignProps = {
  ctx: MarketContext;
  configs: readonly CampaignConfig[];
  campaignNames: Readonly<Record<string, string>>;
  act: Act;
};

function ScheduleEditor({ cfg, act }: { cfg: CampaignConfig; act: Act }) {
  const current = cfg.schedule && cfg.schedule.length ? cfg.schedule : SLOT_LABELS.map((_, i) => i);
  const [draft, setDraft] = useState<number[]>([...current]);
  const changed = draft.length !== current.length || draft.some((s) => !current.includes(s));
  const toggle = (s: number) => setDraft((d) => (d.includes(s) ? d.filter((x) => x !== s) : [...d, s].sort((a, b) => a - b)));
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Hours the ads run</p>
      <div className="flex flex-wrap gap-1.5">
        {SLOT_LABELS.map((label, s) => (
          <button
            key={label}
            type="button"
            aria-pressed={draft.includes(s)}
            onClick={() => toggle(s)}
            className={`rounded-md border px-2 py-1 text-xs ${draft.includes(s) ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" disabled={!changed || draft.length === 0} onClick={() => act(cfg.id, { kind: "schedule", schedule: draft })}>
        Save hours
      </Button>
    </div>
  );
}

function StatesEditor({ ctx, cfg, act }: { ctx: MarketContext; cfg: CampaignConfig; act: Act }) {
  const stocked = Object.keys(ctx.scenario.cityStockMap).filter((s) => (ctx.scenario.cityStockMap[s as keyof typeof ctx.scenario.cityStockMap] ?? 0) > 0);
  const isPan = cfg.geography === "pan_india" || cfg.cities.length === 0;
  const [draft, setDraft] = useState<string[]>(isPan ? stocked : [...cfg.cities]);
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">States (ads only run where you have stock)</p>
      <div className="flex flex-wrap gap-1.5">
        {stocked.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={draft.includes(s)}
            onClick={() => setDraft((d) => (d.includes(s) ? d.filter((x) => x !== s) : [...d, s]))}
            className={`rounded-md border px-2 py-1 text-xs ${draft.includes(s) ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={draft.length === 0} onClick={() => act(cfg.id, { kind: "states", geography: "select_cities", cities: draft })}>Save states</Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act(cfg.id, { kind: "states", geography: "pan_india", cities: [] })}>Use Pan India</Button>
      </div>
    </div>
  );
}

function BudgetEditor({ cfg, act }: { cfg: CampaignConfig; act: Act }) {
  const [draft, setDraft] = useState(String(Math.round(cfg.budget)));
  const n = Number(draft);
  const valid = Number.isFinite(n) && n >= 100;
  return (
    <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (valid) act(cfg.id, { kind: "budget", budget: Math.round(n) }); }}>
      <label className="text-xs font-medium text-muted-foreground">
        {cfg.budgetType === "daily" ? "Daily budget (₹)" : "Total budget (₹)"}
        <input inputMode="numeric" className="mt-1 block w-28 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))} />
      </label>
      <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={!valid || Math.round(n) === Math.round(cfg.budget)}>Save</Button>
    </form>
  );
}

/** Add a keyword from the market list (brand-term defence, long-tail). Starts tomorrow. */
function KeywordAdder({ ctx, cfg, act }: { ctx: MarketContext; cfg: CampaignConfig; act: Act }) {
  const options = ctx.market.keywords.filter((k) => !cfg.keywords.some((x) => x.term === k.term));
  const [term, setTerm] = useState(options[0]?.term ?? "");
  const [bid, setBid] = useState("250");
  const n = Number(bid);
  const valid = term !== "" && Number.isFinite(n) && n >= 200;
  if (options.length === 0) return null;
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (valid) act(cfg.id, { kind: "addKeyword", term, bid: Math.round(n) }); }}>
      <label className="text-xs font-medium text-muted-foreground">
        Add a keyword
        <select className="mt-1 block max-w-[14rem] rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground" value={term} onChange={(e) => setTerm(e.target.value)}>
          {options.map((k) => <option key={k.term} value={k.term}>{k.term}{k.isBrandTerm ? " (your brand)" : ""}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">
        Bid (₹ CPM, min 200)
        <input inputMode="numeric" className="mt-1 block w-24 rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground" value={bid} onChange={(e) => setBid(e.target.value.replace(/[^\d]/g, ""))} />
      </label>
      <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={!valid}>Add</Button>
    </form>
  );
}

export function CampaignPanel({ ctx, configs, campaignNames, act }: CampaignProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {configs.map((cfg) => (
        <Section
          key={cfg.id}
          title={campaignNames[cfg.id] ?? cfg.id}
          description={cfg.paused ? "Paused from tomorrow." : `Running in ${cfg.geography === "pan_india" || cfg.cities.length === 0 ? "every state with stock" : cfg.cities.join(", ")}.`}
          actions={
            <Button size="sm" variant={cfg.paused ? "default" : "outline"} onClick={() => act(cfg.id, { kind: "pause", paused: !cfg.paused })}>
              {cfg.paused ? "Resume" : "Pause"}
            </Button>
          }
        >
          <div className="space-y-5">
            <BudgetEditor cfg={cfg} act={act} />
            {cfg.keywords.length > 0 && <KeywordAdder ctx={ctx} cfg={cfg} act={act} />}
            <ScheduleEditor cfg={cfg} act={act} />
            <StatesEditor ctx={ctx} cfg={cfg} act={act} />
          </div>
        </Section>
      ))}
    </div>
  );
}
