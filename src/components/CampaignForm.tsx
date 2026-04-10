import { useState } from "react";
import { Stepper } from "./Stepper";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, TrendingUp, Users, Smartphone } from "lucide-react";

type AdAsset = "product_booster" | "recommendation_ads" | null;

export function CampaignForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState<"performance" | "reach" | null>(null);
  const [adAsset, setAdAsset] = useState<AdAsset>(null);

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="px-8 pt-6 pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Ad Campaign</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-primary font-medium">Create new</span>
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
                  <Card className="w-56 p-4 border-border opacity-60">
                    <p className="text-sm text-muted-foreground text-center py-8">Reach ad formats coming soon</p>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 1 && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Ad Settings</h2>
            <p className="text-sm text-muted-foreground mt-2">Configure your ad settings here. (Coming soon)</p>
          </div>
        )}

        {currentStep === 2 && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Product Details</h2>
            <p className="text-sm text-muted-foreground mt-2">Add products to your campaign. (Coming soon)</p>
          </div>
        )}

        {currentStep === 3 && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Targeting Options</h2>
            <p className="text-sm text-muted-foreground mt-2">Set your audience targeting. (Coming soon)</p>
          </div>
        )}

        {currentStep === 4 && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-foreground">Budget Details</h2>
            <p className="text-sm text-muted-foreground mt-2">Set your campaign budget. (Coming soon)</p>
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-border bg-card">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="bg-muted text-muted-foreground hover:bg-muted/80"
        >
          Previous
        </Button>
        <Button onClick={handleNext} disabled={currentStep === 4 || (currentStep === 0 && (!campaignName || !objective))}>
          Next
        </Button>
      </div>
    </div>
  );
}

function PhoneMockup({ type }: { type: "booster" | "recommendation" }) {
  return (
    <div className="w-24 h-44 rounded-xl border-2 border-yellow-400 bg-accent/30 p-1.5 relative overflow-hidden">
      {/* Status bar */}
      <div className="flex justify-between items-center mb-1">
        <div className="w-6 h-0.5 rounded bg-muted-foreground/30" />
        <div className="w-3 h-0.5 rounded bg-muted-foreground/30" />
      </div>
      {/* Search bar */}
      <div className="h-3 rounded-sm bg-primary/10 border border-primary/20 mb-2" />
      {/* Content */}
      {type === "booster" ? (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            <div className="w-8 h-10 rounded bg-primary/10 border border-primary/20" />
            <div className="w-8 h-10 rounded bg-orange-100 border border-orange-200" />
          </div>
          <div className="flex gap-1">
            <div className="w-8 h-10 rounded bg-primary/10 border border-primary/20" />
            <div className="w-8 h-10 rounded bg-primary/10 border border-primary/20" />
          </div>
          <div className="h-5 rounded bg-primary/20 flex items-center justify-center">
            <span className="text-[5px] text-primary font-medium">Ad</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="h-4 rounded bg-muted border border-border" />
          <div className="flex gap-1">
            <div className="w-7 h-9 rounded bg-primary/10 border border-primary/20" />
            <div className="w-7 h-9 rounded bg-primary/10 border border-primary/20" />
            <div className="w-7 h-9 rounded bg-orange-100 border border-orange-200" />
          </div>
          <div className="h-3 rounded bg-muted border border-border" />
          <div className="flex gap-1">
            <div className="w-7 h-9 rounded bg-primary/10 border border-primary/20" />
            <div className="w-7 h-9 rounded bg-primary/10 border border-primary/20" />
          </div>
        </div>
      )}
    </div>
  );
}
