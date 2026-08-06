import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, Search, ChevronDown } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";
import { BLINKIT_STATES, STATE_TO_CITIES } from "@/data/scenarios";

interface ProductBoosterSettingsProps {
  onRegionValid?: (valid: boolean) => void;
  showAdSchedule?: boolean;
  // DOM node to portal the city-picker dropdown into (see popover.tsx) —
  // needed so it stays scrollable inside the enclosing Dialog/Sheet.
  portalContainer?: HTMLElement | null;
}

const TIME_SLOTS = [
  { idx: 0, label: "12 AM - 3 AM" },
  { idx: 1, label: "3 AM - 6 AM" },
  { idx: 2, label: "6 AM - 9 AM" },
  { idx: 3, label: "9 AM - 12 PM" },
  { idx: 4, label: "12 PM - 3 PM" },
  { idx: 5, label: "3 PM - 6 PM" },
  { idx: 6, label: "6 PM - 9 PM" },
  { idx: 7, label: "9 PM - 12 AM" },
];

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const PRESETS = {
  peak: [6],
  daytime: [2, 3, 4, 5],
  "24_7": [0, 1, 2, 3, 4, 5, 6, 7],
} as const;

export function ProductBoosterSettings({ onRegionValid, showAdSchedule = false, portalContainer }: ProductBoosterSettingsProps) {
  const { scenario, cmPitch } = useSim();
  const [startDate, setStartDate] = useLocalStorage("sim_campaign_start_date", "2026-02-09");
  const [noEndDate, setNoEndDate] = useState(true);
  const [endDate, setEndDate] = useLocalStorage("sim_campaign_end_date", "");
  const [regionType, setRegionType] = useLocalStorage<"pan_india" | "select_cities" | null>("sim_geography", null);
  // Engine-facing: STATE names only — this is what stock/OSA/scoring actually key on.
  const [selectedCities, setSelectedCities] = useLocalStorage<string[]>("sim_selected_cities", []);
  // UI-facing: the individual cities the user actually checked. Selecting any city
  // under a state marks that whole state as targeted (the sim has no city-level
  // stock model), so selectedCities above is always derived from this.
  const [selectedCityLeaves, setSelectedCityLeaves] = useLocalStorage<string[]>("sim_selected_city_leaves", []);
  const [dayparting, setDayparting] = useLocalStorage<number[]>("sim_dayparting", [0, 1, 2, 3, 4, 5, 6, 7]);
  const [preset, setPreset] = useLocalStorage<string>("sim_daypart_preset", "24_7");
  const [scheduleType, setScheduleType] = useLocalStorage<"all_days" | "days_of_week">("sim_schedule_type", "all_days");
  const [selectedDays, setSelectedDays] = useLocalStorage<number[]>("sim_selected_days", [0, 1, 2, 3, 4, 5, 6]);
  const [timeSlotEnabled, setTimeSlotEnabled] = useLocalStorage<boolean>("sim_timeslot_enabled", false);
  const [stateSearch, setStateSearch] = useState("");
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);

  useEffect(() => {
    const valid = regionType === "pan_india" || (regionType === "select_cities" && selectedCityLeaves.length > 0);
    onRegionValid?.(valid);
  }, [regionType, selectedCityLeaves, onRegionValid]);

  // Keep the engine-facing state list in sync with whichever cities are checked.
  useEffect(() => {
    const states = Array.from(new Set(selectedCityLeaves.map((leaf) => leaf.split("::")[0])));
    const same = states.length === selectedCities.length && states.every((s) => selectedCities.includes(s));
    if (!same) setSelectedCities(states);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCityLeaves]);

  const cityKey = (state: string, city: string) => `${state}::${city}`;
  const isCitySelected = (state: string, city: string) => selectedCityLeaves.includes(cityKey(state, city));
  const toggleCity = (state: string, city: string) => {
    const key = cityKey(state, city);
    setSelectedCityLeaves((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  };
  const selectedCityCount = selectedCityLeaves.length;

  const applyPreset = (key: keyof typeof PRESETS) => {
    setPreset(key);
    setDayparting([...PRESETS[key]]);
  };

  const toggleBlock = (idx: number) => {
    setPreset("custom");
    setDayparting((prev) => {
      const next = prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a, b) => a - b);
      if (next.length === 0) setTimeSlotEnabled(false);
      else setTimeSlotEnabled(true);
      return next;
    });
  };

  const toggleDay = (d: number) => {
    setSelectedDays((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      if (next.length === 0) setScheduleType("all_days");
      else setScheduleType("days_of_week");
      return next;
    });
  };

  const peakHint = scenario?.profile.peakHours ?? "";

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
            <Checkbox id="no-end-date" checked={noEndDate} onCheckedChange={(v) => { setNoEndDate(!!v); if (v) setEndDate(""); }} />
            <label htmlFor="no-end-date" className="text-sm text-foreground cursor-pointer">No End Date</label>
          </div>
          {!noEndDate && (
            <div>
              <label className="text-xs font-semibold text-foreground">End Date</label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-48 mt-1"
              />
            </div>
          )}
          <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-600">No end date signifies that the campaign is run until the budget is utilised or if stopped manually.</p>
          </div>
        </div>
      </div>

      {/* Campaign Region */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Select campaign region</h2>
        <p className="text-xs text-muted-foreground">Choose locations where your audience is most active</p>

        <div className="mt-4 space-y-4">
          {/* Pan India */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRegionType("pan_india")}>
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              regionType === "pan_india" ? "border-green-600 bg-green-600" : "border-gray-300"
            }`}>
              {regionType === "pan_india" && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <span className="text-sm font-medium text-foreground">Pan India</span>
          </div>

          {/* Select Cities */}
          <div>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRegionType("select_cities")}>
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                regionType === "select_cities" ? "border-green-600 bg-green-600" : "border-gray-300"
              }`}>
                {regionType === "select_cities" && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium text-foreground">Select Cities</span>
            </div>

            {regionType === "select_cities" && (
              <div className="ml-8 mt-3">
                <Popover open={regionPickerOpen} onOpenChange={setRegionPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-between gap-2 w-full max-w-xs border border-border rounded-md px-3 py-2 text-sm bg-background hover:border-primary/50 transition-colors"
                    >
                      <span className={selectedCityCount ? "text-foreground" : "text-muted-foreground"}>
                        {selectedCityCount === 0 ? "Select cities…" : `${selectedCityCount} cit${selectedCityCount === 1 ? "y" : "ies"} selected`}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-0" portalContainer={portalContainer}>
                    {/* Search */}
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        value={stateSearch}
                        onChange={(e) => setStateSearch(e.target.value)}
                        placeholder="Search state or city…"
                        className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
                        autoFocus
                      />
                    </div>

                    {/* State → city list — cities are the selectable unit */}
                    <div className="max-h-72 overflow-y-auto py-1">
                      {BLINKIT_STATES
                        .map((s) => ({ state: s, cities: STATE_TO_CITIES[s] ?? [] }))
                        .filter(({ state, cities }) => {
                          const q = stateSearch.trim().toLowerCase();
                          if (!q) return true;
                          return state.toLowerCase().includes(q) || cities.some((c) => c.name.toLowerCase().includes(q));
                        })
                        .map(({ state, cities }) => {
                          const isApproved = cmPitch?.approvedCities.includes(state) ?? false;
                          const q = stateSearch.trim().toLowerCase();
                          const visibleCities = q && !state.toLowerCase().includes(q)
                            ? cities.filter((c) => c.name.toLowerCase().includes(q))
                            : cities;
                          return (
                            <div key={state}>
                              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                                {isApproved && (
                                  <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 rounded px-1 leading-tight shrink-0">CM ✓</span>
                                )}
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{state}</span>
                              </div>
                              <div>
                                {visibleCities.map((c) => (
                                  <label
                                    key={c.name}
                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={isCitySelected(state, c.name)}
                                      onCheckedChange={() => toggleCity(state, c.name)}
                                      className="shrink-0"
                                    />
                                    <span className="text-sm text-foreground truncate">{c.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </PopoverContent>
                </Popover>

                {selectedCities.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedCityCount} cit{selectedCityCount === 1 ? "y" : "ies"} across {selectedCities.length} state{selectedCities.length === 1 ? "" : "s"} selected
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ad Schedule — Stories only */}
      {showAdSchedule && <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Select ad schedule</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select the days on which you want to run the campaign during the week</p>
        </div>

        {peakHint && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <span className="text-base">💡</span>
            <p className="text-xs text-amber-900">{peakHint}</p>
          </div>
        )}

        {/* All days / Days of week radios */}
        <div className="space-y-2">
          {(["all_days", "days_of_week"] as const).map((type) => (
            <div
              key={type}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setScheduleType(type)}
            >
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                scheduleType === type ? "border-green-600 bg-green-600" : "border-gray-300"
              }`}>
                {scheduleType === type && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium text-foreground">
                {type === "all_days" ? "All days" : "Days of the week"}
              </span>
            </div>
          ))}
        </div>

        {/* Day selector — always clickable; clicking auto-switches to Days of the week */}
        <div className="flex gap-2">
          {DAYS.map((d, i) => {
            const active = scheduleType === "days_of_week" && selectedDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`h-9 w-9 rounded-md border text-sm font-semibold transition-colors ${
                  active
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-border text-foreground hover:border-green-400"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Time-slot section */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setTimeSlotEnabled((v) => !v)}
          >
            <Checkbox
              checked={timeSlotEnabled}
              onCheckedChange={(v) => setTimeSlotEnabled(!!v)}
              className="h-4 w-4 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
            />
            <span className="text-sm font-medium text-foreground">Time-slot</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((slot) => {
              const active = timeSlotEnabled && dayparting.includes(slot.idx);
              return (
                <button
                  key={slot.idx}
                  type="button"
                  disabled={!timeSlotEnabled}
                  onClick={() => toggleBlock(slot.idx)}
                  className={`px-3 py-2.5 rounded-md border text-xs font-medium transition-colors ${
                    !timeSlotEnabled
                      ? "border-border text-muted-foreground bg-muted/20 cursor-default"
                      : active
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-border text-foreground hover:border-green-400"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>}
    </div>
  );
}
