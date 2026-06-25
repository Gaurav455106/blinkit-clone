import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { BidInput }    from "@/components/targeting/BidInput";
import { InfoTooltip } from "@/components/targeting/InfoTooltip";
import { catBidRange, inFmt } from "@/lib/targetingUtils";

// ─────────────────────────────────────────────────────────────────────────────
// Asset table data — mirrors actual Blinkit structure
// ─────────────────────────────────────────────────────────────────────────────

/** Children nested under "Repeat Order Suggestions" */
const REPEAT_ORDER_CHILDREN = [
  { id: "retargeting", name: "Re-targeting",      description: "Boost repeat purchases by highlighting previously bought products" },
  { id: "new_user",    name: "New User Targeting", description: "Attract new customers by promoting products based on their past picks" },
];

/** Top-level assets — same visual indent as the parent group header */
const TOP_LEVEL_ASSETS = [
  { id: "cart",         name: "Cart Recommendations",            description: "Assist cross-selling by showcasing products that pair well with cart items" },
  { id: "next_product", name: "Next Product Recommendations",    description: "Maximize cross-sell with instant suggestions for complementary products" },
  { id: "similar",      name: "Similar Product Recommendations", description: "Increase product visibility by featuring your products on related product pages" },
];

/** All assets in table order (used for validity and preview index mapping) */
const ALL_ASSETS = [...REPEAT_ORDER_CHILDREN, ...TOP_LEVEL_ASSETS];

// 6 preview slides ordered to match table visual order
const SLIDES = [
  { label: "Re-targeting",                    sub: "Order Again Widget on Homepage" },
  { label: "New User Targeting",              sub: "Order Again Widget on Homepage" },
  { label: "Cart Recommendations",            sub: "Cart Page"                      },
  { label: "Next Product Recommendations",    sub: "Search and Category Pages"      },
  { label: "Similar Product Recommendations", sub: "Product Page"                   },
  { label: "Continued Browsing Ads",          sub: ""                               },
];

// ─────────────────────────────────────────────────────────────────────────────
// Illustration helpers  (all inline styles for pixel precision)
// ─────────────────────────────────────────────────────────────────────────────

/** Amber supplement bottle — shown inside every AD card */
function AmberBottle({ h = 54 }: { h?: number }) {
  const capH = Math.round(h * 0.18);
  const neckH = Math.round(h * 0.09);
  const bodyH = h - capH - neckH;
  return (
    <div style={{ position: "relative", width: 40, height: h, margin: "0 auto" }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 18, height: capH, background: "#7a4010", borderRadius: "4px 4px 0 0" }} />
      <div style={{ position: "absolute", top: capH, left: "50%", transform: "translateX(-50%)",
        width: 22, height: neckH, background: "#c8904a" }} />
      <div style={{ position: "absolute", top: capH + neckH, left: 2, right: 2, height: bodyH,
        background: "linear-gradient(135deg,#e8c47a,#d4984a)",
        borderRadius: "2px 2px 12px 12px", border: "1px solid #c08030", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 4, left: 3, right: 3, bottom: 4,
          background: "rgba(255,240,180,0.45)", borderRadius: 3 }} />
        <div style={{ position: "absolute", top: "48%", left: "50%", transform: "translate(-50%,-50%)",
          width: 14, height: 14, borderRadius: "50%",
          background: "rgba(160,90,20,0.22)", border: "1.5px solid rgba(140,70,10,0.38)" }} />
      </div>
    </div>
  );
}

/** Standing bag/pouch product — used in Cart and Similar slides */
function BagProduct({ w = 56, h = 68, opacity = 1 }: { w?: number; h?: number; opacity?: number }) {
  const foldH = Math.round(h * 0.24);
  return (
    <div style={{ position: "relative", width: w, height: h, margin: "0 auto", opacity }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: foldH,
        background: "linear-gradient(to bottom,#9e9488,#bab0a0)", borderRadius: "4px 4px 0 0" }} />
      <div style={{ position: "absolute", top: foldH - 4, left: 0, right: 0, bottom: 0,
        background: "linear-gradient(135deg,#ece4d8,#d8ccba)",
        borderRadius: "0 0 8px 8px", border: "1px solid #c0b4a0", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "36%", left: "50%", transform: "translate(-50%,-50%)",
          width: 20, height: 20, borderRadius: "50%",
          background: "rgba(100,80,60,0.14)", border: "1.5px solid rgba(100,80,60,0.28)" }} />
        <div style={{ position: "absolute", bottom: 8, left: 8, right: 8,
          height: 2, background: "rgba(100,80,60,0.18)", borderRadius: 1 }} />
      </div>
    </div>
  );
}

