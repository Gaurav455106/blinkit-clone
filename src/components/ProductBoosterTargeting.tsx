import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, X } from "lucide-react";

interface SelectedKeyword {
  name: string;
  searches: string;
  bid: string;
  boostMyBid: boolean;
  enterAmount: boolean;
  customAmount: string;
}

const suggestedKeywords = [
  { name: "dry", searches: "4,55,847" },
  { name: "dog food", searches: "2,04,379" },
  { name: "pedi", searches: "61,192" },
  { name: "pedigree", searches: "88,384" },
  { name: "active", searches: "13,920" },
  { name: "purepet dog food", searches: "11,789" },
  { name: "droo", searches: "8,455" },
  { name: "dog foo", searches: "3,282" },
  { name: "pure pet", searches: "4,942" },
  { name: "pupp", searches: "4,392" },
  { name: "dog f", searches: "4,129" },
  { name: "chappi", searches: "5,903" },
  { name: "chappi dog food", searches: "1,822" },
  { name: "drools puppy food", searches: "1,814" },
  { name: "pedigree pro puppy", searches: "1,536" },
  { name: "kibble", searches: "1,355" },
  { name: "drools dog food adult", searches: "1,269" },
  { name: "petcrux", searches: "1,140" },
  { name: "dogs food", searches: "1,067" },
  { name: "drools dry dog food", searches: "826" },
  { name: "drools puppy", searches: "795" },
  { name: "pedigree dry puppy food", searches: "757" },
  { name: "puppy starter food", searches: "589" },
  { name: "purepet puppy food", searches: "466" },
  { name: "royal canin mini puppy", searches: "461" },
  { name: "puppy dry food", searches: "579" },
  { name: "royal canin dog puppy food", searches: "517" },
  { name: "drools", searches: "56,195" },
  { name: "royal", searches: "55,888" },
  { name: "purepet", searches: "54,853" },
  { name: "pet food", searches: "52,750" },
  { name: "royal canin", searches: "28,574" },
  { name: "drools dog food", searches: "25,611" },
  { name: "puppy", searches: "22,141" },
  { name: "drool", searches: "18,717" },
  { name: "royal canin dog food", searches: "17,956" },
  { name: "puppy food", searches: "13,426" },
  { name: "pedigree puppy food", searches: "11,871" },
  { name: "royal canin puppy food", searches: "9,578" },
  { name: "dog food dry", searches: "4,116" },
  { name: "pedigree pro", searches: "3,527" },
  { name: "royal ca", searches: "3,090" },
  { name: "dog feed", searches: "2,570" },
  { name: "pedigree dry dog food", searches: "2,456" },
  { name: "dog puppy food", searches: "2,158" },
  { name: "royal canin starter", searches: "1,755" },
  { name: "dog dry food", searches: "1,749" },
  { name: "dry dog food", searches: "1,558" },
  { name: "henlo", searches: "1,215" },
  { name: "dog food puppy", searches: "980" },
  { name: "royal canin maxi puppy", searches: "652" },
];

const categoryData = [
  { name: "Dog Needs", visits: "-", bid: "2300" },
];

