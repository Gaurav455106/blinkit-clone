// Which brief clue cards the student has turned over, remembered per scenario
// in this browser so going back to the brief keeps them turned.

import { useCallback, useState } from "react";

const keyFor = (seed: number | string) => `sim_brief_clues_${seed}`;

function load(seed: number | string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(keyFor(seed)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export interface Clues {
  isOpen: (id: string) => boolean;
  open: (id: string) => void;
  count: number;
}

export function useClues(seed: number | string): Clues {
  const [ids, setIds] = useState<readonly string[]>(() => load(seed));
  const open = useCallback((id: string) => {
    setIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try { localStorage.setItem(keyFor(seed), JSON.stringify(next)); } catch { /* storage blocked: keep it for this visit */ }
      return next;
    });
  }, [seed]);
  const isOpen = useCallback((id: string) => ids.includes(id), [ids]);
  return { isOpen, open, count: ids.length };
}
