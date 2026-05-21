import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, TrendingUp, Users, Smartphone } from "lucide-react";

type AdAsset = "product_booster" | "recommendation_ads" | "listing_spotlight" | "brand_booster" | null;

export function CampaignForm() {
  const nav = useNavigate();
  const { scenario, student } = useSim();
  const [currentStep, setCurrentStep] = useLocalStorage("campaign_step", 0);
  const [campaignName, setCampaignName] = useLocalStorage("campaign_name", "");
  const [objective, setObjective] = useLocalStorage<"performance" | "reach" | null>("campaign_objective", null);
  const [adAsset, setAdAsset] = useLocalStorage<AdAsset>("campaign_adAsset", null);
  const [regionValid, setRegionValid] = useState(false);
  const [productsValid, setProductsValid] = useState(false);

  useEffect(() => {
    if (!student || !scenario) nav("/");
  }, [student, scenario, nav]);

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
    else nav("/results");
  };

type AdAsset = "product_booster" | "recommendation_ads" | "listing_spotlight" | "brand_booster" | null;

export function CampaignForm() {
  const [currentStep, setCurrentStep] = useLocalStorage("campaign_step", 0);
  const [campaignName, setCampaignName] = useLocalStorage("campaign_name", "");
  const [objective, setObjective] = useLocalStorage<"performance" | "reach" | null>("campaign_objective", null);
  const [adAsset, setAdAsset] = useLocalStorage<AdAsset>("campaign_adAsset", null);
  const [regionValid, setRegionValid] = useState(false);
  const [productsValid, setProductsValid] = useState(false);

  // (handleNext defined above)


  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 pb-2">
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
                 "Brand Booster"}
              </span>
            </>
          )}
        </div>
        <h1 className="text-xl font-semibold text-foreground mt-2">Create new campaign</h1>
      </div>

      {/* Stepper */}
      <div className="px-8 py-6">
        <Stepper currentStep={currentStep} />
      </div>

      {/* Form Content */}
      <div className="flex-1 px-8 overflow-y-auto pb-8">
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
                className="max-w-sm mt-2"
              />
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
                    <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-4 w-4 text-orange-600" />
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
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-blue-600" />
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
                    className={`w-56 p-4 cursor-pointer transition-all border hover:shadow-md ${
                      adAsset === "product_booster" ? "border-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        adAsset === "product_booster" ? "border-primary" : "border-muted-foreground"
                      }`}>
                        {adAsset === "product_booster" && <div className="h-2 w-2 rounded-full bg-primary" />}
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
                    className={`w-56 p-4 cursor-pointer transition-all border hover:shadow-md ${
                      adAsset === "recommendation_ads" ? "border-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        adAsset === "recommendation_ads" ? "border-primary" : "border-muted-foreground"
                      }`}>
                        {adAsset === "recommendation_ads" && <div className="h-2 w-2 rounded-full bg-primary" />}
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
                  {/* Listing Spotlight */}
                  <Card
                    onClick={() => setAdAsset("listing_spotlight")}
                    className={`w-56 p-4 cursor-pointer transition-all border hover:shadow-md ${
                      adAsset === "listing_spotlight" ? "border-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        adAsset === "listing_spotlight" ? "border-primary" : "border-muted-foreground"
                      }`}>
                        {adAsset === "listing_spotlight" && <div className="h-2 w-2 rounded-full bg-primary" />}
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
                    className={`w-56 p-4 cursor-pointer transition-all border hover:shadow-md ${
                      adAsset === "brand_booster" ? "border-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        adAsset === "brand_booster" ? "border-primary" : "border-muted-foreground"
                      }`}>
                        {adAsset === "brand_booster" && <div className="h-2 w-2 rounded-full bg-primary" />}
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

        {currentStep === 1 && adAsset === "listing_spotlight" && (
          <CampaignCollection />
        )}

        {currentStep === 1 && (adAsset === "product_booster" || adAsset === "recommendation_ads") && (
          <ProductBoosterSettings onRegionValid={setRegionValid} />
        )}

        {currentStep === 1 && adAsset !== "listing_spotlight" && adAsset !== "product_booster" && adAsset !== "recommendation_ads" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Ad Settings</h2>
            <p className="text-sm text-muted-foreground mt-2">Configure your ad settings here. (Coming soon)</p>
          </div>
        )}

        {currentStep === 2 && (adAsset === "product_booster" || adAsset === "recommendation_ads") && (
          <ProductBoosterProducts onProductsValid={setProductsValid} />
        )}

        {currentStep === 2 && adAsset !== "product_booster" && adAsset !== "recommendation_ads" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Product Details</h2>
            <p className="text-sm text-muted-foreground mt-2">Add products to your campaign. (Coming soon)</p>
          </div>
        )}

        {currentStep === 3 && adAsset === "product_booster" && (
          <ProductBoosterTargeting />
        )}

        {currentStep === 3 && adAsset === "recommendation_ads" && (
          <RecommendationTargeting />
        )}

        {currentStep === 3 && adAsset !== "product_booster" && adAsset !== "recommendation_ads" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Targeting Options</h2>
            <p className="text-sm text-muted-foreground mt-2">Set your audience targeting. (Coming soon)</p>
          </div>
        )}

        {currentStep === 4 && (adAsset === "product_booster" || adAsset === "recommendation_ads") && (
          <ProductBoosterBudget />
        )}

        {currentStep === 4 && adAsset !== "product_booster" && adAsset !== "recommendation_ads" && (
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
        <Button
          onClick={handleNext}
          disabled={
            (currentStep === 0 && (!objective || !adAsset || !campaignName.trim())) ||
            (currentStep === 1 && (adAsset === "product_booster" || adAsset === "recommendation_ads") && !regionValid) ||
            (currentStep === 2 && (adAsset === "product_booster" || adAsset === "recommendation_ads") && !productsValid)
          }
        >
          {currentStep === 4 ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function PhoneMockup({ type }: { type: "booster" | "recommendation" | "spotlight" | "brand" }) {
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
          {/* Sponsored product listing - like Amazon SP ad */}
          <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-1">
            <div className="flex gap-1">
              <div className="w-8 h-10 rounded bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <div className="w-5 h-6 rounded bg-amber-100" />
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="w-full h-1 rounded bg-gray-200" />
                <div className="w-3/4 h-1 rounded bg-gray-200" />
                <div className="text-[4px] text-gray-400">₹600</div>
                <div className="text-[5px] font-bold text-primary">₹1,699</div>
                <div className="flex items-center gap-0.5">
                  <div className="px-1 py-0.5 rounded bg-primary/20 text-[4px] text-primary">Ad</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-[5px] font-bold text-primary">₹40</div>
              <div className="w-8 h-3 rounded bg-primary flex items-center justify-center">
                <span className="text-[4px] text-white font-medium">ADD</span>
              </div>
            </div>
          </div>
          {/* Regular product tiles grid below */}
          <div className="grid grid-cols-2 gap-1">
            <div className="h-8 rounded bg-gray-50 border border-gray-200" />
            <div className="h-8 rounded bg-gray-50 border border-gray-200" />
            <div className="h-8 rounded bg-gray-50 border border-gray-200" />
            <div className="h-8 rounded bg-gray-50 border border-gray-200" />
          </div>
        </div>
      )}

      {type === "recommendation" && (
        <div className="space-y-1">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div className="text-[5px] font-semibold text-gray-600">Recommended for you</div>
            <div className="text-[4px] text-primary">see all</div>
          </div>
          {/* Horizontal product cards - first one is sponsored/highlighted */}
          <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-1">
            <div className="flex gap-1">
              <div className="w-8 h-10 rounded bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <div className="w-5 h-6 rounded bg-amber-100" />
              </div>
              <div className="flex-1">
                <div className="w-full h-1 rounded bg-gray-200 mb-0.5" />
                <div className="w-3/4 h-1 rounded bg-gray-200 mb-0.5" />
                <div className="text-[4px] text-gray-400">₹600</div>
              </div>
              <div className="w-8 h-10 rounded bg-gray-50 border border-gray-200 shrink-0" />
              <div className="w-8 h-10 rounded bg-gray-50 border border-gray-200 shrink-0" />
            </div>
          </div>
          {/* Price + ADD */}
          <div className="flex items-center justify-between">
            <div className="text-[5px] font-bold text-primary">₹40</div>
            <div className="w-8 h-3 rounded bg-primary flex items-center justify-center">
              <span className="text-[4px] text-white font-medium">ADD</span>
            </div>
          </div>
          {/* More rows below */}
          <div className="space-y-1">
            <div className="h-3 rounded bg-gray-100 border border-gray-200" />
            <div className="flex gap-1">
              <div className="w-9 h-8 rounded bg-gray-50 border border-gray-200" />
              <div className="w-9 h-8 rounded bg-gray-50 border border-gray-200" />
            </div>
          </div>
        </div>
      )}

      {type === "spotlight" && (
        <div className="space-y-1.5">
          <div className="h-14 rounded bg-orange-100 border border-orange-200 flex items-center justify-center">
            <div className="w-8 h-8 rounded bg-orange-200" />
          </div>
          <div className="flex gap-1">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20" />
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20" />
          </div>
          <div className="h-4 rounded bg-primary/10 border border-primary/20" />
        </div>
      )}

      {type === "brand" && (
        <div className="space-y-1.5">
          <div className="h-4 rounded bg-gray-100 border border-gray-200" />
          <div className="flex gap-1">
            <div className="w-7 h-8 rounded bg-primary/10 border border-primary/20" />
            <div className="w-7 h-8 rounded bg-primary/10 border border-primary/20" />
          </div>
          <div className="h-3 rounded bg-gray-100 border border-gray-200 text-[4px] text-gray-400 flex items-center px-1">Shop by brands</div>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-full bg-destructive/30" />
            <div className="w-4 h-4 rounded-full bg-primary/30" />
            <div className="w-4 h-4 rounded-full bg-yellow-300/50" />
            <div className="w-4 h-4 rounded-full bg-orange-300/50" />
          </div>
          <div className="h-6 rounded bg-primary/10 border border-primary/20" />
        </div>
      )}
    </div>
  );
}
