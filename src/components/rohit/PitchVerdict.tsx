// End state of the CM pitch: what Rohit approved and what happens next.

import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreBar, Section, Tag } from "@/components/sim/primitives";
import type { Tone } from "@/components/sim/tone";
import type { CmPitchResult } from "@/context/SimContext";
import type { SKU } from "@/data/scenarios";

const STATUS: Record<CmPitchResult["status"], { title: string; tone: Tone }> = {
  strong: { title: "Strong pitch", tone: "good" },
  decent: { title: "Decent pitch", tone: "neutral" },
  weak: { title: "Weak pitch", tone: "warn" },
  rejected: { title: "Pitch rejected", tone: "bad" },
};

type Props = {
  result: CmPitchResult;
  skus: readonly SKU[];
  isTokenDeducted: boolean;
  tokensRemaining: number;
  onContinue: () => void;
  onAcceptDefault: () => void;
  onRetry: () => void;
};

export function PitchVerdict({ result, skus, isTokenDeducted, tokensRemaining, onContinue, onAcceptDefault, onRetry }: Props) {
  const status = STATUS[result.status];
  const names = result.approvedSKUs.map((id) => skus.find((s) => s.id === id)?.name ?? id);
  return (
    <Section
      className="ml-0 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none sm:ml-12"
      title={<span className="flex flex-wrap items-center gap-2">{status.title}<Tag tone={status.tone}>Meeting over</Tag></span>}
      description={result.message}
    >
      <ScoreBar earned={result.pitchScore} max={15} label="Pitch score" />
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Products approved</dt>
          <dd className="mt-1 text-sm text-foreground">{names.length ? names.join(", ") : "None"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">States approved</dt>
          <dd className="mt-1 text-sm text-foreground">{result.approvedCities.length ? result.approvedCities.join(", ") : "None"}</dd>
        </div>
      </dl>

      {result.osaBoost && (
        <p className="mt-4 rounded-lg bg-sim-good/10 px-3 py-2 text-sm text-sim-good">
          Bonus: 10% more stores stock your products in the approved states, so your ads reach more shoppers.
        </p>
      )}

      {result.flags.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">What Rohit noted</p>
          <ul className="mt-1.5 space-y-1">
            {result.flags.map((f) => (
              <li key={f} className="text-sm text-sim-warn">{f}</li>
            ))}
          </ul>
        </div>
      )}

      {isTokenDeducted && (
        <p className="mt-4 rounded-lg bg-sim-bad/10 px-3 py-2 text-sm text-sim-bad">
          A weak pitch uses 1 token. You have {tokensRemaining} {tokensRemaining === 1 ? "token" : "tokens"} left.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {result.status !== "rejected" ? (
          <Button onClick={onContinue} className="gap-2">
            Build your campaigns <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onAcceptDefault}>Take the basic approval</Button>
            <Button variant="outline" onClick={onRetry} disabled={tokensRemaining <= 0} className="gap-2">
              <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
              Pitch again (uses 1 of {tokensRemaining} tokens)
            </Button>
          </>
        )}
      </div>
      {result.status === "rejected" && (
        <p className="mt-2 text-xs text-muted-foreground">The basic approval covers your fastest-selling product in your best-stocked state only.</p>
      )}
    </Section>
  );
}
