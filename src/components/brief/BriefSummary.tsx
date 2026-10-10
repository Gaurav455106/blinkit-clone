import type { GoalMetric, Scenario, StateName } from "@/data/scenarios";
import { StatTile, Section, Tag, type Tone } from "@/components/sim/primitives";
import type { BriefRival, ShoppingHours } from "@/lib/briefData";
import { breakEvenRange, plainText } from "@/lib/briefData";
import { PinButton } from "@/components/brief/PinButton";
import { inr, pct, roasX } from "@/components/brief/format";

type Props = {
  scenario: Scenario;
  stocked: readonly StateName[];
  rivals: readonly BriefRival[];
  hours: ShoppingHours | null;
};

const TOP_RIVALS = 3;

function formatTarget(t: GoalMetric): string {
  if (t.unit === "imp" || t.unit === "users") {
    const v = t.target >= 100000 ? `${(t.target / 100000).toFixed(t.target % 100000 === 0 ? 0 : 1)} lakh` : t.target.toLocaleString("en-IN");
    return t.unit === "imp" ? `${v} ad views` : `${v} people`;
  }
  if (t.unit === "x" || t.unit === "%") return `${t.target}${t.unit}`;
  return `${t.target.toLocaleString("en-IN")} ${t.unit}`;
}

const DIFFICULTY_TONE: Record<Scenario["profile"]["difficulty"], Tone> = {
  Medium: "neutral",
  Hard: "warn",
  "Very Hard": "bad",
};

function inventoryNote(tone: Scenario["inventory"]["tone"]): string {
  switch (tone) {
    case "healthy": return "There's enough stock to spend more if ads work.";
    case "warning": return "Stock is patchy. Ads stop in any state that sells out.";
    case "critical": return "Stock is low. Heavy spending will empty the shelves.";
    case "overstocked": return "There's too much stock. Selling it matters more than return this month.";
  }
}

function GoalGroup({ title, formats, goals }: { title: string; formats: string; goals: readonly GoalMetric[] }) {
  if (goals.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{formats}</p>
      <dl className="mt-3 divide-y divide-border rounded-xl bg-secondary/50">
        {goals.map((g) => (
          <div key={g.label} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="text-sm text-muted-foreground">{plainText(g.label)}</dt>
            <dd className="sim-num text-sm font-semibold text-foreground">{formatTarget(g)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RivalCard({ rival }: { rival: BriefRival }) {
  const cheaper = rival.priceVsYou.diffPct < 0;
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-secondary/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-foreground">{rival.name}</p>
        <Tag tone={rival.archetype === "leader" ? "neutral" : "warn"}>{rival.archetypeLabel}</Tag>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Average price</dt>
          <dd className="sim-num font-medium text-foreground">{inr(rival.price)}</dd>
          <dd className={cheaper ? "text-xs text-sim-warn" : "text-xs text-muted-foreground"}>{rival.priceVsYou.label}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ad share last month</dt>
          <dd className="sim-num font-medium text-foreground">{rival.lastMonthSovPct}%</dd>
        </div>
      </dl>
    </li>
  );
}

export function BriefSummary({ scenario, stocked, rivals, hours }: Props) {
  const { profile, clientGoals, budget, season, market, inventory } = scenario;
  const range = breakEvenRange(profile);
  const breakEvenText = `${roasX(range.min)} to ${roasX(range.max)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-accent-foreground">
          {profile.name.charAt(0)}
        </div>
        <div className="max-w-[68ch]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold text-foreground">{profile.name}</h2>
            <Tag>{profile.category}</Tag>
            <Tag tone={DIFFICULTY_TONE[profile.difficulty]}>{profile.difficulty}</Tag>
            <Tag>{profile.goalType}</Tag>
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{plainText(profile.context)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ad budget for 30 days" value={inr(budget)} hint="Shared by all your campaigns" />
        <div className="relative">
          <StatTile
            label="Break-even ROAS"
            value={breakEvenText}
            hint="Sales you need from every ₹1 of ads just to not lose money. It depends on the product."
          />
          <PinButton note={`Break-even ROAS by product: ${breakEvenText}`} className="absolute right-2 top-2" />
        </div>
        <StatTile label="States with stock" value={stocked.length} hint={stocked.join(", ") || "None"} />
        {hours ? (
          <div className="relative">
            <StatTile
              label="Busiest shopping time"
              value={hours.busiest.label}
              hint={`${pct(hours.busiest.share)} of a day's searches. Next: ${hours.runnersUp.map((s) => s.label).join(" and ")}.`}
            />
            <PinButton note={`Busiest time: ${hours.busiest.label} (${pct(hours.busiest.share)} of searches). Next: ${hours.runnersUp.map((s) => s.label).join(", ")}`} className="absolute right-2 top-2" />
          </div>
        ) : (
          <StatTile label="Client stage" value={clientGoals.lifecycle} hint={plainText(clientGoals.primary)} />
        )}
      </div>

      <Section title="What the client wants" description={plainText(`${clientGoals.primary}. ${clientGoals.threshold}`)}>
        <div className="grid gap-6 md:grid-cols-2">
          <GoalGroup title="Sales targets" formats="Met by Product Booster and Recommendation Ads" goals={clientGoals.performanceGoals ?? []} />
          <GoalGroup title="Reach targets" formats="Met by Listing Spotlight, Brand Booster and Stories" goals={clientGoals.reachGoals ?? []} />
        </div>
        {clientGoals.campaignHint && (
          <p className="mt-5 max-w-[75ch] border-l-2 border-primary/40 pl-4 text-sm leading-relaxed text-foreground">{plainText(clientGoals.campaignHint)}</p>
        )}
      </Section>

      <Section
          title="Who you're up against"
          description="Ad share is how often their ad showed, out of all ad spots, last month. You can't see what they bid, only how they behave."
        >
          {rivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rival data for this brand.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rivals.slice(0, TOP_RIVALS).map((r) => <RivalCard key={r.id} rival={r} />)}
            </ul>
          )}
        </Section>

        <Section title="This month">
          <dl className="grid gap-5 text-sm md:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">{season.name}</dt>
              <dd className="mt-0.5 text-muted-foreground">{plainText(`${season.note} ${season.implication}`)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">{market.name}</dt>
              <dd className="mt-0.5 text-muted-foreground">{plainText(`${market.note} ${market.implication}`)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Stock: {inventory.label}</dt>
              <dd className="mt-0.5 text-muted-foreground">
                <span className="sim-num">On the shelf in {inventory.osa}% of stores. {inventory.agingUnits.toLocaleString("en-IN")} units are getting old.</span>{" "}
                {inventoryNote(inventory.tone)}
              </dd>
            </div>
          </dl>
        </Section>
    </div>
  );
}
