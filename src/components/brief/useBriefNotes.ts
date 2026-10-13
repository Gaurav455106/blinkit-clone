// ── Pinned brief notes (SPEC §10) ─────────────────────────────────────────────
// Facts the student pins while reading the brief. Stored in localStorage under
// `sim_brief_notes` (string[]) so the wizard and live dashboard can show the
// same list later. Every hook instance stays in sync through a window event.

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const BRIEF_NOTES_KEY = "sim_brief_notes";
export const MAX_NOTES = 30;
export const MAX_NOTE_LENGTH = 240;
const CHANGE_EVENT = "sim-brief-notes-change";

const EMPTY: readonly string[] = Object.freeze([]);

export function readNotes(): string[] {
  try {
    const raw = localStorage.getItem(BRIEF_NOTES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return [];
  }
}

export function addNote(notes: readonly string[], text: string): string[] {
  const note = text.trim().slice(0, MAX_NOTE_LENGTH);
  if (!note || notes.includes(note) || notes.length >= MAX_NOTES) return [...notes];
  return [...notes, note];
}

export function removeNote(notes: readonly string[], text: string): string[] {
  return notes.filter((n) => n !== text);
}

// Cache the parsed list per raw string so useSyncExternalStore gets a stable snapshot.
let cachedRaw: string | null = null;
let cachedNotes: readonly string[] = EMPTY;

function getSnapshot(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(BRIEF_NOTES_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedNotes = raw ? Object.freeze(readNotes()) : EMPTY;
  }
  return cachedNotes;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === BRIEF_NOTES_KEY) onChange(); };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeNotes(notes: readonly string[]): void {
  try {
    localStorage.setItem(BRIEF_NOTES_KEY, JSON.stringify(notes));
  } catch {
    // Storage full or blocked: the note just isn't kept. Nothing else depends on it.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Empties the notes, e.g. when a new brief starts: notes belong to one brief. */
export function clearBriefNotes(): void {
  writeNotes([]);
}

export interface BriefNotes {
  notes: readonly string[];
  pin: (text: string) => void;
  unpin: (text: string) => void;
  toggle: (text: string) => void;
  isPinned: (text: string) => boolean;
  clear: () => void;
}

export function useBriefNotes(): BriefNotes {
  const notes = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const pin = useCallback((text: string) => writeNotes(addNote(readNotes(), text)), []);
  const unpin = useCallback((text: string) => writeNotes(removeNote(readNotes(), text)), []);
  const toggle = useCallback((text: string) => {
    const current = readNotes();
    writeNotes(current.includes(text.trim()) ? removeNote(current, text.trim()) : addNote(current, text));
  }, []);
  const clear = useCallback(clearBriefNotes, []);
  const isPinned = useCallback((text: string) => notes.includes(text.trim()), [notes]);

  return useMemo(() => ({ notes, pin, unpin, toggle, isPinned, clear }), [notes, pin, unpin, toggle, isPinned, clear]);
}
