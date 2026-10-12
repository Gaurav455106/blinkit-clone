// Exploration progress: XP, levels and achievements, kept in localStorage.

import type { CodeMap } from "./types";

export const XP_DISTRICT = 10;
export const XP_LANDMARK = 50;
export const XP_PER_LEVEL = 100;

export interface Progress {
  discovered: string[];
  collected: string[];
}

export const EMPTY: Progress = { discovered: [], collected: [] };
const KEY = "code-map-progress";

export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && Array.isArray(raw.discovered) && Array.isArray(raw.collected)) {
      return { discovered: raw.discovered.filter((x: unknown) => typeof x === "string"), collected: raw.collected.filter((x: unknown) => typeof x === "string") };
    }
  } catch {
    // storage blocked or corrupt: start fresh
  }
  return EMPTY;
}

export function saveProgress(p: Progress): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

export const xpOf = (p: Progress) => p.discovered.length * XP_DISTRICT + p.collected.length * XP_LANDMARK;
export const levelOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  done: (p: Progress, map: CodeMap) => boolean;
}

const inArea = (p: Progress, map: CodeMap, area: string) =>
  map.districts.filter((d) => d.area === area && p.discovered.includes(d.id)).length;

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first", title: "First steps", detail: "Discover a district", done: (p) => p.discovered.length >= 1 },
  { id: "engine", title: "Engine room", detail: "Discover 5 Market engine districts", done: (p, m) => inArea(p, m, "market") >= 5 },
  { id: "landmark", title: "Big find", detail: "Collect a landmark", done: (p) => p.collected.length >= 1 },
  { id: "tourist", title: "Tourist", detail: "Visit every area", done: (p, m) => m.areas.every((a) => inArea(p, m, a.id) >= 1) },
  { id: "half", title: "Explorer", detail: "Discover half the districts", done: (p, m) => p.discovered.length * 2 >= m.districts.length },
  { id: "hunter", title: "God-node hunter", detail: "Collect every landmark", done: (p, m) => m.landmarks.every((l) => p.collected.includes(l.id)) },
  { id: "all", title: "Cartographer", detail: "Discover every district", done: (p, m) => m.districts.every((d) => p.discovered.includes(d.id)) },
];
