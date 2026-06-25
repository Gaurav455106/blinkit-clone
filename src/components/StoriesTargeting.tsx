import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Pencil, X } from "lucide-react";

interface Props {
  onTargetingValid?: (v: boolean) => void;
}

// ── CPM multiplier tables ────────────────────────────────────────────────────
const TIME_MULTIPLIERS: Record<number, number> = {
  0: 0.80, 1: 0.80, 2: 1.00, 3: 1.10,
  4: 1.10, 5: 1.20, 6: 1.40, 7: 1.15,
};
const DAY_MULTIPLIERS: Record<number, number> = {
  0: 1.20, 1: 1.00, 2: 1.00, 3: 1.05,
  4: 1.05, 5: 1.15, 6: 1.25,
};
function computeMultiplier(
  scheduleType: "all_days" | "days_of_week",
  selectedDays: number[],
  timeSlotEnabled: boolean,
  dayparting: number[],
): number {
  let dayMult = 1.0;
  if (scheduleType === "days_of_week" && selectedDays.length > 0)
    dayMult = selectedDays.reduce((s, d) => s + DAY_MULTIPLIERS[d], 0) / selectedDays.length;
  let timeMult = 1.0;
  if (timeSlotEnabled && dayparting.length > 0)
    timeMult = dayparting.reduce((s, t) => s + (TIME_MULTIPLIERS[t] ?? 1.0), 0) / dayparting.length;
  return dayMult * timeMult;
}
function roundCpm(base: number, mult: number): number {
  return Math.round((base * mult) / 25) * 25;
}

const READY_MADE_COHORTS = [
  "Female Customers", "Male Customers", "Grocery Users",
  "Health Enthusiast Buyers", "Parents - Toddler and Infants",
  "Parents - Kids", "New Customers", "Repeat Buyers",
];
const USER_ACTIONS = ["Purchased", "Browsed did not purchase", "Not browsed"];
const PERIODS = ["Last 3 months", "Last 6 months", "Last 12 months"];

