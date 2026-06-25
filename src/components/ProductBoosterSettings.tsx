import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Search } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";
import { BLINKIT_STATES } from "@/data/scenarios";

interface ProductBoosterSettingsProps {
  onRegionValid?: (valid: boolean) => void;
  showAdSchedule?: boolean;
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

export function ProductBoosterSettings({ onRegionValid, showAdSchedule = false }: ProductBoosterSettingsProps) {
  const { scenario, cmPitch } = useSim();
  const [startDate, setStartDate] = useLocalStorage("sim_campaign_start_date", "2026-02-09");
  const [noEndDate, setNoEndDate] = useState(true);
  const [endDate, setEndDate] = useLocalStorage("sim_campaign_end_date", "");
  const [regionType, setRegionType] = useLocalStorage<"pan_india" | "select_cities" | null>("sim_geography", null);
  const [selectedCities, setSelectedCities] = useLocalStorage<string[]>("sim_selected_cities", []);
  const [dayparting, setDayparting] = useLocalStorage<number[]>("sim_dayparting", [0, 1, 2, 3, 4, 5, 6, 7]);
  const [preset, setPreset] = useLocalStorage<string>("sim_daypart_preset", "24_7");
  const [scheduleType, setScheduleType] = useLocalStorage<"all_days" | "days_of_week">("sim_schedule_type", "all_days");
  const [selectedDays, setSelectedDays] = useLocalStorage<number[]>("sim_selected_days", [0, 1, 2, 3, 4, 5, 6]);
  const [timeSlotEnabled, setTimeSlotEnabled] = useLocalStorage<boolean>("sim_timeslot_enabled", false);
  const [stateSearch, setStateSearch] = useState("");

  useEffect(() => {
    const valid = regionType === "pan_india" || (regionType === "select_cities" && selectedCities.length > 0);
    onRegionValid?.(valid);
  }, [regionType, selectedCities, onRegionValid]);

  const toggleState = (state: string) =>
    setSelectedCities((prev) => prev.includes(state) ? prev.filter((x) => x !== state) : [...prev, state]);

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
              <span className="text-sm font-medium text-foreground">Select States</span>
            </div>

            {regionType === "select_cities" && (
              <div className="ml-8 mt-3">
                {/* Search */}
                <div className="flex items-center gap-2 border border-border rounded-md px-3 py-1.5 max-w-xs mb-3 bg-background">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    placeholder="Search states…"
                    className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
                  />
                </div>

                {/* State chip grid */}
                <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                  {BLINKIT_STATES
                    .filter((s) => !stateSearch.trim() || s.toLowerCase().includes(stateSearch.toLowerCase()))
                    .map((s) => {
                      const osa = scenario?.cityStockMap[s] ?? 0;
                      const isApproved = cmPitch?.approvedCities.includes(s) ?? false;
                      const hasBoost = (cmPitch?.osaBoost ?? false) && isApproved;
                      const isSelected = selectedCities.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleState(s)}
                          className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            isSelected
                              ? "ring-2 ring-primary border-primary bg-primary/5 text-foreground"
                              : "border-border bg-background text-foreground hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isApproved && (
                              <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 rounded px-1 leading-tight">CM ✓</span>
                            )}
                            <span>{s}</span>
                          </div>
                          <div className={`text-[10px] font-normal ${
                            osa >= 70 ? "text-green-600" : osa > 0 ? "text-amber-600" : "text-red-500"
                          }`}>
                            {osa > 0 ? `${osa}% OSA${hasBoost ? " +10%↑" : ""}` : "⚠ No stock"}
                          </div>
                        </button>
                      );
                    })}
                </div>

                {selectedCities.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedCities.length} state{selectedCities.length === 1 ? "" : "s"} selected
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
