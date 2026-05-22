import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Info } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";
import { CITIES, CityName } from "@/data/scenarios";

interface ProductBoosterSettingsProps {
  onRegionValid?: (valid: boolean) => void;
}

export function ProductBoosterSettings({ onRegionValid }: ProductBoosterSettingsProps) {
  const { scenario, cmPitch } = useSim();
  const [startDate, setStartDate] = useState("2026-02-09");
  const [noEndDate, setNoEndDate] = useState(true);
  const [regionType, setRegionType] = useLocalStorage<"pan_india" | "select_cities" | null>("sim_geography", null);
  const [selectedCities, setSelectedCities] = useLocalStorage<string[]>("sim_selected_cities", []);

  const approved = cmPitch?.approvedCities ?? [];

  useEffect(() => {
    const valid = regionType === "pan_india" || (regionType === "select_cities" && selectedCities.length > 0);
    onRegionValid?.(valid);
  }, [regionType, selectedCities, onRegionValid]);

  const toggleCity = (c: CityName) => {
    setSelectedCities((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  const showPanIndiaWarning = regionType === "pan_india" && approved.length > 0 && approved.length < CITIES.length;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Campaign Duration */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Select campaign duration</h2>
        <p className="text-xs text-muted-foreground">Select the schedule that best suits your audience</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground">Start Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-48 mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="no-end-date" checked={noEndDate} onCheckedChange={(v) => setNoEndDate(!!v)} />
            <label htmlFor="no-end-date" className="text-sm text-foreground cursor-pointer">No End Date</label>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-600">No end date signifies that the campaign is run until the budget is utilised or if stopped manually.</p>
          </div>
        </div>
      </div>

      {/* Campaign Region */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Select campaign region</h2>
        <p className="text-xs text-muted-foreground">
          Only Category Manager-approved cities can be selected.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRegionType("pan_india")}>
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${regionType === "pan_india" ? "border-primary" : "border-muted-foreground"}`}>
              {regionType === "pan_india" && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <span className="text-sm font-medium text-foreground">Pan India</span>
          </div>

          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRegionType("select_cities")}>
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${regionType === "select_cities" ? "border-primary" : "border-muted-foreground"}`}>
              {regionType === "select_cities" && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <span className="text-sm font-medium text-foreground">Select Cities</span>
          </div>

          {showPanIndiaWarning && (
            <div className="ml-7 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Pan India will only serve in your CM-approved cities ({approved.join(", ")}). Consider selecting cities directly.
            </div>
          )}

          {regionType === "select_cities" && (
            <div className="ml-7 grid grid-cols-2 gap-2 max-w-md">
              {CITIES.map((c) => {
                const isApproved = approved.includes(c as CityName);
                const osa = scenario?.cityStockMap[c as CityName] ?? 0;
                const selected = selectedCities.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    disabled={!isApproved}
                    onClick={() => toggleCity(c as CityName)}
                    title={!isApproved ? "Not approved by Category Manager" : `OSA ${osa}%`}
                    className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors text-left ${
                      !isApproved ? "border-border bg-muted text-muted-foreground/50 cursor-not-allowed" :
                      selected ? "border-primary bg-primary/10 text-primary" :
                      "border-border hover:border-primary/40"
                    }`}
                  >
                    <Checkbox checked={selected} disabled={!isApproved} className="pointer-events-none" />
                    <span className="flex-1">{c}</span>
                    <span className="text-xs text-muted-foreground">{osa}%</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
