import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefNotes } from "@/components/brief/useBriefNotes";

type Props = {
  /** The exact text that goes into the notes panel. */
  note: string;
  className?: string;
};

/** Small toggle that pins a fact into the brief notes. */
export function PinButton({ note, className }: Props) {
  const { isPinned, toggle } = useBriefNotes();
  const pinned = isPinned(note);
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      onClick={() => toggle(note)}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin: ${note}` : `Pin to notes: ${note}`}
      title={pinned ? "Unpin from notes" : "Pin to notes"}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground",
        pinned && "bg-accent text-accent-foreground hover:bg-accent",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}
