import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { addNote, removeNote, readNotes, clearBriefNotes, useBriefNotes, BRIEF_NOTES_KEY, MAX_NOTES, MAX_NOTE_LENGTH } from "@/components/brief/useBriefNotes";

beforeEach(() => localStorage.clear());

describe("note helpers", () => {
  it("adds a trimmed note to the end and ignores duplicates and blanks", () => {
    expect(addNote([], "  Break-even 3.2x  ")).toEqual(["Break-even 3.2x"]);
    expect(addNote(["a"], "a")).toEqual(["a"]);
    expect(addNote(["a"], "   ")).toEqual(["a"]);
  });

  it("does not mutate the input list", () => {
    const list = ["a"];
    addNote(list, "b");
    expect(list).toEqual(["a"]);
  });

  it("caps note length and count", () => {
    expect(addNote([], "x".repeat(MAX_NOTE_LENGTH + 50))[0]).toHaveLength(MAX_NOTE_LENGTH);
    const full = Array.from({ length: MAX_NOTES }, (_, i) => `n${i}`);
    expect(addNote(full, "new")).toEqual(full);
  });

  it("removes a note", () => {
    expect(removeNote(["a", "b"], "a")).toEqual(["b"]);
  });

  it("reads only string arrays from storage", () => {
    localStorage.setItem(BRIEF_NOTES_KEY, JSON.stringify(["ok", 3, null]));
    expect(readNotes()).toEqual(["ok"]);
    localStorage.setItem(BRIEF_NOTES_KEY, "not json");
    expect(readNotes()).toEqual([]);
  });
});

describe("useBriefNotes", () => {
  it("persists to sim_brief_notes and keeps two hook instances in sync", () => {
    const a = renderHook(() => useBriefNotes());
    const b = renderHook(() => useBriefNotes());
    act(() => a.result.current.pin("Finance wants 3.7x"));
    expect(JSON.parse(localStorage.getItem("sim_brief_notes")!)).toEqual(["Finance wants 3.7x"]);
    expect(b.result.current.notes).toEqual(["Finance wants 3.7x"]);
    expect(b.result.current.isPinned("Finance wants 3.7x")).toBe(true);
    act(() => b.result.current.unpin("Finance wants 3.7x"));
    expect(a.result.current.notes).toEqual([]);
  });

  it("toggles a note", () => {
    const { result } = renderHook(() => useBriefNotes());
    act(() => result.current.toggle("x"));
    expect(result.current.notes).toEqual(["x"]);
    act(() => result.current.toggle("x"));
    expect(result.current.notes).toEqual([]);
  });
});

describe("clearBriefNotes", () => {
  it("empties stored notes and updates mounted hooks, so a new brief starts blank", () => {
    const { result } = renderHook(() => useBriefNotes());
    act(() => result.current.pin("Old brief: break-even 4.4x"));
    expect(result.current.notes).toHaveLength(1);

    act(() => clearBriefNotes());

    expect(readNotes()).toEqual([]);
    expect(result.current.notes).toEqual([]);
  });
});