// ── Generic multi-select dropdown ────────────────────────────────────────────
function MultiSelectDropdown({ placeholder, options, selected, onChange }: {
  placeholder: string; options: string[]; selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
  const allSel = options.length > 0 && options.every((o) => selected.includes(o));
  const label = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between w-full px-3 py-2 border border-border rounded-md bg-background text-sm gap-2">
        <span className={selected.length === 0 ? "text-muted-foreground" : "text-foreground"}>{label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-background border border-border rounded-md shadow-lg py-1 max-h-56 overflow-y-auto">
          <label className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 cursor-pointer">
            <Checkbox checked={allSel} onCheckedChange={() => onChange(allSel ? [] : [...options])}
              className="h-4 w-4 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" />
            <span className="text-sm">Select All</span>
          </label>
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 cursor-pointer">
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)}
                className="h-4 w-4 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" />
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Simple single-select dropdown ────────────────────────────────────────────
function SelectDropdown({ placeholder, options, value, onChange }: {
  placeholder: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between w-full px-3 py-2 border border-border rounded-md bg-background text-sm gap-2">
        <span className={!value ? "text-muted-foreground" : "text-foreground"}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-md shadow-lg py-1">
          {options.map((opt) => (
            <button key={opt} type="button"
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-muted/40 ${value === opt ? "text-green-600 font-medium" : "text-foreground"}`}
              onClick={() => { onChange(opt); setOpen(false); }}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function StoriesTargeting({ onTargetingValid }: Props) {
  const { scenario } = useSim();
  const profile = scenario?.profile;

  const [scheduleType] = useLocalStorage<"all_days" | "days_of_week">("sim_schedule_type", "all_days");
  const [selectedDays] = useLocalStorage<number[]>("sim_selected_days", [0,1,2,3,4,5,6]);
  const [timeSlotEnabled] = useLocalStorage<boolean>("sim_timeslot_enabled", false);
  const [dayparting] = useLocalStorage<number[]>("sim_dayparting", [0,1,2,3,4,5,6,7]);
  const [selectedFeeds, setSelectedFeeds] = useLocalStorage<string[]>("sim_story_feeds", []);

  // Audience
  const [audienceOpen, setAudienceOpen] = useLocalStorage<boolean>("sim_audience_open", true);
  const [audienceType, setAudienceType] = useLocalStorage<"ready" | "custom" | "">("sim_audience_type", "");
  const [selectedCohorts, setSelectedCohorts] = useLocalStorage<string[]>("sim_audience_cohorts", []);
  const [userAction, setUserAction] = useLocalStorage<string>("sim_audience_action", "Purchased");
  const [period, setPeriod] = useLocalStorage<string>("sim_audience_period", "");
  const [selectedCats, setSelectedCats] = useLocalStorage<string[]>("sim_audience_cats", []);
  const [selectedBrands, setSelectedBrands] = useLocalStorage<string[]>("sim_audience_brands", []);

  useEffect(() => {
    if (profile && selectedBrands.length === 0) setSelectedBrands([profile.name]);
  }, [profile?.name]);

  const multiplier = useMemo(
    () => computeMultiplier(scheduleType, selectedDays, timeSlotEnabled, dayparting),
    [scheduleType, selectedDays, timeSlotEnabled, dayparting]
  );

  const feeds = useMemo(() => {
    const cats = profile?.relevantCategories ?? [];
    return [
      { id: "main-feed", label: "Main Feed", baseCpm: 500 },
      ...cats.slice(0, 2).map((c, i) => ({ id: `feed-cat-${i}`, label: `Feed - ${c}`, baseCpm: 625 })),
    ];
  }, [profile?.relevantCategories]);

  // CPM overrides (user-edited)
  const [cpmOverrides, setCpmOverrides] = useLocalStorage<Record<string, string>>("sim_cpm_overrides", {});
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);

  const getCpm = (feed: { id: string; baseCpm: number }) => {
    if (cpmOverrides[feed.id] !== undefined) return Number(cpmOverrides[feed.id]);
    return roundCpm(feed.baseCpm, multiplier);
  };

  // Audience validity: if Main Feed selected, audience must be complete
  const mainFeedSelected = selectedFeeds.includes("main-feed");
  const audienceValid = !mainFeedSelected || (
    audienceType === "ready" ? selectedCohorts.length > 0 :
    audienceType === "custom" ? period !== "" :
    false
  );
  const isValid = selectedFeeds.length > 0 && audienceValid;
  useEffect(() => { onTargetingValid?.(isValid); }, [isValid]);

  const toggleFeed = (id: string) =>
    setSelectedFeeds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const allChecked = feeds.every((f) => selectedFeeds.includes(f.id));

  const cpmNote = useMemo(() => {
    const notes: string[] = [];
    if (scheduleType === "days_of_week" && selectedDays.length > 0) {
      notes.push(selectedDays.some((d) => d === 0 || d === 6) ? "Weekend premium applied" : "Weekday pricing");
    }
    if (timeSlotEnabled && dayparting.length > 0) {
      if (dayparting.includes(6)) notes.push("Peak hour premium");
      else if (dayparting.every((d) => d === 0 || d === 1)) notes.push("Off-peak discount");
    }
    return notes.join(" · ");
  }, [scheduleType, selectedDays, timeSlotEnabled, dayparting]);

  const handleReset = () => {
    setAudienceType("");
    setSelectedCohorts([]);
    setUserAction("Purchased");
    setPeriod("");
    setSelectedCats([]);
    setSelectedBrands(profile ? [profile.name] : []);
  };

  const categoryOptions = profile?.relevantCategories ?? [];
  const brandOptions = profile ? [profile.name] : [];

  if (!profile) return null;

  return (
    <div className="max-w-3xl space-y-4">
      {/* ── Single card: Feed Targeting + audience sub-section ── */}
      <div className="border border-border rounded-lg bg-card">

        {/* Card header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <Checkbox
            checked={allChecked}
            onCheckedChange={() => setSelectedFeeds(allChecked ? [] : feeds.map((f) => f.id))}
            className="h-5 w-5 mt-0.5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
          <div>
            <p className="text-base font-bold text-foreground">Feed Targeting</p>
            <p className="text-sm text-muted-foreground">Pick the feed where you want your campaign to be shown</p>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_200px] items-center px-5 py-2.5 border-b border-border bg-muted/20">
          <div />
          <span className="text-sm font-semibold text-foreground">Feed</span>
          <span className="text-sm font-semibold text-foreground">CPM bid</span>
        </div>

        {/* Feed rows */}
        {feeds.map((feed) => {
          const checked = selectedFeeds.includes(feed.id);
          const cpm = getCpm(feed);
          const isMainFeed = feed.id === "main-feed";
          const showAudience = isMainFeed && checked;
          const isEditing = editingFeedId === feed.id;

          return (
            <div key={feed.id} className="border-b border-border last:border-b-0">
              {/* Row */}
              <div
                className="grid grid-cols-[40px_1fr_200px] items-center px-5 py-4 hover:bg-muted/20 cursor-pointer"
                onClick={() => toggleFeed(feed.id)}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleFeed(feed.id)}
                  className="h-5 w-5 pointer-events-none data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                />
                <span className="text-sm font-medium text-foreground">{feed.label}</span>
                {/* CPM cell */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <input
                      autoFocus
                      type="number"
                      className="w-24 px-2 py-1 border border-green-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      defaultValue={cpm}
                      onChange={(e) => setCpmOverrides((prev) => ({ ...prev, [feed.id]: e.target.value }))}
                      onBlur={() => setEditingFeedId(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") setEditingFeedId(null); }}
                    />
                  ) : (
                    <>
                      <span className="text-sm text-foreground">₹ {cpm.toLocaleString("en-IN")}</span>
                      {checked && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingFeedId(feed.id); }}
                          className="p-1 rounded border border-green-300 text-green-600 hover:bg-green-50"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Audience sub-section — only under Main Feed when checked */}
              {showAudience && (
                <div className="mx-5 mb-4 border border-green-300 rounded-lg bg-green-50/30">
                  {/* Audience header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-green-200">
                    <div>
                      <p className="text-sm font-bold text-foreground">Choose your audience</p>
                      <p className="text-xs text-muted-foreground">Use a ready-made cohort for quick setup, or create your own for full control</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleReset(); }}
                        className="text-sm font-medium text-green-600 hover:text-green-700">Reset</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setAudienceOpen((p) => !p); }}>
                        {audienceOpen
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  {audienceOpen && (
                    <div className="px-4 py-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                      {/* Radio: ready-made */}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="audience-type" checked={audienceType === "ready"}
                          onChange={() => setAudienceType("ready")} className="h-4 w-4 accent-green-600" />
                        <span className="text-sm font-medium text-foreground">Select a ready-made cohort</span>
                        {audienceType === "ready" && (
                          <div className="ml-auto w-56">
                            <MultiSelectDropdown placeholder="Select user segment"
                              options={READY_MADE_COHORTS} selected={selectedCohorts} onChange={setSelectedCohorts} />
                          </div>
                        )}
                      </label>

                      {/* Radio: custom cohort */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="radio" name="audience-type" checked={audienceType === "custom"}
                            onChange={() => setAudienceType("custom")} className="h-4 w-4 accent-green-600" />
                          <span className="text-sm font-medium text-foreground">Create a custom cohort</span>
                        </label>

                        {audienceType === "custom" && (
                          <div className="ml-7 space-y-3">
                            <div className="grid grid-cols-4 gap-3">
                              <div>
                                <p className="text-xs font-semibold text-foreground mb-1">User action</p>
                                <SelectDropdown placeholder="Select action" options={USER_ACTIONS}
                                  value={userAction} onChange={setUserAction} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-foreground mb-1">In the period</p>
                                <SelectDropdown placeholder="Select period" options={PERIODS}
                                  value={period} onChange={setPeriod} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <Checkbox checked={selectedCats.length > 0}
                                    onCheckedChange={(v) => !v && setSelectedCats([])}
                                    className="h-3.5 w-3.5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" />
                                  <p className="text-xs font-semibold text-foreground">From categories</p>
                                </div>
                                <MultiSelectDropdown placeholder="Select Category(s)"
                                  options={categoryOptions} selected={selectedCats} onChange={setSelectedCats} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <Checkbox checked={selectedBrands.length > 0}
                                    onCheckedChange={(v) => !v && setSelectedBrands([])}
                                    className="h-3.5 w-3.5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" />
                                  <p className="text-xs font-semibold text-foreground">From brands</p>
                                </div>
                                <MultiSelectDropdown placeholder="Select Brand(s)"
                                  options={brandOptions} selected={selectedBrands} onChange={setSelectedBrands} />
                              </div>
                            </div>

                            {/* Selected categories chips */}
                            <div className="border border-border rounded-md bg-background p-3 min-h-[52px]">
                              {selectedCats.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center">Selected categories will show here</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {selectedCats.map((cat) => (
                                    <span key={cat}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-700">
                                      {cat}
                                      <button type="button" onClick={() => setSelectedCats((p) => p.filter((c) => c !== cat))}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cpmNote && <p className="text-xs text-amber-600 font-medium">💡 {cpmNote}</p>}
      {!isValid && <p className="text-xs text-red-500">*Please select at least one feed to continue</p>}
    </div>
  );
}
