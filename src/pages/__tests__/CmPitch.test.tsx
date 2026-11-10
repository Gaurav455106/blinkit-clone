import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BRAND_PROFILES, BLINKIT_STATES, SEASONS, MARKET_CONDITIONS, type Scenario, type CityStockMap } from "@/data/scenarios";

const profile = BRAND_PROFILES.find((b) => b.id === "henlo")!;
const empty = BLINKIT_STATES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as CityStockMap);
const scenario: Scenario = {
  seed: "t", profile,
  cityStockMap: { ...empty, Karnataka: 82, Maharashtra: 70 },
  season: SEASONS[0], market: MARKET_CONDITIONS[0],
  inventory: { id: "healthy", label: "Healthy", osa: 85, fillRate: 90, activeStores: 54, agingUnits: 80, tone: "healthy" },
  budget: 200000,
  clientGoals: { primary: "", performanceGoals: [], reachGoals: [], metrics: [], threshold: "", lifecycle: "Convert", campaignHint: "" },
  scheduledCrisis: { day: 12, eventId: "stock_crisis", reason: "" },
  city: profile.primaryState,
  engine: "v1",
};

const sim: Record<string, unknown> = { student: { name: "Asha", email: "asha@x.com", batch: "B1" }, scenario, setCmPitch: vi.fn(), consumeToken: vi.fn(), tokensRemaining: 10, setOpeningDeal: vi.fn() };

vi.mock("@/context/SimContext", () => ({ useSim: () => sim }));
vi.mock("@/components/BlinkitSidebar", () => ({ BlinkitSidebar: () => <nav aria-label="Blinkit sidebar" /> }));
vi.mock("@/components/FlowHeader", () => ({ FlowHeader: () => <div /> }));

import CmPitch from "@/pages/CmPitch";

function renderPage() {
  return render(<MemoryRouter><CmPitch /></MemoryRouter>);
}

describe("CM pitch page", () => {
  beforeEach(() => localStorage.setItem("sim_brief_ack", "1"));

  it("everyone gets the new deal with Rohit, even on a brief stamped for the old simulation", { timeout: 20000 }, () => {
    renderPage(); // the shared scenario is stamped engine: "v1"
    expect(screen.getByRole("heading", { name: "Strike a deal with Rohit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send pitch to Rohit/ })).toBeNull();
  });

  it("uses plain copy with no em dashes", { timeout: 20000 }, () => {
    const { container } = renderPage();
    expect(container.textContent).not.toContain("—");
  });

  it("a brief started on v2 gets the deal with Rohit instead", { timeout: 20000 }, () => {
    const before = sim.scenario;
    sim.scenario = { ...scenario, engine: "v2" };
    renderPage();
    expect(screen.getByRole("heading", { name: "Strike a deal with Rohit" })).toBeInTheDocument();
    sim.scenario = before;
  });
});
