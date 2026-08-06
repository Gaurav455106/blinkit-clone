import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";
import { Stepper } from "./Stepper";
import { CampaignCollection } from "./CampaignCollection";
import { ProductBoosterSettings } from "./ProductBoosterSettings";
import { ProductBoosterProducts } from "./ProductBoosterProducts";
import { ProductBoosterTargeting } from "./ProductBoosterTargeting";
import { ProductBoosterBudget } from "./ProductBoosterBudget";
import { RecommendationTargeting } from "./RecommendationTargeting";
import { ListingSpotlightProducts, BrandCollectionPayload } from "./ListingSpotlightProducts";
import { BrandBoosterBrands } from "./BrandBoosterBrands";
import { StoriesProducts } from "./StoriesProducts";
import { StoriesTargeting } from "./StoriesTargeting";
import { BrandCollectionsView, BrandCollection } from "./BrandCollectionsView";
import { CatalogueView } from "./CatalogueView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, BarChart2, Megaphone, Bookmark, Package, Menu, X } from "lucide-react";

type PlatformView = "brand_collections" | "catalogue" | null;

type AdAsset = "product_booster" | "recommendation_ads" | "listing_spotlight" | "brand_booster" | "stories" | null;

// All wizard localStorage keys — used for clear-on-mount and snapshot capture
const WIZARD_KEYS = [
  "campaign_step", "campaign_name", "campaign_objective", "campaign_adAsset",
  "sim_geography", "sim_selected_cities", "sim_selected_city_leaves", "sim_schedule_type", "sim_selected_days",
  "sim_timeslot_enabled", "sim_dayparting", "sim_daypart_preset",
  "sim_selected_skus", "sim_added_skus", "sim_sku_strategy",
  "sim_selected_keywords", "sim_keyword_exact_bids", "sim_keyword_smart_bids", "sim_keyword_smart_enabled",
  "sim_category_targeting", "sim_cat_enabled", "sim_cat_bids",
  "sim_budget_type", "sim_budget_value", "sim_campaign_start_date", "sim_campaign_end_date",
  "sim_story_variant", "sim_story_sku", "sim_story_bg", "sim_story_brand_name",
  "sim_story_coll_tab", "sim_story_existing_colls", "sim_story_coll_name",
  "sim_story_coll_brand", "sim_story_coll_cat", "sim_story_logo_type", "sim_story_coll_brand_name",
  "sim_story_feeds", "sim_cpm_overrides", "sim_audience_open", "sim_audience_type",
  "sim_audience_cohorts", "sim_audience_action", "sim_audience_period",
  "sim_audience_cats", "sim_audience_brands", "campaign_draft_id",
];

export interface SavedCampaignRef {
  id: string;
  name: string;
  isDraft?: boolean;
  draftId?: string;
  wizardSnapshot?: Record<string, string>;
}

