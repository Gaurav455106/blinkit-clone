import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { testContext } from "@/market/__tests__/testContext";
import { demandShares } from "@/market/dealRohit";
import { stockPool } from "@/market/deal";

const ctx = testContext("fuelup");
const setOpeningDeal = vi.fn();
vi.mock("@/context/SimContext", () => ({ useSim: () => ({ setOpeningDeal }) }));
vi.mock("@/components/BlinkitSidebar", () => ({ BlinkitSidebar: () => <nav aria-label="Blinkit sidebar" /> }));
vi.mock("@/components/FlowHeader", () => ({ FlowHeader: () => <div /> }));

import DealV2 from "@/pages/DealV2";

const student = { name: "Asha", email: "a@x.com", batch: "B1" };
const renderPage = () => render(<MemoryRouter><DealV2 student={student} scenario={ctx.scenario} ctx={ctx} /></MemoryRouter>);

/** Types a split that follows demand, so Rohit has no stock objection. */
function followDemand() {
  const shares = demandShares(ctx);
  for (const sku of ctx.scenario.profile.skus) {
    for (const [st, w] of Object.entries(shares)) {
      fireEvent.change(screen.getByLabelText(`${sku.name} units in ${st}`), { target: { value: String(Math.floor(stockPool(ctx)[sku.id] * w)) } });
    }
  }
}

describe("Deal with Rohit page", () => {
  beforeEach(() => setOpeningDeal.mockClear());

  it("shows the deal sheet with Rohit's search data for each state", { timeout: 20000 }, async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Strike a deal with Rohit" })).toBeInTheDocument();
    // Rohit types his opening line first (SPEC §15)
    const states = Object.keys(demandShares(ctx));
    expect(await screen.findByText(`Searches from ${states[0]}`, {}, { timeout: 2000 })).toBeInTheDocument();
    for (const st of states) expect(screen.getByText(`Searches from ${st}`)).toBeInTheDocument();
    expect(screen.getByText("1. Where your stock goes")).toBeInTheDocument();
  });

  it("sending a fair sheet ends in an agreed deal that is saved", { timeout: 20000 }, () => {
    renderPage();
    followDemand();
    fireEvent.click(screen.getByRole("button", { name: /Send the deal to Rohit/ }));
    fireEvent.click(screen.getByRole("button", { name: /Shake on it/ }));
    expect(setOpeningDeal).toHaveBeenCalledTimes(1);
    const saved = setOpeningDeal.mock.calls[0][0];
    expect(saved.terms.walkedAway).toBe(false);
    expect(screen.getByText("Deal agreed")).toBeInTheDocument();
  });

  it("blocks a split that places more stock than the product has", { timeout: 20000 }, () => {
    renderPage();
    const sku = ctx.scenario.profile.skus[0];
    fireEvent.change(screen.getByLabelText(`${sku.name} units in ${ctx.scenario.profile.primaryState}`), { target: { value: "99999" } });
    fireEvent.click(screen.getByRole("button", { name: /Send the deal to Rohit/ }));
    expect(screen.getByText(/more than the/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Shake on it/ })).toBeNull();
  });

  it("asking for a lot without offering anything gets a counter, and walking away saves the brief's terms", { timeout: 20000 }, async () => {
    renderPage();
    followDemand();
    fireEvent.click(screen.getByLabelText(/Busier dark stores/));
    fireEvent.click(screen.getByLabelText(/A fast restock/));
    fireEvent.click(screen.getByRole("button", { name: /Send the deal to Rohit/ }));
    // Rohit types for a moment before his counter appears (SPEC §15)
    expect(await screen.findByText(/You're asking for ₹/, {}, { timeout: 2000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Walk away/ }));
    expect(setOpeningDeal.mock.calls[0][0]).toMatchObject({ relationship: 50, terms: { walkedAway: true } });
    expect(screen.getByText("No deal")).toBeInTheDocument();
  });

  it("uses plain copy with no em dashes", { timeout: 20000 }, () => {
    const { container } = renderPage();
    expect(container.textContent).not.toContain("—");
  });
});
