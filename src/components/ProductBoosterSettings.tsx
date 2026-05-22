import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Clock, ChevronDown, X } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";
import { BLINKIT_STATES, StateName } from "@/data/scenarios";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface ProductBoosterSettingsProps {
  onRegionValid?: (valid: boolean) => void;
}

const HOUR_BLOCKS = [
  { idx: 0, label: "6-9 AM", hint: "Early Morning" },
  { idx: 1, label: "9 AM-12 PM", hint: "Morning" },
  { idx: 2, label: "12-3 PM", hint: "Afternoon" },
  { idx: 3, label: "3-6 PM", hint: "Late Afternoon" },
  { idx: 4, label: "6-9 PM", hint: "Evening — PEAK" },
  { idx: 5, label: "9 PM-12 AM", hint: "Night" },
  { idx: 6, label: "12-3 AM", hint: "Late Night" },
  { idx: 7, label: "3-6 AM", hint: "Dead Hours" },
];

const PRESETS = {
  peak: [4],
  daytime: [1, 2, 3, 4],
  "24_7": [0, 1, 2, 3, 4, 5, 6, 7],
} as const;

export function ProductBoosterSettings({ onRegionValid }: ProductBoosterSettingsProps) {
  const { scenario } = useSim();
  const [startDate, setStartDate] = useState("2026-02-09");
  const [noEndDate, setNoEndDate] = useState(true);
  const [regionType, setRegionType] = useLocalStorage<"pan_india" | "select_cities" | null>("sim_geography", null);
  const [selectedStates, setSelectedStates] = useLocalStorage<string[]>("sim_selected_cities", []);
  const [dayparting, setDayparting] = useLocalStorage<number[]>("sim_dayparting", [0, 1, 2, 3, 4, 5, 6, 7]);
  const [preset, setPreset] = useLocalStorage<string>("sim_daypart_preset", "24_7");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const valid = regionType === "pan_india" || (regionType === "select_cities" && selectedStates.length > 0);
    onRegionValid?.(valid);
  }, [regionType, selectedStates, onRegionValid]);

  const toggleState = (s: StateName) =>
    setSelectedStates((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const applyPreset = (key: keyof typeof PRESETS) => {
    setPreset(key);
    setDayparting([...PRESETS[key]]);
  };

  const toggleBlock = (idx: number) => {
    setPreset("custom");
    setDayparting((prev) => prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a, b) => a - b));
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
            <Checkbox id="no-end-date" checked={noEndDate} onCheckedChange={(v) => setNoEndDate(!!v)} />
            <label htmlFor="no-end-date" className="text-sm text-foreground cursor-pointer">No End Date</label>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-600">No end date signifies that the campaign is run until the budget is utilised or if stopped manually.</p>
          </div>
        </div>
      </div>

      {/* Campaign Region (STATES) */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Select campaign region</h2>
        <p className="text-xs text-muted-foreground">
          Choose where your ads will deliver. All Blinkit-operational states are available.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRegionType("pan_india")}>
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${regionType === "pan_india" ? "border-primary" : "border-muted-foreground"}`}>
              {regionType === "pan_india" && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <span className="text-sm font-medium text-foreground">Pan India</span>
            <span className="text-xs text-muted-foreground">(all 23 states)</span>
          </div>

          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRegionType("select_cities")}>
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${regionType === "select_cities" ? "border-primary" : "border-muted-foreground"}`}>
              {regionType === "select_cities" && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <span className="text-sm font-medium text-foreground">Select States</span>
          </div>

          {regionType === "select_cities" && (
            <div className="ml-7 max-w-xl space-y-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="text-sm text-muted-foreground">
                      {selectedStates.length === 0 ? "Select states where you want ads to run" : `${selectedStates.length} state${selectedStates.length === 1 ? "" : "s"} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <div className="max-h-72 overflow-y-auto p-2 grid grid-cols-2 gap-1">
                    {BLINKIT_STATES.map((s) => {
                      const sel = selectedStates.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleState(s)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                            sel ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          }`}
                        >
                          <Checkbox checked={sel} className="pointer-events-none h-3.5 w-3.5" />
                          <span className="truncate">{s}</span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {selectedStates.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedStates.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary text-xs px-2 py-1">
                      {s}
                      <button onClick={() => toggleState(s as StateName)} className="hover:text-primary/70">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dayparting */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Schedule <span className="text-xs font-normal text-muted-foreground">(Optional)</span></h2>
        </div>
        <p className="text-xs text-muted-foreground">Select hours when your ads should run</p>

        {peakHint && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <span className="text-base">💡</span>
            <p className="text-xs text-amber-900">{peakHint}</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {(["peak", "daytime", "24_7"] as const).map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={preset === p ? "default" : "outline"}
              onClick={() => applyPreset(p)}
              className="h-8"
            >
              {p === "peak" ? "Peak hours only" : p === "daytime" ? "Daytime" : "24/7"}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={preset === "custom" ? "default" : "outline"}
            onClick={() => setPreset("custom")}
            className="h-8"
          >
            Custom
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {HOUR_BLOCKS.map((b) => {
            const active = dayparting.includes(b.idx);
            return (
              <button
                key={b.idx}
                type="button"
                onClick={() => toggleBlock(b.idx)}
                className={`px-3 py-2 rounded-md border text-left transition-colors ${
                  active ? "bg-primary/10 border-primary text-primary" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="text-xs font-semibold">{b.label}</div>
                <div className="text-[10px] text-muted-foreground">{b.hint}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
