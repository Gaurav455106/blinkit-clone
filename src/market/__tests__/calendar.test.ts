import { describe, it, expect } from "vitest";
import { BRAND_PROFILES, SEASONS } from "@/data/scenarios";
import { marketCalendar, weekdayOfDay, calendarEntriesOnDay, RUN_DAYS, type CalendarScenario } from "@/market/calendar";

function scenarioFor(brandId: string, season = "Normal Week"): CalendarScenario {
  const profile = BRAND_PROFILES.find((b) => b.id === brandId)!;
  return { profile, season: SEASONS.find((s) => s.name === season)! };
}

describe("marketCalendar", () => {
  it("is deterministic for the same brand and season", () => {
    expect(marketCalendar(scenarioFor("fuelup"))).toEqual(marketCalendar(scenarioFor("fuelup")));
    expect(marketCalendar(scenarioFor("henlo", "Festival Surge"))).toEqual(marketCalendar(scenarioFor("henlo", "Festival Surge")));
  });

  it("keeps every entry inside days 1-30 with fromDay <= toDay", () => {
    for (const b of BRAND_PROFILES) {
      for (const s of SEASONS) {
        for (const e of marketCalendar(scenarioFor(b.id, s.name))) {
          expect(e.fromDay).toBeGreaterThanOrEqual(1);
          expect(e.toDay).toBeLessThanOrEqual(RUN_DAYS);
          expect(e.fromDay).toBeLessThanOrEqual(e.toDay);
          expect(e.title.length).toBeGreaterThan(0);
          expect(e.effect.length).toBeGreaterThan(0);
          expect(e.categories.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("has a sale day and paydays for every brand", () => {
    for (const b of BRAND_PROFILES) {
      const ids = marketCalendar(scenarioFor(b.id)).map((e) => e.id);
      expect(ids).toContain("sale_day");
      expect(ids).toContain("payday");
    }
  });

  it("puts paydays on days 1-3 (day 1 is the 1st of the month)", () => {
    const payday = marketCalendar(scenarioFor("glow")).find((e) => e.id === "payday")!;
    expect(payday.fromDay).toBe(1);
    expect(payday.toDay).toBe(3);
  });

  it("shows IPL evenings only for snacks and protein brands", () => {
    const withIpl = BRAND_PROFILES.filter((b) => marketCalendar(scenarioFor(b.id)).some((e) => e.id === "ipl_evening")).map((b) => b.id);
    expect(withIpl.sort()).toEqual(["fuelup", "munchbox"]);
  });

  it("adds a festival entry only in Festival Surge", () => {
    expect(marketCalendar(scenarioFor("tinybuddy")).some((e) => e.id === "festival")).toBe(false);
    expect(marketCalendar(scenarioFor("tinybuddy", "Festival Surge")).some((e) => e.id === "festival")).toBe(true);
  });

  it("never lists seeded surprise shocks", () => {
    const allowed = new Set(["sale_day", "ipl_evening", "payday", "festival"]);
    for (const b of BRAND_PROFILES) {
      for (const e of marketCalendar(scenarioFor(b.id, "Festival Surge"))) expect(allowed.has(e.id)).toBe(true);
    }
  });

  it("returns entries sorted by start day", () => {
    const entries = marketCalendar(scenarioFor("munchbox", "Festival Surge"));
    const starts = entries.map((e) => e.fromDay);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("puts the sale day on a weekend", () => {
    for (const b of BRAND_PROFILES) {
      const sale = marketCalendar(scenarioFor(b.id)).find((e) => e.id === "sale_day")!;
      expect([0, 6]).toContain(weekdayOfDay(sale.fromDay));
    }
  });
});

describe("weekdayOfDay", () => {
  it("treats day 1 as a Monday", () => {
    expect(weekdayOfDay(1)).toBe(1);
    expect(weekdayOfDay(6)).toBe(6);
    expect(weekdayOfDay(7)).toBe(0);
    expect(weekdayOfDay(8)).toBe(1);
  });
});

describe("calendarEntriesOnDay", () => {
  it("finds entries covering a day", () => {
    const entries = marketCalendar(scenarioFor("fuelup"));
    expect(calendarEntriesOnDay(entries, 2).map((e) => e.id)).toContain("payday");
    expect(calendarEntriesOnDay(entries, 5).map((e) => e.id)).not.toContain("payday");
  });
});
