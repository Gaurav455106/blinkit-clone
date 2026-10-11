// Chat lines for Rohit conversations: his lines (with data chips) and the
// student's replies (with what they cost or committed).

import { useEffect, useState, type ReactNode } from "react";
import { TypingDots } from "@/components/game/GameBits";
import { prefersReducedMotion } from "@/components/game/motion";

/** How long Rohit "types" before a new line appears (SPEC §15). */
export const TYPING_MS = 700;
import { cn } from "@/lib/utils";
import { DataChips, type ChipData } from "@/components/rohit/DataChips";

const ENTER = "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none";

export function RohitAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-xs font-semibold text-accent-foreground", className)}
    >
      RS
    </span>
  );
}

type RohitLineProps = {
  text: string;
  chips?: readonly ChipData[];
  chipsCaption?: string;
  /** Hide the name row for consecutive lines. */
  isContinuation?: boolean;
  /** Show typing dots first (use on his newest line only). */
  typeIn?: boolean;
  children?: ReactNode;
  className?: string;
};

export function RohitLine({ text, chips, chipsCaption, isContinuation = false, typeIn = false, children, className }: RohitLineProps) {
  const [typing, setTyping] = useState(() => typeIn && !prefersReducedMotion());
  useEffect(() => {
    if (!typing) return;
    const t = window.setTimeout(() => setTyping(false), TYPING_MS);
    return () => window.clearTimeout(t);
  }, [typing]);
  if (typing) {
    return (
      <div className={cn("flex items-start gap-3", ENTER, className)}>
        {isContinuation ? <span className="w-9 shrink-0" aria-hidden /> : <RohitAvatar />}
        <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 shadow-[0_1px_0_hsl(var(--border))]"><TypingDots label="Rohit is typing" /></div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-3", ENTER, className)}>
      {isContinuation ? <span className="w-9 shrink-0" aria-hidden /> : <RohitAvatar />}
      <div className="min-w-0 max-w-[64ch] flex-1">
        {!isContinuation && <p className="mb-1 text-xs font-medium text-muted-foreground">Rohit Sharma, category manager</p>}
        <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 shadow-[0_1px_0_hsl(var(--border)),0_8px_24px_-18px_hsl(24_30%_20%/0.35)]">
          <p className="text-[15px] leading-relaxed text-foreground">{text}</p>
          {chips && <DataChips chips={chips} caption={chipsCaption} />}
        </div>
        {children}
      </div>
    </div>
  );
}

type StudentLineProps = {
  text: string;
  /** What the reply cost or committed, repeated under it. */
  cost?: string;
  className?: string;
};

export function StudentLine({ text, cost, className }: StudentLineProps) {
  return (
    <div className={cn("flex flex-col items-end", ENTER, className)}>
      <p className="mb-1 text-xs font-medium text-muted-foreground">You</p>
      <div className="max-w-[56ch] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground">
        <p className="text-[15px] leading-relaxed">{text}</p>
      </div>
      {cost && <p className="mt-1.5 max-w-[56ch] text-right text-xs text-muted-foreground">{cost}</p>}
    </div>
  );
}
