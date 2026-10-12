# Blinkit Ads Simulation — Claude Reference

## v2 Redesign (in progress)
> **`SPEC.md` is the plan for the v2 rebuild** (market engine, auction/SOV, reacting rivals,
> state-driven events and Rohit, scoring v2). Read it before any engine, live-dashboard,
> CM-pitch or scoring work. Its §12 lists the phases and §13 the decided and open questions.
> Don't start a phase without Gaurav's go-ahead. The rest of this file describes v1 until a
> phase replaces it.

## Dependency Reference
> **For all logic, scoring formulas, brand profiles, and module interconnections — read `DEPENDENCIES.md` first.**  
> CLAUDE.md covers project structure; DEPENDENCIES.md covers how everything calculates and connects.

> ⚠️ **Never use bare `npx tsc --noEmit`.** The root `tsconfig.json` is a solution
> file (`"files": []` + project references), so that command checks **zero files**
> and always exits 0 — it silently reports success no matter what is broken.
> Use `npm run typecheck` (= `tsc -p tsconfig.app.json --noEmit`).

---

## Purpose
A training simulation of the Blinkit advertising platform for student marketers. Students play a brand manager: read a brand brief, pitch a CM, build ad campaigns, run a 30-day simulation, face crises, and get a scored result. Everything is interconnected — brief → CM pitch → campaigns → simulation engine → results.

## Commands
```bash
npm run dev        # start dev server (localhost:5173)
npm run typecheck  # type-check — run after every code change
npm run build      # production build
```

---

## Brand Profiles (`src/data/scenarios.ts`)

7 brands, each with fixed properties that drive ALL downstream decisions:

| Brand | Category | Difficulty | Optimal Objective | Optimal Ad Format | Goal Type |
|-------|----------|------------|-------------------|-------------------|-----------|
| Henlo | Dog Treats | Medium | Performance | product_booster | ROAS-First |
| Glow Republic | Premium Skincare | Hard | Reach | listing_spotlight | Awareness-First |
| VitaBoost | Health Supplements | Very Hard | Reach | listing_spotlight | Category-Creation |
| TinyBuddy | Baby Care | Hard | Reach | brand_booster | Volume-First |
| MunchBox | Packaged Snacks | Medium | Performance | product_booster | ROAS-First |
| PawLife | Pet Accessories | Hard | Reach | recommendation_ads | Awareness-First |
| FuelUp | Protein & Fitness | Very Hard | Performance | product_booster | ROAS-First |

Each brand has:
- `skus[]` — 3 SKUs with mrp, margin, velocity (Very Low / Low / Medium / High)
- `goodKeywords[]` — keywords that convert well
- `riskyKeywords[]` — brand-name / generic keywords that burn budget
- `relevantCategories[]` — drives category targeting options AND Stories feed labels
- `primaryState` + `secondaryStates[]` — only these states have stock (OSA > 0); others = 0 OSA
- `peakHours` — human-readable hint shown in Ad Schedule
- `goalType` — determines which client goals are generated
- `trap` — the key strategic mistake students make with this brand

---

> Wizard rules (campaign types, ad schedule, budget) live in `src/components/CLAUDE.md`,
> which loads when you work on files under `src/components`.

## Interdependency Rules (Design Principles)

1. **Brief → targeting options**: `relevantCategories` → category bid rows + Stories feed labels + audience categories. `goodKeywords` → keyword suggestions. `primaryState/secondaryStates` → where OSA > 0.

2. **Inventory → budget strategy**: Overstocked = clearance goal (sell-through > ROAS). Critical = pause. Healthy = scale.

3. **Season → CPMs**: Festival +30%. Post-Festival demand -40%.

4. **Market → competition**: Aggressive Competitor CPMs +35%.

5. **Ad format ↔ objective alignment**: Misalignment penalises score. Performance formats (product_booster) suit ROAS brands. Reach formats suit awareness/category-creation brands.

6. **Geography → stock**: Pan India when stock only in 2-3 states = budget wasted on 0-OSA dark stores.

7. **Dayparting → CPM** (Stories): Peak 6PM-9PM = 1.4× CPM. Weekend premium up to 1.25×.

8. **Budget type → pacing**: Daily = safe cap. Overall = can exhaust early if mismanaged.

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