/** Gray bottle — used only in the Continued Browsing slide */
function GrayBottle() {
  return (
    <div style={{ position: "relative", width: 44, height: 58, margin: "0 auto" }}>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 20, height: 12, background: "#888", borderRadius: "4px 4px 0 0" }} />
      <div style={{ position: "absolute", top: 11, left: 2, right: 2, bottom: 0,
        background: "linear-gradient(135deg,#e8e8e8,#cecece)",
        borderRadius: "2px 2px 12px 12px", border: "1px solid #bbb", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 4, left: 3, right: 3, bottom: 4,
          background: "rgba(255,255,255,0.35)", borderRadius: 3 }} />
        <div style={{ position: "absolute", top: "48%", left: "50%", transform: "translate(-50%,-50%)",
          width: 14, height: 14, borderRadius: "50%",
          background: "rgba(120,120,120,0.18)", border: "1.5px solid rgba(100,100,100,0.32)" }} />
      </div>
    </div>
  );
}

/** Empty teal placeholder tile */
function Teal({ w = "100%", h = 50, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{ width: w, height: h, flexShrink: 0,
      background: "linear-gradient(135deg,#d0eeec,#c4e8e4)",
      borderRadius: radius, border: "0.5px solid #a0d8d0" }} />
  );
}

/** The amber-bottle AD card that overlays slides 1–5 */
function AdCard({ cardW = 92 }: { cardW?: number }) {
  return (
    <div style={{ width: cardW, background: "#fff", borderRadius: 10,
      boxShadow: "0 3px 14px rgba(0,0,0,0.16)", padding: "6px 7px 8px", position: "relative" }}>
      <span style={{ position: "absolute", top: 5, right: 5, fontSize: 6.5, color: "#aaa",
        border: "0.5px solid #ccc", borderRadius: 2, padding: "0 2px", lineHeight: "11px" }}>AD</span>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 2, paddingBottom: 4 }}>
        <AmberBottle h={52} />
      </div>
      {/* carousel dots inside card */}
      <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 5 }}>
        <div style={{ width: 7, height: 4, borderRadius: 2, background: "#444" }} />
        <div style={{ width: 4, height: 4, borderRadius: 2, background: "#ddd" }} />
        <div style={{ width: 4, height: 4, borderRadius: 2, background: "#ddd" }} />
      </div>
      <div style={{ height: 5, background: "#e0e0e0", borderRadius: 2, marginBottom: 2 }} />
      <div style={{ height: 5, background: "#e0e0e0", borderRadius: 2, marginBottom: 5, width: "70%" }} />
      <div style={{ fontSize: 7.5, color: "#555", fontWeight: 500, marginBottom: 3 }}>500 ml</div>
      <div style={{ fontSize: 7.5, color: "#2563eb", fontWeight: 700, marginBottom: 2 }}>5% OFF</div>
      <div style={{ fontSize: 6.5, color: "#aaa", textDecoration: "line-through", marginBottom: 3 }}>M.R.P ₹45</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>₹40</span>
        <span style={{ fontSize: 8, color: "#16a34a", border: "1.5px solid #16a34a",
          borderRadius: 5, padding: "2px 7px", fontWeight: 700 }}>ADD</span>
      </div>
    </div>
  );
}

