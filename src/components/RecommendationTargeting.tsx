import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface SubAsset {
  id: string;
  name: string;
  description: string;
  checked: boolean;
  bid: string;
  suggestedRange: string;
}

interface AssetGroup {
  id: string;
  name: string;
  description?: string;
  checked: boolean;
  bid: string;
  suggestedRange: string;
  children?: SubAsset[];
}

const initialGroups: AssetGroup[] = [
  {
    id: "repeat_order",
    name: "Repeat Order Suggestions",
    checked: true,
    bid: "",
    suggestedRange: "",
    children: [
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
    ],
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
  const [groups, setGroups] = useState<AssetGroup[]>(initialGroups);

  const toggleGroup = (id: string, checked: boolean) => {
    setGroups(groups.map((g) => {
      if (g.id === id) {
        return {
          ...g,
          checked,
          children: g.children?.map((c) => ({ ...c, checked })),
        };
      }
      return g;
    }));
  };

  const toggleChild = (groupId: string, childId: string, checked: boolean) => {
    setGroups(groups.map((g) => {
      if (g.id === groupId && g.children) {
        const updated = g.children.map((c) => (c.id === childId ? { ...c, checked } : c));
        return { ...g, children: updated, checked: updated.every((c) => c.checked) };
      }
      return g;
    }));
  };

  const updateGroupBid = (id: string, value: string) => {
    const val = value.replace(/[^0-9]/g, "");
    setGroups(groups.map((g) => (g.id === id ? { ...g, bid: val } : g)));
  };

  const updateChildBid = (groupId: string, childId: string, value: string) => {
    const val = value.replace(/[^0-9]/g, "");
    setGroups(groups.map((g) => {
      if (g.id === groupId && g.children) {
        return { ...g, children: g.children.map((c) => (c.id === childId ? { ...c, bid: val } : c)) };
      }
      return g;
    }));
  };

  const renderBidInput = (bid: string, onChange: (val: string) => void, range: string) => (
    <div className="space-y-1.5">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
        <Input
          value={bid}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter amount"
          className="pl-6 text-xs h-9"
        />
      </div>
      {range && (
        <div className="text-center">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Suggested bid range: {range}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-6 max-w-6xl">
      {/* Main Panel */}
      <div className="flex-1 bg-card border border-border rounded-lg">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Select asset group</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose the assets on which you would like to run recommendation booster ads
          </p>
        </div>

        <div className="grid grid-cols-[1fr_200px] px-5 py-3 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">Asset</span>
          <span className="text-xs font-medium text-muted-foreground">CPM bid</span>
        </div>

        {groups.map((group) => (
          <div key={group.id} className="border-b border-border last:border-b-0">
            {/* Group row */}
            <div className="grid grid-cols-[1fr_200px] items-center px-5 py-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={group.checked}
                  onCheckedChange={(checked) => toggleGroup(group.id, !!checked)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <div>
                  <span className="text-sm font-semibold text-foreground">{group.name}</span>
                  {group.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                  )}
                </div>
              </div>
              {/* Show bid input for groups without children */}
              {!group.children && group.suggestedRange ? (
                renderBidInput(group.bid, (val) => updateGroupBid(group.id, val), group.suggestedRange)
              ) : (
                <div />
              )}
            </div>

            {/* Children */}
            {group.children?.map((child) => (
              <div
                key={child.id}
                className="grid grid-cols-[1fr_200px] items-start px-5 py-4 border-t border-border"
              >
                <div className="flex items-start gap-3 pl-8">
                  <Checkbox
                    checked={child.checked}
                    onCheckedChange={(checked) => toggleChild(group.id, child.id, !!checked)}
                    className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <div>
                    <h3 className="text-sm font-medium text-foreground">{child.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{child.description}</p>
                  </div>
                </div>
                {renderBidInput(child.bid, (val) => updateChildBid(group.id, child.id, val), child.suggestedRange)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Ad Preview Panel */}
      <div className="w-64 shrink-0">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground">Ad preview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Recommendation ads will appear here</p>

          <div className="mt-4 flex justify-center">
            <div className="w-40 h-64 rounded-2xl border-[3px] border-primary bg-white p-2 relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-center mb-1 px-0.5">
                <div className="text-[5px] text-gray-400 font-medium">9:41</div>
                <div className="flex gap-0.5">
                  <div className="w-2 h-1 rounded-sm bg-gray-300" />
                  <div className="w-1 h-1 rounded-sm bg-gray-300" />
                </div>
              </div>
              <div className="text-[6px] font-semibold text-gray-700 mb-1 px-0.5">Previously Bought</div>
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
              <div className="mt-2 text-center">
                <div className="text-[6px] font-medium text-foreground">Re-targeting</div>
                <div className="text-[5px] text-muted-foreground">Order Again Widget on Homepage</div>
              </div>
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
