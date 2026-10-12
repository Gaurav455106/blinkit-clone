// Every badge as a card: the ones this run earned come first, light up and get
// stamped; the rest stay grey and locked.

import { Lock, Star } from "lucide-react";
import { Section } from "@/components/sim/primitives";
import { stagger } from "@/components/game/GameBits";
import { useTilt } from "@/components/game/useTilt";
import { ALL_ACHIEVEMENTS, type Achievement } from "@/components/game/achievements";
import { cn } from "@/lib/utils";

const STAMP_STEP_MS = 90;

function Badge({ a, earned, order }: { a: Achievement; earned: boolean; order: number }) {
  const tilt = useTilt();
  return (
    <li
      {...(earned ? tilt : {})}
      title={earned ? a.detail : undefined}
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-xl border p-3",
        earned ? "sim-tilt border-primary/40 bg-accent text-accent-foreground" : "border-dashed border-border bg-secondary/40 text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", earned ? "sim-stamp bg-primary text-primary-foreground" : "bg-secondary")}
        style={earned ? stagger(order, STAMP_STEP_MS) : undefined}
      >
        {earned ? <Star className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      </span>
      <span className="text-sm font-medium">{a.title}<span className="sr-only">{earned ? ", earned" : ", locked"}</span></span>
      {earned && <span className="sim-tilt-shine" />}
    </li>
  );
}

export function BadgeShelf({ earned }: { earned: readonly Achievement[] }) {
  const have = new Set(earned.map((a) => a.id));
  const shelf = [...ALL_ACHIEVEMENTS].sort((a, b) => Number(have.has(b.id)) - Number(have.has(a.id)));
  return (
    <Section title="Badges" description={`${have.size} of ${ALL_ACHIEVEMENTS.length} collected`}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shelf.map((a, i) => <Badge key={a.id} a={a} earned={have.has(a.id)} order={i} />)}
      </ul>
    </Section>
  );
}
