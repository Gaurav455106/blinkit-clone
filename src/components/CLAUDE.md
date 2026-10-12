# Campaign wizard rules (v1 wizard, platform UI frozen)

Loaded when working under `src/components`. Moved from the root CLAUDE.md.

## Campaign Types (Ad Formats)

`adAsset` values in `CampaignForm.tsx`:

### 1. `product_booster` — Product Booster
- **Objective**: Performance
- **Targeting**: Keyword + Category (both enabled)
  - Keywords: multi-select; exact bid + optional smart bid per keyword; min ₹200
  - Category: toggle per `relevantCategory`; CPM bid per category; min ₹200
- **Component sequence**: CampaignCollection → ProductBoosterSettings → ProductBoosterProducts → ProductBoosterTargeting(keyword+category) → ProductBoosterBudget

### 2. `recommendation_ads` — Recommendation Ads
- **Objective**: Reach
- **Targeting**: Keyword ONLY — no category section
  - Pass `showCategoryTargeting={false}` to ProductBoosterTargeting
- **Component sequence**: → RecommendationTargeting / ProductBoosterTargeting(keyword only)

### 3. `listing_spotlight` — Listing Spotlight
- **Objective**: Reach
- **Targeting**: Placement-based — NO keyword targeting, NO category targeting
  - Students select placement: Search Results / Home / Category Pages
  - Can create a Brand Collection (BrandCollectionsView sidebar)
- **Component sequence**: → ListingSpotlightProducts → (no targeting step) → ProductBoosterBudget

### 4. `brand_booster` — Brand Booster
- **Objective**: Reach
- **Targeting**: Category targeting available (same component as Product Booster)
- **Step 3 label changed** to "Brand details" using Stepper `stepLabels` prop → `BrandBoosterBrands`
  - Shows brand from brief with SKU count; brand pre-selected; valid when brand checkbox checked
- **Component sequence**: → BrandBoosterBrands → ProductBoosterTargeting(category only) → ProductBoosterBudget

### 5. `stories` — Stories Ad
- **Objective**: Reach
- **Unique feature**: Ad Schedule in step 1 (ONLY for stories — `showAdSchedule={true}`)
- **Product Details**: `StoriesProducts`
  - Single product: SKU dropdown → Ad Creative (19 BG swatches, brand name ≤14 chars, live preview)
  - Collection of products: existing/create tabs → different Ad Creative (key image upload, brand logo, brand name ≤29 chars)
  - Ad Creative section appears immediately when variant radio is clicked (not after SKU selected)
  - Errors shown only on Next click (`storiesShowErrors` in CampaignForm)
- **Targeting**: `StoriesTargeting`
  - Feed Targeting: Main Feed (₹500) + up to 2 feeds from `relevantCategories` (₹625)
  - CPMs are dynamic (multiplied by day/time selections from Ad Settings)
  - Edit icon on checked feeds to manually override CPM
  - Main Feed expands inline to show "Choose your audience" sub-section
    - Ready-made cohort (multi-select from fixed segments)
    - Custom cohort (User action + Period + Categories from brief + Brand from brief)
  - **Next blocked** unless: ≥1 feed selected AND (if Main Feed selected) audience section complete
- **Component sequence**: → ProductBoosterSettings(showAdSchedule=true) → StoriesProducts → StoriesTargeting → ProductBoosterBudget

---

## Ad Settings — Ad Schedule (`ProductBoosterSettings.tsx`)
Only rendered when `showAdSchedule={true}` (Stories only).

Behavior rules:
- Clicking a day chip → auto-switches radio to "Days of the week"
- Deselecting ALL day chips → auto-switches back to "All days"
- Clicking a time slot → auto-enables Time-slot checkbox
- Deselecting ALL time slots → auto-unchecks Time-slot checkbox

localStorage keys: `sim_schedule_type`, `sim_selected_days`, `sim_timeslot_enabled`, `sim_dayparting`

---

## Budget (`ProductBoosterBudget.tsx`)
- Used by ALL 5 campaign types
- Types: Daily or Overall
- Overall budget requires end date (alert on violation, stay on budget step — do NOT navigate away)
- Total scenario budget: ₹2,00,000 shared across all campaigns
