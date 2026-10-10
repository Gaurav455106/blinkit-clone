# Blinkit Ads Simulation — v2 Design Spec

> **Status:** Phase 0 complete: all open questions answered (§13). Awaiting Gaurav's approval to
> start. Nothing here is built yet.
> Once approved, this file is the source of truth for v2. `DEPENDENCIES.md` keeps
> describing v1 until each phase replaces it.

---

## 0. Why v2

Problems with v1, confirmed in code:

| Problem | Cause in v1 |
|---|---|
| Bids don't matter | `SavedCampaign` doesn't store bids. `dayEngine.ts` spends the full budget daily at a fixed ₹250 CPM. |
| No competition | "Aggressive Competitor" is a flat 1.35× CPM set on Day 1. No rival ever reacts. |
| No SOV / impression share | There is no auction, so there is nothing to win or lose. |
| The sim feels fixed | The whole 30 days are computed upfront (`computeAllDays`). Crises fire on fixed days per brand. |
| Rohit follows a script | `cmPitchLogic.ts` picks canned lines, so he asks about restocking when OSA is already fine. |
| Two engines | `engine.ts`/`simResults.ts` and `dayEngine.ts` overlap. |

**Core change:** a **day-by-day market engine** with a real auction, rivals that react,
shoppers who respond to position and price, and stock that runs down as you sell.
Everything else (SOV drops, CPM shocks, live optimisation, a context-aware Rohit) is
built on top of it.

### 0.1 UI boundary: the Blinkit platform stays as it is

The ads-platform screens copy the real Blinkit Ads console, so students learn the real
tool. **v2 does not change how they look or behave.** All v2 work happens in the
simulation layer around them.

| Layer | Screens | v2 rule |
|---|---|---|
| **Blinkit platform (frozen)** | `BlinkitSidebar`, the 5-step `CampaignForm` wizard and every step component (`CampaignCollection`, `ProductBooster*`, `ListingSpotlightProducts`, `BrandBoosterBrands`, `Stories*`, `RecommendationTargeting`, `Stepper`), `CatalogueView`, `BrandCollectionsView` | **No visible or flow changes.** Same fields, labels, validation, min bids, CPM units; it adds no new fields. **Allowed:** bug fixes, and data plumbing that changes nothing on screen: saving a value the screen already collects (e.g. Boost my bid, creative checks), or changing the *source* of a number it already shows (suggested ranges, search volumes, keyword list). |
| **Simulation layer (open to redesign)** | Brand brief, Rohit / CM pitch, live dashboard and optimisation panels, simulation graphs, alerts, events, results and debrief, setup score card, trainer/admin views | Free to redesign (§6, §7, §8, §10). |

Consequences for the rest of this spec:
- **Bid unit stays CPM** with the ₹200 minimum, because that is what the platform UI shows
  (closes Q8).
- **Suggested bid ranges keep their boxes and labels**, but their numbers come from the
  engine instead of made-up formulas (§3.2.1).
- **Launching a new campaign mid-run** opens the unchanged wizard (in the existing side sheet).
- **Mid-run edits** (keyword bids, pause keyword, budgets, states, dayparting) are made in the
  simulation layer's optimisation tables on the live dashboard, not by adding controls to the
  platform screens.
- The `BlinkitSidebar` chrome stays on every page that uses it now.
- **Check per phase:** a before/after screenshot of each platform screen must match. A PR that
  touches a frozen file needs a stated bug-fix reason.

### 0.2 Your problem list → where each is fixed

| # | Problem you raised | Fix | Section |
|---|---|---|---|
| 1 | The simulation is fixed; no real-life element | Engine steps **one day at a time** with seeded randomness; nothing is pre-computed; your changes apply next day | §2, §3 |
| 2 | **CPM suddenly rises so you win fewer bids** | Real **auction per keyword × state × time slot**: ad rank = bid × relevance, second-price clearing CPM. When rivals bid up or a newcomer launches, clearing CPM rises and **you lose slots you used to win** | §3.2, §5 (Newcomer launch, Sale day) |
| 3 | **No competition logic** | 3–4 named rivals per brand (Leader, Challenger, Price Warrior, Newcomer) with budgets, bids, target SOV, ROAS floors and **reaction lag**. They react to losing SOV, conquest your brand term, cut price, run out of budget or stock | §4 |
| 4 | **Keyword SOV drops, so they must go back and bid higher** | Per-keyword **SOV, impression share, and IS lost to rank / budget / stock**. A drop raises an alert that pauses the clock; the student re-bids (or lets the keyword go) and sees the result next day | §3.6, §7, **§7.2 worked example** |
| 5 | It doesn't feel dynamic | Events fire **from triggers on the current state** (rival stock-out, your stock running low, budget capping before peak), not on fixed days | §5 |
| 6 | Rohit is fixed (asks to restock when OSA is fine); brainstorm separate scenarios | Every Rohit ask has **preconditions on live data**; 7 situations (restock, co-fund banner, match rival discount, SOV threat, overstock clearance, new dark stores, ROAS below break-even) | §6 |
| 7 | Live optimisation needs real focus | Live optimisation becomes the core skill and the biggest score block (35); decision moments scored on lever + timing | §1, §7, §8 |
| 8 | More real-life scenarios | Event library: sale day, rival conquest, newcomer, price cut, rival stock-out, rain, IPL evening, payday, stock running low, budget capping | §5 |
| 9 | Brand brief is too simple | Unit economics, break-even ROAS, rivals, keyword volumes and CPMs, calendar, stakeholder tension, tabbed layout | §10 |
| 10 | Bots on a mock Blinkit? | Simulated shopper cohorts in the engine (instant, explainable); optional storefront replay later | §9 |
| 11 | Start-up must not be slow | Day 1 in < 1 s, engine in a Web Worker, background saves | §2.1 |
| 12 | Dayparting must have a consequence | Spend-as-auctions-arrive pacing: 24/7 runs dry before peak | §3.3 |
| 13 | Keep the platform UI identical | Platform screens frozen; only the sim layer changes | §0.1 |
| 14 | Suggested bids | Ranges come from the engine's auctions, not made-up formulas | §3.2.1 |
| 15 | No stock → no ads, so selecting all states is fine | Pan India spends only where stocked; the v1 penalty is removed | §3.4 |
| 16 | Split a strong state into its own campaign | States differ in value; a shared budget starves the good one; "Split campaign" helper | §3.7.1, §3.7.4 |
| 17 | High-volume keywords take the money | Head terms eat a shared budget; split head vs long-tail | §3.7.2 |
| 18 | Weak Listing Spotlight creatives lower CTR | Creative quality score from the platform's own guidelines; rejection; fatigue; creative kit | §3.8 |
| 19 | Downloadable Excel reports to analyse | 12 reports (campaign, keyword, SKU, state, hour, placement, auction insights, creative, inventory, pacing, change log, search terms) + debrief workbook; analysis checkpoints on days 7/14/21 | §7.3 |
| 20 | More budget behind the hero product | One SKU serves per auction; cheap SKUs on broad keywords eat a shared budget; per-SKU break-even; split by SKU | §3.11 |
| 21 | Scrutinise every formula | 17 formula groups audited; 3 prototype-found flaws fixed (slot-2 pricing, ₹200 floor in last slot, worked example) | §14 |
| — | Scrutiny of 15–18 | 18 issues found and fixed (incl. brand margins that make break-even ROAS 5–20) | §3.9, §3.10 |

---

## 1. Learning outcomes (one per stage)

After the sim, a student should be able to:

| # | Stage | The student can… |
|---|---|---|
| 1 | Brief | Work out break-even ROAS from margin, spot stocked states, and judge which rivals threaten which keywords. |
| 2 | Rohit pitch | Negotiate with the category manager using their own data (OSA, sell-through, margin) instead of promises. |
| 3 | Campaign setup | Set bids from expected clearing prices and unit economics, not just "bid high". |
| 4 | Live optimisation | **Diagnose a visibility drop (lost to bid, lost to budget, or out of stock) and decide whether to defend it, given what each click is worth.** ← the core skill |
| 5 | Market events | React to shocks (CPM spike, rival price cut, rival stock-out, demand surge) with the right lever, at the right time. |
| 6 | Debrief | Explain their costliest mistake in ₹. |

**The central trap:** chasing SOV on a keyword where the clearing CPM pushes ROAS below
break-even. Sometimes the right move is **to let the keyword go** and move the money elsewhere.

---

## 2. Time model

- 30 simulated days, as now.
- **The engine steps one day at a time:** `stepDay(state, actions) → { state, dayResult, alerts }`.
  Any change a student makes applies **from the next day**, as on a real ads platform.
- **Pace:** auto-play at about 15 s per day. A pause button and an "Advance day" button are
  always available. **Alerts pause the clock** (e.g. "SOV on *whey protein* fell 41% → 17%").
- **The clock also pauses while the student is working:** opening the wizard, the split
  helper, any edit panel or a Rohit chat pauses it; closing resumes. Otherwise 8–12 days pass
  while one campaign is being built.
- **Alert budget:** at most **1 pausing alert per day and ~8 per run**, picked by ₹ at stake
  (counterfactual, §8). Everything else goes to the alerts feed without pausing.
- All randomness is **seeded by batch + brand**, so everyone on the same brand in a batch
  faces the same market timeline, and the same choices always give the same result.
- The token-based "re-run" mechanic is **removed**: there's nothing to re-run once days are
  stepped live.

### 2.1 Fast start: everything asynchronous

A student clicking "Go live" must see Day 1 **almost instantly**. Nothing heavy runs before the
first screen, and no student ever waits for another.

| Requirement | Target / rule |
|---|---|
| "Go live" → Day 1 on screen | **< 1 s**. Only Day 1 is computed before the first paint. |
| Engine runs off the main thread | `stepDay` runs in a **Web Worker**. The UI never freezes while a day is computed. |
| Compute ahead | While Day N is on screen, the worker **pre-computes Day N+1** on current settings. If the student changes something, only that day is recomputed (one day ≈ milliseconds). |
| No upfront 30-day computation | v1's `computeAllDays` (whole run before showing anything) is removed. |
| No network wait to start | The scenario, rivals and market timeline are generated **locally from the seed**. Supabase is never on the critical path. |
| Saves never block | Day state goes to localStorage immediately. Supabase sync is **debounced and in the background** (as SimContext does now); a failed sync retries silently and shows a small "not synced" badge, never a blocking error. |
| Students start whenever they like | Seeds are deterministic (batch + brand), so a student who starts 20 minutes late gets the same market. **No "wait for class to start" sync.** |
| Heavy pages load lazily | Live dashboard, results, trainer and admin pages are **code-split** (`React.lazy`), so the brief and login load fast. |
| Slow device fallback | If a worker isn't available, the engine runs on the main thread in small chunks (`requestIdleCallback`), still one day at a time. |

**Tests:** the time to compute Day 1 for every brand stays under a performance budget
(e.g. 50 ms headless). A CI check fails if it regresses.

---

## 3. Market engine

All numbers below go in one `MARKET_DATA` constants file so they can be tuned without
touching logic.

### 3.1 Demand (searches)

For each keyword × state × time slot (8 three-hour slots) × day:

```
searches = baseVolume[keyword]
         × stateWeight[state]          (dark-store count based)
         × slotCurve[category][slot]   (e.g. snacks peak 6–9 PM; baby care 6–9 AM & 9 PM–12)
         × dayOfWeek[d]                (weekend lift)
         × seasonMult                  (from scenario season)
         × eventMult                   (sale day, rain, IPL… see §5)
         × noise(seed)                 (±8%)
```

Category targeting works the same way: "browses" of a category page replace searches.

### 3.2 Auction (per keyword × state × slot)

- **Ad slots per results page:** 3 (Search), with **position CTR factors `[1.00, 0.55, 0.30]`**.
- **Eligibility:** the bidder is in stock in that state, has budget left, its dayparting
  covers the slot, and the campaign is active.
- **Ad rank = bid × relevance.** Relevance (0.6–1.3) comes from:
  - keyword ↔ SKU fit (good keyword 1.0–1.2, risky/generic 0.6–0.8, own brand term 1.3)
  - recent CTR versus category average (rolling 3 days)
