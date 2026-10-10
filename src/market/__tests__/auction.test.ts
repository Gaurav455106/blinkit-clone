import { describe, it, expect } from "vitest";
import { runAuction, backgroundBidders, MIN_BID, VIEW_RATES, type Bidder } from "@/market/auction";
import { mulberry32 } from "@/market/rng";
import { PROTEIN } from "@/market/data/categories";

const student = (bid: number, relevance = 1.1, id = "s1"): Bidder => ({ id, ownerId: "student", bid, relevance });
const rival = (id: string, bid: number, relevance = 1.0): Bidder => ({ id, ownerId: id, bid, relevance });

const slotOf = (res: ReturnType<typeof runAuction>, id: string) => res.find((r) => r.bidderId === id);

describe("runAuction (F2d second price)", () => {
  it("reproduces the §7.2 worked example: slot 1 at ₹387", () => {
    const res = runAuction([student(450), rival("iron", 420), rival("whey", 380)]);
    const s = slotOf(res, "s1")!;
    expect(s.slot).toBe(0);
    expect(s.price).toBeCloseTo(420 / 1.1 + 5, 6);
  });

  it("drops the student to slot 2 when a rival bursts to ₹560", () => {
    const res = runAuction([student(450), rival("iron", 420), rival("whey", 560)]);
    expect(slotOf(res, "s1")!.slot).toBe(1);
    expect(slotOf(res, "s1")!.price).toBeCloseTo(420 / 1.1 + 5, 6);
  });

  it("never charges more than the bid or less than the floor", () => {
    const res = runAuction([student(300, 1.3), rival("a", 299, 1.3)]);
    for (const r of res) {
      expect(r.price).toBeLessThanOrEqual(r.bid);
      expect(r.price).toBeGreaterThanOrEqual(MIN_BID);
    }
  });

  it("charges the floor when nobody ranks below", () => {
    const res = runAuction([student(500)]);
    expect(slotOf(res, "s1")!.price).toBe(MIN_BID);
  });

  it("excludes bids below the ₹200 minimum", () => {
    const res = runAuction([student(150), rival("a", 250)]);
    expect(slotOf(res, "s1")).toBeUndefined();
  });

  it("fills at most 3 slots with the platform's view rates", () => {
    const res = runAuction([student(500), rival("a", 450), rival("b", 400), rival("c", 350)]);
    expect(res).toHaveLength(3);
    expect(res.map((r) => r.viewRate)).toEqual([...VIEW_RATES]);
    expect(slotOf(res, "c")).toBeUndefined();
  });

  it("lets only the owner's highest-ranked entry in, so own campaigns don't raise each other's price (F2g)", () => {
    const res = runAuction([student(500, 1.1, "s1"), student(480, 1.1, "s2"), rival("a", 300)]);
    expect(slotOf(res, "s2")).toBeUndefined();
    expect(slotOf(res, "s1")!.price).toBeCloseTo(300 / 1.1 + 5, 6);
  });

  it("breaks exact ties the same way every time", () => {
    const a = runAuction([rival("x", 400), rival("y", 400)]);
    const b = runAuction([rival("y", 400), rival("x", 400)]);
    expect(a.map((r) => r.bidderId)).toEqual(b.map((r) => r.bidderId));
  });

  it("a higher bid never gives a worse slot (randomised check)", () => {
    const rand = mulberry32(2024);
    for (let i = 0; i < 500; i++) {
      const others = Array.from({ length: 1 + Math.floor(rand() * 6) }, (_, j) =>
        rival(`r${j}`, 200 + rand() * 600, 0.6 + rand() * 0.7));
      const low = 200 + rand() * 500;
      const high = low + rand() * 300;
      const slotLow = slotOf(runAuction([student(low), ...others]), "s1")?.slot ?? 99;
      const slotHigh = slotOf(runAuction([student(high), ...others]), "s1")?.slot ?? 99;
      expect(slotHigh).toBeLessThanOrEqual(slotLow);
    }
  });
});

describe("backgroundBidders (F2c)", () => {
  it("creates 'other brands' within the category's count range, all at or above the floor", () => {
    for (let i = 0; i < 50; i++) {
      const bg = backgroundBidders(PROTEIN, 1, mulberry32(i));
      expect(bg.length).toBeGreaterThanOrEqual(PROTEIN.backgroundBidderCount[0]);
      expect(bg.length).toBeLessThanOrEqual(PROTEIN.backgroundBidderCount[1]);
      expect(bg.every((b) => b.bid >= MIN_BID && b.ownerId.startsWith("other"))).toBe(true);
    }
  });

  it("keeps the third slot off the ₹200 floor in most auctions", () => {
    let atFloor = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const res = runAuction([student(450), rival("iron", 420), ...backgroundBidders(PROTEIN, 1, mulberry32(i))]);
      if (res[2] && res[2].price === MIN_BID) atFloor++;
    }
    expect(atFloor / N).toBeLessThan(0.1);
  });

  it("scales bids with the unit's competition level", () => {
    const mean = (competition: number) => {
      let total = 0, n = 0;
      for (let i = 0; i < 200; i++) for (const b of backgroundBidders(PROTEIN, 1, mulberry32(i), competition)) { total += b.bid; n++; }
      return total / n;
    };
    expect(mean(0.55)).toBeLessThan(mean(1));
  });

  it("scales bids with the slot's rival pressure", () => {
    const mean = (pressure: number) => {
      let total = 0, n = 0;
      for (let i = 0; i < 200; i++) for (const b of backgroundBidders(PROTEIN, pressure, mulberry32(i))) { total += b.bid; n++; }
      return total / n;
    };
    expect(mean(1.25)).toBeGreaterThan(mean(0.7));
  });
});
