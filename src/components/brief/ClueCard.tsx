// A face-down brief fact. Click (or Enter/Space) turns it over for good.

import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTilt } from "@/components/game/useTilt";
import "@/components/game/game.css";

interface ClueCardProps {
  title: string;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
  className?: string;
}

export function ClueCard({ title, open, onOpen, children, className }: ClueCardProps) {
  const tilt = useTilt();
  const face = "sim-flip-face relative overflow-hidden rounded-xl";
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onOpen();
  };
  const closedProps = open ? {} : { role: "button", tabIndex: 0, onClick: onOpen, onKeyDown, "aria-label": `${title}: turn over` };
  return (
    <div className={cn("sim-flip", open && "is-flipped", className)}>
      <div {...tilt} {...closedProps} className={cn("sim-tilt sim-flip-inner h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", !open && "cursor-pointer")}>
        <div className={cn(face, "flex min-h-[120px] flex-col items-center justify-center gap-1 border border-dashed border-primary/40 bg-accent p-4 text-center")} aria-hidden={open}>
          <span className="text-2xl font-semibold text-primary">?</span>
          <span className="text-sm font-medium text-accent-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">Click to turn over</span>
          <span className="sim-tilt-shine" />
        </div>
        <div className={cn(face, "sim-flip-back bg-secondary/50 p-4")} aria-hidden={!open}>
          {children}
          <span className="sim-tilt-shine" />
        </div>
      </div>
    </div>
  );
}
