// Mid-run Rohit check-in (SPEC §6): a chat panel over the live dashboard.
// Presentational only: the dashboard owns the clock, applies the chosen
// reply's effect and stores any commitment.
//
// Usage (live dashboard):
//
//   const ask = pickCheckIns({ ctx, state, history, campaigns, relationship }, askedSoFar);
//   {ask && (
//     <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md p-4">
//       <RohitPanel
//         ask={ask}
//         day={state.day}
//         relationship={relationship}
//         isClockPaused
//         chosenOptionId={chosen?.id ?? null}
//         onChoose={(option) => {
//           setChosen(option);
//           setRelationship((r) => clampRelationship(r + option.effect.relationshipDelta));
//           const c = commitmentFor(ask, option);
//           if (c) setCommitments((list) => [...list, c]);
//           applyReplyEffect(option.effect, ask.situationEffect); // dashboard-side
//         }}
//         onClose={() => { setAskedSoFar((a) => [...a, ask.id]); resumeClock(); }}
//       />
//     </div>
//   )}

import { Pause, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { RohitAsk, ReplyOption } from "@/market/rohit";
import { RohitAvatar, RohitLine, StudentLine } from "@/components/rohit/ChatLines";
import { ReplyChoice } from "@/components/rohit/ReplyChoice";
import { RelationshipMeter } from "@/components/rohit/RelationshipMeter";

type Props = {
  ask: Pick<RohitAsk, "title" | "line" | "chips" | "options">;
  onChoose: (option: ReplyOption) => void;
  /** Set once the student has replied; the panel then shows the reply. */
  chosenOptionId?: string | null;
  /** Rohit's answer to the reply, if the dashboard has one. */
  rohitReply?: string;
  relationship?: number;
  isClockPaused?: boolean;
  /** The last completed day, shown in the header. */
  day?: number;
  onClose?: () => void;
  className?: string;
};

export function RohitPanel({ ask, onChoose, chosenOptionId = null, rohitReply, relationship, isClockPaused = false, day, onClose, className }: Props) {
  const chosen = ask.options.find((o) => o.id === chosenOptionId) ?? null;
  return (
    <section
      aria-label={`Rohit: ${ask.title}`}
      className={cn("sim-ui flex max-h-full flex-col overflow-hidden rounded-2xl bg-background shadow-[0_1px_0_hsl(var(--border)),0_24px_64px_-24px_hsl(24_30%_20%/0.45)]", className)}
    >
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <RohitAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{ask.title}</p>
          <p className="text-xs text-muted-foreground">Check-in with Rohit{day !== undefined ? `, after day ${day}` : ""}</p>
        </div>
        {isClockPaused && (
          <span className="inline-flex items-center gap-1 rounded-md bg-sim-warn/10 px-2 py-1 text-xs font-medium text-sim-warn">
            <Pause className="h-3 w-3" strokeWidth={2} aria-hidden />
            Clock paused
          </span>
        )}
        {onClose && chosen && (
          <button type="button" onClick={onClose} aria-label="Close and resume" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <RohitLine key={ask.line} typeIn text={ask.line} chips={ask.chips} chipsCaption="The numbers he is looking at" />

        {chosen ? (
          <>
            <StudentLine text={chosen.label} cost={chosen.cost} />
            {rohitReply && <RohitLine typeIn text={rohitReply} isContinuation={false} />}
          </>
        ) : (
          <fieldset className="space-y-2 pl-12">
            <legend className="mb-2 text-xs font-medium text-muted-foreground">Your reply. Each one shows what it costs you.</legend>
            {ask.options.map((option) => (
              <ReplyChoice
                key={option.id}
                label={option.label}
                cost={option.cost}
                tag={option.commitment ? "You promise" : undefined}
                onSelect={() => onChoose(option)}
              />
            ))}
          </fieldset>
        )}
      </div>

      {(relationship !== undefined || (chosen && onClose)) && (
        <footer className="space-y-4 border-t border-border px-5 py-4">
          {relationship !== undefined && (
            <RelationshipMeter value={relationship} delta={chosen ? chosen.effect.relationshipDelta : undefined} />
          )}
          {chosen && onClose && (
            <Button className="w-full" onClick={onClose}>Back to the dashboard</Button>
          )}
        </footer>
      )}
    </section>
  );
}
