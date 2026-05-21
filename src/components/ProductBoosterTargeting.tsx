import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";

export function ProductBoosterTargeting() {
  const { scenario } = useSim();
  const [keywordTargeting, setKeywordTargeting] = useState(true);
  const [categoryTargeting, setCategoryTargeting] = useState(true);
  const [selectedKeywords, setSelectedKeywords] = useLocalStorage<string[]>("sim_selected_keywords", []);
  const [manualKeyword, setManualKeyword] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (scenario && selectedCategories.length === 0) {
      setSelectedCategories([scenario.profile.relevantCategories[0]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  if (!scenario) return null;
  const { profile } = scenario;

  // Mix good + risky in display, but DO NOT show "risky" label visually
  const allSuggested = [
    ...profile.goodKeywords.map((k) => ({ name: k, risky: false })),
    ...profile.riskyKeywords.map((k) => ({ name: k, risky: true })),
  ];

  const add = (k: string) => {
    if (!selectedKeywords.includes(k)) setSelectedKeywords([...selectedKeywords, k]);
  };
  const remove = (k: string) => setSelectedKeywords(selectedKeywords.filter((x) => x !== k));

  const handleManual = () => {
    if (!manualKeyword.trim()) return;
    const next = manualKeyword.split(",").map((s) => s.trim()).filter(Boolean);
    setSelectedKeywords([...new Set([...selectedKeywords, ...next])]);
    setManualKeyword("");
  };

  return (
    <div className="max-w-6xl space-y-6">
      <p className="text-sm text-muted-foreground">
        You can select multiple targeting options to boost your product across the platform
      </p>

      {/* Keyword Targeting */}
      <div className="rounded-lg border border-border p-5 space-y-5">
        <div className="flex items-center gap-3">
          <Checkbox checked={keywordTargeting} onCheckedChange={(v) => setKeywordTargeting(!!v)} />
          <h3 className="text-base font-semibold text-foreground">Keyword targeting</h3>
          <Badge variant="outline" className="border-primary text-primary text-xs">Search Listing</Badge>
        </div>

        {keywordTargeting && (
          <div className="flex gap-6">
            <div className="flex-1 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Suggested keywords</h4>
                <p className="text-xs text-muted-foreground">
                  Pick relevant keywords for {profile.name} — not every suggestion is a good fit
                </p>
              </div>
              <div className="flex flex-wrap gap-2 border border-border rounded-lg p-3">
                {allSuggested.map((kw) => {
                  const isSel = selectedKeywords.includes(kw.name);
                  return (
                    <button
                      key={kw.name}
                      onClick={() => !isSel && add(kw.name)}
                      className={`px-3 py-1.5 rounded border text-xs transition-colors ${
                        isSel
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-card border-border text-foreground hover:border-primary/50"
                      }`}
                    >
                      {kw.name}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Enter keywords manually</h4>
                <Input
                  value={manualKeyword}
                  onChange={(e) => setManualKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManual()}
                  placeholder="Type a keyword & press enter"
                  className="max-w-md"
                />
              </div>
            </div>

            <div className="w-[360px] shrink-0">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Selected keywords</h4>
                <p className="text-xs text-muted-foreground">{selectedKeywords.length} keywords</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedKeywords.map((k) => (
                    <div key={k} className="flex items-center gap-2 px-2 py-1.5 rounded bg-accent">
                      <span className="text-xs flex-1">{k}</span>
                      <button onClick={() => remove(k)} className="text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {selectedKeywords.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No keywords yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Targeting */}
      <div className="rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox checked={categoryTargeting} onCheckedChange={(v) => setCategoryTargeting(!!v)} />
          <h3 className="text-base font-semibold text-foreground">Category targeting</h3>
          <Badge variant="outline" className="border-primary text-primary text-xs">Category Listing</Badge>
        </div>

        {categoryTargeting && (
          <div className="space-y-2">
            {profile.relevantCategories.map((cat) => {
              const sel = selectedCategories.includes(cat);
              return (
                <label key={cat} className="flex items-center gap-3 p-3 border border-border rounded cursor-pointer hover:border-primary/40">
                  <Checkbox
                    checked={sel}
                    onCheckedChange={() =>
                      setSelectedCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])
                    }
                  />
                  <span className="text-sm text-foreground">{cat}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