- **Price paid (second-price):** `clearingCPM = (nextAdRank / yourRelevance) + ₹5`, with a floor
  of `MIN_BID = ₹200` and never above your own bid.
- **Billed on viewable impressions** (slot view rates 1.00 / 0.55 / 0.30), and **background
  "other brands" bidders** fill the auction so the last slot doesn't clear at the floor.
  Both found necessary in the formula audit (§14 F2b, F2c).
- **Unit:** CPM (₹ per 1,000 impressions), as in the current UI. Fixed by the UI boundary (§0.1).

### 3.2.1 Suggested bid ranges (platform screens, data only)

**Today (v1):** the "Suggested top bid range" boxes in the wizard are made-up numbers, not
linked to anything the engine does.

| Where | v1 formula (`targetingUtils.ts`) | Problem |
|---|---|---|
| Keyword exact bid | `kwBidRange(searches)`: ₹1,500–₹15,000, scaled by search volume | Engine charges a fixed ₹250 CPM, so the range is 6–60× what is ever paid. Volume ≠ competition. |
| Keyword smart bid | exact range × 0.077 | Low end can be **₹115, below the ₹200 minimum** the same screen enforces |
| Category CPM | `catBidRange(cat)`: ₹1,400–₹3,800 from a hash of the category name | Arbitrary; same category gives the same range for every brand |
| Recommendation placements | `catBidRange(asset.id)` | Arbitrary hash |
| Keyword search volume (shown next to the range) | `kwSearches()` uses `Math.random()` | Not deterministic despite its comment; changes between visits |
| "Boost my bid" | kept in `useState` only | Lost on reload; the engine never sees it |

**v2 rule:** the box, label, placement and styling stay exactly as they are (§0.1). Only the
**numbers** change, and they come from the market engine, so the platform tells the truth in
the same way the real one does.

```
Pre-run: simulate a seeded "last 14 days" with the rivals' starting bids (no student).
For each keyword / category / placement:
  top bid range = [p50, p80] of the bid needed to win slot 1   (exact match)
  smart range   = same, on the broader smart-match auction set  (floored at MIN_BID = ₹200)
  searches      = demand.ts monthly volume (seeded, stable)
```

- The suggestion reflects **competition**, not just volume: a keyword where WheyNation bids
  hard gets a high range even with modest volume, and a long-tail term gets a low one.
- **It is a snapshot from before Day 1.** If a newcomer launches on day 10, the range the
  student set bids from is out of date. That's realistic and part of the lesson.
- **It never says whether the bid is profitable.** Like the real console, the range answers
  "what wins the top slot", not "what can I afford". The student must compare it with their
  **max profitable CPM**:
  ```
  maxProfitableCPM = 1000 × CTR × CVR × 0.85 × sellingPrice ÷ breakEvenROAS
  ```
  This is the central trap (§1): on some keywords the suggested top range sits **above** max
  profitable CPM, so following it loses money.
- Where the student sees max profitable CPM (simulation layer only, never on the platform):
  a worked example in the brief (§10), a column in the live keyword table (§7), and the debrief.
- **During the run** the live keyword table (simulation layer) shows a refreshed "bid to win
  slot 1" from the last 7 days of real auctions. The wizard's box, if reopened for a new
  campaign, also uses the latest 7 days.
- **Boost my bid** becomes real: persisted to localStorage (`sim_keyword_boost`,
  `sim_keyword_boost_pct`, no visual change), and the engine uses `bid × (1 + boost%)` as the
  effective bid in every auction (§14 F2f).
- **Stories feeds** keep their existing base CPMs (₹500 / ₹625) and day/time multipliers in
  the UI; the engine uses the same numbers so what is shown is what is charged.

**Calibration:** `MARKET_DATA` CPM levels must make the shown ranges and the charged prices
match. Target: the p50 clearing price sits in a believable band for each category and the
₹200 minimum is meaningful (long-tail terms clear near it). See open question Q12.

### 3.2.2 Inventory types (every format has something to win)

The same auction (ad rank, slots, second price, IS lost, SOV) runs on five kinds of inventory,
so every format and every brand gets the "SOV dropped → re-bid or let go" loop.

| Inventory | Formats | Demand source | Slots per view |
|---|---|---|---|
| Keyword results | Product Booster (keyword), Rec Ads (keyword) | searches (§3.1) | 3 |
| Category page | Product Booster (category), Brand Booster | category browses | 2 |
| Spotlight placement | Listing Spotlight (Search results / Home / Category pages) | page views per placement | 1 (banner) |
| Stories feed | Stories (Main feed + category feeds) | feed opens, by day/time | 1 per story break |
| Recommendation slot | Rec Ads placements | product-page and cart views | 2 |

For single-slot inventory (Spotlight, Stories) "SOV" is **share of placement views won**, and
creative CTR drives relevance most strongly there.

### 3.3 Budget pacing and dayparting

> The earlier draft of this section contradicted itself: it said budget is spread in proportion
> to searches *and* that it can run out by 3 PM. With proportional spreading it never runs out
> early, so dayparting would have no consequence. This section replaces it.

#### 3.3.1 Core principle

Dayparting only matters if **two things are true at once**:
1. **Hours differ in value.** A rupee spent at 2 AM earns less than a rupee spent at 7 PM
   (different intent/CVR, different CPM, different search volume).
2. **The budget would otherwise be spent in the wrong hours.** If the engine already moves
   money to the best hours by itself, the student's schedule changes nothing.

If either is missing, a schedule change can't change the outcome, and the lesson is lost.

#### 3.3.2 Pacing model: spend as auctions arrive

- The day starts at 12 AM. The campaign **enters every auction it is eligible for, in time
  order, until the daily budget runs out.** Bid and relevance decide how many auctions it wins;
  the clock decides when the money goes.
- So **a 24/7 campaign with a tight daily budget spends its money in the morning and goes dark
  before the 6–9 PM peak.** That's the real-world failure dayparting fixes.
- The student has three levers, each with a different trade-off:
  - **Daypart:** switch off low-value hours so money survives to peak
  - **Raise the daily budget:** costs more
  - **Lower bids:** win fewer auctions but last longer; risks losing position at peak
- Overall budgets: the per-day amount is `remaining ÷ days left`, then paced within the day
  as above.

**Across days: budgets follow traffic, normalised weekly (Gaurav, 2026-10-11).** A daily budget
isn't a flat daily limit:
- Busy days (weekends, sale days) may spend up to **1.5×** the daily budget; quiet days spend
  less. Today's limit = `budget × min(1.5, today's traffic ÷ the week's average traffic)`.
- **Each week is normalised:** days 1–7, 8–14, 15–21, 22–28 never spend more than
  `budget × live days in that week`; the last two days likewise. So the run never passes
  `budget × days`. A quiet or stock-limited day leaves room that later days of the same week
  can use, but a week's unspent money doesn't roll into the next.
- Overall budgets flex the same way: `remaining ÷ days left × traffic index`, never more than
  what's left.

**Too-high budgets (e.g. a ₹2 lakh daily budget on a new account): what stops a blow-up**
1. **The ₹2,00,000 scenario budget is a hard stop** across all campaigns (built, §14 F5).
2. **The market limits delivery:** a campaign can only buy the auctions it wins. FuelUp's
   whole keyword set absorbs ~₹12K/day, so a ₹2 lakh daily budget burns the account in about
   two weeks rather than in a day, and the campaign then sits dark for the rest of the run.
3. **Pacing alert (Phase 2):** when projected spend finishes the money before day 30, an alert
   pauses the clock ("At this rate your budget runs out on day 16"). It's a decision moment:
   the right levers are lowering daily budgets or bids, or switching to an overall budget.
4. **New-account spend limit (Q28, needs confirmation):** whether Blinkit caps a new
   advertiser's daily spend and raises it with history. If it does, the engine applies it as
   an account-level daily cap.

*Open question Q10: does Blinkit pace evenly within a day, or spend as auctions arrive? If it
paces evenly, we model that instead and get the consequence from §3.3.3 alone, which is weaker.*

#### 3.3.3 Hour profiles (per category, in `MARKET_DATA`)

For each of the 8 slots: **search share**, **intent multiplier** (CVR) and **rival intensity**
(CPM pressure). Illustrative FuelUp (protein) profile:

| Slot | Search share | Intent (CVR ×) | CPM pressure | Character |
|---|---|---|---|---|
| 12–3 AM | 4% | 0.20 | low | Browsers, cheap but nobody buys |
| 3–6 AM | 2% | 0.20 | low | Dead |
| 6–9 AM | 16% | 1.10 | medium | Gym-goers, good |
| 9 AM–12 PM | 10% | 0.80 | medium | Average |
| 12–3 PM | 10% | 0.80 | medium | Average |
| 3–6 PM | 12% | 0.90 | medium | Building |
| 6–9 PM | 30% | 1.30 | **high** | Peak: best buyers, most rivals, highest CPM |
| 9 PM–12 AM | 16% | 1.00 | medium | Good |

Each category gets its own profile (snacks: strong 9 PM–12 AM; baby care: 6–9 AM and night
feeds; skincare: evening). **The profiles are not identical,** so "always run 6–9 PM only" is
not a rule students can memorise.

#### 3.3.4 What the model gives (FuelUp, ₹6,000/day, break-even ROAS 2.86)

