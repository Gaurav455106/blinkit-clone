import { Check } from "lucide-react";

const steps = [
  "Ad Format",
  "Ad Settings",
  "Product details",
  "Targeting Options",
  "Budget Details",
];

interface StepperProps {
  currentStep: number;
}

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="flex items-center w-full max-w-3xl mx-auto">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                i < currentStep
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === currentStep
                  ? "border-primary text-primary bg-card"
                  : "border-border text-muted-foreground bg-card"
              }`}
            >
              {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs whitespace-nowrap ${
                i <= currentStep ? "text-primary font-medium" : "text-muted-foreground"
              }`}
            >
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${
                i < currentStep ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
