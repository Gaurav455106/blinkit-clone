// "Show me around": replays the current page's guided tour.

import { useSyncExternalStore } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOURS } from "@/components/tour/tourSteps";
import { currentTour, subscribeTours } from "@/components/tour/tourState";

export function TourButton({ className }: { className?: string }) {
  const tour = useSyncExternalStore(subscribeTours, currentTour, () => null);
  if (!tour) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      data-tour="tour-button"
      className={className}
      onClick={tour.start}
      title={`Replay the tour: ${TOURS[tour.id].name}`}
    >
      <Compass className="mr-1 h-4 w-4" aria-hidden />
      Show me around
    </Button>
  );
}
