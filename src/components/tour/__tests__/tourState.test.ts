import { describe, it, expect, beforeEach } from "vitest";
import { tourSeenKey, hasSeenTour, markTourSeen, resetTours, availableSteps, targetSelector } from "@/components/tour/tourState";
import { TOURS, type TourId } from "@/components/tour/tourSteps";

describe("seen flags", () => {
  beforeEach(() => localStorage.clear());

  it("are per student and per tour", () => {
    expect(hasSeenTour("a@x.com", "brief")).toBe(false);
    markTourSeen("a@x.com", "brief");
    expect(hasSeenTour("a@x.com", "brief")).toBe(true);
    expect(hasSeenTour("a@x.com", "dashboard")).toBe(false);
    expect(hasSeenTour("b@x.com", "brief")).toBe(false);
  });

  it("ignore email case and can be reset for one student", () => {
    markTourSeen("A@X.com", "brief");
    expect(hasSeenTour("a@x.com", "brief")).toBe(true);
    markTourSeen("b@x.com", "brief");
    resetTours("a@x.com");
    expect(hasSeenTour("a@x.com", "brief")).toBe(false);
    expect(hasSeenTour("b@x.com", "brief")).toBe(true);
    expect(tourSeenKey("a@x.com", "brief")).toBe("sim_tour_seen:a@x.com:brief");
  });
});

describe("availableSteps", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("keeps only steps whose element is on the page and visible", () => {
    document.body.innerHTML = `<div data-tour="a" style="width:10px;height:10px"></div><div data-tour="hidden" hidden></div><div id="cm"></div>`;
    const steps = [
      { target: "a", title: "A", body: "a" },
      { target: "missing", title: "M", body: "m" },
      { target: "hidden", title: "H", body: "h" },
      { target: "#cm", title: "C", body: "c" },
    ];
    expect(availableSteps(steps, document).map((s) => s.target)).toEqual(["a", "#cm"]);
  });

  it("uses data-tour unless the target is already a selector", () => {
    expect(targetSelector("brief-tabs")).toBe('[data-tour="brief-tabs"]');
    expect(targetSelector("#cm-relationship-section")).toBe("#cm-relationship-section");
  });
});

describe("tour copy", () => {
  const all = Object.entries(TOURS) as [TourId, (typeof TOURS)[TourId]][];

  it("every section has a tour of 3 to 9 steps with a title and short body", () => {
    expect(all.length).toBeGreaterThanOrEqual(10);
    for (const [, tour] of all) {
      expect(tour.steps.length).toBeGreaterThanOrEqual(3);
      expect(tour.steps.length).toBeLessThanOrEqual(9);
      for (const s of tour.steps) {
        expect(s.title.length).toBeGreaterThan(2);
        expect(s.body.length).toBeGreaterThan(10);
        expect(s.body.length).toBeLessThanOrEqual(240);
      }
    }
  });

  it("uses plain punctuation: no em dashes", () => {
    for (const [, tour] of all) for (const s of tour.steps) expect(`${s.title} ${s.body}`).not.toContain("—");
  });

  it("never points two steps of one tour at the same element", () => {
    for (const [, tour] of all) expect(new Set(tour.steps.map((s) => s.target)).size).toBe(tour.steps.length);
  });
});
