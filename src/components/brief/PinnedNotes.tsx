import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useBriefNotes, MAX_NOTES, MAX_NOTE_LENGTH } from "@/components/brief/useBriefNotes";

type Props = {
  /** Read-only lists hide the add box (for later stages). */
  readOnly?: boolean;
};

/** The student's pinned facts. Reusable on later screens (outside platform UI). */
export function PinnedNotes({ readOnly = false }: Props) {
  const { notes, pin, unpin } = useBriefNotes();
  const [draft, setDraft] = useState("");
  const full = notes.length >= MAX_NOTES;

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || full) return;
    pin(draft);
    setDraft("");
  };

  return (
    <aside aria-labelledby="pinned-notes-title" className="rounded-2xl bg-card p-5 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-24px_hsl(24_30%_20%/0.3)]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="pinned-notes-title" className="text-sm font-semibold text-foreground">Your notes</h2>
        <span className="sim-num text-xs text-muted-foreground">{notes.length}/{MAX_NOTES}</span>
      </div>

      {notes.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pin facts with the pin icon as you read. They stay with you through setup and the live run.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {notes.map((n) => (
            <li key={n} className="group flex items-start gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm leading-snug text-foreground">
              <span className="flex-1">{n}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => unpin(n)}
                  aria-label={`Remove note: ${n}`}
                  className="mt-px rounded text-muted-foreground opacity-60 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2">
          <label htmlFor="brief-note-input" className="text-xs font-medium text-muted-foreground">Add your own</label>
          <div className="flex gap-2">
            <input
              id="brief-note-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_NOTE_LENGTH}
              disabled={full}
              placeholder={full ? "Notes are full" : "e.g. Defend the brand term"}
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={!draft.trim() || full}
              className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              Pin
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}
