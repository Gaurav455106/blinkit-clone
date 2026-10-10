import type { BrandProfile } from "@/data/scenarios";
import { Section } from "@/components/sim/primitives";
import { stakeholderTargets, stakeholderView, type StakeholderAsk } from "@/lib/briefData";
import { BRAND_REVIEWS } from "@/components/brief/copy";
import { PinButton } from "@/components/brief/PinButton";

type Props = { profile: BrandProfile };

function AskCard({ ask }: { ask: StakeholderAsk }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-secondary/50 p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{ask.who}</p>
        <PinButton note={`${ask.who}: ${ask.ask}`} />
      </div>
      <p className="text-lg font-semibold leading-snug text-foreground">{ask.ask}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{ask.why}</p>
    </div>
  );
}

function Reviews({ brandId }: { brandId: string }) {
  const reviews = BRAND_REVIEWS[brandId] ?? [];
  if (reviews.length === 0) return <p className="text-sm text-muted-foreground">No reviews yet.</p>;
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {reviews.map((r) => (
        <li key={r.author}>
          <figure className="flex h-full flex-col gap-3 rounded-xl bg-secondary/50 p-5">
            <blockquote className="text-sm leading-relaxed text-foreground">“{r.quote}”</blockquote>
            <figcaption className="mt-auto text-xs text-muted-foreground">
              {r.author}, {r.city} <span className="sim-num">· Rated {r.rating} of 5</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

export function StakeholdersTab({ profile }: Props) {
  const view = stakeholderView(profile.goalType, stakeholderTargets(profile));
  return (
    <div className="space-y-6">
      <Section title="Two people, two targets" description="Both will read your results. You probably can't give both of them everything they want.">
        <div className="grid gap-4 md:grid-cols-2">
          <AskCard ask={view.finance} />
          <AskCard ask={view.brandHead} />
        </div>
        <p className="mt-5 max-w-[75ch] border-l-2 border-primary/40 pl-4 text-sm leading-relaxed text-foreground">{view.tension}</p>
      </Section>
      <Section title="What customers say" description="Recent reviews on Blinkit. They hint at what shoppers like, and what they don't.">
        <Reviews brandId={profile.id} />
      </Section>
    </div>
  );
}
