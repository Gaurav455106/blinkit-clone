import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render, screen, fireEvent } from "@testing-library/react";

const drive = vi.fn();
const destroy = vi.fn();
let lastConfig: { steps: { element: string }[]; onDestroyed: () => void } | null = null;
vi.mock("driver.js", () => ({
  driver: (config: typeof lastConfig) => {
    lastConfig = config;
    return { drive, destroy: () => { destroy(); config?.onDestroyed(); }, isActive: () => false, isLastStep: () => false };
  },
}));
vi.mock("driver.js/dist/driver.css", () => ({}));

import { useTour, AUTO_START_DELAY_MS } from "@/components/tour/useTour";
import { TourButton } from "@/components/tour/TourButton";
import { hasSeenTour, markTourSeen } from "@/components/tour/tourState";

const page = `<div data-tour="brief-summary"></div><div data-tour="brief-tabs"></div>`;

describe("useTour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    document.body.innerHTML = page;
    drive.mockClear(); destroy.mockClear(); lastConfig = null;
  });
  afterEach(() => vi.useRealTimers());

  it("starts by itself on a first visit, with only the steps on the page", () => {
    renderHook(() => useTour("brief", "a@x.com"));
    act(() => { vi.advanceTimersByTime(AUTO_START_DELAY_MS); });
    expect(drive).toHaveBeenCalledTimes(1);
    expect(lastConfig!.steps.map((s) => s.element)).toEqual(['[data-tour="brief-summary"]', '[data-tour="brief-tabs"]']);
  });

  it("remembers the tour once it closes, however it closed", () => {
    renderHook(() => useTour("brief", "a@x.com"));
    act(() => { vi.advanceTimersByTime(AUTO_START_DELAY_MS); });
    act(() => { lastConfig!.onDestroyed(); });
    expect(hasSeenTour("a@x.com", "brief")).toBe(true);
  });

  it("doesn't start again once seen, or before the page is ready, or without a student", () => {
    markTourSeen("a@x.com", "brief");
    renderHook(() => useTour("brief", "a@x.com"));
    renderHook(() => useTour("dashboard", "a@x.com", false));
    renderHook(() => useTour("cmPitch", null));
    act(() => { vi.advanceTimersByTime(AUTO_START_DELAY_MS * 2); });
    expect(drive).not.toHaveBeenCalled();
  });

  it("doesn't open an empty tour when none of its elements are on the page", () => {
    document.body.innerHTML = "";
    renderHook(() => useTour("brief", "a@x.com"));
    act(() => { vi.advanceTimersByTime(AUTO_START_DELAY_MS); });
    expect(drive).not.toHaveBeenCalled();
  });

  it("closes its tour when the page goes away", () => {
    const { unmount } = renderHook(() => useTour("brief", "a@x.com"));
    act(() => { vi.advanceTimersByTime(AUTO_START_DELAY_MS); });
    unmount();
    expect(destroy).toHaveBeenCalled();
  });

  it("Show me around replays the page's tour even after it was seen", () => {
    markTourSeen("a@x.com", "brief");
    renderHook(() => useTour("brief", "a@x.com"));
    render(<TourButton />);
    fireEvent.click(screen.getByRole("button", { name: /show me around/i }));
    expect(drive).toHaveBeenCalledTimes(1);
  });

  it("a tour whose part of the page isn't shown neither starts nor takes the replay button", () => {
    renderHook(() => useTour("brief", "a@x.com", true, true));
    renderHook(() => useTour("dashboard", "a@x.com", true, false));
    act(() => { vi.advanceTimersByTime(AUTO_START_DELAY_MS); });
    expect(drive).toHaveBeenCalledTimes(1);
    expect(lastConfig!.steps[0].element).toBe('[data-tour="brief-summary"]');
  });
});
