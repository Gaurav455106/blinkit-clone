import { useState, useMemo } from "react";
import { useSim } from "@/context/SimContext";
import { SavedCampaign } from "@/context/SimContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { simulateRun } from "@/lib/simResults";
import { isAwarenessFormat } from "@/lib/scoring";
import { ChevronRight, ArrowLeft, MapPin, Tag, Package, Clock, Wallet } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ── Constants ─────────────────────────────────────────────────────────────────
const FORMAT_LABEL: Record<string, string> = {
  product_booster:    "Product Booster",
  recommendation_ads: "Recommendation Ads",
  listing_spotlight:  "Listing Spotlight",
  brand_booster:      "Brand Booster",
  stories:            "Stories Ad",
};

const FORMAT_COLOR: Record<string, string> = {
  product_booster:    "#4B7BEC",
  recommendation_ads: "#FFC947",
  listing_spotlight:  "#54D87B",
  brand_booster:      "#A55EEA",
  stories:            "#FF6B6B",
};

const TIME_SLOTS = [
  "12 AM–3 AM","3 AM–6 AM","6 AM–9 AM","9 AM–12 PM",
  "12 PM–3 PM","3 PM–6 PM","6 PM–9 PM","9 PM–12 AM",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) { return Math.round(n).toLocaleString("en-IN"); }

function pseudoRand(s: string, offset = 0) {
  let h = offset * 31;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) / 2147483647;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PerfCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4 border border-border">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-green-600 text-green-700" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  campaign: SavedCampaign;
  onBack: () => void;
}

