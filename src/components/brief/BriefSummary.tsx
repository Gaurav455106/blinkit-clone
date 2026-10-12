import { CountUp, Reveal, stagger } from "@/components/game/GameBits";
import type { GoalMetric, Scenario, StateName } from "@/data/scenarios";
import { StatTile, Section, Tag, type Tone } from "@/components/sim/primitives";
import type { BriefRival, ShoppingHours } from "@/lib/briefData";
import { breakEvenRange, plainText } from "@/lib/briefData";
import { PinButton } from "@/components/brief/PinButton";
import { inr, pct, roasX } from "@/components/brief/format";
import { useIsEngineV2 } from "@/lib/useEngine";
import { clientGoalsV2 } from "@/market/goals";
import { ClueCard } from "@/components/brief/ClueCard";
import type { Clues } from "@/components/brief/useClues";

type Props = {
  scenario: Scenario;
  stocked: readonly StateName[];
  rivals: readonly BriefRival[];
  hours: ShoppingHours | null;
  clues: Clues;
};

const TOP_RIVALS = 3;
const MONTH_CLUES = ["season", "market", "stock"] as const;

/** How many clue cards the brief deals: the top rivals plus the three facts about this month. */
export const clueCountFor = (rivals: readonly BriefRival[]) => Math.min(TOP_RIVALS, rivals.length) + MONTH_CLUES.length;

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
        {goals.map((g, i) => (
          <div key={g.label} className="sim-rise flex items-baseline justify-between gap-3 px-4 py-2.5" style={stagger(i + 4, 90)}>
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
    <div className="flex flex-col gap-2">
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
          <dd aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
            <span className="sim-fill block h-full rounded-full bg-sim-warn/70" style={{ width: `${Math.min(100, rival.lastMonthSovPct)}%` }} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function BriefSummary({ scenario, stocked, rivals, hours, clues }: Props) {
  const { profile, budget, season, market, inventory } = scenario;
  // v2 runs use goals calibrated to the engine; v1 runs keep the goals they started with
  const isV2 = useIsEngineV2();
  const clientGoals = isV2 ? clientGoalsV2(scenario) : scenario.clientGoals;
  const range = breakEvenRange(profile);
  const breakEvenText = `${roasX(range.min)} to ${roasX(range.max)}`;

  return (
    <div className="space-y-6">
      <div className="sim-rise flex flex-col gap-5 md:flex-row md:items-start">
        <div aria-hidden className="sim-pop-in flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-accent-foreground">
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
        <div className="sim-rise sim-lift rounded-xl" style={stagger(1, 90)}>
          <StatTile label="Ad budget for 30 days" value={<CountUp value={budget} from={0} ms={1100} format={inr} />} hint="Shared by all your campaigns" />
        </div>
        <div className="sim-rise sim-lift relative rounded-xl" style={stagger(2, 90)}>
          <StatTile
            label="Break-even ROAS"
            value={breakEvenText}
            hint="Sales you need from every ₹1 of ads just to not lose money. It depends on the product."
          />
          <PinButton note={`Break-even ROAS by product: ${breakEvenText}`} className="absolute right-2 top-2" />
        </div>
        <div className="sim-rise sim-lift rounded-xl" style={stagger(3, 90)}>
          <StatTile label="States with stock" value={<CountUp value={stocked.length} from={0} ms={900} format={(n) => String(Math.round(n))} />} hint={stocked.join(", ") || "None"} />
        </div>
        {hours ? (
          <div className="sim-rise sim-lift relative rounded-xl" style={stagger(4, 90)}>
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

      <Reveal>
      <Section title="What the client wants" description={plainText(`${clientGoals.primary}. ${clientGoals.threshold}`)}>
        <div className="grid gap-6 md:grid-cols-2">
          <GoalGroup title="Sales targets" formats="Met by Product Booster and Recommendation Ads" goals={clientGoals.performanceGoals ?? []} />
          <GoalGroup title="Reach targets" formats="Met by Listing Spotlight, Brand Booster and Stories" goals={clientGoals.reachGoals ?? []} />
        </div>
        {clientGoals.campaignHint && (
          <p className="mt-5 max-w-[75ch] border-l-2 border-primary/40 pl-4 text-sm leading-relaxed text-foreground">{plainText(clientGoals.campaignHint)}</p>
        )}
      </Section>
      </Reveal>

      <Reveal>
      <Section
          title="Who you're up against"
          description="Ad share is how often their ad showed, out of all ad spots, last month. You can't see what they bid, only how they behave."
        >
          {rivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rival data for this brand.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rivals.slice(0, TOP_RIVALS).map((r, i) => (
                <li key={r.id}>
                  <ClueCard title={`Rival ${i + 1}`} open={clues.isOpen(`rival:${r.id}`)} onOpen={() => clues.open(`rival:${r.id}`)} className="h-full">
                    <RivalCard rival={r} />
                  </ClueCard>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Reveal>

      <Reveal>
        <Section title="This month">
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <ClueCard title="Season" open={clues.isOpen("season")} onOpen={() => clues.open("season")}>
              <p className="font-medium text-foreground">{season.name}</p>
              <p className="mt-0.5 text-muted-foreground">{plainText(`${season.note} ${season.implication}`)}</p>
            </ClueCard>
            <ClueCard title="Competition" open={clues.isOpen("market")} onOpen={() => clues.open("market")}>
              <p className="font-medium text-foreground">{market.name}</p>
              <p className="mt-0.5 text-muted-foreground">{plainText(`${market.note} ${market.implication}`)}</p>
            </ClueCard>
            <ClueCard title="Stock" open={clues.isOpen("stock")} onOpen={() => clues.open("stock")}>
              <p className="font-medium text-foreground">Stock: {inventory.label}</p>
              <p className="mt-0.5 text-muted-foreground">
                <span className="sim-num">On the shelf in {inventory.osa}% of stores. {inventory.agingUnits.toLocaleString("en-IN")} units are getting old.</span>{" "}
                {inventoryNote(inventory.tone)}
              </p>
            </ClueCard>
          </div>
        </Section>
      </Reveal>
    </div>
  );
}