Prototyped in Python with the illustrative numbers above. *Note (§3.9 #1): 2.86 assumes a 35%
margin; the current FuelUp data gives 20% (break-even 5.0). The relative result holds; absolute
numbers are redone after the SKU data is recalibrated.*

| Schedule | Where the money went | ROAS | Verdict |
|---|---|---|---|
| 24/7 | 12% in dead hours; **budget gone by 3 PM; ₹0 at 6–9 PM** | **2.76** | **Below break-even: losing money** |
| Dead hours off (6 AM–12 AM) | Lasts until ~4 PM, still misses peak | 3.02 | Profitable |
| 3 PM–12 AM | ₹4.2K lands in 6–9 PM peak | 3.02 | Profitable |
| 9 AM–12 AM (cut gym slot) | Skips a good morning slot | 2.83 | Worse than "dead off": **over-cutting is a mistake too** |

What this shows:
- With spend-as-arrives pacing, **24/7 actually loses money** and the right schedule makes
  it profitable. That's a real consequence.
- Under even or proportional pacing the same prototype moved ROAS by **< 2%**. Dayparting
  was meaningless there (it confirms your concern).
- The gap is still only ~9%. **Calibration target for Phase 1:** a good schedule beats 24/7 by
  **15–30% ROAS**, and switching off the category's peak loses **≥ 20%**. Tune intent
  multipliers and CPM pressure until headless tests confirm both.

#### 3.3.5 What could go wrong (scrutiny)

| # | Failure | Why it breaks the lesson | Mitigation |
|---|---|---|---|
| 1 | **Even / proportional pacing** | Money already flows to good hours; schedule changes ≈ nothing (prototype: < 2%) | Spend-as-auctions-arrive pacing (§3.3.2) |
| 2 | **Daily budget larger than the day's inventory** | Budget never runs out, so there's no early exhaustion; cutting dead hours just leaves money unspent | Calibrate brief budgets so ₹2L is **tight** for the brand; show "could have spent" and "IS lost to budget by hour" |
| 3 | **Dayparting is penalised for unspent budget** | v1 Results gives points for spending ≥ 85% of budget, so a student who rightly cuts waste loses points | Score **wasted spend** (₹ in hours/keywords below break-even), not raw utilisation |
| 4 | **Peak-only is too narrow** | Can't spend the daily budget in 3 hours; CPM climbs as they bid into thin inventory | Model diminishing supply per slot; show "budget not deliverable in selected hours" |
| 5 | **Students can't see hourly effects** | Daily totals hide hour differences, so dayparting becomes guessing | **Hour-of-day heatmap** per campaign: spend, ROAS vs break-even, IS lost to budget, per slot |
| 6 | **Noise drowns the signal** | Small slots with ±8% noise can show random wins | Noise per slot scaled to volume; heatmap shows 7-day averages |
| 7 | **One right answer to memorise** | Every student switches off 12–6 AM, so it doesn't separate good from great | Category-specific profiles plus traps (a good slot outside the "obvious" peak, e.g. gym mornings) |
| 8 | **Rivals all crowd into peak** | If rivals also daypart to peak, peak CPM can make it unprofitable | Define rival schedules; on some brands, **shoulder hours (3–6 PM, 9 PM–12 AM) are the sweet spot**. A great student spots that in the heatmap |
| 9 | **Scoring by a fixed peak-slot list** | Rewards matching a hardcoded list, not good outcomes; breaks when rivals change the economics | Score the **outcome**: ROAS/wasted ₹ before vs after the change, and how fast they reacted |
| 10 | **Slot numbering differs between files** | The same index means different hours in different places (**this is a live v1 bug, see §3.3.6**) | **One `SLOTS` constant** used by the UI, engine and scoring, with a test that labels match |
| 11 | **Mid-run schedule changes don't reach the engine** | The student changes the schedule; numbers don't move (**live v1 bug**) | `stepDay` reads the current schedule every day; test: change on day N → hourly spend shifts from day N+1 |
| 12 | **Event spikes change the hour mix** | IPL evening or rain shifts demand; a static schedule becomes wrong | Events modify the hour profile, so a good student adjusts the schedule around them |
| 13 | **Stock runs out at peak** | Peak sales empty the dark store; late-evening ads hit 0 OSA | Stock depletes within the day; "IS lost to stock" shows by hour |
| 14 | **Unrealistic ROAS hides everything** | The v1 conversion chain (1.5% CTR × 18% ATC × 85%) gives ROAS ~15 in my prototype; everything looks profitable, so nothing feels like a consequence | Calibrate end-to-end so typical ROAS sits **around break-even (2–4)**; headless test per brand |

#### 3.3.6 Live v1 bugs found while analysing this (affect students now)

1. **The dayparting score is inverted.** The schedule editor and the engine use slot 0 = 12–3 AM,
   but the scoring code (`engine.ts` `HOUR_BLOCK_LABELS` / `DEAD_BLOCKS` / `getPeakBlocks`) uses
   slot 0 = 6–9 AM. Verified with FuelUp:

   | Student's schedule (as shown in the UI) | Score multiplier | Dayparting points |
   |---|---|---|
   | 24/7 | 1.00 | 0 |
   | **Right:** dead hours (12–6 AM) off | 0.85 → "removed peak hours" | **3 / 15** |
   | **Right:** 6–9 PM peak only | 0.75 | **3 / 15** |
   | **Wrong:** 6 PM–12 AM off | **1.20** | **15 / 15** |

2. **Mid-run schedule changes have no effect on results.** "Save Schedule" in the live dashboard
   only records the change for scoring (`recordDaypartingChange`); `computeAllDays` reads the
   setup-time `c.dayparting`, so spend and revenue don't change.
3. **In the v1 engine, dayparting can only hurt.** `daypartCPMMult` raises CPM for peak-only
   schedules (fewer impressions per ₹) with no matching CVR gain, so a good schedule lowers
   results.

**Recommendation:** hotfix bug 1 now (small, independent of v2) so current batches aren't scored
backwards. Bugs 2 and 3 go away with the v2 engine.

### 3.4 Stock (OSA) changes every day

- Each state starts with the scenario's stock map.
- **Units sold reduce stock.** Restocks arrive on a schedule (every 7 days, or as negotiated
  with Rohit).
- When stock in a state hits 0, the bidder **drops out of every auction there** (keeps v1 rule 2:
  zero OSA means zero spend and zero delivery).
- **Selecting all states (Pan India) is fine, as on real Blinkit.** Spend only happens where
  the SKU is in stock; nothing is wasted on dark stores. If stock later arrives in a new state,
  a Pan India campaign picks it up automatically, while a hand-picked state list misses it.
  That's a real trade-off, not a mistake. Every brand has stock in only 3 states today, so
  the **"new dark stores / cluster opens" event** adds stock in a 4th state mid-run; that's when
  the difference shows.
- **v1 gets this wrong and must change:** `dayEngine.ts` `geoConversionMult` cuts CVR to as low
  as 0.40× for Pan India, `newScoring.ts` gives Pan India 0/7 for geography, and the brief
  (`Brief.tsx` line ~284) tells students Pan India "under-delivers". All three go in v2. Geography
  decisions are scored on **structure** instead (§3.7).
- **Lesson:** good ads can cause your own stock-out. Rohit's restock conversation only happens
  when this is actually close (§6).

### 3.5 Shopper response

The sim uses cohorts of simulated shoppers, not bots (see §9):

```
clicks    = viewableImpressions × baseCTR × creativeMult × affinity × fatigueMult
ATCs      = clicks × baseCVR × fit × intent[slot] × stateCVR × priceEffect
units     = ATCs × 0.85
revenue   = units × sellingPrice
```
*Audited version; full definitions in §14 F7.*

- `priceIndexEffect`: if a rival on the same results page is ≥10% cheaper, your CVR drops
  (up to −30%). This is how a rival price cut hurts you without touching CPM.
- `brandAffinity`: higher on your own brand term and for repeat shoppers (rises slowly as
  your reach builds, which rewards awareness formats).

### 3.6 Metrics the engine outputs (per campaign × keyword × day)

| Metric | Definition |
|---|---|
| Searches | Eligible searches in targeted states and slots |
| Impressions | Ad impressions won |
| **Impression share (IS)** | impressions ÷ eligible searches |
| **IS lost to rank** | auctions lost because ad rank was too low |
| **IS lost to budget** | auctions missed because budget ran out |
| **IS lost to stock** | auctions skipped because of zero OSA |
| **Ad SOV** | your viewable impressions ÷ all advertisers' viewable impressions (max ≈ 54%; §14 F8) |
| Avg position | 1–3 |
| Clearing CPM | avg ₹ paid per 1,000 impressions |
| CTR, ATC rate, units, revenue, ROAS | as now |
| **Break-even ROAS** | per SKU `sellingPrice ÷ contribution`; per campaign `Σ revenue ÷ Σ contribution` (§14 F9) |

Every metric is also broken down **by state** (per campaign), so a student can see which
states are working (§3.7).

### 3.7 Campaign structure: why splitting campaigns matters

**Core mechanic:** budget belongs to the **campaign**, and the campaign spends as auctions
arrive (§3.3.2) across all its keywords and states together. So whatever gets the most
auctions takes the most money, whether or not it's the best use of it. Splitting a campaign
gives each part **its own budget and its own bids**. That only matters if parts differ in
value, so the engine makes them differ.

#### 3.7.1 States that perform differently

- Each state has its own demand, CVR, rival presence and price sensitivity in `MARKET_DATA`
  (e.g. for FuelUp, Karnataka converts well with few rivals; Maharashtra has the most
  searches but IronWhey is strong there).
- In one Pan India campaign, the **biggest state takes most of the budget** because it has the
  most auctions, even if a smaller state earns a much better ROAS. When the budget runs out,
  it runs out for every state at once, so the good state gets the **same rationed share** as
  the weak ones.
- **Right moves** (any can be right; the outcome is scored):
  - **Split the winning state into its own campaign** with its own budget and higher bids
  - Remove a weak state from the main campaign
  - Raise the budget only if the extra spend is above break-even
- **Decision moment:** "the campaign is budget-capped (IS lost to budget > 30%) **and** state X's
  ROAS ≥ 1.3× the campaign's, for 3 days" → valid levers: split X out, drop weak states, or move
  budget toward X. Scored by counterfactual ₹ (§8).
- ROAS by state is **learned live**, not given in the brief, and events (rain, rival stock-out)
  can change which state is best mid-run.

#### 3.7.2 High-volume keywords taking the money

- Head terms ("protein powder") have far more searches than long-tail terms ("whey protein
  chocolate 1kg"), so in a shared campaign **the head term spends most of the budget**.
- Long-tail terms usually have **higher intent and lower CPM**, so better ROAS, but they get
  starved: they show high **IS lost to budget** while the head term eats the money.
- **Right moves:**
  - **Split into two campaigns: head terms and long-tail terms, each with its own budget**
    (the classic real-world structure)
  - Lower the head-term bid so it wins fewer auctions
  - Pause the head term if it's below break-even
- **Decision moment:** "the campaign is budget-capped **and** one keyword takes > 60% of its spend
  at a ROAS below the campaign's, while another keyword's ROAS is ≥ 1.3× the campaign's" → valid
  levers: split by volume, lower the head-term bid, or pause it. Scored by counterfactual ₹ (§8).
- **Keyword data:** `MARKET_DATA` gives each brand **10–14 keywords tagged head / mid /
  long-tail** with volume, intent and rival presence (today each brand has 5 good + 2–3 risky
  keywords with no volume). The wizard's existing "Suggested keywords" list shows them; no
  visible change. Long-tail must hold **25–35% of profitable volume**, or splitting can't help.
- Calibration target (headless test, per brand): with the same total budget, the split
  structure beats one combined campaign by **≥ 15% ROAS** on the brands built for this trap.

#### 3.7.3 Rules that keep this realistic

- **Your own campaigns don't bid against each other.** If two of your campaigns target the
  same keyword × state, only the one with the higher ad rank enters the auction (as on real
  platforms). The dashboard shows an **overlap warning**; a split done properly excludes the
  moved states/keywords from the original campaign.
- **Total spend stays within the ₹2,00,000 scenario budget** across all campaigns. Splitting
  moves money; it doesn't add any.
- **A new campaign starts the next day.** CTR history is kept at **keyword × SKU** level and
  carries over, so splitting can't be used to wipe a bad CTR record. The only cost of a split
  is the 1-day delay, plus the student's time.

#### 3.7.4 How a student splits a campaign (UI boundary respected)

- A **"Split campaign" helper** on the live dashboard (simulation layer): pick states or
  keywords from the campaign's by-state / by-keyword tables → it pre-fills the **unchanged
  platform wizard** through its existing localStorage keys (`sim_selected_cities`,
  `sim_selected_keywords`, bids, budget) and opens it in the existing side sheet.
- **Before pre-filling,** any half-built campaign in the wizard is saved as a draft (the
  existing `wizardSnapshot` mechanism) and restored afterwards, so nothing is lost.
- The student reviews and launches as normal. On launch, the moved states/keywords are
  removed from the original campaign and its budget is reduced by the amount moved (applied
  next day).
- **Budget check on launch (simulation layer):** if the new budget exceeds what's unallocated
  in the ₹2,00,000, the original campaign is reduced to cover it; if that isn't enough, launch
  is refused with a toast showing how much is available. The wizard itself is unchanged.
- The clock is paused while the helper and wizard are open (§2).
- Students can also build the new campaign by hand in the wizard; the helper just saves time.

### 3.8 Creative quality (Listing Spotlight and Stories)

**Mechanic:** every uploaded creative gets a **creative multiplier** on CTR: 1.10 for a clean
creative, reduced multiplicatively for each guideline it breaks (§14 F10).
CTR feeds relevance (§3.2), so a weak creative **also raises the CPM you pay** for the same
slot. The student finds out by watching CTR against the category benchmark, as in real life.

#### 3.8.1 What the score is made of (the platform's own guidelines)

The Listing Spotlight upload screen already lists the guidelines and checks two of them. v2
scores all of them; **the screen itself doesn't change**.

| Guideline (already on screen) | How it's checked in the browser | Effect if it fails |
|---|---|---|
| Dimensions exactly as required | Already checked (`dimsOk`) | **Rejected** at review (below) |
| File size ≤ max | Already checked (`sizeOk`) | **Rejected** at review |
| Important elements inside the safe area | Canvas: detail/edges in the padding outside the safe area | quality −0.25 |
| Plain background in padding | Canvas: colour variance in the padding area | quality −0.15 |
| Readable (min font 12 px, contrast) | Canvas: contrast and sharpness (blur) of the safe area | quality −0.15 |
| No price callouts or T&Cs; English only | Known kit files: from their labels (below). Own uploads: optional text check, see Q15 | quality −0.2, or rejected if blatant |

- **Saving the result:** the upload component keeps the file only in memory today. On upload it
  computes these checks in the page and saves `sim_creative_checks` (scores, kit id, file hash);
  the image itself isn't stored. No visible change (§0.1).
- **Pixel-only penalties are capped at −0.15 quality in total** (≈ −8% CTR), so a misjudged
  image of the student's own can't be badly hurt. Kit images use exact labels.
- **Review status (new, realistic):** a creative that fails a hard rule (dimensions, size) is
  **rejected** after 1 day, **with the reason** (as real consoles give): the campaign shows
  "Creative rejected: wrong dimensions" in the simulation-layer campaign row and delivers
  nothing until the student replaces it. Soft issues are never labelled live; they show up as
  CTR below the category benchmark and are explained in the debrief. Today the wizard lets
  students continue with failed checks and nothing happens; v2 makes it cost something.
- **Stories:** the same pixel checks apply to the key image and logo. For the single-product
  variant, quality also uses **contrast between the background swatch and the text** and
  brand-name length (the existing ≤14-char rule stays).

#### 3.8.2 Creative kit (so students have something to upload)

- Each brief includes a downloadable **creative kit** per brand: 5–6 images such as
  **two different "clean, correct size" variants** (so there's a fresh one to swap in), "price sticker on it", "text outside the safe area", "busy background",
  "wrong dimensions".
- The engine recognises kit files by a hash and uses their **known labels** directly, so
  scoring is exact and needs no text recognition.
- Students can still upload their own images; those are scored by the pixel checks only.
- **The lesson:** the image that looks most eye-catching (big price sticker) breaks the
  guidelines and either gets rejected or hurts CTR.

#### 3.8.3 Creative fatigue and replacing creatives

- CTR on the same creative **decays with frequency** (impressions ÷ shoppers reached in that
  state), not with calendar days, so small states with heavy spend tire fastest and a
  light-spend campaign may never need a refresh.
- **Replace creative** is a live action (it re-opens the unchanged upload step for that
  campaign). A fresh good creative restores CTR; a worse one doesn't.
- **Decision moment:** "Spotlight/Stories CTR below the category benchmark by > 25% for 3 days"
  → expected lever: replace the creative (check it against the guidelines), not raise bids.
  Raising bids to make up for a weak creative is the wrong lever: it pays more for the
  same poor CTR.

### 3.9 Scrutiny of §3.4–§3.8 (stock, structure, creatives) and fixes

Checked against the code and the rest of this spec. **Fixes marked "applied" are already
written into the sections above or below**; the rest need a decision (§13).

#### Critical: would break the lesson or the build

| # | Problem found | Evidence | Fix |
|---|---|---|---|
| 1 | **Break-even ROAS in this spec doesn't match the brand data.** `margin` in `scenarios.ts` is ₹ per unit, not %. FuelUp whey: ₹260 on ₹1,299 = 20% → break-even ROAS **5.0**, not the 2.86 used in §3.3.4 and §7.2. Henlo: ₹15 on ₹299 = 5% → break-even **20**. MunchBox chips: ₹5 on ₹49 → **9.8**. With break-evens of 10–20, almost every keyword loses money and the "around break-even" calibration (§3.3.5 #14) is impossible | `scenarios.ts` L157, L250, L294 | Define `margin` as **contribution margin per unit after Blinkit commission, before ads**, and recalibrate the SKU data so break-even ROAS lands at **2.5–5** for most brands. Keep one deliberately thin-margin brand (Henlo, whose trap *is* thin margin) at ~6–8, so "ROAS 5 is still a loss" is a lesson, not an accident. Q17 |
| 2 | **Listing Spotlight, Stories, Brand Booster and Rec Ads have no keywords**, but the auction in §3.2 is per keyword. The optimal format for Glow Republic and VitaBoost is Listing Spotlight, so for 2 of 7 brands the core skill (SOV drop → re-bid) can't happen | §3.2; CLAUDE.md format table | **Applied (§3.2.2):** one auction mechanic over five inventory types: keyword, category page, Spotlight placement, Stories feed, recommendation slot. SOV, IS lost and re-bid work on each |
| 3 | **Building a campaign mid-run while the clock runs.** The 5-step wizard takes 2–3 min; at 15 s/day, 8–12 days pass while the student is still in the wizard | §2 pace + §3.7.4 | **Applied (§2):** opening the wizard, the split helper, any edit panel or a Rohit chat **pauses the clock**; it resumes on close |
| 4 | **§0.1 says frozen files get "bug fixes only"**, but §3.2.1 (persist Boost, engine-driven ranges) and §3.8 (save the creative's quality) need small changes inside frozen components. As written, the spec forbids its own plan | §0.1 vs §3.2.1, §3.8 | **Applied (§0.1):** frozen = **no visible or flow change**. Data plumbing is allowed: persisting a value the screen already collects, or changing the *source* of a number it already shows. Screenshot parity proves it |
| 5 | **Uploaded creatives aren't saved.** `ListingSpotlightProducts` keeps the file in `useState`; on reload or launch it's gone, so the engine can't score it and "Replace creative" has nothing to compare | `ListingSpotlightProducts.tsx` L206 | **Applied (§3.8.1):** on upload, compute the checks in the page and save `sim_creative_checks` (scores, kit id, hash); the image itself isn't stored |

#### High: the mechanic is wrong or can be gamed

| # | Problem found | Fix |
|---|---|---|
| 6 | **"IS lost to budget in state X > 30%" can't single out a state.** With spend-as-auctions-arrive, a shared budget runs out **at the same moment for every state and keyword** in the campaign, so they all show the same IS lost to budget. The triggers in §3.7.1 and §3.7.2 would fire for every state/keyword or none | **Applied:** trigger = *campaign* is budget-capped **and** a state/keyword's ROAS is ≥ 1.3× the campaign's. The signal is "your best part gets the same rationed share as your worst" |
| 7 | **Only 3 stocked states per brand**, and stock never appears anywhere new, so "Pan India picks up new states automatically" never actually happens; Pan India would just be a free default | **Applied (§3.4):** the "new dark stores / cluster opens" event (and Rohit's matching ask) adds stock in a 4th state mid-run. Pan India campaigns start spending there next day; hand-picked lists don't. That's the moment the trade-off becomes visible |
| 8 | **Not enough keywords for a head vs long-tail split.** Each brand has 5 `goodKeywords` and 2–3 `riskyKeywords` as plain strings with no volume | **Applied (§3.7.2):** `MARKET_DATA` gives each brand **10–14 keywords tagged head / mid / long-tail** with volume, intent and rival presence. The wizard's existing "Suggested keywords" list shows them (data change only). Long-tail must hold **25–35% of profitable volume**, or splitting can't move ROAS by 15% |
| 9 | **The learning period can be exploited.** If a new campaign starts with fresh CTR history, a student with a bad creative or low CTR can split to reset it | **Applied (§3.7.3):** CTR history lives at **keyword × SKU** level and carries over to the new campaign. The only cost of a split is the 1-day start delay |
| 10 | **Split helper overwrites a half-built campaign.** Pre-filling the wizard's localStorage keys wipes any draft in progress | **Applied (§3.7.4):** save the current wizard keys as a draft first (the `wizardSnapshot` mechanism already exists for editing drafts) and restore it after |
| 11 | **A split can break the ₹2,00,000 cap.** The student types a budget into the unchanged wizard; nothing stops it exceeding what's left | **Applied (§3.7.4):** checked in the simulation layer on launch. If it exceeds the unallocated amount, the original campaign is reduced to cover it; if that's not enough, launch is refused with a toast saying how much is available |
| 12 | **Scoring a single "expected lever" punishes equally good answers.** For a starved state, splitting, dropping weak states and moving budget can all work; for a head term, splitting and lowering its bid can both work | **Applied (§8):** decision moments are scored by **counterfactual ₹**. The worker re-runs the response window with and without the student's action (same seed, ms per day). Gain ≥ 60% of the best-lever gain = full points. This also produces "costliest mistake in ₹" for the debrief |
| 13 | **Too many alerts.** 7 decision-moment types + 10 events + Rohit could pause the clock most days; students stop reading them | **Applied (§2):** at most **1 pausing alert per day and ~8 per run**, chosen by ₹ at stake (counterfactual). The rest go to the alerts feed without pausing |
| 14 | **Every brand hitting every trap** makes runs long and samey | **Applied (§3.10):** each brand gets **2–3 structural traps**, matched to its data |

#### Medium: realism and fairness of creative scoring

| # | Problem found | Fix |
|---|---|---|
| 15 | **Pixel heuristics can misjudge a student's own image** and quietly cut its CTR with no explanation | **Applied (§3.8.1):** pixel-only penalties are capped at **−0.15 quality total** (≈ −8% CTR). Kit images use exact labels. **Rejections show a reason** (real consoles do); soft issues show up as CTR vs the category benchmark, explained in the debrief |
| 16 | **Fatigue at −1.5%/day from day 7 is −35% by day 30 for everyone**, forcing every student into the same replacement; the kit has only one clean image to replace it with | **Applied (§3.8.3):** fatigue scales with **frequency** (impressions ÷ shoppers reached in that state), so small states with heavy spend tire fastest. Kit has **two clean variants** |
| 17 | **No category CTR benchmark is shown**, but the creative decision moment depends on it | **Applied (§7):** keyword/placement table gets a "category CTR" column, as real consoles show benchmarks |
| 18 | **Brief shows last month's ROAS by state**, which hands over the state-split answer before Day 1 | **Applied (§10):** the brief shows last month's *demand and stock* by state only. ROAS by state is learned live, and events (rain, rival stock-out) change which state is best mid-run |

### 3.10 Traps per brand (structural)

| Brand | Stocked states | State split | Head vs long-tail split | Hero SKU (§3.11) | Creative | Why |
|---|---|---|---|---|---|---|
| Henlo | KA, MH, TS | — | **Yes** ("dog treats" head vs "chicken jerky" long-tail) | **Yes** (Jerky vs low-margin biscuits) | — | Thin margin: head terms and cheap SKUs lose money fast |
| Glow Republic | MH, DL, KA | **Yes** (MH big, DL converts better) | — | — | **Yes** (Spotlight) | Premium, image-led |
| VitaBoost | MH, KA, TS | — | **Yes** (generic "vitamins" vs specific needs like pregnancy iron) | — | **Yes** (Spotlight) | New category; creative and placement SOV carry it. Head/long added in 1g so it has 2 traps |
| TinyBuddy | DL, HR, UP | **Yes** (DL dominant, HR better ROAS) | — | **Yes** (Wipes volume vs Rash Cream margin) | — | Hyperlocal demand |
| MunchBox | MH, GJ, KA | — | **Yes** ("healthy chips" head vs "peri peri makhana") | **Yes** (₹49 chips eat budget; makhana is hero) | — | Low price, volume-led |
| PawLife | TS, KA, MH | **Yes** | — | — | **Yes** (Rec Ads / Stories) | Low velocity, discovery-led |
| FuelUp | KA, MH, DL | **Yes** (MH big, KA converts better) | **Yes** ("protein supplement" vs "whey protein chocolate") | **Yes** (₹99 bar eats "protein" budget; whey is hero) | — | Very Hard brand: several traps |

Each brand gets **2–3** of these in a run (seeded), not all of them, so runs stay short.

### 3.11 Hero product: budget by SKU

**The real-world lesson:** a campaign with several SKUs shares one budget, and the SKU that
gets the most auctions takes the money, not the one that earns the most. A good manager puts
**more budget behind the hero product** and caps or drops the rest.

#### 3.11.1 How the engine picks which SKU shows

- For each auction a campaign enters, it shows **one SKU: the best fit for that keyword**
  (from a keyword × SKU fit table in `MARKET_DATA`; ties go to the SKU with the better CTR
  history). "protein bar" shows the bar; "whey protein" shows whey; a broad term like
  "protein" may show either.
- So a broad, high-volume keyword can keep showing a **cheap, low-margin SKU**, which earns
  little per click. That SKU takes most of the shared budget at a ROAS below its break-even.
- Each SKU has its **own break-even ROAS** (`sellingPrice ÷ contributionPerUnit`), and the
  campaign's break-even is **revenue-weighted**: `Σ revenue ÷ Σ contribution` (§14 F9). A
  campaign can look fine on average while one SKU loses money.

#### 3.11.2 What makes a hero (the student works it out; the brief doesn't label it)

| Signal | Where the student finds it |
|---|---|
| Contribution per unit (₹) and break-even ROAS | Brief, Economics tab |
| CVR and revenue per click | SKU report (§7.3), from Day 2 |
| Velocity and stock cover (days) | Brief + Stock report |
| Reviews / rating | Brief, review snippets |

**Hero = highest contribution per click with enough stock to sustain it.** A hero with only
5 days of cover is a trap of its own: pushing it causes a stock-out (Rohit restock, §6).

#### 3.11.3 Levers and the decision moment

- **Right moves** (scored by counterfactual, §8):
  - Give the hero SKU **its own campaign with the larger budget** and bids up to its max
    profitable CPM
  - Remove low-margin SKUs from the broad campaign, or give them a small capped campaign
  - Add SKU-specific keywords so broad terms stop serving the cheap SKU
- **Decision moment:** "campaign is budget-capped **and** a non-hero SKU takes > 40% of spend at
  ROAS below its own break-even, while the hero's ROAS ≥ 1.3× its break-even" → valid levers
  above.
- **Over-correcting is also a mistake:** putting 100% behind the hero when its stock cover is
  short, or when another SKU is the only one matching a high-intent keyword.
- **Split helper (§3.7.4)** also splits by SKU (pre-fills `sim_selected_skus`).
- Calibration target (headless): for brands with this trap, a hero-weighted structure beats an
  equal "all SKUs in one campaign" structure by **≥ 15% profit** at the same total budget.

---

## 4. Competitors

### 4.1 Archetypes

Each rival has a **budget, bids per keyword, max bid, target SOV, ROAS floor, reaction lag** and
a behaviour rule. Rivals **can't see your bids**, only (like real teams) their own SOV
falling, after a lag.

| Archetype | Behaviour |
|---|---|
| **Leader** (defensive) | Big budget. Holds target SOV on head terms. If its SOV drops >10pp below target for 2 days → bids +15% (up to max). Rarely conquests. |
| **Challenger** (aggressive) | Mid budget, high bids. **Conquests your brand term.** Runs bursts (e.g. days 8–14) and often burns its monthly budget by day ~22, then disappears. |
| **Price Warrior** | Low bids. **Cuts price 10–20%** at some point, hurting everyone's CVR on shared keywords. |
| **Newcomer / Opportunist** | Not present at the start. **Launches mid-run** with very high bids for ~5 days (CPM shock), then settles. |

All rivals also **cut bids ×0.9/day if their ROAS falls below their floor** (this rule wins over
the SOV rule; full order in §14 F11). A bidding war
burns them too, so a student who holds firm on profitable terms can outlast them.

### 4.2 Rivals per brand (fictional)

| Brand | Leader | Challenger | Price Warrior | Newcomer / Opportunist |
|---|---|---|---|---|
| Henlo (dog treats) | Barkster | ChewChamp (conquests "henlo") | PawPrice | — |
| Glow Republic (premium skincare) | DermaDew | SkinTheory (D2C, reach-heavy) | GlowMart Basics | — |
| VitaBoost (supplements, new category) | NutriCore (adjacent leader) | — | — | VitaLeaf (launches ~day 10) + WellRx (pharmacy opportunist) |
| TinyBuddy (baby care) | BabySoft | HappyNest | BudgetBub | — |
| MunchBox (snacks) | CrunchCo | SnackSutra (IPL-evening bursts) | NamkeenNow | — |
| PawLife (pet accessories) | PetNest | WagWear | — | ToyTail (enters at a festival) |
| FuelUp (protein) | IronWhey | WheyNation (conquests "fuelup") | ProFit Basics | — |

Rivals appear in the **brief** (price, positioning, known strengths) so reading the brief
pays off later.

### 4.3 What the student sees about rivals

As on real platforms, **no rival bids.** An **Auction insights** panel per keyword shows each
rival's *overlap rate*, *position-above rate* and *SOV trend*. The student has to infer
"WheyNation is outbidding me on *whey protein* since day 9".

---

## 5. Market events

Events come from a **library with triggers**, not fixed days. Some are on a calendar (and
the brief shows them in advance), others depend on what is happening in the run.

| Event | Trigger | Effect | Right response (scored) |
|---|---|---|---|
| **Sale day** ("Big Savings Day") | Calendar (shown in brief) | searches ×1.6, rival bids ×1.4 → CPM shock | Pre-load budget and bids on profitable terms; avoid exhausting budget by noon |
| **Rival conquest** | Challenger starts bidding on your brand term | Your brand-term SOV falls, rival takes slot 1 | Defend the brand term (cheap, relevance 1.3) |
| **Newcomer launch** | Seeded, days 8–14 | CPM +40–60% on head terms for ~5 days | Usually **don't** chase it: shift to long-tail and wait it out, unless ROAS stays above break-even |
| **Rival price cut** | Price Warrior, seeded | Your CVR −15–30% on shared terms | Shift budget to terms they're not on, bundle, or ask Rohit about co-funding a discount |
| **Rival stock-out** | Leader/Challenger hits 0 OSA in a state | Their bids vanish there; CPM drops | **Raise** bids/budget in that state to grab cheap SOV |
| **Rain spike** | Seeded, metro states | Searches in that state ×1.5 for 1–2 days | Raise budget cap there, if stock allows |
| **IPL evening** (snacks, protein) | Calendar | 6–9 PM searches ×1.4 | Daypart toward the evening |
| **Payday** | Days 1–3 of the month | Premium SKUs CVR +10% | Push premium SKU |
| **Your stock running low** | OSA < 30% in a targeted state | Delivery will stop soon | Cut bids there, or trigger Rohit restock (§6) |
| **Budget capping before peak** | IS lost to budget > 25% in peak slot, 2 days running | Missing best hours | Raise daily budget or daypart off dead hours |

Each event is defined with: `id, trigger(state) → boolean, effect, expiresAfter, decisionWindowDays,
scoring rubric`.

---

## 6. Rohit (Category Manager): context-aware

Rohit's opening pitch and every mid-run check-in are **picked by conditions on the current
state**. Every "ask" in the library has preconditions. He **never** asks for something the data
already answers.

| Situation (precondition) | Rohit's ask | Trade-off the student weighs |
|---|---|---|
| OSA < 50% in a state the student targets | "Why advertise where you're out of stock? Restock or pull out." | Pay to expedite a restock (₹, delay) vs. drop the state |
| **OSA healthy and sell-through strong** | "You're selling well. Fund a homepage banner (₹15K co-funding) and I'll give better shelf placement." | ₹ now vs. +relevance / +organic visibility |
| Rival price cut detected | "Barkster dropped price 15%. Will you fund a matching discount?" | Margin hit vs. CVR recovery |
| Student's SOV on a category head term < 20% | "ChewChamp is taking the category. What's your plan?" | Commit budget vs. explain a long-tail strategy (both can be right; rationale scored) |
| Inventory overstocked / aging | "Clear 2,000 aging units. Combo bundle or flash deal?" | Clearance ROAS vs. brand price perception |
| New dark stores opening | "Gurgaon cluster opens next week. Launch support?" | Spend on new demand vs. proven states |
| Student's ROAS < break-even for 3+ days | "Your ads are losing money on every order. Talk me through it." | Honest diagnosis scored |

- The **relationship meter** (already in `cmPitchLogic.ts`) stays. Kept promises (e.g.
  committed stock actually arrives) raise it; broken ones lower it. A higher relationship
  unlocks better deals later.
- 2–3 Rohit check-ins per run, picked from whichever situations are true at the time.

**Conversation design** (simulation layer, open to redesign):
- **Every Rohit line shows the data behind it** as a small chip ("OSA Mumbai 42%",
  "Sell-through 1.8×/week"), so the student can check him rather than take him on trust.
- **Student replies are choices that cite data or commit something** (budget, stock, a
  rationale), not tone options. Each choice shows its cost before the student picks it.
- **Promises are tracked:** what was agreed appears as a "Commitments" list on the live
  dashboard and is checked later (feeds the relationship meter).
- **Mid-run check-ins pause the clock** like alerts and arrive as a chat panel over the live
  dashboard, not a page change.

---

## 7. Live optimisation: actions

All actions apply from the next day. Every control below lives in the **simulation layer**
(live dashboard), not on the frozen platform screens (§0.1).

| Action | Where |
|---|---|
| Change keyword bid | Keyword table (per campaign) |
| Add / pause keyword (incl. brand-term defence, long-tail) | Keyword table |
| Change category bid | Category table |
| Change daily budget / move budget between campaigns | Campaign row |
| Add / remove states | Campaign settings panel |
| Dayparting | Campaign settings panel (uses the shared `SLOTS` constant) |
| Pause / resume campaign | Campaign row |
| Launch new campaign | Unchanged platform wizard, in the existing side sheet |
| **Split campaign** (by state or by keyword volume) | "Split campaign" helper → pre-filled unchanged wizard (§3.7.4) |
| **Replace creative** (Listing Spotlight, Stories) | Re-opens the unchanged upload step for that campaign (§3.8.3) |

The campaign view also gets **by-state** and **by-keyword** breakdown tabs (spend, ROAS vs
break-even, IS lost to budget, share of campaign spend), so the student can see when a state
or a head keyword is taking the money (§3.7).

**Dashboard (new):** per-keyword table showing searches, IS, IS lost (rank / budget / stock),
SOV, avg position, clearing CPM, CTR **vs category CTR benchmark**, ROAS vs break-even, plus a
7-day sparkline. The same table works for placements and feeds (§3.2.2). Also an
alerts feed, the Auction insights panel and a stock-by-state panel.

### 7.1 Simulation graphs

Each graph answers one question the student has to act on. Daily values, with the current
day marked and event days annotated on the x-axis.

| Graph | Question it answers | Form |
|---|---|---|
| ROAS vs break-even | Am I making or losing money, and since when? | Line per campaign, break-even as a horizontal reference line, area below it shaded |
| Impression share breakdown | Why am I losing visibility? | Stacked bars per day: won / lost to rank / lost to budget / lost to stock |
| SOV trend vs rivals | Who took my slot, and when? | Line per bidder on a chosen keyword (rival names from Auction insights, no bids) |
| Hour-of-day heatmap | Is my schedule spending in the right hours? | 8 slots × last 7 days: spend, ROAS vs break-even, IS lost to budget (§3.3.5 #5) |
| Stock by state | Where am I about to go dark? | Small bars per state with a 30% warning line |
| Spend pacing | Will my budget last the month? | Cumulative spend vs an even-pace line |
| Before / after an action | Did my change work? | Marker on each chart at the day an action took effect; hover shows the action |

### 7.2 Worked example: bids are dynamic (FuelUp, keyword *whey protein*)

> **Rewritten after the formula audit (§14).** The first version used numbers that its own
> auction formula can't produce, and it named "re-bid" as the right answer when the formulas
> show holding earns ~3× the profit. Every number below is computed with the §14 formulas
> (Python check): student relevance 1.1, rivals 1.0, break-even ROAS 4.0, max profitable CPM
> ₹550, billing on viewable impressions (F2b). ₹ are illustrative until Q12 is answered.
> Profit = contribution − ad spend, per 1,000 searches per day.

| Days | Market | Student bid | Slot | Clearing CPM | ROAS | SOV | Revenue | Profit |
|---|---|---|---|---|---|---|---|---|
| 1–8 | IronWhey ₹420, WheyNation ₹380 | ₹450 | 1 | ₹387 | 5.7 | 54% | ₹2,200 | **₹163** |
| 9–10 | **WheyNation bursts to ₹560** → alert | A: re-bid ₹520 | 1 | ₹514 | 4.3 | 54% | ₹2,200 | ₹36 |
| | | B: hold ₹450 | 2 | ₹387 | 5.7 | 30% | ₹1,210 | **₹90** |
| 11–13 | IronWhey reacts (+15%/day → ₹590 max) | A: ₹550 (= max profitable CPM) | 1 | ₹541 | 4.1 | 54% | ₹2,200 | ₹9 |
| | | B: hold ₹450 | 3 | ~₹396* | 5.6 | 16% | ₹660 | **₹46** |
| 14+ | Both rivals below ROAS floor → cut ×0.9/day | either | 1 | ₹440–488 | 4.5–5.0 | 54% | ₹2,200 | ₹62–110 |

\* priced off the background bidders (F2c), not the ₹200 floor.

**Days 9–13 totals per 1,000 daily searches:** A = ₹11,000 revenue, **₹99 profit**.
B = ₹4,400 revenue, **₹318 profit**.

What this teaches (and how it's scored):
- **Winning back SOV isn't automatically right, even above break-even.** Paying ₹514–541 for
  slot 1 keeps ROAS above 4.0 but leaves almost no profit; slot 2 at ₹387 earns more.
- **The right answer depends on the brand's goal** (§8, F13): FuelUp is ROAS-first → **B is
  best**. For a volume-first brand (TinyBuddy), A is right *as long as ROAS stays ≥ break-even*.
- **Bid = max profitable CPM is the safety rule** (with Boost ticked: bid × (1 + boost%) ≤ max
  profitable CPM): under second price you never pay more than your effective bid, so a bid at ₹550 can never put you below break-even, whatever rivals do.
- **Wrong move:** bidding ₹750 "to win at any cost". When WheyNation bursts to ₹650 the student
  pays ₹596 → ROAS 3.7 → **loses ₹46 per 1,000 searches**. With a ₹550 bid they would have
  dropped to slot 2 and stayed profitable. Flagged in the debrief with the ₹ lost.
- **Path C (let go, move budget to long-tail)** is right when the keyword's clearing CPM
  exceeds max profitable CPM; here it doesn't, so it scores partial.

This is the loop every brand gets, with different rivals, keywords and timings (seeded per
batch + brand). Scored as a decision moment (§8).

### 7.3 Downloadable Excel reports

Students download reports as `.xlsx`, analyse them in Excel, and come back with decisions.
This is how real brand managers work: the console shows summaries, the analysis happens in a
spreadsheet.

#### 7.3.1 Where and when

- A **Reports** tab on the live dashboard and on the results page (simulation layer, §0.1).
  Pick a report (or "All reports"), a date range and campaigns → **Download .xlsx**.
- **Only completed days** are included. No future data, no hidden engine values (relevance,
  true creative quality, rival bids, upcoming events).
- **Analysis checkpoints** (Q19): the clock stops at the end of days 7, 14 and 21 for a review
  (v1 already had day-7/14/21 pages). Students download the week's reports, analyse, then
  make changes before resuming. Downloading at any other time also pauses the clock.
- Replaces the v1 CSV export (`LiveDashboard.tsx` `downloadCSV`: daily totals only).

#### 7.3.2 The reports

All reports are **long format** (one row per entity per day) so pivot tables work, and every
₹ and % is a number, not text.

| # | Report | One row per | Key columns | Decision it supports |
|---|---|---|---|---|
| R1 | **Campaign performance** | campaign × day | budget, spend, impressions, clicks, CTR, CPM, CPC, ATCs, units, revenue, ROAS, break-even ROAS, profit after ads, IS, IS lost (rank / budget / stock) | Is each campaign profitable? Which is budget-capped? |
| R2 | **Keyword performance** | campaign × keyword × match type × day | exact bid, smart bid, searches, impressions, IS, IS lost ×3, SOV, top-slot rate, avg position, clearing CPM, CTR, category CTR, ATCs, units, revenue, ROAS, **max profitable CPM** | Re-bid, let go, head vs long-tail split (§3.7.2) |
| R3 | **Product (SKU) performance** | campaign × SKU × day | impressions, clicks, CVR, units, revenue, contribution, spend, ROAS, **SKU break-even ROAS**, profit, share of campaign spend, stock cover (days) | Hero product budget (§3.11) |
| R4 | **State performance** | campaign × state × day | spend, impressions, CTR, CVR, revenue, ROAS, OSA %, IS lost to stock, dark stores live | State split (§3.7.1), where stock is short |
| R5 | **Hour-of-day** | campaign × slot × day | searches, spend, impressions, CPM, CVR, ROAS, IS lost to budget | Dayparting (§3.3) |
| R6 | **Placement / feed** | campaign × placement or feed × day | views, impressions, share of placement, CPM, CTR, revenue, ROAS | Spotlight, Stories, Rec Ads, category bids (§3.2.2) |
| R7 | **Auction insights** | keyword × competitor × day | overlap rate, position-above rate, top-slot rate, SOV (rivals by name plus "Other brands"); **never bids** | Who is taking my slot? (§4.3) |
| R8 | **Creative** | campaign × creative × day | creative name, status (approved / rejected + reason), impressions, CTR vs category CTR, frequency | Replace creative (§3.8) |
| R9 | **Inventory** | SKU × state × day | opening stock, units sold (ads / organic), restocks, closing stock, OSA %, days of cover | Restock asks, hero stock risk |
| R10 | **Budget pacing** | campaign × day | daily budget, spend, cumulative spend, % of ₹2,00,000 used, days left, projected end-of-run spend | Will the money last? |
| R11 | **Change log** | action | day made, day applied, campaign, what changed (from → to) | Before/after analysis of own decisions |
| R12 | **Search terms** (smart match, decided #22) | campaign × search term × day | matched keyword, impressions, clicks, units, revenue, ROAS | Promote to exact, or stop |

**Results-page workbook** (end of run): R1–R12 for all 30 days, plus **Decision moments**
(day, what happened, what the student did, ₹ gained or lost vs no action and vs best lever)
and **Costliest mistakes** (top 3 in ₹).

#### 7.3.3 Workbook format

- One workbook, one sheet per report, plus a **README** sheet: each column's definition and
  formula (taken from §14), so students can check the numbers.
- Header row with units (`Spend (₹)`, `CTR (%)`), stable column order across downloads so a
  student's own Excel formulas keep working, ISO dates plus `Sim day`.
- Totals are **not** baked into the data sheets (pivot-friendly); R1 gets a separate
  "Summary" sheet.
- Built in the browser with SheetJS from the day results already in memory: no server call.
- **Size:** largest sheet (R2) ≈ 30 days × 14 keywords × 3 states × 6 campaigns ≈ 7,500 rows.
  Fine for Excel and for in-browser generation (< 1 s).

#### 7.3.4 Library security (found during this review)

The project uses `xlsx@0.18.5` from npm, the last version SheetJS published there. It has
known vulnerabilities when **reading** untrusted files (prototype pollution, ReDoS), and
`ProductBoosterTargeting.tsx` reads student-uploaded files with `XLSX.read` (bulk keyword
upload). Writing reports isn't affected, but the reading path is. **Fix:** move to the current
SheetJS release from its official CDN (`https://cdn.sheetjs.com/`), pinned by version.
Check the exact version and advisories when doing it.

#### 7.3.5 Making reports worth analysing

- Each brand's traps (§3.10) must be **visible in a pivot of one report**, e.g. the hero trap
  appears in R3 as "SKU X: 52% of spend, ROAS 4.1 vs break-even 6.6".
- At least one insight per run needs **two reports joined** (e.g. R4 state ROAS + R9 OSA:
  "Telangana's ROAS dropped because OSA fell to 40%, not because of rivals"). That's the
  skill that separates good from great.
- The debrief points to the row that showed each missed decision ("R2, day 9, whey protein:
  IS lost to rank 52%").

The results page reuses the same graphs over all 30 days, with **decision moments** marked
(green = right lever in time, amber = late or partial, red = wrong or ignored) and the
costliest mistake highlighted in ₹.

---

## 8. Scoring v2 (final weights set in Phase 5)

Scoring moves from "did you pick the right setup" toward "**did you react correctly**".

| Category | Max | What's scored |
|---|---|---|
| Setup | 25 | Objective/format fit, keyword quality, campaign structure, creative meets guidelines, **bids set near break-even-aware levels** (Pan India not penalised, §3.4) |
| **Live optimisation** | **35** | **Decision moments** (below) |
| Market events + Rohit | 20 | Response to each triggered event/ask, using the rubric in §5/§6 |
| Results | 20 | Goal achievement + ROAS vs break-even + **wasted spend** (₹ below break-even, not raw budget use; §3.3.5 #3) |

**Decision moments:** the engine logs each moment an expert would act, e.g.:
- SOV drop on a profitable keyword (IS lost to rank ↑)
- budget capping before peak
- rival stock-out opportunity
- keyword ROAS below break-even for 3 days (should cut / let go)
- a strong state starved by a shared budget (should split it out, §3.7.1)
- a head keyword taking the money from profitable long-tail terms (should split by volume, §3.7.2)
- creative CTR well below benchmark, or creative rejected (should replace it, §3.8)

**Setup scoring for geography changes:** Pan India is **not** penalised (§3.4). Setup scores
whether the campaign structure fits the brand (e.g. head and long-tail separated where volumes
differ a lot) and whether the uploaded creative meets the guidelines.

Each moment has a **response window** (e.g. 3 days) and is scored by **counterfactual outcome**
on the brand's goal (profit for ROAS-first, units for volume-first, reach for awareness; §14 F13),
not by matching one expected lever. Because the engine is seeded and a day takes
milliseconds, the worker re-runs the window three ways: with the student's actions, with no
action, and with the best known lever.

- Gain ≥ 60% of the best lever's gain, inside the window → full points
- Some gain, or acted late → partial, in proportion
- Lost money versus doing nothing (e.g. raising bids on a keyword already below break-even) → 0,
  flagged in the debrief with the ₹ lost
- Ignored → 0

This accepts every lever that works (splitting, dropping weak states and moving budget can all
be right) and gives the debrief its "costliest mistake in ₹" directly.

**Old and new scores won't be comparable.** Saved attempts get `score_version: 2`, and the
leaderboard/trainer views keep versions apart.

---

## 9. Simulated shoppers vs. bots

**Decision: simulated shopper cohorts in the engine, not bots on a mock storefront.**

- A seeded cohort per state × slot with search intent, price sensitivity and brand
  affinity. Same realism, runs instantly, and every outcome can be explained.
- Real bots would be slow, fragile and costly, and would add noise without adding learning.
- Optional later (Phase 6): a **mock storefront replay** that shows 3–4 sampled shoppers'
  journeys ("searched *whey protein* at 7:40 PM → saw WheyNation in slot 1, you in slot 2 →
  clicked rival"). It's a visual for the debrief, driven by the same engine data.

---

## 10. Brand brief v2 (Phase 4)

Each brief adds:
- **Unit economics:** MRP, margin, **break-even ROAS**, target ROAS
- **Competitor landscape:** the 3–4 rivals from §4.2 with price ladder, positioning, last-month SOV
- **Keyword intelligence:** last month's search volume and avg clearing CPM per keyword
  (so bids can be set sensibly)
- **City-level demand and stock** per state (demand and stock only; ROAS by state is learned
  live, so the state-split answer isn't handed over before Day 1)
- **Keyword volume tiers** (head vs long-tail) with last month's ROAS, so the
  volume-vs-intent trade-off is visible before setup
- **Creative kit** and the platform's creative guidelines (§3.8.2)
- The old "Pan India under-delivers" warning is replaced by the real rule: ads only run where
  you have stock
- **Market calendar:** sale days, IPL, paydays in the 30-day window
- **Stakeholder tension:** e.g. finance wants ROAS ≥ 3.0, brand head wants SOV ≥ 30% on head
  terms. The student has to decide between them.
- **Customer review snippets** (hint at positioning)

**Layout and usability** (the brief is simulation layer, so it can be redesigned freely):
- **One-screen summary first:** brand, goal, budget, break-even ROAS, stocked states and the
  top 3 rivals as cards, then the detail in tabs (Economics · Market · Keywords · Calendar ·
  Stakeholders) instead of one long page.
- **A small worked example** of break-even ROAS for one SKU, so the maths is shown once.
- **Notes the student can pin** while reading; the pinned notes stay visible in the wizard
  and live dashboard as a side panel (outside the platform screens), so reading the brief pays off later.
- The brief stays available from every later stage, read-only.

---

## 11. Code architecture

```
src/market/
  data.ts          MARKET_DATA constants (all tunables)
  rng.ts           seeded RNG
  demand.ts        searches per keyword × state × slot × day
  auction.ts       ad rank, slot allocation, clearing price      (pure)
  suggest.ts       suggested bid ranges + search volumes for the wizard (pre-run snapshot, §3.2.1)
  rivals.ts        rival state + daily reaction rules            (pure)
  shoppers.ts      clicks / ATC / units                          (pure)
  stock.ts         OSA depletion + restocks                      (pure)
  structure.ts     shared-budget allocation, own-campaign dedupe, split helper   (pure)
  creative.ts      creative quality score, review status, fatigue   (pixel checks run in the page, results passed in)
  events.ts        event library: trigger, effect, rubric
  step.ts          stepDay(state, actions) → { state, dayResult, alerts }
  moments.ts       decision-moment detection + counterfactual scoring (§14 F13)
  reports.ts       builds R1–R12 rows from day results; xlsx export (§7.3)
  worker.ts        Web Worker wrapper: runs stepDay off the main thread, pre-computes next day
  useMarket.ts     React hook: talks to the worker, exposes current day + pending state
```

- **One engine.** `engine.ts`, `simResults.ts` and `dayEngine.ts` are retired once v2
  covers their callers.
- `SavedCampaign` gains `keywordBids`, `categoryBids` and `dailyBudget`. The wizard already
  collects these; they just aren't saved yet.
- Market state is saved per day (localStorage + Supabase snapshot) so a refresh or pause
  resumes exactly.

**Tests (written first, each phase):**
- a higher bid never lowers impression share
- zero OSA → zero spend and zero delivery
- spend ≤ budget, daily and overall
- same seed + same actions → identical run
- a rival reacts only after its lag
- each event's trigger fires and expires correctly
- each decision-moment rubric gives a right and a wrong answer the expected points
- bidding the p80 of a suggested range wins slot 1 in ≥ 80% of pre-run auctions
- no suggested range has a low end below ₹200; ranges and volumes are identical across reloads
- for every brand, at least one keyword has its suggested range above max profitable CPM (the trap exists)
- Pan India and "stocked states only" give the **same** spend and results when stock never moves
- two of your own campaigns on the same keyword × state never raise each other's CPM
- same total budget: split head/long-tail beats combined by ≥ 15% ROAS on trap brands
- a rejected creative delivers nothing; a kit "clean" creative out-CTRs the "price sticker" one
- every format (keyword, category, Spotlight, Stories, Rec) can lose SOV to a rival bid and regain it with a higher bid
- a split never makes total allocated budget exceed ₹2,00,000; a split doesn't reset CTR history
- counterfactual scoring: the best-known lever scores full points; a money-losing action scores 0
- each brand's traps from §3.10 actually fire in a headless run with a passive student
- bidding exactly max profitable CPM never yields ROAS below break-even, in any slot
- no slot clears at the ₹200 floor while background bidders exist (except long-tail by design)
- SOV never exceeds 54%; the visibility partition always sums to 100%
- reports contain only completed days and no hidden fields; same run → byte-identical workbook rows
- for hero-trap brands, hero-weighted structure beats equal structure by ≥ 15% profit

---

## 12. Phases

| Phase | Ships | Done when |
|---|---|---|
| 0 | This spec | Gaurav approves |
| 1 | `src/market/` engine + Web Worker + tests, bids saved from the wizard, engine-driven suggested bid ranges (§3.2.1) | Engine tests pass; 30-day headless runs give believable numbers for all 7 brands; Day 1 computes in < 50 ms |
| 2 | Live dashboard v2 + actions + rivals reacting + Excel reports R1–R12 | A student can see an SOV drop, re-bid, and see it recover next day |
| 3 | Event library + context-aware Rohit | No Rohit ask contradicts the current state; events fire by trigger |
| 4 | Brief v2 | Brief shows the rivals, CPMs and calendar the student later meets |
| 5 | Scoring v2 + debrief + score versioning | Every rubric tested right/wrong; costliest mistake shown in ₹ |
| 6 (optional) | Storefront journey replay | — |

The sim stays playable after every phase, and **every phase leaves the platform screens
unchanged** (§0.1 screenshot check).

### 12.1 Phase 1 slices (branch `feat/v2-phase1-market-engine`)

Each slice is test-first, keeps v1 playable, and touches no UI until 1h.

| Slice | Ships | Done when |
|---|---|---|
| 1a | **SKU margin recalibration** in `scenarios.ts` (Q17): `margin` = contribution per unit after commission, before ads | Break-even 2.5–5 for every SKU except the deliberate thin ones (Henlo ~7, MunchBox chips ~6, FuelUp bar ~6.6); test enforces it |
| 1b | `src/market/rng.ts`: seeded RNG, string hash, Poisson, log-normal | Same seed → same stream; distribution means within tolerance |
| 1c | `src/market/types.ts` + `data.ts`: categories, states, keywords (tiers, fit, clusters), rivals, background bidders. **FuelUp first**, then the other 6 | Data validation tests: shares sum to 1, every keyword has a fit for each SKU, etc. |
| 1d | `demand.ts` (F1) and `auction.ts` (F2a–F2g) | Spec tests: higher bid never lowers IS; price ≤ bid; floor; dedupe; slot-3 not at floor with background bidders |
| 1e | `shoppers.ts` (F7), `stock.ts` (F6), `rivals.ts` (F11) | Unit tests per formula |
| 1f | `step.ts` `stepDay` with pacing (F5), metrics (F8), **keyword inventory** (Product Booster, keyword Rec Ads) | Spend ≤ cap; partition = 100%; same seed + actions → identical day. **Done:** Day 1 in 27 ms |
| 1f-b | Category, Spotlight, Stories and recommendation inventory (§3.2.2) on the same `stepDay` | Each format can lose SOV and regain it with a higher bid. **Done:** rivals react on keywords only; Stories/Spotlight fatigue; reach from awareness formats lifts search CTR |
| 1g | `suggest.ts` (F3) and headless 30-day runner + calibration report for all 7 brands | **Done:** `npm run calibrate`, 64/64 checks pass for all 7 brands (below) |

**Calibration checks (`npm run calibrate`), per brand:** 30 days under 1.5 s; naive search play
at 0.9–1.5× break-even for ROAS-first brands (Henlo 0.6–1.2×: thin margin is its lesson;
volume-first 0.8–1.4×; awareness 0.5–1.15×; category creation 0.4–1.0×); ₹2 lakh budget tight
(naive spends ≥ 95%); trap keywords exist (suggested range above max profitable CPM); the best
schedule beats 24/7 by ≥ 15% / ₹10K profit and includes the category's peak; each of the brand's
traps (head/long split, hero SKU, state split, creative) improves profit (or revenue for
creative) by ≥ 15% / ₹10K; the challenger runs out of budget between days 12 and 28.

What calibration changed: FuelUp keyword volumes ×2.2 and long-tail raised (the budget wasn't
tight and long-tail was 3.5% of volume); tier-based background competition; category CTR/CVR
for the six new brands; challenger budgets; the "peak loses ≥ 20%" target replaced by "best
schedule includes the peak" because profit comparisons break when naive play is loss-making by
design (awareness brands spend less → lose less). Gains are ₹ differences, not ratios, for
the same reason.
| 1h | `worker.ts` + `useMarket.ts`; bids saved from the wizard; suggested ranges sourced from `suggest.ts` | **Done.** Found: the wizard never saved keyword, category or Rec Ads bids (kept in `useState` though listed as saved); now persisted to their localStorage keys, no visual change. `adapter.ts` maps SavedCampaign → engine input (Spotlight auto-bids at the range midpoint pending Q27) |

---

## 13. Decisions and open questions

### Decided (2026-10-10; second batch 2026-10-11)

| # | Question | Decision |
|---|---|---|
| 1 | Session length | ~7.5 min of auto-play (15 s per day) plus pauses; **with the day 7/14/21 checkpoints (#19) the session is ~20–30 min** |
| 2 | Tokens | **Dropped.** The next-day lag is the cost of acting. |
| 6 | Event timing across a batch | **Same seed per batch + brand**, so scores are comparable and the trainer can debrief one timeline |
| 7 | Pace control | **Auto-play, pausing on alerts**; pause and "Advance day" always available |
| 9 | Start-up time | **Asynchronous.** Day 1 on screen in < 1 s, engine in a Web Worker, background saves, no class-wide sync (§2.1) |
| 8 | Bid unit | **CPM, min ₹200**, as the platform UI shows now (§0.1) |
| 11 | Platform UI | **Frozen.** Sidebar, campaign wizard, catalogue and brand collections stay exactly as they are; brief, Rohit, live optimisation, graphs and results are open to redesign (§0.1) |
| 3 | Rival bids | **Hidden.** Auction insights only (§4.3) |
| 4 | Calendar | **Calendar events shown in the brief** (sale days, IPL, paydays); seeded shocks are surprises |
| 5 | Scoring weights | **Setup 25 / Live 35 / Events + Rohit 20 / Results 20** |
| 10 | In-day pacing | **Spend as auctions arrive** (§3.3.2, §14 F5) |
| 12 | CPM levels | **Calibrate to the economics** so typical ROAS sits around break-even after the margin fix |
| 13 | Max profitable CPM column | **Shown from Day 1** |
| 14 | v1 hotfix | **Hotfix now:** inverted dayparting score and the Pan India penalty (separate small PR, before v2) |
| 15 | Text check on own creatives | **Kit labels only**; own uploads get pixel checks |
| 16 | Creative rejection | **Rejected in ~1 day with a reason, no delivery until replaced** |
| 17 | SKU margins | **Recalibrate:** margin = contribution after Blinkit commission, before ads; most brands break even at 2.5–5, Henlo ~6–8 |
| 19 | Time for analysis | **Checkpoints at the end of days 7, 14, 21**; session ~20–30 min |
| 20 | Attribution | **Direct + indirect revenue in ROAS**, split shown in reports |
| 26 | Billing | **Viewable impressions** (§14 F2b) |
| 18 | Traps per brand | **2–3 per brand as in §3.10**, tuned after headless runs |
| 22 | Smart match | **Enters related searches in the keyword's cluster** at the smart bid and fit × 0.85; search-term report R12 |
| 23 | Boost my bid | **Always `bid × (1 + boost%)`**; safety rule uses the effective bid (§14 F2f) |
| 24 | Hero product | **Student infers it** from the brief and reports; the brief doesn't label it |
| 25 | Organic sales | **Modelled** (deplete stock, shown in R9); no cannibalisation / incrementality scoring for now |

### Still open

27. **Listing Spotlight has no bid in the wizard** (and no placement choice, despite CLAUDE.md
    describing one). The engine needs a bid. *Recommendation: the platform bids automatically
    at the suggested range's p50 (§3.2.1) for all three Spotlight placements; the student's
    levers are budget, schedule and the creative (whose CTR raises relevance and lowers price).*
    Is that how real Blinkit Spotlight is priced?

28. **New-account spend limit:** does Blinkit cap a new advertiser's total daily spend (and
    lift it as spend history builds)? If yes, what are the starting limit and the steps? The
    engine will apply it as an account-level daily cap. Without it, a too-high budget is
    still stopped by market supply and the ₹2 lakh total (§3.3.2).

Everything else is decided. **Phase 0 spec is complete and ready for Gaurav's approval.** Next step on approval:
the v1 hotfix (#14), then Phase 1.

---

## 14. Formula audit (canonical formulas)

Every formula in this spec, checked line by line, partly with a Python prototype. **Where a
section above disagrees with this one, this section wins.** Tunable numbers live in
`MARKET_DATA`; values here are starting points for calibration.

### F1. Demand

**Problems:** units were undefined (daily? monthly?); the ±8% noise was flat, so small cells
swung as much as big ones; event multipliers stacked without limit (sale day × festival ×
IPL × rain = 4.4×).

```
expected = dailyVolume[kw]                       national searches per day
         × stateShare[state]                     Σ over states = 1 (dark stores × category affinity)
         × slotShare[category][slot]             Σ over 8 slots = 1
         × dowMult[weekday]                      mean over a week = 1
         × seasonMult
         × min(Π eventMult, 2.0)                 combined events capped at 2×
searches = Poisson(expected)                     seeded per kw × state × slot × day
```
Poisson noise scales with volume by itself (§3.3.5 #6). Category browses, placement views and
feed opens use the same structure with their own base volumes.

### F2. Auction

**F2a Relevance.** Problem: undefined how fit and CTR combine; and raw CTR rewards position
(slot 1 gets more clicks, raises relevance, keeps slot 1: a rich-get-richer loop).
```
relevance = clamp( fit[kw][sku] × ctrRatio^0.5 , 0.6, 1.3 )
ctrRatio  = (clicks_3d ÷ viewableImpressions_3d) ÷ categoryCTR      (position-neutral)
          = 1 if fewer than 500 viewable impressions in 3 days      (no history yet)
```
History is kept per keyword × SKU and survives campaign splits (§3.7.3).

**F2b Billing on viewable impressions.** Problem found by the prototype: if every search
counts as an impression in all 3 slots, slot 2 earns 55% of slot 1's revenue but can cost the
same. A student bidding exactly their max profitable CPM landed in slot 2 at ROAS 2.2 against a
break-even of 4.0, so the core safety rule ("bid = max profitable CPM") didn't hold.
```
viewRate[slot] = [1.00, 0.55, 0.30]          share of searches where the slot is actually seen
impressions    = searches × viewRate[slot]   counted and billed only when viewed
CTR per viewable impression is the same in every slot
```
Now ROAS at a given CPM is the same in every slot; lower slots just bring less volume. (Q26:
does Blinkit bill viewable impressions?)

**F2c Background bidders.** Problem: with only 3–4 named rivals, the last filled slot has no
one below it and pays the ₹200 floor. Prototype: slot 3 at ROAS 11, the most profitable place to
be, which teaches "bid low and sit at the bottom".
```
per inventory unit: 3–8 seeded "other brands"
bid ~ LogNormal(median = category p40 CPM, σ = 0.35), relevance 0.8–1.0
```
They appear as "Other brands" in Auction insights (R7).

**F2d Price.**
```
price[k] = max( ₹200, min( bid[k], adRank[k+1] ÷ relevance[k] + ₹5 ) )
```
Unchanged from §3.2; with F2c there is almost always an `adRank[k+1]`.

**F2e Smart match.** The campaign also enters auctions for other keywords in the same cluster
(`MARKET_DATA` clusters), with its smart bid and `fit × 0.85`. For the same campaign, exact
beats smart.

**F2f Boost my bid.** `effectiveBid = bid × (1 + boost%)` in every auction (decided, Q23).
The effective bid is what caps the price, so the safety rule becomes
**`bid × (1 + boost%) ≤ max profitable CPM`**. A student who bids at max profitable CPM *and*
ticks a 20% boost can pay up to 20% more than break-even allows; the keyword table shows the
effective bid next to max profitable CPM.

**F2g Own-campaign dedupe.** Per auction only your highest-ranked entry enters (§3.7.3).

### F3. Suggested bid range

**Problem:** "bid needed to win slot 1" depends on the student's relevance, which isn't known
before Day 1.
```
needed = adRank(slot-1 holder) ÷ fit[kw][sku]        student's fit, no CTR history
range  = [p50, p80] of needed over the 14 pre-run days, stocked states only
smart  = same over cluster auctions with fit × 0.85, low end ≥ ₹200
```
The "p80 wins slot 1 in ≥ 80%" test applies to pre-run auctions only, since rivals react later.

### F4. Max profitable CPM

```
m      = contributionPerUnit ÷ sellingPrice
R      = 1000 × CTR_viewable × CVR × 0.85 × sellingPrice     revenue per 1,000 viewable impressions
maxCPM = R × m  ( = R ÷ breakEven )
```
Uses the student's last 7 days on that keyword (category defaults until 300 clicks).
**Recomputed when price changes** (e.g. a discount agreed with Rohit lowers `m` and raises
break-even). The draft formula was right but didn't say which CTR or when it updates.

### F5. Pacing (spend as auctions arrive)

**Problem:** the order of auctions *within* a 3-hour slot wasn't defined, so results would
depend on loop order across keywords and states.
```
for slot s = 0..7:
  C = cost of every auction the campaign would win in s (all keywords, states, inventory)
  if remaining ≥ C:  win all, remaining −= C
  else:              f = remaining ÷ C; win fraction f of every auction (pro rata); remaining = 0
  later slots: all lost to budget
dailyCap (overall budget) = remaining overall ÷ days left including today (or to end date)
```
Pro rata is what makes every state and keyword get "the same rationed share" (§3.9 #6). Spend
never exceeds the cap. Budget changes apply next day.

### F6. Stock and OSA

**Problems:** the spec modelled stock as state-level units with a 0 cutoff, but also used "OSA
< 50%", which is a share of dark stores. And only ad sales reduced stock (no organic sales),
so stock lasted unrealistically long.
```
OSA[sku][state] = 1 − e^( −units ÷ (stores[state] × k) )      saturating; see note below
eligible share  = OSA          ads run only in catchments of in-stock stores
units sold      = adUnits + organicUnits
organicUnits    = baseVelocity[sku] × stateShare × dowMult × seasonMult × (1 + 0.1 × SOV)
restock (every 7 days or as agreed) = max(0, targetCoverDays × avgDailyUnits_7d − units)
targetCoverDays: Healthy 21 · Shaky 10 · Critical 4 · Overstocked 45
```
**Built in slices 1e–1f:** a linear OSA (`units ÷ (stores × safety)`) turned out inconsistent:
21 days of cover only reached ~66% OSA, so even healthy stock drifted down all run. OSA is now
the saturating curve above: units are spread unevenly, and extra units add cover, not OSA.
`k` by SKU velocity: High 3 · Medium 2 · Low 1 · Very Low 0.7 units per store. Healthy /
shaky / critical cover then gives roughly 86% / 61% / 32% OSA. Starting units reproduce the
scenario's OSA % (capped at 99%). Organic sales are also limited by stock.

### F7. Shopper response (full chain)

**Problems:** the draft multiplied CVR by `relevance`, which already contains CTR, so CTR was
counted twice and fed back on itself. And the slot intent (§3.3.3) and state CVR (§3.7.1)
were described in the text but missing from the formula.
```
clicks       = viewableImpressions × baseCTR[cat] × creativeMult × affinity × fatigueMult
ATCs         = clicks × baseCVR[cat] × fit[kw][sku] × intent[slot] × stateCVR[state] × priceEffect
units        = ATCs × 0.85
revenue      = units × sellingPrice
contribution = units × contributionPerUnit
profit       = contribution − spend
priceEffect  = 1 − 0.30 × clamp( (gap − 0.05) ÷ 0.20, 0, 1 )
gap          = (yourPrice − cheapest rival ad on the same page) ÷ yourPrice
affinity     = 1.5 on own brand term; else 1 + 0.15 × min(1, reach[state] ÷ shoppers[state])
```
The draft's price rule ("≥ 10% cheaper → up to −30%") had no curve; this one starts at a 5% gap
and reaches −30% at a 25% gap. Position is handled by viewability (F2b), not repeated here.

**Built in slice 1f-b:** awareness formats (Spotlight, Stories) get the creative multiplier and
frequency fatigue but no reach affinity; search-led formats (keywords, category pages, Rec Ads)
get the reach affinity those awareness formats build. So Stories pays off partly through later
search CTR, not only its own clicks. Rivals react (ROAS floor, SOV) on their **keywords only**;
their placement spend still counts against their budget.

**Built in slice 1e:** outcomes are expected values, not random draws (noise comes from Poisson
demand, F1), so every number can be explained. **Indirect revenue** (decision #20) = 15% of
direct revenue (`INDIRECT_REVENUE_RATE`), with contribution at the same margin, so break-even
ROAS is unchanged by it.

### F8. Visibility metrics

**Problem:** with unweighted impressions and 3 slots, SOV can't exceed 33%, yet the worked
example showed 41% and the brief's stakeholder target was 30%: nearly impossible.
```
denominator = searches in targeted states and schedule
partition   = lost to stock (1 − OSA) → lost to budget (F5) → lost to rank → won     sums to 100%
IS          = won ÷ denominator
SOV         = your viewable impressions ÷ all advertisers' viewable impressions   (max ≈ 54%)
top-slot    = your slot-1 appearances ÷ your appearances
avg position = impression-weighted
```
Stakeholder SOV targets in briefs must be ≤ 45%.

### F9. Break-even ROAS

**Problems:** "1 ÷ margin" assumes margin is a % and a single SKU; the data has ₹ per unit and
3 SKUs (§3.9 #1).
```
breakEven[sku]      = sellingPrice ÷ contributionPerUnit
breakEven[campaign] = Σ revenue ÷ Σ contribution          revenue-weighted, changes with SKU mix
```

### F10. Creative

**Problem:** with `0.6 + 0.55 × quality`, a creative with a price sticker (quality 0.8) still
got 1.04×, better than an average ad, so the main creative lesson vanished; and "0.6×" was
unreachable.
```
creativeMult = 1.10 clean
             × 0.80 if elements outside the safe area
             × 0.88 if busy padding background
             × 0.85 if unreadable (contrast / blur / small text)
price callout, T&Cs, non-English → rejected (guideline says not allowed; Q16)
pixel-only detections (own uploads) capped at × 0.92 combined
category CTR benchmark = creativeMult 1.0
fatigueMult = 1 ÷ (1 + 0.08 × max(0, frequency − 2))      (built 1f-b; 0.04/3 was too weak to notice)
frequency   = viewable impressions ÷ unique shoppers reached in the state   (new creative resets it)
```

### F11. Rivals

**Problems:** no precedence when "SOV low → raise" and "ROAS low → cut" are both true; bids
could only ratchet up; the example reacted daily although the rule said "2 days".
```
daily, in this order:
1. ROAS_3d < floor                        → bids × 0.90            (profit beats share)
2. else SOV < target − 10pp for `lag` days → bids × 1.15 per day until recovered or max bid
3. else SOV > target + 15pp                → bids × 0.95            (drift down)
monthly budget used up                     → out of auctions
```
Rivals use the F7 chain with their own SKU data in `MARKET_DATA`. Rival stock-outs are seeded
events (rival stock isn't simulated).

### F12. Events

Combined event multiplier capped at 2.0 (F1). Paydays need real dates: the scenario maps sim
day 1 to a calendar date. A sale day's rival bid lift applies to named rivals **and** background
bidders.

### F13. Decision-moment scoring (counterfactual)

**Problems:** scoring everything in ₹ profit punishes awareness and category-creation brands
for doing their job; "≥ 60% of best gain" breaks when doing nothing is best (newcomer launch:
"don't chase"); actions taken for one moment change others.
```
objective by goal type, over response window + 7 days:
  ROAS-First          profit after ads
  Volume-First        units, minus any ₹ lost below break-even
  Awareness-First     viewable reach in stocked states, while ROAS ≥ 0.7 × break-even
  Category-Creation   new-to-brand reach + units, while ROAS ≥ 0.6 × break-even

score = clamp( (obj_student − obj_none) ÷ (obj_best − obj_none), 0, 1 ) × points
if obj_best − obj_none ≤ tolerance (doing nothing is best):
  full points if obj_student ≥ obj_none − tolerance, else reduced by the loss
obj_best = best of 3–5 candidate levers per moment type AND the student's own action
overlapping moments on the same campaign are scored jointly and share the points
```
Cost: ~8 moments × 6 replays × ~17 days × a few ms → under 1 s in the worker at run end.
Acting late scores less automatically, because it gains less.

### F14. Results: wasted spend

```
wasted = Σ spend over (campaign × keyword × slot) cells, aggregated over the whole run,
         where ROAS < breakEven of the serving SKU
```
Aggregated across the run so daily noise doesn't create false waste.

### F15. Stories CPM

The UI formula `round(base × dayMult × timeMult ÷ 25) × 25` stays on screen. It is the
student's **bid** in the feed auction; the amount charged is ≤ that (second price). The draft
promised "what is shown is what is charged", which an auction can't guarantee.

### F16. Which SKU serves

Per auction: the SKU with the highest `fit[kw][sku]` among the campaign's SKUs in stock in
that state; ties go to the better CTR history (§3.11).

### F17. Session length

30 days × 15 s = 7.5 min, plus alert pauses, Rohit chats, campaign building and three
analysis checkpoints (§7.3.1). **Realistic total: 20–30 min**, not 10. (Q19)
