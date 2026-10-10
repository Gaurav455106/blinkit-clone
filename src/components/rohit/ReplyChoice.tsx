// One reply the student can pick. The cost or commitment is visible before
// the click (SPEC §6). Quality is never shown: that would give the answer away.

import { ArrowRight, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  cost: string;
  /** Short tag such as "You promise" when the reply creates a commitment. */
  tag?: string;
  onSelect: () => void;
  isDisabled?: boolean;
};

export function ReplyChoice({ label, cost, tag, onSelect, isDisabled = false }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl bg-card px-4 py-3 text-left",
        "shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.6)] hover:bg-accent/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug text-foreground">{label}</span>
        <span className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
          <Receipt className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>
            {tag && <span className="font-medium text-foreground">{tag}: </span>}
            {cost}
          </span>
        </span>
      </span>
      <ArrowRight
        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  );
}
