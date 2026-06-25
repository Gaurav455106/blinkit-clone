import { useEffect, useState } from "react";
import { useSim } from "@/context/SimContext";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  onBrandsValid?: (v: boolean) => void;
}

export function BrandBoosterBrands({ onBrandsValid }: Props) {
  const { scenario } = useSim();
  const [selected, setSelected] = useState(true); // brand pre-selected

  const profile = scenario?.profile;
  const productCount = profile?.skus?.length ?? 0;

  useEffect(() => {
    onBrandsValid?.(selected);
  }, [selected]);

  if (!profile) return null;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Select campaign brands</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose the brands you want to boost through this campaign. You can select multiple brands mapped to your advertiser ID.
        </p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {/* Header row */}
        <div className="grid grid-cols-[40px_60px_1fr_160px] items-center px-4 py-3 border-b border-border bg-muted/30">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => setSelected(!!v)}
            className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
          <div />
          <span className="text-sm font-semibold text-foreground">
            Brand name{selected ? " (1 selected)" : ""}
          </span>
          <span className="text-sm font-semibold text-foreground">Number of products</span>
        </div>

        {/* Brand row */}
        <div className="grid grid-cols-[40px_60px_1fr_160px] items-center px-4 py-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => setSelected(!!v)}
            className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
          {/* Brand logo placeholder */}
          <div className="h-10 w-10 rounded border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            <span className="text-[9px] font-bold text-muted-foreground text-center leading-tight px-0.5">
              {profile.name.slice(0, 6)}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">{profile.name}</span>
          <span className="text-sm text-foreground">{productCount}</span>
        </div>
      </div>
    </div>
  );
}