export function ProductBoosterTargeting() {
  const [keywordTargeting, setKeywordTargeting] = useState(true);
  const [categoryTargeting, setCategoryTargeting] = useState(true);
  const [filters, setFilters] = useState({ branded: true, generic: true, event: true });
  const [selectedKeywords, setSelectedKeywords] = useState<SelectedKeyword[]>([
    { name: "royal canin mini starter", searches: "923", bid: "600", boostMyBid: false, enterAmount: false, customAmount: "" },
    { name: "pedigree dog food", searches: "84,062", bid: "2000", boostMyBid: false, enterAmount: false, customAmount: "" },
  ]);
  const [bidTab, setBidTab] = useState<"exact" | "smart">("exact");
  const [manualKeyword, setManualKeyword] = useState("");
  const [negativeKeyword, setNegativeKeyword] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Dog Needs"]);
  const [categoryBids, setCategoryBids] = useState<Record<string, string>>({ "Dog Needs": "2300" });

  const addKeyword = (kw: { name: string; searches: string }) => {
    if (!selectedKeywords.find((s) => s.name === kw.name)) {
      setSelectedKeywords([...selectedKeywords, { ...kw, bid: "1000" }]);
    }
  };

  const removeKeyword = (name: string) => {
    setSelectedKeywords(selectedKeywords.filter((k) => k.name !== name));
  };

  const handleManualAdd = () => {
    if (manualKeyword.trim()) {
      const keywords = manualKeyword.split(",").map((k) => k.trim()).filter(Boolean);
      const newKws = keywords
        .filter((k) => !selectedKeywords.find((s) => s.name === k))
        .map((k) => ({ name: k, searches: "0", bid: "1000" }));
      setSelectedKeywords([...selectedKeywords, ...newKws]);
      setManualKeyword("");
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <p className="text-sm text-muted-foreground">
        You can select multiple targeting options to boost your product across the platform
      </p>

      {/* Keyword Targeting */}
      <div className="rounded-lg border border-border p-5 space-y-5">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={keywordTargeting}
            onCheckedChange={(v) => setKeywordTargeting(!!v)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <h3 className="text-base font-semibold text-foreground">Keyword targeting</h3>
          <Badge variant="outline" className="border-primary text-primary text-xs">Search Listing</Badge>
        </div>
        <p className="text-xs text-muted-foreground -mt-3 ml-7">
          Select this for boosting your products on search keywords
        </p>

        {keywordTargeting && (
          <div className="flex gap-6">
            {/* Left - Suggested keywords */}
            <div className="flex-1 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Suggested keywords</h4>
                <p className="text-xs text-muted-foreground">
                  Pick relevant keywords from our suggestions to target in this campaign
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filters</span>
                {(["branded", "generic", "event"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilters({ ...filters, [f]: !filters[f] })}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
                      filters[f]
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    {f === "branded" ? "Branded keywords" : f === "generic" ? "Generic keywords" : "Event special"}
                    {filters[f] && (
                      <span className="w-3.5 h-3.5 rounded bg-primary text-primary-foreground flex items-center justify-center text-[8px]">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Keyword chips */}
              <div className="flex flex-wrap gap-2 max-h-[340px] overflow-y-auto border border-border rounded-lg p-3">
                {suggestedKeywords.map((kw) => {
                  const isSelected = selectedKeywords.some((s) => s.name === kw.name);
                  return (
                    <button
                      key={kw.name}
                      onClick={() => !isSelected && addKeyword(kw)}
                      className={`px-3 py-1.5 rounded border text-xs transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-card border-border text-foreground hover:border-primary/50"
                      }`}
                    >
                      <div className="font-medium">{kw.name}</div>
                      <div className="text-[10px] text-muted-foreground">({kw.searches} searches)</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">*Approximate no. of searches in the last 30 days</p>

              {/* Manual entry */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Enter keywords manually</h4>
                <p className="text-xs text-muted-foreground">Type specific keywords or add a list separated by commas</p>
                <div className="flex gap-3">
                  <Input
                    value={manualKeyword}
                    onChange={(e) => setManualKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
                    placeholder="Type a keyword & press enter"
                    className="flex-1"
                  />
                  <Button className="gap-2 shrink-0">
                    <Download className="h-4 w-4" />
                    Bulk Upload
                  </Button>
                </div>
              </div>
            </div>

            {/* Right - Selected keywords */}
            <div className="w-[400px] shrink-0">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Selected keywords</h4>
                  <p className="text-xs text-muted-foreground">Your selected keywords will appear here</p>
                </div>

                {/* Bid tabs */}
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground flex-1">Keywords</span>
                  <span className="text-xs text-muted-foreground">Exact Match Bid ⓘ</span>
                  <div className="flex rounded-full border border-border overflow-hidden">
                    <button
                      onClick={() => setBidTab("exact")}
                      className={`px-3 py-1 text-xs font-medium ${
                        bidTab === "exact" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                      }`}
                    >
                      Bid ✏️
                    </button>
                    <button
                      onClick={() => setBidTab("smart")}
                      className={`px-3 py-1 text-xs font-medium ${
                        bidTab === "smart" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                      }`}
                    >
                      Smart Match Bid ▸
                    </button>
                  </div>
                </div>

                {/* Selected keyword rows */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {selectedKeywords.map((kw) => (
                    <div key={kw.name} className="flex items-center gap-2">
                      <button onClick={() => removeKeyword(kw.name)} className="text-destructive shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{kw.name}</div>
                        <div className="text-[10px] text-muted-foreground">({kw.searches} searches)</div>
                      </div>
                      <Input
                        value={`₹ ${kw.bid}`}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setSelectedKeywords(
                            selectedKeywords.map((k) => (k.name === kw.name ? { ...k, bid: val } : k))
                          );
                        }}
                        className="w-24 text-xs"
                      />
                      <label className="flex items-center gap-1 text-[10px] text-primary whitespace-nowrap">
                        <Checkbox className="h-3 w-3" /> Boost my bid
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                        <Checkbox className="h-3 w-3" /> ₹ Enter amount
                      </label>
                    </div>
                  ))}
                </div>

                {selectedKeywords.length > 0 && (
                  <p className="text-[10px] text-muted-foreground text-right">
                    Suggested top bid range: ₹5001 - ₹5233
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Negative keywords */}
      <div className="rounded-lg border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Negative keywords <span className="text-muted-foreground font-normal">(Optional)</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          Your ads will not appear on these searches. Please enter the negative keywords below.
        </p>
        <Input
          value={negativeKeyword}
          onChange={(e) => setNegativeKeyword(e.target.value)}
          placeholder="Type a keyword & press enter"
          className="max-w-lg"
        />
      </div>

      {/* Category Targeting */}
      <div className="rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={categoryTargeting}
            onCheckedChange={(v) => setCategoryTargeting(!!v)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <h3 className="text-base font-semibold text-foreground">Category targeting</h3>
          <Badge variant="outline" className="border-primary text-primary text-xs">Category Listing</Badge>
        </div>
        <p className="text-xs text-muted-foreground -mt-2 ml-7">
          Select this for boosting your products on their category listings
        </p>

        {categoryTargeting && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
              <span>Category</span>
              <span>Number of category visits</span>
              <span>CPM Bid ⓘ</span>
              <span>Suggested top bid range</span>
            </div>
            {categoryData.map((cat) => (
              <div key={cat.name} className="grid grid-cols-4 gap-4 px-4 py-3 items-center text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCategories.includes(cat.name)}
                    onCheckedChange={() => {
                      setSelectedCategories((prev) =>
                        prev.includes(cat.name) ? prev.filter((c) => c !== cat.name) : [...prev, cat.name]
                      );
                    }}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <span className="text-foreground">{cat.name}</span>
                </div>
                <span className="text-muted-foreground">{cat.visits}</span>
                <Input
                  value={`₹ ${categoryBids[cat.name] || cat.bid}`}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setCategoryBids({ ...categoryBids, [cat.name]: val });
                  }}
                  className="w-32 text-sm"
                />
                <span className="text-xs text-muted-foreground">-</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
