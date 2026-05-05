import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Smartphone } from "lucide-react";

interface AssetItem {
  id: string;
  name: string;
  description: string;
  checked: boolean;
  bid: string;
  suggestedRange: string;
}

const initialAssets: AssetItem[] = [
  {
    id: "retargeting",
    name: "Re-targeting",
    description: "Boost repeat purchases by highlighting previously bought products",
    checked: true,
    bid: "",
    suggestedRange: "₹501 - ₹581",
  },
  {
    id: "new_user",
    name: "New User Targeting",
    description: "Attract new customers by promoting products based on their past picks",
    checked: true,
    bid: "",
    suggestedRange: "₹185 - ₹2035",
  },
  {
    id: "cart",
    name: "Cart Recommendations",
    description: "Assist cross-selling by showcasing products that pair well with cart items",
    checked: true,
    bid: "",
    suggestedRange: "₹520 - ₹552",
  },
  {
    id: "next_product",
    name: "Next Product Recommendations",
    description: "Maximize cross-sell with instant suggestions for complementary products",
    checked: true,
    bid: "",
    suggestedRange: "₹500 - ₹510",
  },
  {
    id: "similar",
    name: "Similar Product Recommendations",
    description: "Increase product visibility by featuring your products on related product pages",
    checked: true,
    bid: "",
    suggestedRange: "₹530 - ₹550",
  },
];

export function RecommendationTargeting() {
  const [selectAll, setSelectAll] = useState(true);
  const [assets, setAssets] = useState<AssetItem[]>(initialAssets);

  const toggleAll = (checked: boolean) => {
    setSelectAll(checked);
    setAssets(assets.map((a) => ({ ...a, checked })));
  };

  const toggleAsset = (id: string, checked: boolean) => {
    const updated = assets.map((a) => (a.id === id ? { ...a, checked } : a));
    setAssets(updated);
    setSelectAll(updated.every((a) => a.checked));
  };

  const updateBid = (id: string, value: string) => {
    const val = value.replace(/[^0-9]/g, "");
    setAssets(assets.map((a) => (a.id === id ? { ...a, bid: val } : a)));
  };

  return (
    <div className="flex gap-6 max-w-6xl">
      {/* Main Panel */}
      <div className="flex-1 bg-card border border-border rounded-lg">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Select asset group</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose the assets on which you would like to run recommendation booster ads
          </p>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_200px] px-5 py-3 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">Asset</span>
          <span className="text-xs font-medium text-muted-foreground">CPM bid</span>
        </div>

        {/* Select All Row */}
        <div className="grid grid-cols-[1fr_200px] items-center px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectAll}
              onCheckedChange={(checked) => toggleAll(!!checked)}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="text-sm font-semibold text-foreground">Repeat Order Suggestions</span>
          </div>
          <div />
        </div>

        {/* Asset Rows */}
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="grid grid-cols-[1fr_200px] items-start px-5 py-4 border-b border-border last:border-b-0"
          >
            <div className="flex items-start gap-3 pl-6">
              <Checkbox
                checked={asset.checked}
                onCheckedChange={(checked) => toggleAsset(asset.id, !!checked)}
                className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <div>
                <h3 className="text-sm font-medium text-foreground">{asset.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{asset.description}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  value={asset.bid}
                  onChange={(e) => updateBid(asset.id, e.target.value)}
                  placeholder="Enter amount"
                  className="pl-6 text-xs h-9"
                />
              </div>
              <div className="text-center">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  Suggested bid range: {asset.suggestedRange}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ad Preview Panel */}
      <div className="w-64 shrink-0">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground">Ad preview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Recommendation ads will appear here</p>

          <div className="mt-4 flex justify-center">
            {/* Phone mockup */}
            <div className="w-40 h-64 rounded-2xl border-[3px] border-primary bg-white p-2 relative overflow-hidden shadow-sm">
              {/* Status bar */}
              <div className="flex justify-between items-center mb-1 px-0.5">
                <div className="text-[5px] text-gray-400 font-medium">9:41</div>
                <div className="flex gap-0.5">
                  <div className="w-2 h-1 rounded-sm bg-gray-300" />
                  <div className="w-1 h-1 rounded-sm bg-gray-300" />
                </div>
              </div>
              {/* Header */}
              <div className="text-[6px] font-semibold text-gray-700 mb-1 px-0.5">Previously Bought</div>
              {/* Product card */}
              <div className="rounded-md border border-gray-200 p-1.5 space-y-1">
                <div className="w-full h-16 rounded bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <div className="w-8 h-10 rounded bg-amber-200/60" />
                </div>
                <div className="space-y-0.5">
                  <div className="w-full h-1 rounded bg-gray-200" />
                  <div className="w-3/4 h-1 rounded bg-gray-200" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[6px] font-bold text-foreground">₹40</div>
                  <div className="w-10 h-4 rounded bg-primary flex items-center justify-center">
                    <span className="text-[5px] text-white font-medium">ADD</span>
                  </div>
                </div>
              </div>
              {/* Label */}
              <div className="mt-2 text-center">
                <div className="text-[6px] font-medium text-foreground">Re-targeting</div>
                <div className="text-[5px] text-muted-foreground">Order Again Widget on Homepage</div>
              </div>
              {/* Dots */}
              <div className="flex justify-center gap-1 mt-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="w-1 h-1 rounded-full bg-gray-300" />
                <div className="w-1 h-1 rounded-full bg-gray-300" />
                <div className="w-1 h-1 rounded-full bg-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