/** Teal tile with product info text — right column in slides 3, 4, 5 */
function ProductInfoTile() {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Teal h={44} />
      <div style={{ marginTop: 3, paddingLeft: 1 }}>
        <div style={{ fontSize: 6.5, color: "#555", fontWeight: 600, lineHeight: 1.3 }}>Product name</div>
        <div style={{ fontSize: 6, color: "#888", lineHeight: 1.3 }}>300 g</div>
        <div style={{ fontSize: 6.5, color: "#2563eb", fontWeight: 600, lineHeight: 1.3 }}>Save ₹10</div>
        <div style={{ fontSize: 6, color: "#aaa", textDecoration: "line-through", lineHeight: 1.3 }}>M.R.P ₹100</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#111" }}>₹90</span>
          <span style={{ fontSize: 6, color: "#16a34a", border: "1px solid #16a34a",
            borderRadius: 3, padding: "1px 3px", fontWeight: 700 }}>ADD</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone top bar (slides 1 & 2 only)
// ─────────────────────────────────────────────────────────────────────────────

function GrayTopBar() {
  return (
    <div style={{ background: "#555", padding: "10px 12px", display: "flex",
      justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#333",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Previously Bought section (slides 1 & 2)
// ─────────────────────────────────────────────────────────────────────────────

function PreviouslyBoughtHeader({ tall = false }: { tall?: boolean }) {
  const rowH = tall ? 58 : 46;
  return (
    <div style={{ padding: "10px 10px 6px", borderBottom: "0.5px solid #e8e8e8" }}>
      <div style={{ fontWeight: 800, fontSize: 11, color: "#111", marginBottom: 8 }}>Previously Bought</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        {/* Left: bag icon + label */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#e8f8f0",
            border: "1px solid #b8e8cc", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14 }}>🛍</div>
          <div style={{ fontSize: 6, color: "#555", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>Your top<br/>buys</div>
        </div>
        {/* Vertical green separator */}
        <div style={{ width: 2, background: "#22c55e", borderRadius: 1, alignSelf: "stretch", minHeight: rowH, flexShrink: 0 }} />
        {/* Right: teal placeholder tiles in 2 columns */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          <Teal h={rowH} />
          <Teal h={rowH} />
          {tall && <><Teal h={rowH} /><Teal h={rowH} /></>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide content components
// ─────────────────────────────────────────────────────────────────────────────

/** Slide 1 — Re-targeting: popup card over "Previously Bought" */
function SlideRetargeting() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <GrayTopBar />
      <div style={{ flex: 1, background: "#fff", overflow: "hidden", position: "relative" }}>
        <PreviouslyBoughtHeader tall />
        {/* AD card floats bottom-left over second row of tiles */}
        <div style={{ position: "absolute", bottom: 16, left: 10, zIndex: 10 }}>
          <AdCard />
        </div>
        {/* Second row background tiles (partially visible behind card) */}
        <div style={{ padding: "6px 10px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          <Teal h={48} />
          <Teal h={48} />
        </div>
        <div style={{ padding: "5px 10px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          <Teal h={48} />
          <Teal h={48} />
        </div>
      </div>
    </div>
  );
}

/** Slide 2 — New User Targeting: "Discover your new favourites" row + card */
function SlideNewUser() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <GrayTopBar />
      <div style={{ flex: 1, background: "#fff", overflow: "hidden" }}>
        {/* Previously Bought header (compact) */}
        <PreviouslyBoughtHeader tall={false} />

        {/* "Discover your new favourites" cream section */}
        <div style={{ background: "#fffaf2", padding: "8px 10px" }}>
          <div style={{ fontWeight: 800, fontSize: 10, color: "#111", marginBottom: 2 }}>Discover your new favourites</div>
          <div style={{ fontSize: 7.5, color: "#888", marginBottom: 8 }}>Sponsored</div>

          {/* 3 mini product cards side by side */}
          <div style={{ display: "flex", gap: 5 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, minWidth: 0 }}>
                {/* image area */}
                <div style={{ position: "relative", height: 44,
                  background: "linear-gradient(135deg,#f8f0e0,#f0e4c0)",
                  borderRadius: 6, border: "0.5px solid #e0d0a0", marginBottom: 3,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AmberBottle h={34} />
                  <div style={{ position: "absolute", bottom: 3, right: 3, background: "#16a34a",
                    color: "#fff", fontSize: 5.5, fontWeight: 700, borderRadius: 3,
                    padding: "1px 4px" }}>ADD</div>
                </div>
                <div style={{ fontSize: 6.5, color: "#555" }}>500 ml</div>
                {/* "sold" bar */}
                <div style={{ height: 3, background: "#e0e0e0", borderRadius: 2, margin: "2px 0 2px" }}>
                  <div style={{ height: 3, width: "60%", background: "#4ade80", borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 6.5, color: "#2563eb", fontWeight: 700 }}>5% OFF</div>
                <div style={{ fontSize: 6, color: "#aaa", textDecoration: "line-through" }}>M.R.P ₹45</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#111" }}>₹40</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom teal tiles */}
        <div style={{ padding: "8px 10px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          <Teal h={54} />
          <Teal h={54} />
        </div>
      </div>
    </div>
  );
}

/** Slide 3 — Next Product Recommendations: search page with "Our top picks" */
function SlideNextProduct() {
  return (
    <div style={{ background: "#f8f8f8", height: "100%", padding: "10px 10px 0" }}>
      {/* Search bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff",
        border: "0.5px solid #ddd", borderRadius: 20, padding: "5px 10px", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "#999" }}>🔍</span>
        <span style={{ fontSize: 7.5, color: "#bbb", flex: 1 }}>Search for products</span>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#eee" }} />
      </div>

      {/* Two placeholder tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <Teal h={52} />
        <Teal h={52} />
      </div>

      {/* "Our top picks for you" */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "#111" }}>Our top picks for you</span>
        <span style={{ fontSize: 7.5, color: "#16a34a", fontWeight: 600 }}>see all</span>
      </div>

      {/* Ad card + 2 product info tiles */}
      <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
        <AdCard cardW={88} />
        <ProductInfoTile />
        <ProductInfoTile />
      </div>
    </div>
  );
}

/** Slide 4 — Cart Recommendations: faded checkout + product detail + "Similar products" */
function SlideCart() {
  return (
    <div style={{ background: "#fff", height: "100%", overflow: "hidden" }}>
      {/* Faded checkout top */}
      <div style={{ opacity: 0.32, padding: "8px 10px 0" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#111", marginBottom: 6 }}>Checkout</div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
            justifyContent: "space-between", marginBottom: 5 }}>
            <div style={{ width: 28, height: 28, flexShrink: 0 }}>
              <BagProduct w={28} h={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 4, background: "#ccc", borderRadius: 2, marginBottom: 2 }} />
              <div style={{ height: 4, background: "#ccc", borderRadius: 2, width: "60%" }} />
            </div>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: "#333" }}>₹300</div>
            <div style={{ display: "flex", alignItems: "center", gap: 2,
              border: "0.5px solid #ddd", borderRadius: 4, padding: "1px 3px" }}>
              <span style={{ fontSize: 8, color: "#666" }}>−</span>
              <span style={{ fontSize: 8, fontWeight: 700 }}>1</span>
              <span style={{ fontSize: 8, color: "#16a34a" }}>+</span>
            </div>
          </div>
        ))}
      </div>

      {/* Product detail strip */}
      <div style={{ padding: "4px 10px 6px", borderBottom: "0.5px solid #eee" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#111" }}>Product Name</div>
        <div style={{ fontSize: 7.5, color: "#888" }}>100 g</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#111" }}>₹40</div>
      </div>

      {/* Similar products header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 10px 5px" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#111" }}>Similar products</span>
        <span style={{ fontSize: 7.5, color: "#16a34a", fontWeight: 600 }}>see all</span>
      </div>

      {/* Ad card + info tiles */}
      <div style={{ display: "flex", gap: 5, padding: "0 10px", alignItems: "flex-start" }}>
        <AdCard cardW={88} />
        <ProductInfoTile />
        <ProductInfoTile />
      </div>
    </div>
  );
}

/** Slide 5 — Similar Product Recommendations: product detail page + "Similar products" */
function SlideSimilar() {
  return (
    <div style={{ background: "#fff", height: "100%", overflow: "hidden" }}>
      {/* Product hero image */}
      <div style={{ display: "flex", justifyContent: "center", padding: "14px 10px 6px",
        background: "#f8f4ee" }}>
        <BagProduct w={70} h={80} />
      </div>

      {/* Product info */}
      <div style={{ padding: "8px 10px 6px", borderBottom: "0.5px solid #eee" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>Product Name</div>
        <div style={{ fontSize: 7.5, color: "#888" }}>100 g</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>₹40</div>
      </div>

      {/* Similar products header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 10px 5px" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#111" }}>Similar products</span>
        <span style={{ fontSize: 7.5, color: "#16a34a", fontWeight: 600 }}>see all</span>
      </div>

      {/* Ad card + info tiles */}
      <div style={{ display: "flex", gap: 5, padding: "0 10px", alignItems: "flex-start" }}>
        <AdCard cardW={88} />
        <ProductInfoTile />
        <ProductInfoTile />
      </div>
    </div>
  );
}

/** Slide 6 — Continued Browsing Ads: search page with prominent AD card (blue border) */
function SlideContinuedBrowsing() {
  return (
    <div style={{ background: "#f8f8f8", height: "100%", padding: "10px 10px 0" }}>
      {/* Search bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff",
        border: "0.5px solid #ddd", borderRadius: 20, padding: "5px 10px", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "#999" }}>🔍</span>
        <span style={{ fontSize: 7.5, color: "#bbb", flex: 1 }}>Search</span>
      </div>

      {/* Recent searches */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, color: "#111" }}>Recent searches</span>
        <span style={{ fontSize: 7.5, color: "#16a34a", fontWeight: 600 }}>Clear</span>
      </div>

      {/* Search chip rows */}
      {[1, 2].map((row) => (
        <div key={row} style={{ display: "flex", gap: 5, marginBottom: 5 }}>
          {[1, 2].map((chip) => (
            <div key={chip} style={{ flex: 1, height: 14, background: "#e8e8e8",
              borderRadius: 10 }} />
          ))}
        </div>
      ))}

      {/* Continue browsing */}
      <div style={{ fontSize: 8.5, fontWeight: 700, color: "#111", marginBottom: 8 }}>Continue browsing</div>

      {/* Grid: big AD card (left) + right product tiles */}
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>

        {/* AD card — blue bordered, gray bottle, different style */}
        <div style={{ width: 96, background: "#f0f0ff", borderRadius: 10,
          border: "2px solid #4f46e5", padding: "8px 7px", position: "relative", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <GrayBottle />
          </div>
          {/* AD pill badge */}
          <div style={{ display: "inline-block", background: "#4f46e5", color: "#fff",
            fontSize: 6.5, fontWeight: 700, borderRadius: 4, padding: "1px 5px", marginBottom: 5 }}>AD</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#111", marginBottom: 3 }}>₹1,400</div>
          {/* Stars */}
          <div style={{ fontSize: 9, color: "#f59e0b", marginBottom: 5 }}>★★★★★</div>
          {/* Lines */}
          <div style={{ height: 4, background: "#ccc", borderRadius: 2, marginBottom: 2 }} />
          <div style={{ height: 4, background: "#ccc", borderRadius: 2, width: "70%", marginBottom: 6 }} />
          {/* + Add button */}
          <div style={{ border: "1.5px solid #555", borderRadius: 5, padding: "3px 0",
            textAlign: "center", fontSize: 8, fontWeight: 700, color: "#333" }}>+ Add</div>
        </div>

        {/* Right: 2x2 browsing product tiles */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          {[1, 2].map((row) => (
            <div key={row} style={{ position: "relative" }}>
              <Teal h={56} />
              {/* heart icon */}
              <div style={{ position: "absolute", top: 4, right: 4, fontSize: 8, color: "#aaa" }}>♡</div>
              <div style={{ marginTop: 3, fontSize: 6.5, color: "#888" }}>150 g</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#111" }}>₹400</div>
              <div style={{ fontSize: 6.5, color: "#2563eb" }}>Save ₹51</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SLIDE_COMPONENTS = [
  SlideRetargeting,       // 0 → Re-targeting
  SlideNewUser,           // 1 → New User Targeting
  SlideCart,              // 2 → Cart Recommendations
  SlideNextProduct,       // 3 → Next Product Recommendations
  SlideSimilar,           // 4 → Similar Product Recommendations
  SlideContinuedBrowsing, // 5 → Continued Browsing Ads
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function RecommendationTargeting({
  onTargetingValid,
}: {
  onTargetingValid?: (v: boolean) => void;
} = {}) {
  // checked state for all assets (children + top-level)
  const [assetChecked, setAssetChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_ASSETS.map((a) => [a.id, true]))
  );
  const [bids,       setBids]       = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);

  const getChecked = (id: string) => assetChecked[id] ?? true;

  // "Repeat Order Suggestions" group is checked if at least one child is checked
  const groupChecked = REPEAT_ORDER_CHILDREN.some((c) => getChecked(c.id));

  const toggleGroup = (v: boolean) => {
    setAssetChecked((prev) => ({
      ...prev,
      ...Object.fromEntries(REPEAT_ORDER_CHILDREN.map((c) => [c.id, v])),
    }));
  };

  const toggleAsset = (id: string) =>
    setAssetChecked((prev) => ({ ...prev, [id]: !getChecked(id) }));

  const MIN_BID = 200;
  const isBidLow = (v: string) => !!v && Number(v) < MIN_BID;

  const isValid = ALL_ASSETS.every(
    (a) => !getChecked(a.id) || (!!bids[a.id] && Number(bids[a.id]) >= MIN_BID)
  );

  useEffect(() => { onTargetingValid?.(isValid); }, [isValid]);
  useEffect(() => { if (!isValid) setShowErrors(true); else setShowErrors(false); }, [isValid]);

  // Auto-play: cycle through slides every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setPreviewIdx((prev) => (prev + 1) % SLIDES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const ActiveSlide = SLIDE_COMPONENTS[previewIdx];
  const activeSlide = SLIDES[previewIdx];

  return (
    <div className="flex gap-6">

      {/* ── Asset table ── */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden">

        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Select asset group</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose the assets on which you would like to run recommendation booster ads
          </p>
        </div>

        <div className="grid grid-cols-[1fr_220px] px-6 py-3 border-b border-gray-100 bg-gray-50/60">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">CPM bid</span>
            <InfoTooltip
              content="Cost per thousand impressions. You're charged each time your ad is shown 1,000 times on this placement."
              align="right"
            />
          </div>
        </div>

        {/* ── "Repeat Order Suggestions" group ── */}
        {/* Group header — no CPM input, same indent level as top-level rows */}
        <div className="grid grid-cols-[1fr_220px] items-center px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={groupChecked}
              onCheckedChange={(v) => toggleGroup(!!v)}
              className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shrink-0"
            />
            <span className="text-base font-bold text-gray-900">Repeat Order Suggestions</span>
          </div>
          <div />
        </div>

        {/* Children of Repeat Order Suggestions — indented */}
        {REPEAT_ORDER_CHILDREN.map((asset, idx) => {
          const checked    = getChecked(asset.id);
          const [lo, hi]   = catBidRange(asset.id);
          const missingBid = showErrors && checked && !bids[asset.id];
          const lowBid     = checked && isBidLow(bids[asset.id] ?? "");
          return (
            <div
              key={asset.id}
              className={`grid grid-cols-[1fr_220px] items-start px-6 py-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50/40 ${
                previewIdx === idx ? "bg-green-50/40" : ""
              }`}
              onClick={() => setPreviewIdx(idx)}
            >
              <div className="flex items-start gap-3 pl-10">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleAsset(asset.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shrink-0"
                />
                <div>
                  <div className="text-sm font-bold text-gray-800">{asset.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">{asset.description}</div>
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <BidInput
                  value={bids[asset.id] ?? ""}
                  onChange={(v) => setBids((prev) => ({ ...prev, [asset.id]: v }))}
                  placeholder="Enter amount"
                  hasError={missingBid || lowBid}
                  disabled={!checked}
                  size="md"
                />
                {checked && (
                  <div className="mt-1.5 text-center bg-blue-50 border border-blue-100 rounded px-2 py-1">
                    <div className="text-[10px] text-blue-400 leading-tight">Suggested bid range</div>
                    <div className="text-xs font-semibold text-blue-700">₹{inFmt(lo)} – ₹{inFmt(hi)}</div>
                  </div>
                )}
                {missingBid && <p className="text-[10px] text-red-500 mt-0.5">CPM bid required</p>}
                {lowBid && <p className="text-[10px] text-red-500 mt-0.5">CPM bid cannot be less than ₹{MIN_BID}</p>}
              </div>
            </div>
          );
        })}

        {/* ── Top-level asset rows ── */}
        {TOP_LEVEL_ASSETS.map((asset, idx) => {
          const checked    = getChecked(asset.id);
          const [lo, hi]   = catBidRange(asset.id);
          const missingBid = showErrors && checked && !bids[asset.id];
          const lowBid     = checked && isBidLow(bids[asset.id] ?? "");
          const slideIdx   = idx + 2;
          return (
            <div
              key={asset.id}
              className={`grid grid-cols-[1fr_220px] items-start px-6 py-5 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors hover:bg-gray-50/40 ${
                previewIdx === slideIdx ? "bg-green-50/40" : ""
              }`}
              onClick={() => setPreviewIdx(slideIdx)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleAsset(asset.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shrink-0"
                />
                <div>
                  <div className="text-sm font-bold text-gray-800">{asset.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">{asset.description}</div>
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <BidInput
                  value={bids[asset.id] ?? ""}
                  onChange={(v) => setBids((prev) => ({ ...prev, [asset.id]: v }))}
                  placeholder="Enter amount"
                  hasError={missingBid || lowBid}
                  disabled={!checked}
                  size="md"
                />
                {checked && (
                  <div className="mt-1.5 text-center bg-blue-50 border border-blue-100 rounded px-2 py-1">
                    <div className="text-[10px] text-blue-400 leading-tight">Suggested bid range</div>
                    <div className="text-xs font-semibold text-blue-700">₹{inFmt(lo)} – ₹{inFmt(hi)}</div>
                  </div>
                )}
                {missingBid && <p className="text-[10px] text-red-500 mt-0.5">CPM bid required</p>}
                {lowBid && <p className="text-[10px] text-red-500 mt-0.5">CPM bid cannot be less than ₹{MIN_BID}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Ad Preview Panel ── */}
      <div style={{ width: 340, flexShrink: 0 }}>
        {/* sticky panel — takes full height of viewport minus header */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 sticky top-4">
          <h3 className="text-sm font-semibold text-gray-900">Ad preview</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">Recommendation ads will appear here</p>

          {/* Phone mockup
              Slide components are authored for a 210px-wide viewport.
              We render them inside a 210×385 box and CSS-scale up to 220px
              so the phone fits the panel without causing scroll. */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative" }}>

              {/* Yellow shadow card */}
              <div style={{
                position: "absolute",
                width: 220, height: 400,
                background: "#f5c518",
                borderRadius: 28,
                transform: "translate(7px, 9px)",
                zIndex: 0,
              }} />

              {/* Green-bordered phone shell (220 × 400) */}
              <div style={{
                position: "relative", zIndex: 1,
                width: 220, height: 400,
                borderRadius: 28,
                border: "3px solid #22c55e",
                background: "#fff",
                overflow: "hidden",
              }}>
                {/* Scale 210→220 (factor ≈ 1.048) */}
                <div style={{
                  width: 210,
                  height: 385,
                  transform: "scale(1.048)",
                  transformOrigin: "top left",
                  overflow: "hidden",
                }}>
                  <ActiveSlide />
                </div>
              </div>
            </div>
          </div>

          {/* Caption */}
          <div style={{
            marginTop: 22, background: "#f2f2f2", borderRadius: 16,
            padding: "10px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>{activeSlide.label}</div>
            {activeSlide.sub && (
              <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{activeSlide.sub}</div>
            )}
          </div>

          {/* Clickable dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setPreviewIdx(i)}
                style={{
                  width: i === previewIdx ? 22 : 12,
                  height: 12,
                  borderRadius: 6,
                  background: i === previewIdx ? "#22c55e" : "#d1d5db",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.2s ease",
                }}
                aria-label={SLIDES[i].label}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
