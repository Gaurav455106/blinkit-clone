import { useMemo } from "react";
import type { BrandProfile } from "@/data/scenarios";
import type { MarketContext } from "@/market/engineTypes";
import type { KeywordTier } from "@/market/types";
import { Section, Tag, EmptyState } from "@/components/sim/primitives";
import { keywordRows, unlistedV1Keywords, type KeywordRow } from "@/lib/briefData";
import { PinButton } from "@/components/brief/PinButton";
import { count, inr } from "@/components/brief/format";

type Props = {
  profile: BrandProfile;
  ctx: MarketContext | null;
};

const TIER_LABEL: Record<KeywordTier, string> = { head: "Head", mid: "Mid", long: "Long-tail" };

function rangeText(r: KeywordRow): string {
  return `${inr(r.cpmRange.lo)} to ${inr(r.cpmRange.hi)}`;
}

function KeywordTable({ rows }: { rows: readonly KeywordRow[] }) {
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Keyword</th>
            <th scope="col" className="py-2 pr-4 font-medium">Tier</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Searches per month</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Usual CPM for the top spot</th>
            <th scope="col" className="py-2 pr-4 font-medium">Notes</th>
            <th scope="col" className="py-2"><span className="sr-only">Pin</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.term} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
              <td className="py-2.5 pr-4 font-medium text-foreground">{r.term}</td>
              <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground">{TIER_LABEL[r.tier]}</td>
              <td className="py-2.5 pr-4 text-right">{count(r.monthlySearches)}</td>
              <td className="whitespace-nowrap py-2.5 pr-4 text-right">{rangeText(r)}</td>
              <td className="py-2.5 pr-4">
                <div className="flex flex-wrap gap-1">
                  {r.isBrandTerm && <Tag>Your brand</Tag>}
                  {r.v1 === "good" && <Tag tone="good">High intent</Tag>}
                  {r.v1 === "risky" && <Tag tone="bad">Risky</Tag>}
                </div>
              </td>
              <td className="py-2.5 text-right">
                <PinButton note={`"${r.term}" (${TIER_LABEL[r.tier].toLowerCase()}): ${count(r.monthlySearches)} searches, top spot ${rangeText(r)} CPM`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChipList({ title, words, tone }: { title: string; words: readonly string[]; tone: "good" | "bad" }) {
  if (words.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{words.map((w) => <Tag key={w} tone={tone}>{w}</Tag>)}</div>
    </div>
  );
}

export function KeywordsTab({ profile, ctx }: Props) {
  const rows = useMemo(() => (ctx ? keywordRows(ctx) : []), [ctx]);
  const unlisted = useMemo(() => (ctx ? unlistedV1Keywords(profile, ctx.market) : { good: profile.goodKeywords, risky: profile.riskyKeywords }), [ctx, profile]);

  if (!ctx) {
    return (
      <EmptyState
        title="No keyword data for this brand yet"
        description="Start from these lists. High intent means people searching it usually want to buy. Risky means it costs a lot and rarely sells."
        action={
          <div className="space-y-3">
            <ChipList title="High intent" words={profile.goodKeywords} tone="good" />
            <ChipList title="Risky" words={profile.riskyKeywords} tone="bad" />
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="Keywords: what people search for"
        description="How many times each search happened last month, and the usual CPM (price per 1,000 ad showings) it took to get the top ad spot. Based on the states where you have stock."
      >
        <KeywordTable rows={rows} />
        <div className="mt-5 grid gap-4 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">Head</span> searches are short and common, like “chips”. Lots of
            people, lots of rivals. <span className="font-medium text-foreground">Long-tail</span> searches are longer and
            more exact, like “peri peri makhana 60g”. Fewer people, but they know what they want, so they buy more often
            and the ad spot is cheaper. <span className="font-medium text-foreground">Mid</span> sits in between.
          </p>
          <p>
            The price range tells you what won the top spot. It doesn't tell you if that spot made money. Work out your
            max profitable CPM first (see the Economics tab), then decide your bid.
          </p>
        </div>
        {(unlisted.good.length > 0 || unlisted.risky.length > 0) && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ChipList title="Also on your high-intent list" words={unlisted.good} tone="good" />
            <ChipList title="Also on your risky list" words={unlisted.risky} tone="bad" />
          </div>
        )}
      </Section>
    </div>
  );
}
