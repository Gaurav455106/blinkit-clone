import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
};

const sim = { student: { name: "Asha" }, scenario, setCmPitch: vi.fn(), consumeToken: vi.fn(), tokensRemaining: 10 };

vi.mock("@/context/SimContext", () => ({ useSim: () => sim }));
vi.mock("@/components/BlinkitSidebar", () => ({ BlinkitSidebar: () => <nav aria-label="Blinkit sidebar" /> }));
vi.mock("@/components/FlowHeader", () => ({ FlowHeader: () => <div /> }));

import CmPitch from "@/pages/CmPitch";

function renderPage() {
  return render(<MemoryRouter><CmPitch /></MemoryRouter>);
}

describe("CM pitch page", () => {
  beforeEach(() => localStorage.setItem("sim_brief_ack", "1"));

  it("opens with the relationship explainer, then the pitch form with Rohit's data", { timeout: 20000 }, () => {
    renderPage();
    const dialog = screen.getByRole("dialog", { name: "Your relationship with Rohit" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Pitch your products to Rohit" })).toBeInTheDocument();
    expect(screen.getByText("States with stock today")).toBeInTheDocument();
    expect(screen.getByText("2: Karnataka, Maharashtra")).toBeInTheDocument();
  });

  it("keeps the send button disabled until a product has a reason", { timeout: 20000 }, () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    const send = screen.getByRole("button", { name: /Send pitch to Rohit/ });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText(/Pick a reason for:/)).toBeInTheDocument();
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Goa/ }));
    expect(screen.getByText(/Goa has no stock today/)).toBeInTheDocument();
  });

  it("uses plain copy with no em dashes", { timeout: 20000 }, () => {
    const { container } = renderPage();
    expect(container.textContent).not.toContain("—");
  });
});
