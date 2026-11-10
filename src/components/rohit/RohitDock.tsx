// Rohit's mid-run check-in, placed beside the live dashboard instead of on top
// of it (FIXES-TODO #2), so students can look at the numbers he asks about.
//
//   lg and up: a docked column; the dashboard narrows to make room.
//   below lg:  a sheet over the bottom half of the screen.
//   Hidden:    a small "Rohit is waiting" tab. Hiding never closes the
//              check-in: the clock stays paused and any reply is kept,
//              because both live in the run, not here.

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ChevronDown, MessageCircle, Pause } from "lucide-react";
import { RohitPanel } from "@/components/rohit/RohitPanel";

type Props = Omit<ComponentProps<typeof RohitPanel>, "className" | "isClockPaused">;

export function RohitDock(props: Props) {
  const [hidden, setHidden] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);

  // Focus follows the panel: into it when shown, back to the tab when hidden
  useEffect(() => {
    if (hidden) tabRef.current?.focus();
    else panelRef.current?.focus();
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;
    // Escape inside another dialog (e.g. the campaign builder) belongs to that dialog
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
      setHidden(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hidden]);

  if (hidden) {
    return (
      <button
        ref={tabRef}
        type="button"
        onClick={() => setHidden(false)}
        aria-label="Rohit is waiting for your reply. The clock is paused. Open the chat."
        className="sim-ui fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        Rohit is waiting
        <span className="inline-flex items-center gap-1 rounded-md bg-background/15 px-1.5 py-0.5 text-xs">
          <Pause className="h-3 w-3" aria-hidden />clock paused
        </span>
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[55vh] flex-col p-2 focus:outline-none lg:static lg:z-auto lg:h-screen lg:w-[400px] lg:shrink-0 lg:border-l lg:border-border lg:bg-secondary/30 lg:p-3"
    >
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide Rohit's chat (the clock stays paused)"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />Hide chat
        </button>
      </div>
      <RohitPanel {...props} isClockPaused className="min-h-0 flex-1" />
    </div>
  );
}