export function CampaignForm({ onDone, asSheet, editCampaign }: {
  onDone?: () => void;
  asSheet?: boolean;
  editCampaign?: import("@/context/SimContext").SavedCampaign;
} = {}) {
  const nav = useNavigate();
  const { scenario, student, addCampaign, updateCampaign, deleteCampaign, campaigns, activeRunId, currentDay } = useSim();
  const [currentStep, setCurrentStep] = useLocalStorage("campaign_step", 0);
  const [campaignName, setCampaignName] = useLocalStorage("campaign_name", "");
  // Duplicate name check: another campaign (not the one being edited) already has this name
  const isDuplicateName = !!campaignName.trim() && campaigns.some(
    (c) => c.name.trim().toLowerCase() === campaignName.trim().toLowerCase() && c.id !== editCampaign?.id
  );
  const [objective, setObjective] = useLocalStorage<"performance" | "reach" | null>("campaign_objective", null);
  const [adAsset, setAdAsset] = useLocalStorage<AdAsset>("campaign_adAsset", null);
  const [startDate, setStartDate] = useLocalStorage("sim_campaign_start_date", "");
  const [endDate, setEndDate] = useLocalStorage("sim_campaign_end_date", "");
  const [regionValid, setRegionValid] = useState(false);
  const [productsValid, setProductsValid] = useState(false);
  const [targetingValid, setTargetingValid] = useState(false);
  const todayStr = new Date().toISOString().split("T")[0];

  // Stable draft ID for this form session
  const [draftId] = useState<string>(() => editCampaign?.draftId ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2,7)}`);

  // This form always renders inside a Radix Dialog/Sheet. Popovers opened from
  // within it (e.g. the city picker) must portal inside this container rather
  // than document.body, or the Dialog's scroll lock blocks wheel-scrolling them.
  const wizardRootRef = useRef<HTMLDivElement>(null);

  // On mount: restore snapshot if editing a draft, else clear wizard state for a fresh form
  useEffect(() => {
    if (editCampaign?.wizardSnapshot) {
      // Restore exactly where the student left off
      Object.entries(editCampaign.wizardSnapshot).forEach(([k, v]) => localStorage.setItem(k, v));
    } else if (!editCampaign) {
      // Fresh form — clear all wizard keys so previous campaign state doesn't contaminate
      WIZARD_KEYS.forEach((k) => localStorage.removeItem(k));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Platform sidebar state ──
  const [platformView, setPlatformView] = useState<PlatformView>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => !!asSheet);
  const [createdCollections, setCreatedCollections] = useState<BrandCollection[]>([]);
  const [storiesShowErrors, setStoriesShowErrors] = useState(false);

  // Pre-existing collections from scenario
  const existingCollections = useMemo<BrandCollection[]>(() => {
    if (!scenario) return [];
    const today = new Date().toLocaleDateString("en-GB").split("/").join("/");
    return [
      `${scenario.profile.name} – Top Sellers`,
      `${scenario.profile.category} Essentials`,
      `${scenario.profile.name} – New Arrivals`,
      `${scenario.profile.name} – Bestsellers`,
    ].map((name, i) => ({
      id: `existing-${i}`,
      name,
      type: "DYNAMIC" as const,
      productCount: [8, 12, 6, 15][i],
      createdBy: student?.name ?? "You",
      createdOn: today,
    }));
  }, [scenario?.profile.name, student?.name]);

  const allCollections: BrandCollection[] = [...existingCollections, ...createdCollections];

  const handleCollectionCreated = (payload: BrandCollectionPayload) => {
    setCreatedCollections((prev) => {
      if (prev.some((c) => c.name === payload.name)) return prev;
      const today = new Date().toLocaleDateString("en-GB").split("/").join("/");
      return [
        ...prev,
        {
          id: `coll-${Date.now()}`,
          ...payload,
          createdBy: student?.name ?? "You",
          createdOn: today,
        },
      ];
    });
  };

  useEffect(() => {
    if (!student || !scenario) nav("/");
  }, [student, scenario, nav]);

  const captureWizardSnapshot = (): Record<string, string> => {
    const snap: Record<string, string> = {};
    WIZARD_KEYS.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v !== null) snap[k] = v;
    });
    return snap;
  };

  const saveAsDraft = () => {
    const get = <T,>(k: string, d: T): T => {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
    };
    const name = get<string>("campaign_name", "") || "Draft campaign";
    const budgetValueRaw = get<string>("sim_budget_value", "");
    const budget = Number(budgetValueRaw) || 0;
    const snap = captureWizardSnapshot();

    // If editing an existing draft, update it in place; otherwise create new
    if (editCampaign?.isDraft) {
      updateCampaign(editCampaign.id, {
        name,
        budget,
        isDraft: true,
        draftId,
        wizardSnapshot: snap,
        objective,
        adFormat: adAsset,
      });
    } else {
      addCampaign({
        id: `c-${Date.now()}`,
        name,
        objective,
        adFormat: adAsset,
        cities: get<string[]>("sim_selected_cities", []),
        skuIds: get<string[]>("sim_selected_skus", []),
        keywords: get<string[]>("sim_selected_keywords", []),
        budget,
        budgetType: get<"daily" | "overall" | null>("sim_budget_type", null),
        geography: get<"select_cities" | "pan_india" | null>("sim_geography", null),
        isDraft: true,
        draftId,
        wizardSnapshot: snap,
      });
    }
    if (onDone) onDone();
    else nav("/live");
  };

  const saveCampaign = () => {
    const get = <T,>(k: string, d: T): T => {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
    };
    const budgetValueRaw = get<string>("sim_budget_value", "");
    const budget = Number(budgetValueRaw) || 0;
    // Exclude the campaign being edited from budget calculation
    const totalAllocated = campaigns
      .filter((c) => c.id !== editCampaign?.id)
      .reduce((s, c) => s + (c.budget || 0), 0);
    const totalBudget = scenario?.budget ?? 200000;
    if (budget <= 0) { alert("Please enter a campaign budget before saving."); return; }
    if (totalAllocated + budget > totalBudget) {
      alert(`This campaign's budget would exceed your remaining ₹${(totalBudget - totalAllocated).toLocaleString("en-IN")}.`);
      return;
    }
    // Remove draft being edited (will be replaced with a real campaign)
    if (editCampaign?.isDraft) deleteCampaign(editCampaign.id);

    // Capture enabled categories (PB, BB)
    const catEnabled = get<Record<string, boolean>>("sim_cat_enabled", {});
    const categories = Object.entries(catEnabled).filter(([, v]) => v).map(([k]) => k);
    // Capture selected feeds (Stories)
    const feeds = get<string[]>("sim_story_feeds", []);

    // Compute endDay from start/end date strings (applies to all budget types)
    const bType = get<"daily" | "overall" | null>("sim_budget_type", null);
    const startDateStr = get<string>("sim_campaign_start_date", "");
    const endDateStr   = get<string>("sim_campaign_end_date", "");
    let endDay: number | undefined;
    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      const end   = new Date(endDateStr);
      const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
      if (diffDays > 0) endDay = diffDays + 1; // launchDay(1) + diffDays → inclusive end day
    }

    addCampaign({
      id: `c-${Date.now()}`,
      name: campaignName || "Untitled campaign",
      objective,
      adFormat: adAsset,
      cities: get<string[]>("sim_selected_cities", []), // STATE names (legacy key)
      skuIds: get<string[]>("sim_selected_skus", []),
      keywords: get<string[]>("sim_selected_keywords", []),
      categories: categories.length > 0 ? categories : undefined,
      feeds: feeds.length > 0 ? feeds : undefined,
      budget,
      budgetType: bType,
      geography: get<"select_cities" | "pan_india" | null>("sim_geography", null),
      endDay,
      dayparting: get<number[]>("sim_dayparting", [0, 1, 2, 3, 4, 5, 6, 7]),
      daypartPreset: get<"peak" | "daytime" | "24_7" | "custom">("sim_daypart_preset", "24_7"),
      scheduleType: get<"all_days" | "days_of_week">("sim_schedule_type", "all_days"),
      selectedDays: get<number[]>("sim_selected_days", []),
      isDraft: false,
    });
    WIZARD_KEYS.forEach((k) => localStorage.removeItem(k));
    if (onDone) onDone();
    else nav("/live");
  };

  const handleNext = () => {
    // Stories step 2: show inline errors instead of disabling the button
    if (currentStep === 2 && adAsset === "stories" && !productsValid) {
      setStoriesShowErrors(true);
      return;
    }
    setStoriesShowErrors(false);
    // Block launching if overall budget selected but no end date — send back to Ad Settings
    if (currentStep === 4) {
      const budgetType = localStorage.getItem("sim_budget_type")?.replace(/"/g, "");
      const endDate = localStorage.getItem("sim_campaign_end_date")?.replace(/"/g, "");
      if (budgetType === "overall" && !endDate) {
        alert("Overall campaign budget requires an end date. Please go back to Ad Settings to set it.");
        return;
      }
    }
    if (currentStep < 4) setCurrentStep(currentStep + 1);
    else saveCampaign();
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };



  const navItems = [
    { key: "brand_collections" as PlatformView, label: "Brand Collections", icon: Bookmark },
    { key: "catalogue" as PlatformView, label: "Catalogue", icon: Package },
  ];

  return (
    <div ref={wizardRootRef} className={`flex w-full ${asSheet ? "h-full" : "h-screen"} bg-background overflow-hidden`}>
      {/* ── Platform sidebar ── */}
      <div className={`flex flex-col border-r border-border bg-card h-full transition-all duration-200 ${sidebarCollapsed ? "w-14" : "w-52"} shrink-0`}>
        <div className="flex items-center gap-2 px-3 py-4 border-b border-border">
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <Menu className="h-5 w-5" />
          </button>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold text-foreground truncate">Brand Panel</span>
          )}
        </div>
        <nav className="flex-1 py-2">
          {navItems.map(({ key, label, icon: Icon }) => {
            const active = platformView === key;
            return (
              <button
                key={key}
                onClick={() => setPlatformView(active ? null : key)}
                title={sidebarCollapsed ? label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground font-medium border-r-2 border-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span className="text-left truncate">{label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Platform pages ── */}
      {platformView === "brand_collections" && (
        <div className="flex-1 overflow-y-auto">
          <BrandCollectionsView
            collections={allCollections}
            onBack={() => setPlatformView(null)}
            onUpdateCollection={(updated) =>
              setCreatedCollections((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
              )
            }
          />
        </div>
      )}
      {platformView === "catalogue" && (
        <div className="flex-1 overflow-y-auto">
          <CatalogueView onBack={() => setPlatformView(null)} />
        </div>
      )}

      {/* ── Campaign form (hidden when a platform page is active) ── */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${platformView !== null ? "hidden" : ""}`}>
      {/* Breadcrumb */}
      <div className="px-8 pt-6 pb-2 pr-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Ad Campaign</span>
              <ChevronRight className="h-3 w-3" />
              <span>Create new</span>
              {adAsset && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-primary font-medium">
                    {adAsset === "product_booster" ? "Product Booster" :
                     adAsset === "recommendation_ads" ? "Recommendation Ads" :
                     adAsset === "listing_spotlight" ? "Listing Spotlight" :
                     adAsset === "stories" ? "Stories" :
                     "Brand Booster"}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl font-semibold text-foreground mt-2">Create new campaign</h1>
          </div>
          {asSheet && onDone && (
            <button
              onClick={onDone}
              className="mt-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Stepper — in its own card */}
      <div className="px-8 pb-4">
        <div className="bg-card border border-border rounded-lg px-8 py-5">
          <Stepper
            currentStep={currentStep}
            stepLabels={adAsset === "brand_booster"
              ? ["Ad Format", "Ad Settings", "Brand details", "Targeting Options", "Budget Details"]
              : undefined}
          />
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 px-8 overflow-y-auto pb-8 flex flex-col">
        {currentStep === 0 && (
          <div className="max-w-3xl space-y-8">
            {/* Campaign Name */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                Add a campaign name
              </label>
              <p className="text-xs text-muted-foreground">Add a title to your campaign for easy reference</p>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
                className={`max-w-sm mt-2 ${isDuplicateName ? "border-red-400 focus-visible:ring-red-400" : ""}`}
              />
              {isDuplicateName && (
                <p className="text-xs text-red-500 mt-1">A campaign with this name already exists. Please use a unique name.</p>
              )}
            </div>

            {/* Advertising Objective */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">
                Select your advertising objective
              </label>
              <p className="text-xs text-muted-foreground">
                What do you want to achieve through this campaign?
              </p>
              <div className="flex gap-4 mt-3">
                {/* Performance Card */}
                <Card
                  onClick={() => { setObjective("performance"); setAdAsset(null); }}
                  className={`w-64 p-4 cursor-pointer transition-all border-2 hover:shadow-md ${
                    objective === "performance"
                      ? "border-primary bg-accent"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                      <BarChart2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Performance</h3>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Drive clicks, conversions, and measurable results
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Reach Card */}
                <Card
                  onClick={() => { setObjective("reach"); setAdAsset(null); }}
                  className={`w-64 p-4 cursor-pointer transition-all border-2 hover:shadow-md ${
                    objective === "reach"
                      ? "border-primary bg-accent"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                      <Megaphone className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Reach</h3>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Maximize visibility and connect with more shoppers
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Ad Asset Selection - shows when Performance is selected */}
            {objective === "performance" && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Select the Ad asset
                </label>
                <p className="text-xs text-muted-foreground">
                  These are recommended ad assets based on your advertising objective
                </p>
                <div className="flex gap-4 mt-3">
                  {/* Product Booster */}
                  <Card
                    onClick={() => setAdAsset("product_booster")}
                    className={`w-56 p-4 cursor-pointer transition-all border-2 hover:shadow-md ${
                      adAsset === "product_booster"
                        ? "border-green-500 bg-green-50/50"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                        adAsset === "product_booster" ? "border-green-500 bg-green-500" : "border-muted-foreground"
                      }`}>
                        {adAsset === "product_booster" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Product Booster</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Boost your product's search and category listing performance
                        </p>
                      </div>
                    </div>
                    {/* Phone Mockup */}
                    <div className="flex justify-center">
                      <PhoneMockup type="booster" />
                    </div>
                  </Card>

                  {/* Recommendation Ads */}
                  <Card
                    onClick={() => setAdAsset("recommendation_ads")}
                    className={`w-56 p-4 cursor-pointer transition-all border-2 hover:shadow-md ${
                      adAsset === "recommendation_ads"
                        ? "border-green-500 bg-green-50/50"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                        adAsset === "recommendation_ads" ? "border-green-500 bg-green-500" : "border-muted-foreground"
                      }`}>
                        {adAsset === "recommendation_ads" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Recommendation Ads</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Boost your product's performance in recommendations engines
                        </p>
                      </div>
                    </div>
                    {/* Phone Mockup */}
                    <div className="flex justify-center">
                      <PhoneMockup type="recommendation" />
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Ad Asset Selection - shows when Reach is selected */}
            {objective === "reach" && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Select the Ad asset
                </label>
                <p className="text-xs text-muted-foreground">
                  These are recommended ad assets based on your advertising objective
                </p>
                <div className="flex gap-4 mt-3">
                  {/* Stories */}
                  <Card
                    onClick={() => setAdAsset("stories")}
                    className={`w-56 p-4 cursor-pointer transition-all border-2 hover:shadow-md relative ${
                      adAsset === "stories" ? "border-green-500 bg-green-50/50" : "border-border"
                    }`}
                  >
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-sm bg-blue-100 text-[10px] text-blue-600 font-semibold">New Asset</div>
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                        adAsset === "stories" ? "border-green-500 bg-green-500" : "border-muted-foreground"
                      }`}>
                        {adAsset === "stories" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Stories</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Bring your products and new launches to the top of the feed
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <PhoneMockup type="stories" />
                    </div>
                  </Card>

                  {/* Listing Spotlight */}
                  <Card
                    onClick={() => setAdAsset("listing_spotlight")}
                    className={`w-56 p-4 cursor-pointer transition-all border-2 hover:shadow-md ${
                      adAsset === "listing_spotlight" ? "border-green-500 bg-green-50/50" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                        adAsset === "listing_spotlight" ? "border-green-500 bg-green-500" : "border-muted-foreground"
                      }`}>
                        {adAsset === "listing_spotlight" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Listing Spotlight</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Enhance brand visibility and acquire new customers
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <PhoneMockup type="spotlight" />
                    </div>
                  </Card>

                  {/* Brand Booster */}
                  <Card
                    onClick={() => setAdAsset("brand_booster")}
                    className={`w-56 p-4 cursor-pointer transition-all border-2 hover:shadow-md ${
                      adAsset === "brand_booster" ? "border-green-500 bg-green-50/50" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                        adAsset === "brand_booster" ? "border-green-500 bg-green-500" : "border-muted-foreground"
                      }`}>
                        {adAsset === "brand_booster" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Brand Booster</h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Enhance your brand's visibility on search and category listings
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <PhoneMockup type="brand" />
                    </div>
                  </Card>
                </div>
              </div>
            )}

          </div>
        )}

        {currentStep === 1 && (adAsset === "product_booster" || adAsset === "recommendation_ads" || adAsset === "listing_spotlight" || adAsset === "brand_booster" || adAsset === "stories") && (
          <ProductBoosterSettings onRegionValid={setRegionValid} showAdSchedule={adAsset === "stories"} portalContainer={wizardRootRef.current} />
        )}

        {currentStep === 1 && adAsset !== "product_booster" && adAsset !== "recommendation_ads" && adAsset !== "listing_spotlight" && adAsset !== "brand_booster" && adAsset !== "stories" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Ad Settings</h2>
            <p className="text-sm text-muted-foreground mt-2">Configure your ad settings here. (Coming soon)</p>
          </div>
        )}

        {currentStep === 2 && (adAsset === "product_booster" || adAsset === "recommendation_ads") && (
          <div className="flex-1 flex flex-col min-h-0">
            <ProductBoosterProducts onProductsValid={setProductsValid} />
          </div>
        )}

        {currentStep === 2 && adAsset === "listing_spotlight" && (
          <ListingSpotlightProducts
            onProductsValid={setProductsValid}
            onCollectionCreated={handleCollectionCreated}
          />
        )}

        {currentStep === 2 && adAsset === "brand_booster" && (
          <BrandBoosterBrands onBrandsValid={setProductsValid} />
        )}

        {currentStep === 2 && adAsset === "stories" && (
          <StoriesProducts onProductsValid={setProductsValid} showErrors={storiesShowErrors} />
        )}

        {currentStep === 2 && adAsset !== "product_booster" && adAsset !== "recommendation_ads" && adAsset !== "listing_spotlight" && adAsset !== "brand_booster" && adAsset !== "stories" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Product Details</h2>
            <p className="text-sm text-muted-foreground mt-2">Add products to your campaign. (Coming soon)</p>
          </div>
        )}

        {currentStep === 3 && adAsset === "product_booster" && (
          <ProductBoosterTargeting onTargetingValid={setTargetingValid} />
        )}

        {currentStep === 3 && adAsset === "listing_spotlight" && (
          <ProductBoosterTargeting onTargetingValid={setTargetingValid} showCategoryTargeting={false} />
        )}

        {currentStep === 3 && adAsset === "recommendation_ads" && (
          <RecommendationTargeting onTargetingValid={setTargetingValid} />
        )}

        {currentStep === 3 && adAsset === "brand_booster" && (
          <ProductBoosterTargeting onTargetingValid={setTargetingValid} />
        )}

        {currentStep === 3 && adAsset === "stories" && (
          <StoriesTargeting onTargetingValid={setTargetingValid} />
        )}

        {currentStep === 3 && adAsset !== "product_booster" && adAsset !== "recommendation_ads" && adAsset !== "listing_spotlight" && adAsset !== "brand_booster" && adAsset !== "stories" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Targeting Options</h2>
            <p className="text-sm text-muted-foreground mt-2">Set your audience targeting. (Coming soon)</p>
          </div>
        )}

        {currentStep === 4 && (adAsset === "product_booster" || adAsset === "recommendation_ads" || adAsset === "listing_spotlight" || adAsset === "brand_booster" || adAsset === "stories") && (
          <ProductBoosterBudget />
        )}

        {currentStep === 4 && adAsset !== "product_booster" && adAsset !== "recommendation_ads" && adAsset !== "listing_spotlight" && adAsset !== "brand_booster" && adAsset !== "stories" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Budget Details</h2>
            <p className="text-sm text-muted-foreground mt-2">Set your campaign budget. (Coming soon)</p>
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="sticky bottom-0 flex items-center justify-end gap-3 px-8 py-4 border-t border-border bg-card z-10">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="bg-muted text-muted-foreground hover:bg-muted/80"
        >
          Previous
        </Button>
        {/* Save as Draft — visible from step 0 onwards when name + format chosen */}
        {campaignName.trim() && (
          <Button
            variant="outline"
            onClick={saveAsDraft}
            className="text-muted-foreground border-dashed"
          >
            Save as Draft
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={
            (currentStep === 0 && (!objective || !adAsset || !campaignName.trim() || isDuplicateName)) ||
            (currentStep === 1 && (adAsset === "product_booster" || adAsset === "recommendation_ads" || adAsset === "listing_spotlight" || adAsset === "brand_booster" || adAsset === "stories") && !regionValid) ||
            (currentStep === 2 && (adAsset === "product_booster" || adAsset === "recommendation_ads" || adAsset === "listing_spotlight" || adAsset === "brand_booster") && !productsValid) ||
            (currentStep === 3 && (adAsset === "product_booster" || adAsset === "recommendation_ads" || adAsset === "listing_spotlight" || adAsset === "brand_booster" || adAsset === "stories") && !targetingValid)
          }
        >
          {currentStep === 4 ? "Done" : "Next"}
        </Button>
      </div>
      </div>
    </div>
  );
}

function PhoneMockup({ type }: { type: "booster" | "recommendation" | "spotlight" | "brand" | "stories" }) {
  return (
    <div className="w-32 h-56 rounded-2xl border-[3px] border-yellow-400 bg-white p-2 relative overflow-hidden shadow-sm">
      {/* Status bar */}
      <div className="flex justify-between items-center mb-1 px-0.5">
        <div className="text-[5px] text-gray-400 font-medium">9:41</div>
        <div className="flex gap-0.5">
          <div className="w-2 h-1 rounded-sm bg-gray-300" />
          <div className="w-1 h-1 rounded-sm bg-gray-300" />
        </div>
      </div>
      {/* Search bar */}
      <div className="h-4 rounded-md bg-gray-100 border border-gray-200 mb-2 flex items-center px-1.5 gap-1">
        <div className="w-2 h-2 rounded-full border border-gray-300" />
        <div className="w-12 h-1 rounded bg-gray-200" />
      </div>

      {type === "booster" && (
        <div className="space-y-1">
          {/* Top: sponsored tile left + 2 stacked teal tiles right */}
          <div className="grid grid-cols-2 gap-1">
            {/* Sponsored product tile */}
            <div className="rounded border border-gray-200 bg-white p-1 relative">
              <div className="absolute top-0.5 right-0.5 px-0.5 py-px rounded-sm bg-gray-200 text-[3.5px] text-gray-500 font-semibold leading-none">AD</div>
              {/* Bottle image */}
              <div className="w-full flex items-center justify-center mb-0.5" style={{height:"36px"}}>
                <div className="flex flex-col items-center">
                  <div className="w-2 h-1 rounded-t bg-amber-400" />
                  <div className="w-1.5 h-1 bg-amber-300" />
                  <div className="w-5 h-7 rounded-b bg-amber-300 flex items-center justify-center">
                    <div className="w-3 h-4 rounded bg-amber-200/60" />
                  </div>
                </div>
              </div>
              {/* 10 MINS badge */}
              <div className="flex items-center gap-0.5 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full border border-gray-400" />
                <div className="text-[3.5px] text-gray-500 font-medium">10 MINS</div>
              </div>
              {/* Text lines */}
              <div className="w-full h-0.5 rounded bg-gray-200 mb-0.5" />
              <div className="text-[3.5px] text-gray-500">500 ml</div>
              <div className="inline-flex px-0.5 rounded-sm bg-green-100 text-[3.5px] text-green-700 font-semibold">5% OFF</div>
              <div className="text-[3px] text-gray-400 line-through">MRP ₹45</div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="text-[4.5px] font-bold text-gray-800">₹40</div>
                <div className="w-7 h-2.5 rounded bg-yellow-400 flex items-center justify-center">
                  <span className="text-[3.5px] text-gray-900 font-bold">ADD</span>
                </div>
              </div>
            </div>
            {/* Right: 2 stacked teal tiles */}
            <div className="flex flex-col gap-1">
              <div className="flex-1 rounded bg-teal-50 border border-teal-100" style={{minHeight:"40px"}} />
              <div className="flex-1 rounded bg-teal-50 border border-teal-100" style={{minHeight:"40px"}} />
            </div>
          </div>
          {/* Bottom: 2 teal tiles */}
          <div className="grid grid-cols-2 gap-1">
            <div className="h-8 rounded bg-teal-50 border border-teal-100" />
            <div className="h-8 rounded bg-teal-50 border border-teal-100" />
          </div>
        </div>
      )}

      {type === "recommendation" && (
        <div className="space-y-1">
          {/* Recommended for you header */}
          <div className="flex items-center justify-between">
            <div className="text-[5px] font-semibold text-gray-700">Recommended for you</div>
            <div className="text-[4px] text-green-600">see all</div>
          </div>
          {/* Large sponsored card left + 2 small tiles right */}
          <div className="grid grid-cols-2 gap-1">
            {/* Sponsored large card */}
            <div className="rounded border border-gray-200 bg-white p-1 relative">
              <div className="text-[3.5px] text-gray-500 font-semibold mb-0.5">AD</div>
              {/* Bottle */}
              <div className="w-full flex items-center justify-center mb-0.5" style={{height:"32px"}}>
                <div className="flex flex-col items-center">
                  <div className="w-2 h-1 rounded-t bg-amber-400" />
                  <div className="w-1.5 h-1 bg-amber-300" />
                  <div className="w-5 h-6 rounded-b bg-amber-300 flex items-center justify-center">
                    <div className="w-3 h-3.5 rounded bg-amber-200/60" />
                  </div>
                </div>
              </div>
              {/* Dots indicator */}
              <div className="flex gap-0.5 justify-center mb-0.5">
                <div className="w-1 h-0.5 rounded-full bg-gray-400" />
                <div className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                <div className="w-0.5 h-0.5 rounded-full bg-gray-300" />
              </div>
              <div className="text-[3.5px] text-gray-500">500 ml</div>
              <div className="inline-flex px-0.5 rounded-sm bg-green-100 text-[3.5px] text-green-700 font-semibold">5% OFF</div>
              <div className="text-[3px] text-gray-400 line-through">MRP ₹45</div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="text-[4.5px] font-bold text-gray-800">₹40</div>
                <div className="w-7 h-2.5 rounded bg-yellow-400 flex items-center justify-center">
                  <span className="text-[3.5px] text-gray-900 font-bold">ADD</span>
                </div>
              </div>
            </div>
            {/* Right: 2 small product tiles */}
            <div className="flex flex-col gap-1">
              {[0,1].map(i => (
                <div key={i} className="rounded border border-gray-100 bg-white p-0.5 flex-1">
                  <div className="w-full h-5 rounded bg-teal-50 mb-0.5" />
                  <div className="text-[3.5px] font-medium text-gray-700">Product name</div>
                  <div className="text-[3px] text-gray-400">300 g</div>
                  <div className="text-[3px] text-green-600 font-semibold">Save ₹10</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="text-[4px] font-bold text-gray-800">₹90</div>
                    <div className="w-5 h-2 rounded bg-yellow-400 flex items-center justify-center">
                      <span className="text-[3px] text-gray-900 font-bold">ADD</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* see all */}
          <div className="text-[4px] text-green-600 text-right">see all</div>
          {/* Bottom 3-col product grid */}
          <div className="grid grid-cols-3 gap-0.5">
            {[0,1,2].map(i => (
              <div key={i} className="rounded border border-gray-100 bg-white p-0.5">
                <div className="w-full h-5 rounded bg-teal-50 mb-0.5" />
                <div className="text-[3.5px] font-medium text-gray-700">Product name</div>
                <div className="text-[3px] text-gray-400">300 g</div>
                <div className="text-[3px] text-green-600 font-semibold">Save ₹10</div>
                <div className="flex items-center justify-between mt-0.5">
                  <div className="text-[4px] font-bold text-gray-800">₹90</div>
                  <div className="w-5 h-2 rounded bg-yellow-400 flex items-center justify-center">
                    <span className="text-[3px] text-gray-900 font-bold">ADD</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {type === "spotlight" && (
        <div className="space-y-1">
          {/* Top section: vertical banner left + 2 stacked tiles right */}
          <div className="grid grid-cols-2 gap-0.5" style={{height: "88px"}}>
            {/* Left: tall vertical banner ad */}
            <div className="rounded-md bg-blue-400 flex flex-col items-center justify-between p-1 h-full">
              <div className="text-[4px] text-white font-semibold text-center leading-tight mt-0.5">Your favourite coffee for all seasons!</div>
              {/* Steam + cup illustration */}
              <div className="flex flex-col items-center">
                <div className="flex gap-0.5 mb-0.5">
                  <div className="w-px h-2 bg-white/60 rounded" />
                  <div className="w-px h-3 bg-white/60 rounded" />
                  <div className="w-px h-2 bg-white/60 rounded" />
                </div>
                {/* Cup */}
                <div className="w-7 h-5 rounded-b-lg bg-red-500 flex items-end justify-center pb-0.5">
                  <div className="w-4 h-2 rounded bg-red-400" />
                </div>
                <div className="w-8 h-1 rounded-full bg-red-600" />
                {/* Coffee beans */}
                <div className="flex gap-0.5 mt-0.5">
                  <div className="w-2 h-1.5 rounded-full bg-amber-700 rotate-12" />
                  <div className="w-2 h-1.5 rounded-full bg-amber-800 -rotate-12" />
                </div>
              </div>
              {/* Shop Now */}
              <div className="w-full h-3 rounded bg-gray-900 flex items-center justify-center">
                <span className="text-[4px] text-white font-semibold">Shop Now</span>
              </div>
            </div>
            {/* Right: 2 stacked tiles */}
            <div className="flex flex-col gap-0.5 h-full">
              <div className="flex-1 rounded bg-blue-50 border border-blue-100" />
              <div className="flex-1 rounded bg-blue-50 border border-blue-100" />
            </div>
          </div>
          {/* Bottom: 2x2 grid of regular tiles */}
          <div className="grid grid-cols-2 gap-0.5">
            {[0,1,2,3].map(i => (
              <div key={i} className="h-8 rounded bg-blue-50 border border-blue-100" />
            ))}
          </div>
        </div>
      )}

      {type === "brand" && (
        <div className="space-y-1 relative">
          {/* 2-column tall tiles */}
          <div className="grid grid-cols-2 gap-0.5">
            <div className="h-16 rounded bg-teal-50 border border-teal-100" />
            <div className="h-16 rounded bg-teal-50 border border-teal-100" />
          </div>
          {/* Shop by brands — protrudes left */}
          <div className="relative" style={{marginLeft: "-12px"}}>
            <div className="rounded-r-md bg-yellow-50 border border-yellow-200 px-1.5 py-1">
              <div className="text-[5px] font-semibold text-gray-700 mb-1">Shop by brands</div>
              <div className="flex gap-1">
                {/* Coca-Cola */}
                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-1 rounded-full bg-white/90" />
                    <div className="w-4 h-0.5 rounded-full bg-white/70 mt-0.5" />
                  </div>
                </div>
                {/* Fanta — with AD badge */}
                <div className="w-8 h-8 rounded-lg bg-orange-400 flex items-center justify-center shrink-0 relative">
                  <div className="w-5 h-1 rounded-full bg-white/80" />
                  <div className="absolute -top-0.5 -right-0.5 px-0.5 rounded-sm bg-gray-300 text-[3px] text-gray-600 font-bold leading-none py-px">AD</div>
                </div>
                {/* Sprite */}
                <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                  <div className="w-4 h-1 rounded-full bg-yellow-300" />
                </div>
                {/* Thums Up */}
                <div className="w-8 h-8 rounded-lg bg-red-700 flex items-center justify-center shrink-0">
                  <div className="w-4 h-3 rounded bg-red-500/60" />
                </div>
              </div>
            </div>
          </div>
          {/* 3 small tiles below */}
          <div className="grid grid-cols-3 gap-0.5">
            <div className="h-6 rounded bg-teal-50 border border-teal-100" />
            <div className="h-6 rounded bg-teal-50 border border-teal-100" />
            <div className="h-6 rounded bg-teal-50 border border-teal-100" />
          </div>
        </div>
      )}

      {type === "stories" && (
        <div className="space-y-0.5">
          {/* Status bar */}
          <div className="flex justify-between items-center px-0.5">
            <div className="text-[5px] font-semibold text-gray-700">10:01</div>
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-1 rounded-sm bg-gray-400" />
              <div className="text-[4px] text-gray-400">▲</div>
              <div className="w-2.5 h-1.5 rounded-sm border border-gray-400 flex items-center px-px">
                <div className="w-1.5 h-0.5 rounded-sm bg-gray-600" />
              </div>
            </div>
          </div>
          {/* Header */}
          <div className="flex items-start justify-between px-0.5">
            <div>
              <div className="text-[6px] font-bold text-gray-900 leading-tight">Delivery in 8 minutes</div>
              <div className="text-[4px] text-gray-500">Home · 521, Address road ∨</div>
            </div>
            <div className="w-3 h-3 rounded-full bg-gray-200 shrink-0 mt-0.5" />
          </div>
          {/* Search bar */}
          <div className="h-3.5 rounded-md bg-gray-100 border border-gray-200 flex items-center px-1 gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full border border-gray-400" />
            <div className="text-[4px] text-gray-400 flex-1">Search for atta, dal, coke...</div>
            <div className="text-[5px] text-gray-400">🎤</div>
          </div>
          {/* Category icons */}
          <div className="flex gap-1 overflow-hidden px-0.5">
            {["All","Lifestyle","Beauty","Kids","Gifting"].map(label => (
              <div key={label} className="flex flex-col items-center gap-px shrink-0">
                <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200" />
                <div className="text-[3px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>
          {/* Stories row — featured card protrudes left */}
          <div className="relative flex items-center gap-0.5 overflow-hidden" style={{height: "32px"}}>
            {/* Featured story — slightly larger, with border */}
            <div className="shrink-0 rounded-md border-2 border-blue-400 bg-orange-700 flex flex-col items-center justify-between p-0.5 z-10" style={{width:"28px", height:"36px", marginLeft:"-4px", marginTop:"-2px"}}>
              <div className="text-[3px] text-white font-bold bg-blue-400 px-0.5 rounded-sm w-full text-center">Featured</div>
              <div className="flex flex-col items-center">
                <div className="flex gap-px">
                  <div className="w-px h-1.5 bg-white/60 rounded" />
                  <div className="w-px h-2 bg-white/60 rounded" />
                  <div className="w-px h-1.5 bg-white/60 rounded" />
                </div>
                <div className="w-4 h-3 rounded-b bg-red-500" />
                <div className="w-5 h-0.5 rounded-full bg-red-700" />
              </div>
              <div className="w-1 h-1 rounded-full bg-amber-700" />
            </div>
            {/* Other stories */}
            {[
              { label: "New Launch", text: "E-gift cards", bg: "bg-pink-100" },
              { label: "New Launch", text: "Smart Watches", bg: "bg-gray-100" },
              { label: "Featured", text: "Gifts for...", bg: "bg-purple-100" },
            ].map(({ label, text, bg }, i) => (
              <div key={i} className={`shrink-0 rounded border border-gray-200 ${bg} flex flex-col justify-between p-0.5`} style={{width:"26px", height:"30px"}}>
                <div className="text-[3px] text-green-600 font-semibold">{label}</div>
                <div className="text-[3px] text-gray-700 font-medium leading-tight">{text}</div>
              </div>
            ))}
          </div>
          {/* Recommended for you */}
          <div className="flex items-center justify-between px-0.5">
            <div className="text-[5px] font-semibold text-gray-700">Recommended for you</div>
            <div className="text-[4px] text-green-600">see all</div>
          </div>
          {/* Product tiles */}
          <div className="grid grid-cols-3 gap-0.5">
            {[0,1,2].map(i => (
              <div key={i} className="rounded border border-gray-100 bg-white p-0.5">
                <div className="w-full h-6 rounded bg-blue-50 mb-0.5" />
                <div className="text-[3.5px] font-medium text-gray-700 leading-tight">Product name</div>
                <div className="text-[3px] text-gray-400">300 g</div>
                <div className="text-[3px] text-green-600 font-semibold">Save ₹10</div>
                <div className="text-[3px] text-gray-400 line-through">MRP ₹100</div>
                <div className="flex items-center justify-between mt-0.5">
                  <div className="text-[4px] font-bold text-gray-800">₹90</div>
                  <div className="w-4 h-2 rounded bg-yellow-400 flex items-center justify-center">
                    <span className="text-[3px] text-gray-900 font-bold">ADD</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