export function CampaignDetails({ campaign, onBack }: Props) {
  const { scenario, cmPitch, abTests, cannibalResolved, clusterReactions, tokensSpent } = useSim();

  const isReach = isAwarenessFormat(campaign.adFormat);

  // ── Which detail sub-tabs are available ──────────────────────────────────
  const availableSubTabs = useMemo(() => {
    const tabs: string[] = [];
    if (campaign.keywords.length > 0)            tabs.push("keyword");
    if ((campaign.categories ?? []).length > 0)  tabs.push("category");
    if (campaign.adFormat === "recommendation_ads") tabs.push("asset");
    if (campaign.adFormat === "stories")         tabs.push("feed");
    return tabs;
  }, [campaign]);

  const [topTab, setTopTab] = useState<"details" | "performance">("performance");
  const [subTab, setSubTab] = useState<string>(availableSubTabs[0] ?? "keyword");

  // ── Projected simulation for single campaign ─────────────────────────────
  const projected = useMemo(() => {
    if (!scenario || !cmPitch) return null;
    return simulateRun(scenario, [campaign], cmPitch, {
      abTests, cannibalResolved, clusterReactions, tokensSpent,
    });
  }, [scenario, campaign, cmPitch, abTests, cannibalResolved, clusterReactions, tokensSpent]);

  const perf = projected?.perCampaign[0];
  const cpm  = perf && perf.impressions > 0 ? Math.round((perf.spend / perf.impressions) * 1000) : 0;

  // Derived reach / CTR for reach formats
  const reach = perf ? Math.round(perf.impressions * 0.65) : 0;
  const ctrPct = perf && perf.impressions > 0
    ? ((perf.clicks / perf.impressions) * 100).toFixed(2)
    : "0.00";

  // ── Daily trend data ──────────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    if (!perf) return [];
    const base = perf.spend / 30;
    const variance = [0.92, 1.0, 1.06, 1.1, 1.04, 0.95, 0.93];
    return Array.from({ length: 30 }, (_, i) => ({
      label: `D${i + 1}`,
      spend: Math.round(base * variance[i % 7]),
    }));
  }, [perf]);

  // ── Per-keyword breakdown ─────────────────────────────────────────────────
  const keywordRows = useMemo(() => {
    if (!perf || campaign.keywords.length === 0) return [];
    const goodKws  = new Set(scenario?.profile.goodKeywords ?? []);
    const riskyKws = new Set(scenario?.profile.riskyKeywords ?? []);
    const weights  = campaign.keywords.map((kw) =>
      goodKws.has(kw) ? 1.5 : riskyKws.has(kw) ? 0.6 : 1.0
    );
    const totalWeight = weights.reduce((s, w) => s + w, 0);

    return campaign.keywords.map((kw, i) => {
      const frac       = weights[i] / totalWeight;
      const impressions = Math.round(perf.impressions * frac * (0.88 + pseudoRand(kw, 1) * 0.24));
      const reachKw    = Math.round(impressions * (0.58 + pseudoRand(kw, 2) * 0.22));
      const baseCtr    = isReach
        ? (0.007 + pseudoRand(kw, 3) * 0.009)
        : goodKws.has(kw) ? (0.014 + pseudoRand(kw, 3) * 0.01) : (0.005 + pseudoRand(kw, 3) * 0.007);
      const clicks     = Math.round(impressions * baseCtr);
      const spend      = Math.round(perf.spend * frac);
      const kwCpm      = impressions > 0 ? Math.round((spend / impressions) * 1000) : cpm;
      const atcs       = isReach ? 0 : Math.round(perf.atcs * frac * (0.75 + pseudoRand(kw, 4) * 0.5));
      const units      = isReach ? 0 : Math.round(perf.units * frac * (0.75 + pseudoRand(kw, 5) * 0.5));
      const revenue    = isReach ? 0 : Math.round(perf.revenue * frac);
      const roas       = spend > 0 && revenue > 0 ? (revenue / spend).toFixed(2) : "—";

      return {
        keyword: kw, spend, cpm: kwCpm, impressions, reach: reachKw,
        clicks, ctr: (baseCtr * 100).toFixed(2),
        atcs, units, roas,
        isGood: goodKws.has(kw), isRisky: riskyKws.has(kw),
      };
    });
  }, [perf, campaign.keywords, scenario, isReach, cpm]);

  // ── Per-category breakdown ────────────────────────────────────────────────
  const categoryRows = useMemo(() => {
    const cats = campaign.categories ?? [];
    if (!perf || cats.length === 0) return [];

    return cats.map((cat) => {
      const frac       = 1 / cats.length;
      const impressions = Math.round(perf.impressions * frac * (0.8 + pseudoRand(cat, 1) * 0.4));
      const reachCat   = Math.round(impressions * (0.58 + pseudoRand(cat, 2) * 0.24));
      const baseCtr    = 0.007 + pseudoRand(cat, 3) * 0.008;
      const clicks     = Math.round(impressions * baseCtr);
      const spend      = Math.round(perf.spend * frac);
      const catCpm     = impressions > 0 ? Math.round((spend / impressions) * 1000) : cpm;
      const atcs       = isReach ? 0 : Math.round(perf.atcs * frac);
      const units      = isReach ? 0 : Math.round(perf.units * frac);
      const revenue    = isReach ? 0 : Math.round(perf.revenue * frac);
      const roas       = spend > 0 && revenue > 0 ? (revenue / spend).toFixed(2) : "—";

      return {
        category: cat, spend, cpm: catCpm, impressions, reach: reachCat,
        clicks, ctr: (baseCtr * 100).toFixed(2),
        atcs, units, roas,
      };
    });
  }, [perf, campaign.categories, isReach, cpm]);

  // ── Rec Ads asset breakdown ───────────────────────────────────────────────
  const assetRows = useMemo(() => {
    if (!perf || campaign.adFormat !== "recommendation_ads") return [];
    const assets = [
      { name: "Next Product Recommendation",    frac: 0.35 },
      { name: "Similar Products Recommendation", frac: 0.65 },
    ];
    return assets.map(({ name, frac }) => {
      const spend        = Math.round(perf.spend * frac);
      const impressions  = Math.round(perf.impressions * frac);
      const assetCpm     = impressions > 0 ? Math.round((spend / impressions) * 1000) : 0;
      const directAtc    = Math.round(perf.atcs * frac * 0.7);
      const indirectAtc  = Math.round(perf.atcs * frac * 0.3);
      const directQty    = Math.round(perf.units * frac * 0.7);
      const indirectQty  = Math.round(perf.units * frac * 0.3);
      const directSales  = Math.round(perf.revenue * frac * 0.7);
      const indirectSales = Math.round(perf.revenue * frac * 0.3);
      const directRoas   = spend > 0 && directSales > 0 ? (directSales / spend).toFixed(2) : "0";
      const totalRoas    = spend > 0 ? (perf.roas * frac * 2).toFixed(2) : "0";
      const newUsers     = Math.round(impressions * 0.002);
      return { name, spend, cpm: assetCpm, impressions, directAtc, indirectAtc, directQty, indirectQty, directSales, indirectSales, directRoas, totalRoas, newUsers };
    });
  }, [perf, campaign.adFormat]);

  // ── Stories feed breakdown ────────────────────────────────────────────────
  const feedRows = useMemo(() => {
    if (!perf || campaign.adFormat !== "stories") return [];
    const feeds = (campaign.feeds ?? []).length > 0 ? campaign.feeds! : ["Main Feed"];
    return feeds.map((feed) => {
      const frac        = 1 / feeds.length;
      const impressions = Math.round(perf.impressions * frac * (0.85 + pseudoRand(feed, 1) * 0.3));
      const reachFeed   = Math.round(impressions * (0.68 + pseudoRand(feed, 2) * 0.18));
      const reachPct    = perf.impressions > 0 ? ((reachFeed / perf.impressions) * 100).toFixed(1) : "0";
      const baseCtr     = 0.005 + pseudoRand(feed, 3) * 0.009;
      const clicks      = Math.round(impressions * baseCtr);
      const spend       = Math.round(perf.spend * frac);
      const feedCpm     = impressions > 0 ? Math.round((spend / impressions) * 1000) : 0;
      return { feed, spend, cpm: feedCpm, impressions, reach: reachFeed, reachPct, clicks, ctr: (baseCtr * 100).toFixed(2) };
    });
  }, [perf, campaign.adFormat, campaign.feeds]);

  // ── SKU names lookup ──────────────────────────────────────────────────────
  const skuMap = useMemo(() => {
    const map: Record<string, string> = {};
    scenario?.profile.skus.forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [scenario]);

  // ── Active daypart slots ──────────────────────────────────────────────────
  const activeDayparts = campaign.dayparting?.length === 8 || !campaign.dayparting
    ? null
    : campaign.dayparting.map((i) => TIME_SLOTS[i]).filter(Boolean);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 bg-background overflow-y-auto">

      {/* ── Breadcrumb + Header ── */}
      <div className="px-8 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <button onClick={onBack} className="hover:text-foreground flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Ad Summary
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Campaign details</span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              {campaign.isDraft ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">Draft</Badge>
              ) : (
                <Badge className="bg-green-50 text-green-700 border border-green-300 text-xs">Ready</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="capitalize">{campaign.objective ?? "—"}</span> campaign
              {" | "}
              <span style={{ color: FORMAT_COLOR[campaign.adFormat ?? ""] }}>
                {FORMAT_LABEL[campaign.adFormat ?? ""] ?? campaign.adFormat ?? "—"}
              </span>
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 border border-border rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Ad Summary
          </button>
        </div>

        {/* ── Top tabs ── */}
        <div className="flex gap-6 mt-4">
          <TabButton label="Campaign Details"     active={topTab === "details"}     onClick={() => setTopTab("details")} />
          <TabButton label="Campaign Performance" active={topTab === "performance"} onClick={() => setTopTab("performance")} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: Campaign Details
      ══════════════════════════════════════════════════════════════════════ */}
      {topTab === "details" && (
        <div className="px-8 py-6 max-w-4xl space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Geography */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <MapPin className="h-3.5 w-3.5" /> Geography
              </div>
              {campaign.geography === "pan_india" ? (
                <p className="text-sm font-medium">Pan India</p>
              ) : campaign.cities.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {campaign.cities.map((c) => (
                    <span key={c} className="text-xs bg-muted rounded px-2 py-0.5">{c}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not set</p>
              )}
            </Card>

            {/* SKUs */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Package className="h-3.5 w-3.5" /> Products
              </div>
              {campaign.skuIds.length > 0 ? (
                <div className="space-y-1">
                  {campaign.skuIds.map((id) => (
                    <div key={id} className="text-sm font-medium">
                      {skuMap[id] ?? id}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No SKUs selected</p>
              )}
            </Card>

            {/* Keywords */}
            {campaign.keywords.length > 0 && (
              <Card className="p-4 space-y-2 col-span-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Tag className="h-3.5 w-3.5" /> Keywords ({campaign.keywords.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.keywords.map((kw) => {
                    const goodKws  = new Set(scenario?.profile.goodKeywords ?? []);
                    const riskyKws = new Set(scenario?.profile.riskyKeywords ?? []);
                    const isGood   = goodKws.has(kw);
                    const isRisky  = riskyKws.has(kw);
                    return (
                      <span key={kw} className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${
                        isGood  ? "bg-green-50 text-green-700 border border-green-200" :
                        isRisky ? "bg-red-50 text-red-700 border border-red-200" :
                        "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {kw}
                      </span>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  <span className="text-green-600">●</span> Good keyword &nbsp;
                  <span className="text-red-500">●</span> Risky keyword
                </p>
              </Card>
            )}

            {/* Categories */}
            {(campaign.categories ?? []).length > 0 && (
              <Card className="p-4 space-y-2 col-span-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Tag className="h-3.5 w-3.5" /> Categories ({campaign.categories!.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.categories!.map((cat) => (
                    <span key={cat} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium">
                      {cat}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Feeds (Stories) */}
            {(campaign.feeds ?? []).length > 0 && (
              <Card className="p-4 space-y-2 col-span-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Tag className="h-3.5 w-3.5" /> Feeds ({campaign.feeds!.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.feeds!.map((f) => (
                    <span key={f} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 font-medium">
                      {f}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Budget */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Wallet className="h-3.5 w-3.5" /> Budget
              </div>
              <p className="text-xl font-bold">₹{fmt(campaign.budget)}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {campaign.budgetType ?? "not set"} budget
              </p>
            </Card>

            {/* Dayparting */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Clock className="h-3.5 w-3.5" /> Ad Schedule
              </div>
              {activeDayparts ? (
                <>
                  <p className="text-xs text-amber-600 font-medium">Dayparting active</p>
                  <div className="flex flex-wrap gap-1">
                    {activeDayparts.map((slot) => (
                      <span key={slot} className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 rounded px-1.5 py-0.5">
                        {slot}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Off-peak hours run at ₹1 bid</p>
                </>
              ) : (
                <p className="text-sm text-foreground">24/7 — all hours</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: Campaign Performance
      ══════════════════════════════════════════════════════════════════════ */}
      {topTab === "performance" && (
        <div className="px-8 py-6 space-y-5 max-w-6xl">

          {/* ── Performance Overview cards ── */}
          <div>
            <h2 className="text-base font-semibold mb-3">Performance Overview</h2>
            <div className="grid grid-cols-5 gap-3">
              <PerfCard label="Planned Budget"    value={`₹${fmt(campaign.budget)}`} sub="Campaign total" />
              <PerfCard label="Proj. Impressions" value={fmt(perf?.impressions ?? 0)} sub="30-day estimate" />

              {isReach ? (
                <>
                  <PerfCard label="Proj. Reach"   value={fmt(reach)}  sub="Unique users" />
                  <PerfCard label="Proj. Clicks"  value={fmt(perf?.clicks ?? 0)} sub="Total clicks" />
                  <PerfCard label="CTR %"         value={`${ctrPct}%`} sub="Click-through rate" />
                </>
              ) : (
                <>
                  <PerfCard label="Proj. ATCs"       value={fmt(perf?.atcs ?? 0)}    sub="Add-to-carts" />
                  <PerfCard label="Proj. Qty Sold"   value={fmt(perf?.units ?? 0)}   sub="Units" />
                  <PerfCard label="Proj. Revenue"    value={`₹${fmt(perf?.revenue ?? 0)}`} sub="Gross sales" />
                </>
              )}
            </div>
          </div>

          {/* ── Daily Metric Trend ── */}
          {dailyData.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Daily Metric Trends</h3>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-green-500" />
                  <span className="text-xs text-muted-foreground">Budget Consumed (Projected)</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} width={36} />
                  <Tooltip
                    formatter={(v: number) => [`₹${fmt(v)}`, "Spend"]}
                    labelFormatter={(l: string) => `Day ${l.replace("D", "")}`}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Area type="monotone" dataKey="spend" stroke="#16a34a" strokeWidth={2}
                    fill="url(#spendGrad2)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ── Detailed Summary ── */}
          {availableSubTabs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold">Detailed summary</h3>
                  <p className="text-xs text-muted-foreground">Analyse performance metrics by targeting type</p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-6 border-b border-border mb-4">
                {availableSubTabs.includes("keyword") && (
                  <TabButton label="Keyword Performance"  active={subTab === "keyword"}  onClick={() => setSubTab("keyword")} />
                )}
                {availableSubTabs.includes("category") && (
                  <TabButton label="Category Performance" active={subTab === "category"} onClick={() => setSubTab("category")} />
                )}
                {availableSubTabs.includes("asset") && (
                  <TabButton label="Asset Performance"    active={subTab === "asset"}    onClick={() => setSubTab("asset")} />
                )}
                {availableSubTabs.includes("feed") && (
                  <TabButton label="Feed Performance"     active={subTab === "feed"}     onClick={() => setSubTab("feed")} />
                )}
              </div>

              {/* ── Keyword Performance ── */}
              {subTab === "keyword" && (
                <Card className="overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Keyword</th>
                        <th className="text-right px-4 py-3 font-medium">Budget</th>
                        <th className="text-right px-4 py-3 font-medium">CPM</th>
                        <th className="text-right px-4 py-3 font-medium">Impressions</th>
                        <th className="text-right px-4 py-3 font-medium">Reach</th>
                        <th className="text-right px-4 py-3 font-medium">Clicks</th>
                        <th className="text-right px-4 py-3 font-medium">CTR %</th>
                        {!isReach && <>
                          <th className="text-right px-4 py-3 font-medium">ATCs</th>
                          <th className="text-right px-4 py-3 font-medium">Qty Sold</th>
                          <th className="text-right px-4 py-3 font-medium">ROAS</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody>
                      {keywordRows.map((row) => (
                        <tr key={row.keyword} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              row.isGood ? "bg-green-500" : row.isRisky ? "bg-red-400" : "bg-muted-foreground"
                            }`} />
                            {row.keyword}
                          </td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.spend)}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.cpm)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.impressions)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.reach)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.clicks)}</td>
                          <td className="px-4 py-3 text-right">{row.ctr}%</td>
                          {!isReach && <>
                            <td className="px-4 py-3 text-right">{fmt(row.atcs)}</td>
                            <td className="px-4 py-3 text-right">{fmt(row.units)}</td>
                            <td className="px-4 py-3 text-right font-medium">{row.roas}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}

              {/* ── Category Performance ── */}
              {subTab === "category" && (
                <Card className="overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Category</th>
                        <th className="text-right px-4 py-3 font-medium">Budget</th>
                        <th className="text-right px-4 py-3 font-medium">CPM</th>
                        <th className="text-right px-4 py-3 font-medium">Impressions</th>
                        <th className="text-right px-4 py-3 font-medium">Reach</th>
                        <th className="text-right px-4 py-3 font-medium">Clicks</th>
                        <th className="text-right px-4 py-3 font-medium">CTR %</th>
                        {!isReach && <>
                          <th className="text-right px-4 py-3 font-medium">ATCs</th>
                          <th className="text-right px-4 py-3 font-medium">Qty Sold</th>
                          <th className="text-right px-4 py-3 font-medium">ROAS</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody>
                      {categoryRows.map((row) => (
                        <tr key={row.category} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{row.category}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.spend)}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.cpm)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.impressions)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.reach)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.clicks)}</td>
                          <td className="px-4 py-3 text-right">{row.ctr}%</td>
                          {!isReach && <>
                            <td className="px-4 py-3 text-right">{fmt(row.atcs)}</td>
                            <td className="px-4 py-3 text-right">{fmt(row.units)}</td>
                            <td className="px-4 py-3 text-right font-medium">{row.roas}</td>
                          </>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}

              {/* ── Asset Performance (Rec Ads) ── */}
              {subTab === "asset" && (
                <Card className="overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Asset Type</th>
                        <th className="text-right px-4 py-3 font-medium">Budget</th>
                        <th className="text-right px-4 py-3 font-medium">CPM</th>
                        <th className="text-right px-4 py-3 font-medium">Impressions</th>
                        <th className="text-right px-4 py-3 font-medium">Direct ATC</th>
                        <th className="text-right px-4 py-3 font-medium">Indirect ATC</th>
                        <th className="text-right px-4 py-3 font-medium">Direct Qty</th>
                        <th className="text-right px-4 py-3 font-medium">Indirect Qty</th>
                        <th className="text-right px-4 py-3 font-medium">Direct Sales</th>
                        <th className="text-right px-4 py-3 font-medium">Indirect Sales</th>
                        <th className="text-right px-4 py-3 font-medium">Direct ROAS</th>
                        <th className="text-right px-4 py-3 font-medium">Total ROAS</th>
                        <th className="text-right px-4 py-3 font-medium">New Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetRows.map((row) => (
                        <tr key={row.name} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium max-w-[180px] whitespace-normal leading-tight">{row.name}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.spend)}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.cpm)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.impressions)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.directAtc)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.indirectAtc)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.directQty)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.indirectQty)}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.directSales)}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.indirectSales)}</td>
                          <td className="px-4 py-3 text-right">{row.directRoas}</td>
                          <td className="px-4 py-3 text-right font-medium">{row.totalRoas}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.newUsers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}

              {/* ── Feed Performance (Stories) ── */}
              {subTab === "feed" && (
                <Card className="overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Feed</th>
                        <th className="text-right px-4 py-3 font-medium">Budget</th>
                        <th className="text-right px-4 py-3 font-medium">CPM</th>
                        <th className="text-right px-4 py-3 font-medium">Impressions</th>
                        <th className="text-right px-4 py-3 font-medium">Reach</th>
                        <th className="text-right px-4 py-3 font-medium">Reach %</th>
                        <th className="text-right px-4 py-3 font-medium">Clicks</th>
                        <th className="text-right px-4 py-3 font-medium">CTR %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedRows.map((row) => (
                        <tr key={row.feed} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{row.feed}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.spend)}</td>
                          <td className="px-4 py-3 text-right">₹{fmt(row.cpm)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.impressions)}</td>
                          <td className="px-4 py-3 text-right">{fmt(row.reach)}</td>
                          <td className="px-4 py-3 text-right">{row.reachPct}%</td>
                          <td className="px-4 py-3 text-right">{fmt(row.clicks)}</td>
                          <td className="px-4 py-3 text-right">{row.ctr}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          )}

          <div className="pb-8" />
        </div>
      )}
    </div>
  );
}
