

## Blinkit Ad Backend UI - Implementation Plan

### What We're Building
A multi-step campaign creation interface replicating the Blinkit ad backend, based on the screenshot provided.

### UI Structure

**Left Sidebar:**
- Hamburger menu icon
- Navigation items: Campaigns, Brand Collections, Visibility Plans, Insights, Catalogue
- "What's new?" card at bottom with carousel dots

**Main Content Area:**
- Breadcrumb: "Ad Campaign > Create new"
- Title: "Create new campaign"
- 5-step progress stepper: Ad Format (active), Ad Settings, Product details, Targeting Options, Budget Details
- Step 1 form:
  - Campaign name input
  - Advertising objective selection (Performance / Reach) as selectable cards with icons
- Previous / Next buttons at bottom

### Files to Create/Modify

1. **`src/components/Sidebar.tsx`** - Left navigation sidebar
2. **`src/components/Stepper.tsx`** - 5-step horizontal progress indicator
3. **`src/components/CampaignForm.tsx`** - Main campaign creation form with multi-step logic
4. **`src/components/WhatsNewCard.tsx`** - Bottom-left info card
5. **`src/pages/Index.tsx`** - Compose layout with sidebar + main content
6. **`src/index.css`** - Custom styles for Blinkit green theme

### Technical Details
- Multi-step form state managed with React useState
- Step 1: campaign name + objective selection (as shown)
- Steps 2-5: placeholder content for now
- Blinkit green (#0C831F) for active/primary elements
- Light gray (#F7F7F7) background
- All mock data, no backend needed initially

