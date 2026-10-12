// A card that tilts toward the mouse and flips over when clicked or when
// Enter/Space is pressed. Only the face showing is exposed to screen readers.

import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTilt } from "@/components/game/useTilt";
import "@/components/game/game.css";

interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  flipped: boolean;
  onFlip: () => void;
  className?: string;
  faceClassName?: string;
}

export function FlipCard({ front, back, flipped, onFlip, className, faceClassName }: FlipCardProps) {
  const tilt = useTilt();
  const face = cn("sim-flip-face relative overflow-hidden rounded-2xl", faceClassName);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onFlip();
  };
  return (
    <div className={cn("sim-flip", flipped && "is-flipped", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        onClick={onFlip}
        onKeyDown={onKeyDown}
        {...tilt}
        className="sim-tilt sim-flip-inner h-full cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className={face} aria-hidden={flipped}>{front}<span className="sim-tilt-shine" /></div>
        <div className={cn(face, "sim-flip-back")} aria-hidden={!flipped}>{back}<span className="sim-tilt-shine" /></div>
      </div>
    </div>
  );
}
