import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Info } from "lucide-react";

const cityData: Record<string, string[]> = {
  "Andhra Pradesh": ["Anantapur", "Bhimavaram", "Eluru", "Guntur", "Kakinada", "Kurnool", "Nellore", "Rajahmundry", "Tirupati", "Vijayawada", "Visakhapatnam"],
  "Bihar": ["Bhagalpur", "Gaya", "Muzaffarpur", "Patna"],
  "Chhattisgarh": ["Bhilai", "Raipur"],
  "Delhi": ["New Delhi"],
  "Goa": ["Panaji", "Margao"],
  "Gujarat": ["Ahmedabad", "Gandhinagar", "Rajkot", "Surat", "Vadodara"],
  "Haryana": ["Faridabad", "Gurugram", "Hisar", "Karnal", "Panipat", "Rohtak"],
  "Karnataka": ["Bengaluru", "Hubli", "Mangalore", "Mysore"],
  "Kerala": ["Kochi", "Kozhikode", "Thiruvananthapuram", "Thrissur"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur"],
  "Maharashtra": ["Mumbai", "Nagpur", "Nashik", "Pune", "Thane"],
  "Odisha": ["Bhubaneswar", "Cuttack"],
  "Punjab": ["Amritsar", "Chandigarh", "Jalandhar", "Ludhiana", "Patiala"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Udaipur"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli"],
  "Telangana": ["Hyderabad", "Warangal"],
  "Uttar Pradesh": ["Agra", "Allahabad", "Kanpur", "Lucknow", "Meerut", "Noida", "Varanasi"],
  "West Bengal": ["Asansol", "Durgapur", "Kolkata", "Siliguri"],
};

interface ProductBoosterSettingsProps {
  onRegionValid?: (valid: boolean) => void;
}

export function ProductBoosterSettings({ onRegionValid }: ProductBoosterSettingsProps) {
  const [startDate, setStartDate] = useState("2026-02-09");
  const [noEndDate, setNoEndDate] = useState(true);
  const [regionType, setRegionType] = useState<"pan_india" | "select_cities" | null>(null);
  const [citySearch, setCitySearch] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [expandedStates, setExpandedStates] = useState<string[]>(["Andhra Pradesh"]);
  const [showDropdown, setShowDropdown] = useState(false);

  const updateRegionValid = (type: "pan_india" | "select_cities" | null, cities: string[]) => {
    const valid = type === "pan_india" || (type === "select_cities" && cities.length > 0);
    onRegionValid?.(valid);
  };

  const toggleState = (state: string) => {
    setExpandedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

  const toggleCity = (city: string) => {
    setSelectedCities((prev) => {
      const next = prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city];
      updateRegionValid(regionType, next);
      return next;
    });
  };

  const toggleAllCitiesInState = (state: string) => {
    const cities = cityData[state];
    const allSelected = cities.every((c) => selectedCities.includes(c));
    setSelectedCities((prev) => {
      const next = allSelected ? prev.filter((c) => !cities.includes(c)) : [...new Set([...prev, ...cities])];
      updateRegionValid(regionType, next);
      return next;
    });
  };

  const selectAll = () => {
    const all = Object.values(cityData).flat();
    setSelectedCities((prev) => {
      const next = prev.length === all.length ? [] : all;
      updateRegionValid(regionType, next);
      return next;
    });
  };

  const allCities = Object.values(cityData).flat();
  const filteredStates = Object.keys(cityData).filter((state) => {
    if (!citySearch) return true;
    const q = citySearch.toLowerCase();
    return (
      state.toLowerCase().includes(q) ||
      cityData[state].some((c) => c.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-4xl space-y-8">
      {/* Campaign Duration */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Select campaign duration</h2>
        <p className="text-xs text-muted-foreground">Select the schedule that best suits your audience</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-48 mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="no-end-date"
              checked={noEndDate}
              onCheckedChange={(v) => setNoEndDate(!!v)}
            />
            <label htmlFor="no-end-date" className="text-sm text-foreground cursor-pointer">
              No End Date
            </label>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-600">
              No end date signifies that the campaign is run until the budget is utilised or if stopped manually, billing is done in 1st week of every month.
            </p>
          </div>
        </div>
      </div>

      {/* Campaign Region */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Select campaign region</h2>
        <p className="text-xs text-muted-foreground">Choose locations where your audience is most active</p>

        <div className="mt-4 space-y-3">
          {/* Pan India */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => { setRegionType("pan_india"); updateRegionValid("pan_india", selectedCities); }}
          >
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
              regionType === "pan_india" ? "border-primary" : "border-muted-foreground"
            }`}>
              {regionType === "pan_india" && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <span className="text-sm font-medium text-foreground">Pan India</span>
          </div>

          {/* Select Cities */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => { setRegionType("select_cities"); updateRegionValid("select_cities", selectedCities); }}
          >
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
              regionType === "select_cities" ? "border-primary" : "border-muted-foreground"
            }`}>
              {regionType === "select_cities" && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <span className="text-sm font-medium text-foreground">Select Cities</span>
          </div>

          {regionType === "select_cities" && (
            <div className="relative ml-7 w-72">
              <Input
                placeholder="Select from a list of cities"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                className="border-primary"
              />
              {showDropdown && (
                <div className="absolute z-10 top-full left-0 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {/* Select All */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Checkbox
                      checked={selectedCities.length === allCities.length}
                      onCheckedChange={selectAll}
                    />
                    <span className="text-sm font-medium">Select All</span>
                  </div>

                  {filteredStates.map((state) => {
                    const cities = cityData[state].filter(
                      (c) => !citySearch || c.toLowerCase().includes(citySearch.toLowerCase()) || state.toLowerCase().includes(citySearch.toLowerCase())
                    );
                    if (cities.length === 0) return null;
                    const isExpanded = expandedStates.includes(state);
                    const allStateSelected = cities.every((c) => selectedCities.includes(c));

                    return (
                      <div key={state}>
                        <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50">
                          <span
                            className="text-xs cursor-pointer select-none w-3"
                            onClick={() => toggleState(state)}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </span>
                          <Checkbox
                            checked={allStateSelected}
                            onCheckedChange={() => toggleAllCitiesInState(state)}
                          />
                          <span className="text-sm font-medium">{state}</span>
                        </div>
                        {isExpanded &&
                          cities.map((city) => (
                            <div
                              key={city}
                              className="flex items-center gap-2 pl-10 pr-3 py-1 hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={selectedCities.includes(city)}
                                onCheckedChange={() => toggleCity(city)}
                              />
                              <span className="text-sm">{city}</span>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
