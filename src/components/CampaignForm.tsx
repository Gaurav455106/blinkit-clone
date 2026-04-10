import { useState } from "react";
import { Stepper } from "./Stepper";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, TrendingUp, Users } from "lucide-react";

export function CampaignForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState<"performance" | "reach" | null>(null);

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
          <span className="text-foreground font-medium">Create new</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground mt-2">Create new campaign</h1>
      </div>

      {/* Stepper */}
      <div className="px-8 py-6">
        <Stepper currentStep={currentStep} />
      </div>

      {/* Form Content */}
      <div className="flex-1 px-8">
        {currentStep === 0 && (
          <div className="max-w-2xl space-y-8">
            {/* Campaign Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Campaign name <span className="text-destructive">*</span>
              </label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
                className="max-w-md"
              />
            </div>

            {/* Advertising Objective */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Advertising objective <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground">
                Choose the main goal for your campaign
              </p>
              <div className="flex gap-4">
                {/* Performance Card */}
                <Card
                  onClick={() => setObjective("performance")}
                  className={`flex-1 p-5 cursor-pointer transition-all border-2 hover:shadow-md ${
                    objective === "performance"
                      ? "border-primary bg-accent"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      objective === "performance" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">Performance</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Bid to maximise clicks and conversions for your products
                      </p>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      objective === "performance" ? "border-primary" : "border-border"
                    }`}>
                      {objective === "performance" && (
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                </Card>

                {/* Reach Card */}
                <Card
                  onClick={() => setObjective("reach")}
                  className={`flex-1 p-5 cursor-pointer transition-all border-2 hover:shadow-md ${
                    objective === "reach"
                      ? "border-primary bg-accent"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      objective === "reach" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">Reach</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pay a fixed amount to show your ads to maximum shoppers
                      </p>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      objective === "reach" ? "border-primary" : "border-border"
                    }`}>
                      {objective === "reach" && (
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
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
      <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-card">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button onClick={handleNext} disabled={currentStep === 4 || (currentStep === 0 && (!campaignName || !objective))}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
