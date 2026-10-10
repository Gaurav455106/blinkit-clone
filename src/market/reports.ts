// ── Excel reports R1–R12 (SPEC §7.3) ──────────────────────────────────────────
// Long format (one row per entity per day), numbers as numbers, only completed
// days, never hidden engine values (relevance, rival bids, upcoming events).

import type { CampaignConfig, DayResult, MarketContext } from "@/market/engineTypes";
import type { ChangeLogEntry } from "@/market/actions";
import { sumMetrics, byUnit, byState, bySlot, bySku, byCampaign, rivalInsights, type Metrics } from "@/market/aggregate";
import { SLOT_LABELS } from "@/market/slots";
import type { Row, SheetSpec } from "@/lib/excel";

export interface ReportInput {
  ctx: MarketContext;
  results: readonly DayResult[];
  /** Campaign settings that ran on each day (index 0 = day 1). */
  configsByDay: readonly (readonly CampaignConfig[])[];
  campaignNames: Readonly<Record<string, string>>;
  changeLog: readonly ChangeLogEntry[];
  /** ISO date of day 1; defaults to no date column values. */
  startDate?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => Math.round(n * 1000) / 10;
const rup = (n: number) => Math.round(n);

function dateOf(input: ReportInput, day: number): string {
  if (!input.startDate) return "";
  const d = new Date(`${input.startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d.toISOString().slice(0, 10);
}

function metricCols(m: Metrics): Row {
  return {
    "Spend (₹)": rup(m.spend),
    "Impressions (viewable)": Math.round(m.viewableImpressions),
    "Clicks": Math.round(m.clicks),
    "CTR (%)": pct(m.ctr),
    "CPM (₹)": rup(m.cpm),
    "ATCs": Math.round(m.atcs),
    "Units": r2(m.units),
    "Revenue direct (₹)": rup(m.directRevenue),
    "Revenue indirect (₹)": rup(m.indirectRevenue),
    "Revenue (₹)": rup(m.revenue),
    "ROAS": r2(m.roas),
    "Break-even ROAS": r2(m.breakEvenRoas),
    "Profit after ads (₹)": rup(m.profit),
  };
}

function visibilityCols(m: Metrics): Row {
  const share = (x: number) => (m.searches > 0 ? pct(x / m.searches) : 0);
  return {
    "Searches / views": Math.round(m.searches),
    "Impression share (%)": pct(m.impressionShare),
    "IS lost to rank (%)": share(m.lostToRank),
    "IS lost to budget (%)": share(m.lostToBudget),
    "IS lost to stock (%)": share(m.lostToStock),
    "SOV (%)": pct(m.sov),
  };
}

function perDay<T>(input: ReportInput, fn: (r: DayResult) => T[]): T[] {
  return input.results.flatMap(fn);
}

export function campaignReport(input: ReportInput): Row[] {
  return perDay(input, (r) => byCampaign(r.cells).map((g) => {
    const cfg = input.configsByDay[r.day - 1]?.find((c) => c.id === g.key);
    return {
      "Date": dateOf(input, r.day), "Sim day": r.day, "Campaign": input.campaignNames[g.key] ?? g.key,
      "Budget type": cfg?.budgetType ?? "", "Budget (₹)": cfg?.budget ?? 0,
      ...visibilityCols(g), ...metricCols(g),
    };
  }));
}

function categoryCtr(input: ReportInput, term: string): number {
  const p = input.ctx.market.placements.find((x) => x.id === term);
  return input.ctx.market.category.baseCTR * (p?.ctrMult ?? 1);
}

export function keywordReport(input: ReportInput): Row[] {
  return perDay(input, (r) => {
    const rows: Row[] = [];
    for (const campaignId of new Set(r.cells.map((c) => c.campaignId))) {
      const cfg = input.configsByDay[r.day - 1]?.find((c) => c.id === campaignId);
      for (const matchType of ["exact", "smart", "placement"] as const) {
        const cells = r.cells.filter((c) => c.campaignId === campaignId && c.matchType === matchType);
        for (const g of byUnit(cells)) {
          const kw = cfg?.keywords.find((k) => k.term === g.key);
          const pl = cfg?.placements?.find((p) => p.id === g.key);
          rows.push({
            "Date": dateOf(input, r.day), "Sim day": r.day, "Campaign": input.campaignNames[campaignId] ?? campaignId,
            "Keyword / placement": g.key, "Inventory": g.inventory, "Match type": matchType,
            "Exact bid (₹)": kw?.exactBid ?? pl?.bid ?? 0, "Smart bid (₹)": kw?.smartBid ?? 0,
            ...visibilityCols(g),
            "Top-slot rate (%)": pct(rivalInsights([r], g.key).find((x) => x.rivalId === "you")?.topSlotRate ?? 0),
            "Avg position": r2(g.avgPosition),
            "Category CTR (%)": pct(categoryCtr(input, g.key)),
            "Max profitable CPM (₹)": rup(g.maxProfitableCpm),
            ...metricCols(g),
          });
        }
      }
    }
    return rows;
  });
}

export function skuReport(input: ReportInput): Row[] {
  const skus = new Map(input.ctx.scenario.profile.skus.map((s) => [s.id, s]));
  return perDay(input, (r) => {
    const total = sumMetrics(r.cells).spend;
    return bySku(r.cells).map((g) => {
      const sku = skus.get(g.key);
      const stock = r.stock.filter((s) => s.skuId === g.key);
      const closing = stock.reduce((s, x) => s + x.closing, 0);
      const sold = stock.reduce((s, x) => s + x.adUnits + x.organicUnits, 0);
      return {
        "Date": dateOf(input, r.day), "Sim day": r.day, "SKU": sku?.name ?? g.key,
        "SKU break-even ROAS": sku ? r2(sku.mrp / sku.margin) : 0,
        "Share of spend (%)": total > 0 ? pct(g.spend / total) : 0,
        "Stock cover (days)": sold > 0 ? r2(closing / sold) : 0,
        ...metricCols(g),
      };
    });
  });
}

export function stateReport(input: ReportInput): Row[] {
  return perDay(input, (r) => byState(r.cells).map((g) => {
    const stock = r.stock.filter((s) => s.state === g.key);
    const osa = stock.length ? stock.reduce((s, x) => s + x.osa, 0) / stock.length : 0;
    return { "Date": dateOf(input, r.day), "Sim day": r.day, "State": g.key, "OSA (%)": pct(osa), ...visibilityCols(g), ...metricCols(g) };
  }));
}

export function hourReport(input: ReportInput): Row[] {
  return perDay(input, (r) => bySlot(r.cells).map((g) => ({
    "Date": dateOf(input, r.day), "Sim day": r.day, "Slot": SLOT_LABELS[Number(g.key)] ?? g.key,
    ...visibilityCols(g), ...metricCols(g),
  })));
}

export function placementReport(input: ReportInput): Row[] {
  return keywordReport(input).filter((row) => row["Inventory"] !== "keyword");
}

const RIVAL_YOU = "you";

export function auctionInsightsReport(input: ReportInput): Row[] {
  const names = new Map(input.ctx.market.rivals.map((r) => [r.id, r.name]));
  return perDay(input, (r) => {
    const terms = new Set(r.cells.map((c) => c.term));
    return [...terms].flatMap((term) => rivalInsights([r], term)
      .filter((x) => x.rivalId === RIVAL_YOU || names.has(x.rivalId))
      .map((x) => ({
        "Date": dateOf(input, r.day), "Sim day": r.day, "Keyword / placement": term,
        "Competitor": x.rivalId === RIVAL_YOU ? "You" : names.get(x.rivalId) ?? "Other brands",
        "SOV (%)": pct(x.sov), "Top-slot rate (%)": pct(x.topSlotRate),
      })));
  });
}

export function creativeReport(input: ReportInput): Row[] {
  return perDay(input, (r) => {
    const cells = r.cells.filter((c) => c.inventory === "spotlight" || c.inventory === "stories");
    return byCampaign(cells).map((g) => {
      const cfg = input.configsByDay[r.day - 1]?.find((c) => c.id === g.key);
      const own = cells.filter((c) => c.campaignId === g.key);
      const views = own.reduce((sum, c) => sum + c.viewableImpressions, 0);
      // View-weighted benchmark of the placements this campaign actually ran on
      const benchmark = views > 0 ? own.reduce((sum, c) => sum + c.viewableImpressions * categoryCtr(input, c.term), 0) / views : 0;
      return {
        "Date": dateOf(input, r.day), "Sim day": r.day, "Campaign": input.campaignNames[g.key] ?? g.key,
        "Creative quality multiplier": r2(cfg?.creativeMult ?? 1),
        "Impressions (viewable)": Math.round(g.viewableImpressions), "CTR (%)": pct(g.ctr),
        "Category CTR (%)": pct(benchmark),
      };
    });
  });
}

export function inventoryReport(input: ReportInput): Row[] {
  const skus = new Map(input.ctx.scenario.profile.skus.map((s) => [s.id, s.name]));
  return perDay(input, (r) => r.stock.map((s) => ({
    "Date": dateOf(input, r.day), "Sim day": r.day, "SKU": skus.get(s.skuId) ?? s.skuId, "State": s.state,
    "Opening stock": r2(s.opening), "Units sold (ads)": r2(s.adUnits), "Units sold (organic)": r2(s.organicUnits),
    "Restocked": r2(s.restocked), "Closing stock": r2(s.closing), "OSA (%)": pct(s.osa),
    "Days of cover": s.adUnits + s.organicUnits > 0 ? r2(s.closing / (s.adUnits + s.organicUnits)) : 0,
  })));
}

export function pacingReport(input: ReportInput): Row[] {
  const total = input.ctx.scenario.budget;
  const cumulative = new Map<string, number>();
  let all = 0;
  return perDay(input, (r) => {
    const rows = byCampaign(r.cells).map((g) => {
      const cfg = input.configsByDay[r.day - 1]?.find((c) => c.id === g.key);
      const cum = (cumulative.get(g.key) ?? 0) + g.spend;
      cumulative.set(g.key, cum);
      return { key: g.key, spend: g.spend, cum, cfg };
    });
    all += rows.reduce((s, x) => s + x.spend, 0);
    const daysLeft = input.ctx.totalDays - r.day;
    return rows.map((x) => ({
      "Date": dateOf(input, r.day), "Sim day": r.day, "Campaign": input.campaignNames[x.key] ?? x.key,
      "Budget type": x.cfg?.budgetType ?? "", "Budget (₹)": x.cfg?.budget ?? 0,
      "Spend (₹)": rup(x.spend), "Cumulative spend (₹)": rup(x.cum),
      "% of total budget used (all campaigns)": pct(all / total), "Days left": daysLeft,
      "Projected end-of-run spend (₹)": rup(all + (all / r.day) * daysLeft),
    }));
  });
}

export function changeLogReport(input: ReportInput): Row[] {
  return input.changeLog.map((e) => ({
    "Day made": e.dayMade, "Day applied": e.dayApplied, "Campaign": input.campaignNames[e.campaignId] ?? e.campaignId,
    "What changed": e.what, "From": e.from, "To": e.to,
  }));
}

export function searchTermReport(input: ReportInput): Row[] {
  return perDay(input, (r) => {
    const rows: Row[] = [];
    for (const campaignId of new Set(r.cells.map((c) => c.campaignId))) {
      const cells = r.cells.filter((c) => c.campaignId === campaignId && c.matchType === "smart");
      for (const g of byUnit(cells)) {
        rows.push({
          "Date": dateOf(input, r.day), "Sim day": r.day, "Campaign": input.campaignNames[campaignId] ?? campaignId,
          "Search term": g.key, "Impressions (viewable)": Math.round(g.viewableImpressions), "Clicks": Math.round(g.clicks),
          "Units": r2(g.units), "Revenue (₹)": rup(g.revenue), "Spend (₹)": rup(g.spend), "ROAS": r2(g.roas),
        });
      }
    }
    return rows;
  });
}

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  build: (input: ReportInput) => Row[];
}

export const REPORTS: readonly ReportDef[] = [
  { id: "R1", name: "Campaign performance", description: "Is each campaign profitable? Which is budget-capped?", build: campaignReport },
  { id: "R2", name: "Keyword performance", description: "Re-bid, let go, head vs long-tail split", build: keywordReport },
  { id: "R3", name: "Product (SKU) performance", description: "Hero product budget", build: skuReport },
  { id: "R4", name: "State performance", description: "State split, where stock is short", build: stateReport },
  { id: "R5", name: "Hour of day", description: "Dayparting", build: hourReport },
  { id: "R6", name: "Placement and feed", description: "Spotlight, Stories, Rec Ads, category pages", build: placementReport },
  { id: "R7", name: "Auction insights", description: "Who is taking your slot (never bids)", build: auctionInsightsReport },
  { id: "R8", name: "Creative", description: "Replace a weak or tired creative", build: creativeReport },
  { id: "R9", name: "Inventory", description: "Restock asks, hero stock risk", build: inventoryReport },
  { id: "R10", name: "Budget pacing", description: "Will the money last?", build: pacingReport },
  { id: "R11", name: "Change log", description: "Before/after analysis of your own decisions", build: changeLogReport },
  { id: "R12", name: "Search terms", description: "What smart match reached: promote or stop", build: searchTermReport },
];

export const REPORT_README: readonly { column: string; meaning: string }[] = [
  { column: "Sim day", meaning: "Day of the 30-day run. Only completed days are included." },
  { column: "Searches / views", meaning: "Searches (keywords) or page views (placements) in your targeted states and hours." },
  { column: "Impression share (%)", meaning: "Share of those searches where your ad appeared." },
  { column: "IS lost to rank / budget / stock (%)", meaning: "Why you didn't appear: outbid, out of daily budget, or out of stock. With impression share these add to 100%." },
  { column: "SOV (%)", meaning: "Your share of all viewable ad impressions on that page (slot 1 always ≈ 54% at most)." },
  { column: "CPM (₹)", meaning: "₹ paid per 1,000 viewable impressions (second price, never above your bid)." },
  { column: "Max profitable CPM (₹)", meaning: "Contribution earned per 1,000 viewable impressions: bid above this and each order loses money." },
  { column: "Revenue (₹)", meaning: "Direct (the advertised SKU) + indirect (other brand SKUs bought after the click)." },
  { column: "Break-even ROAS", meaning: "Revenue ÷ contribution for what was sold: ROAS below this loses money." },
  { column: "Profit after ads (₹)", meaning: "Contribution minus ad spend." },
  { column: "OSA (%)", meaning: "Share of dark stores in the state with the SKU in stock." },
];

export function buildReportSheets(input: ReportInput, ids?: readonly string[]): SheetSpec[] {
  return REPORTS.filter((r) => !ids || ids.includes(r.id)).map((r) => ({ name: `${r.id} ${r.name}`, rows: r.build(input) }));
}
