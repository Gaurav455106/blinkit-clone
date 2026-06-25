import { useState, useMemo, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, TrendingUp, Inbox, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";

// Shared reusable components (usable by any campaign targeting component)
import { InfoTooltip } from "@/components/targeting/InfoTooltip";
import { BidInput }    from "@/components/targeting/BidInput";
import { BidRangeBox } from "@/components/targeting/BidRangeBox";

// Shared pure helpers (usable by any campaign targeting component)
import {
  inFmt,
  kwType,
  kwSearches,
  kwTrending,
  kwBidRange,
  catBidRange,
  catVisits,
  entryPoint,
} from "@/lib/targetingUtils";

// ── Bid constants ─────────────────────────────────────────────────────────────
const MIN_BID = 200;
const isBidLow = (v: string) => !!v && Number(v) < MIN_BID;

// ── Bulk-upload constants ─────────────────────────────────────────────────────
const REQUIRED_COLS = ["Keyword", "Exact Match Bid", "Smart Match Bid"];

// ── Small local helpers ───────────────────────────────────────────────────────

/** Download a pre-filled sample XLSX for the bulk upload modal */
function downloadSampleFile() {
  const data = [
    { Keyword: "milk",   "Exact Match Bid": 800, "Smart Match Bid": "" },
    { Keyword: "dahi",   "Exact Match Bid": 900, "Smart Match Bid": 500 },
    { Keyword: "paneer", "Exact Match Bid": 200, "Smart Match Bid": "" },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Keywords");
  XLSX.writeFile(wb, "sample_keywords.xlsx");
}

// ── Types ─────────────────────────────────────────────────────────────────────
type BulkRow = { keyword: string; exact: string; smart: string };

// ── Component ─────────────────────────────────────────────────────────────────
export function ProductBoosterTargeting({
  onTargetingValid,
  showCategoryTargeting = true,
}: {
  onTargetingValid?: (v: boolean) => void;
  showCategoryTargeting?: boolean;
} = {}) {
  const { scenario } = useSim();

  // Section toggles
  const [keywordTargeting,  setKeywordTargeting]  = useState(true);
  const [categoryTargeting, setCategoryTargeting] = useState(true);

  // Keyword selection
  const [selectedKeywords, setSelectedKeywords] = useLocalStorage<string[]>("sim_selected_keywords", []);
  const [manualKw, setManualKw] = useState("");

  // Negative keywords
  const [negKwInput, setNegKwInput] = useState("");
  const [negKwTags,  setNegKwTags]  = useState<string[]>([]);

  // Keyword-level bid state (keyed by keyword name)
  const [kwExactBids,   setKwExactBids]   = useState<Record<string, string>>({});
  const [kwSmartBids,   setKwSmartBids]   = useState<Record<string, string>>({});
  const [kwSmartEnabled,setKwSmartEnabled]= useState<Record<string, boolean>>({});
  const [kwBoost,       setKwBoost]       = useState<Record<string, boolean>>({});
  const [kwBoostPct,    setKwBoostPct]    = useState<Record<string, string>>({});

  // Bid booster header toggle
  const [bidBooster, setBidBooster] = useState(false);

  // Keyword filters
  const [filters, setFilters] = useState({ branded: true, generic: true, event: true });

  // Category bid state (keyed by category name)
  const [catBids,    setCatBids]    = useState<Record<string, string>>({});
  const [catEnabled, setCatEnabled] = useState<Record<string, boolean>>({});
  const [showCpmErrors, setShowCpmErrors] = useState(false);

  // Bulk upload modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkError,     setBulkError]     = useState("");
  const [bulkParsed,    setBulkParsed]    = useState<BulkRow[]>([]);
  const [isDragging,    setIsDragging]    = useState(false);

  // ── Derived data (unconditional) ──────────────────────────────────────────
  const profile = scenario?.profile;
  const cats    = profile?.relevantCategories ?? [];

  const allKeywords = useMemo(() => {
    if (!profile) return [];
    return [
      ...profile.goodKeywords.map((k, i) => ({
        name: k, good: true,
        searches: kwSearches(k, i, true),
        trending: kwTrending(k, true),
        type: kwType(k, profile.name),
      })),
      ...profile.riskyKeywords.map((k, i) => ({
        name: k, good: false,
        searches: kwSearches(k, i, false),
        trending: kwTrending(k, false),
        type: kwType(k, profile.name),
      })),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.name]);

  const getCatEnabled = (c: string) =>
    catEnabled[c] !== undefined ? catEnabled[c] : true;

  // Validity: every enabled category must have a CPM bid >= MIN_BID
  const isCategoryValid =
    !showCategoryTargeting ||
    !categoryTargeting ||
    cats.every((c) => !getCatEnabled(c) || (!!catBids[c] && Number(catBids[c]) >= MIN_BID));

  // Validity: at least one keyword selected (when keyword targeting is on)
  const hasKeywords = !keywordTargeting || selectedKeywords.length > 0;

  // Validity: every selected keyword must have an exact bid entered and >= MIN_BID
  const isKeywordBidsValid = selectedKeywords.every(
    (k) =>
      !!kwExactBids[k] &&
      !isBidLow(kwExactBids[k] ?? "") &&
      (!(kwSmartEnabled[k] ?? false) || !isBidLow(kwSmartBids[k] ?? ""))
  );

  useEffect(() => {
    onTargetingValid?.(isCategoryValid && isKeywordBidsValid && hasKeywords);
  }, [isCategoryValid, isKeywordBidsValid, hasKeywords]);
  useEffect(() => {
    setShowCpmErrors(showCategoryTargeting && categoryTargeting && !isCategoryValid);
  }, [showCategoryTargeting, categoryTargeting, isCategoryValid]);

  // ── Early return AFTER all hooks ──────────────────────────────────────────
  if (!scenario || !profile) return null;

  // ── Event handlers ────────────────────────────────────────────────────────
  const toggleKw = (name: string) =>
    setSelectedKeywords((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );

  const addManual = () => {
    if (!manualKw.trim()) return;
    const next = manualKw.split(",").map((s) => s.trim()).filter(Boolean);
    setSelectedKeywords((prev) => [...new Set([...prev, ...next])]);
    setManualKw("");
  };

  const toggleFilter = (f: keyof typeof filters) =>
    setFilters((prev) => ({ ...prev, [f]: !prev[f] }));

  const toggleCat = (c: string) =>
    setCatEnabled((prev) => ({ ...prev, [c]: !getCatEnabled(c) }));

  const visibleKws = allKeywords.filter(
    (kw) => filters[kw.type]
  );

  // ── Bulk upload helpers ───────────────────────────────────────────────────
  const parseUploadedFile = (file: File) => {
    setBulkError("");
    setBulkParsed([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (!rows.length) { setBulkError("Wrong format uploaded. File is empty."); return; }

        const headers = Object.keys(rows[0]);
        const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
        if (missing.length) { setBulkError("Wrong format uploaded. Please use the sample file."); return; }

        const parsed = rows
          .map((r) => ({
            keyword: String(r["Keyword"]).trim(),
            exact:   String(r["Exact Match Bid"]).trim(),
            smart:   String(r["Smart Match Bid"]).trim(),
          }))
          .filter((r) => r.keyword);

        if (!parsed.length) { setBulkError("No valid keywords found in the file."); return; }
        setBulkParsed(parsed);
      } catch {
        setBulkError("Could not read file. Please upload a valid .XLSX or .CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkSave = () => {
    if (!bulkParsed.length) return;
    setSelectedKeywords((prev) => [...new Set([...prev, ...bulkParsed.map((r) => r.keyword)])]);
    setKwExactBids((prev) => {
      const next = { ...prev };
      bulkParsed.forEach((r) => { if (r.exact) next[r.keyword] = r.exact; });
      return next;
    });
    setKwSmartBids((prev) => {
      const next = { ...prev };
      bulkParsed.forEach((r) => { if (r.smart) next[r.keyword] = r.smart; });
      return next;
    });
    setKwSmartEnabled((prev) => {
      const next = { ...prev };
      bulkParsed.forEach((r) => { if (r.smart) next[r.keyword] = true; });
      return next;
    });
    setBulkParsed([]);
    setBulkError("");
    setShowBulkModal(false);
  };

  const closeBulkModal = () => { setShowBulkModal(false); setBulkError(""); setBulkParsed([]); };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Keyword Targeting header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={keywordTargeting}
            onCheckedChange={(v) => setKeywordTargeting(!!v)}
            className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
          <h3 className="text-base font-bold text-foreground">Keyword targeting</h3>
          <span className="border border-dashed border-blue-400 text-blue-500 text-xs px-2 py-0.5 rounded-md font-medium">
            Search Listing
          </span>
        </div>
        {keywordTargeting && (
          <button
            onClick={() => setSelectedKeywords(allKeywords.map((k) => k.name))}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
          >
            <Download className="h-4 w-4" /> Download Keywords
          </button>
        )}
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        Select this for boosting your products on search keywords
      </p>

      {keywordTargeting && (
        <>
          <div className="flex gap-4">

            {/* ── Left: Suggested keywords ── */}
            <div className="flex-1 border border-gray-200 rounded-lg bg-white p-5 min-w-0">
              <div className="font-semibold text-sm text-foreground mb-0.5">Suggested keywords</div>
              <p className="text-xs text-muted-foreground mb-4">
                Pick relevant keywords from our suggestions to target in this campaign
              </p>

              {/* Filter chips */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-500 font-medium">Filters</span>
                {(["branded", "generic", "event"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => toggleFilter(f)}
                    className={`flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-full border transition-colors ${
                      filters[f]
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-400"
                    }`}
                  >
                    {f === "branded" ? "Branded keywords" : f === "generic" ? "Generic keywords" : "Event special"}
                    {filters[f] && (
                      <span className="bg-green-500 rounded-full h-5 w-5 flex items-center justify-center text-white text-xs font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Keyword cards */}
              <div className="flex flex-wrap gap-2.5 overflow-y-auto pr-1" style={{ maxHeight: "360px" }}>
                {visibleKws.map((kw) => {
                  const sel = selectedKeywords.includes(kw.name);
                  return (
                    <button
                      key={kw.name}
                      onClick={() => toggleKw(kw.name)}
                      className={`flex flex-col items-start text-left px-4 py-2.5 rounded-lg border transition-colors ${
                        sel
                          ? "border-green-500 bg-green-50/30"
                          : "border-gray-300 bg-white hover:border-green-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-sm leading-tight">{kw.name}</span>
                        {kw.trending && (
                          <span className="flex items-center gap-0.5 text-xs text-blue-600 font-semibold whitespace-nowrap">
                            Trending <TrendingUp className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 mt-0.5">({inFmt(kw.searches)} searches)</span>
                    </button>
                  );
                })}
              </div>

              {/* Manual entry */}
              <div className="mt-5 border border-gray-200 rounded-lg p-4">
                <div className="font-semibold text-sm text-foreground mb-0.5">Enter keywords manually</div>
                <div className="text-xs text-muted-foreground mb-3">
                  Type specific keywords or add a list separated by commas
                </div>
                <div className="flex gap-2">
                  <input
                    value={manualKw}
                    onChange={(e) => setManualKw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addManual()}
                    placeholder="Type a keyword & press enter"
                    className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-green-400 bg-white"
                  />
                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors shrink-0"
                  >
                    <Upload className="h-4 w-4" /> Bulk Upload
                  </button>
                </div>
              </div>
            </div>

            {/* ── Right: Selected keywords ── */}
            <div className="w-[680px] shrink-0 border border-gray-200 rounded-lg bg-white flex flex-col">
              <div className="px-5 pt-5 pb-3">
                <div className="font-semibold text-base text-foreground">Selected keywords</div>
                <div className="text-sm text-muted-foreground mt-0.5">Your selected keywords will appear here</div>
              </div>

              {/* Table header */}
              <div className="border-t border-b border-gray-100 px-4 py-2.5 grid grid-cols-[20px_1fr_148px_150px_160px] gap-3 items-center bg-gray-50/40">
                <div />
                <span className="text-sm font-semibold text-gray-700">Keywords</span>

                {/* Exact Match Bid */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-semibold text-gray-700">Exact Match Bid</span>
                  <InfoTooltip
                    title="Exact Match Bid"
                    content="Your ad will only show when the search exactly matches your keyword. Set a maximum bid per click."
                  />
                </div>

                {/* Bid Booster toggle */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setBidBooster((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                      bidBooster ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> Bid booster
                  </button>
                  {/* Bid Booster has its own tooltip since it's a click-toggle, not just an info icon */}
                  <InfoTooltip
                    title="Bid booster"
                    content={
                      <>
                        Enable this feature to auto-increase your Exact match bid for top ad slots up to your max limit.<br /><br />
                        Once enabled, your bid will adjust to the top bid range.<br /><br />
                        Bid Booster activates when your highest possible bid exceeds the next highest bid by ₹20 or more.
                      </>
                    }
                    align="center"
                  />
                </div>

                {/* Smart Match Bid */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-semibold text-gray-700">Smart Match Bid</span>
                  <InfoTooltip
                    content={"Smart match targets broad intent that cover your specific keyword's intent. For example, bidding on \"mustard oil\" with smart match turned on will show your product on searches such as \"oil\" and \"mustard\"."}
                    align="right"
                  />
                </div>
              </div>

              {selectedKeywords.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
                  <Inbox className="h-14 w-14 text-gray-300 mb-4" />
                  <div className="text-base font-medium text-gray-500 mb-1">No keywords yet!</div>
                  <div className="text-sm text-gray-400">Select from the suggested keywords or add them manually</div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {selectedKeywords.map((k) => {
                    const meta    = allKeywords.find((x) => x.name === k);
                    const searches = meta?.searches ?? 5000;
                    const [bidLo, bidHi] = kwBidRange(searches);
                    const boosted = kwBoost[k] ?? false;
                    const smartOn = kwSmartEnabled[k] ?? false;

                    return (
                      <div
                        key={k}
                        className="grid grid-cols-[20px_1fr_148px_150px_160px] gap-3 items-start px-4 py-3 border-b border-gray-100 hover:bg-gray-50/40"
                      >
                        {/* Remove */}
                        <button onClick={() => toggleKw(k)} className="text-red-400 hover:text-red-600 mt-1 shrink-0">
                          <X className="h-4 w-4" />
                        </button>

                        {/* Keyword name */}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-800 leading-snug truncate">{k}</div>
                          <div className="text-xs text-gray-400 mt-0.5">({inFmt(searches)} searches)</div>
                        </div>

                        {/* Exact bid + suggested range */}
                        <div className="w-full">
                          <BidInput
                            value={kwExactBids[k] ?? ""}
                            onChange={(v) => setKwExactBids((prev) => ({ ...prev, [k]: v }))}
                            placeholder="Enter ..."
                            hasError={isBidLow(kwExactBids[k] ?? "")}
                          />
                          {isBidLow(kwExactBids[k] ?? "") && (
                            <p className="text-[10px] text-red-500 mt-0.5">Bid cannot be less than ₹{MIN_BID}</p>
                          )}
                          <BidRangeBox lo={bidLo} hi={bidHi} />
                        </div>

                        {/* Bid booster % input */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={boosted}
                              onChange={() => setKwBoost((prev) => ({ ...prev, [k]: !boosted }))}
                              className="h-4 w-4 accent-blue-600"
                            />
                            <span className="text-xs text-blue-600 font-medium whitespace-nowrap">Boost my bid</span>
                          </div>
                          {boosted && (
                            <>
                              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white mt-0.5">
                                <span className="px-2 text-xs text-gray-400 border-r border-gray-200 bg-gray-50 whitespace-nowrap py-1.5">Upto</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  placeholder="e.g. 20"
                                  value={kwBoostPct[k] ?? ""}
                                  onChange={(e) => setKwBoostPct((prev) => ({ ...prev, [k]: e.target.value }))}
                                  className="flex-1 px-2 py-1.5 text-xs outline-none bg-white w-0"
                                />
                                <span className="px-2 text-xs text-gray-400 border-l border-gray-200 bg-gray-50 py-1.5">%</span>
                              </div>
                              {!kwBoostPct[k] && (
                                <p className="text-[10px] text-red-500 mt-0.5">Please enter a boost value</p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Smart match bid */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <input
                              type="checkbox"
                              checked={smartOn}
                              onChange={() => setKwSmartEnabled((prev) => ({ ...prev, [k]: !smartOn }))}
                              className="h-4 w-4 accent-green-600"
                            />
                            <span className="text-xs text-gray-600 font-medium">Enable Smart Bid</span>
                          </div>
                          <BidInput
                            value={kwSmartBids[k] ?? ""}
                            onChange={(v) => setKwSmartBids((prev) => ({ ...prev, [k]: v }))}
                            placeholder="Enter amou..."
                            disabled={!smartOn}
                            hasError={smartOn && isBidLow(kwSmartBids[k] ?? "")}
                          />
                          {smartOn && isBidLow(kwSmartBids[k] ?? "") && (
                            <p className="text-[10px] text-red-500 mt-0.5">Bid cannot be less than ₹{MIN_BID}</p>
                          )}
                          {smartOn && (
                            <BidRangeBox
                              lo={Math.round(bidLo * 0.077)}
                              hi={Math.round(bidHi * 0.077)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Negative keywords ── */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm text-foreground">Negative keywords</span>
              <span className="text-xs text-gray-400">(Optional)</span>
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              Your ads will not appear on these searches. Please enter the negative keywords below.
            </div>
            <div
              className="flex flex-wrap items-center gap-2 w-full border border-gray-200 rounded-md px-3 py-2 bg-white focus-within:border-green-400 cursor-text min-h-[40px]"
              onClick={() => document.getElementById("neg-kw-input")?.focus()}
            >
              {negKwTags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 text-sm rounded-full px-3 py-0.5">
                  {tag}
                  <button
                    onClick={(e) => { e.stopPropagation(); setNegKwTags((prev) => prev.filter((t) => t !== tag)); }}
                    className="text-gray-400 hover:text-gray-600 ml-0.5"
                  >×</button>
                </span>
              ))}
              <input
                id="neg-kw-input"
                value={negKwInput}
                onChange={(e) => setNegKwInput(e.target.value)}
                placeholder={negKwTags.length === 0 ? "Type a keyword & press enter" : ""}
                className="flex-1 min-w-[160px] text-sm outline-none bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && negKwInput.trim()) {
                    setNegKwTags((prev) => [...new Set([...prev, negKwInput.trim()])]);
                    setNegKwInput("");
                  }
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Category Targeting ── */}
      {showCategoryTargeting && <div className="rounded-lg border border-gray-200">
        <div className="flex items-center gap-3 px-5 pt-5 pb-2">
          <Checkbox
            checked={categoryTargeting}
            onCheckedChange={(v) => setCategoryTargeting(!!v)}
            className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
          <h3 className="text-base font-bold text-foreground">Category targeting</h3>
          <span className="border border-dashed border-blue-400 text-blue-500 text-xs px-2 py-0.5 rounded-md font-medium">
            Category Listing
          </span>
        </div>
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Select this for boosting your products on their category listings
        </p>

        {categoryTargeting && cats.length > 0 && (
          <div className="border-t border-gray-100">
            {/* Table header */}
            <div className="grid grid-cols-[28px_1fr_160px_180px_180px_1fr] gap-4 items-center px-5 py-2.5 border-b border-gray-100 bg-gray-50/60">
              <div />
              <span className="text-xs font-semibold text-gray-500">Category</span>
              <span className="text-xs font-semibold text-gray-500">No. of category visits</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-gray-500">CPM Bid</span>
                <InfoTooltip content="Cost per thousand impressions. You're charged each time your product is shown 1,000 times in this category." />
              </div>
              <span className="text-xs font-semibold text-gray-500">Suggested top bid range</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-gray-500">Entry points</span>
                <InfoTooltip
                  content="The browsing path a customer takes before reaching this category. Your ad appears at these entry points."
                  align="right"
                />
              </div>
            </div>

            {/* Category rows */}
            {cats.map((cat) => {
              const enabled = getCatEnabled(cat);
              const [lo, hi] = catBidRange(cat);
              const visits   = catVisits(cat);
              return (
                <div
                  key={cat}
                  className="grid grid-cols-[28px_1fr_160px_180px_180px_1fr] gap-4 items-center px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50/40 last:border-b-0"
                >
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={() => toggleCat(cat)}
                    className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <span className="text-sm font-semibold text-gray-800">{cat}</span>
                  <span className="text-sm font-bold text-gray-800">{inFmt(visits)}</span>

                  {/* CPM bid input with error */}
                  <div>
                    <BidInput
                      value={catBids[cat] ?? ""}
                      onChange={(v) => setCatBids((prev) => ({ ...prev, [cat]: v }))}
                      placeholder="Enter amount"
                      hasError={enabled && (showCpmErrors && !catBids[cat] || isBidLow(catBids[cat] ?? ""))}
                      size="md"
                    />
                    {enabled && showCpmErrors && !catBids[cat] && (
                      <p className="text-[10px] text-red-500 mt-0.5">CPM bid required</p>
                    )}
                    {enabled && isBidLow(catBids[cat] ?? "") && (
                      <p className="text-[10px] text-red-500 mt-0.5">CPM bid cannot be less than ₹{MIN_BID}</p>
                    )}
                  </div>

                  {/* Suggested range — blue variant */}
                  <BidRangeBox lo={lo} hi={hi} variant="blue" />

                  {/* Entry point */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 leading-tight">
                      {entryPoint(cat, scenario?.category ?? "")}
                    </span>
                    <InfoTooltip
                      content="The category path where customers discover your product listing."
                      align="right"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* ── Bulk Upload Modal ── */}
      {showBulkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeBulkModal}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-[600px] p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Bulk upload</h2>
            <p className="text-sm text-gray-500 mb-5">
              Efficiently add multiple keywords by uploading a .XLSX or .CSV file
            </p>

            {/* Drop zone */}
            <label
              className={`flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-xl cursor-pointer transition-colors mb-4 ${
                isDragging      ? "border-green-500 bg-green-50"
                : bulkError    ? "border-red-300 bg-red-50"
                : bulkParsed.length > 0 ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-gray-50 hover:bg-green-50 hover:border-green-400"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) parseUploadedFile(f); }}
            >
              {bulkParsed.length > 0 ? (
                <>
                  <div className="text-green-600 text-3xl mb-2">✓</div>
                  <span className="text-sm font-semibold text-green-700">
                    {bulkParsed.length} keyword{bulkParsed.length > 1 ? "s" : ""} ready to import
                  </span>
                  <span className="text-xs text-gray-400 mt-1">Drop a new file to replace</span>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-dashed border-gray-400 mb-3">
                    <span className="text-2xl text-gray-400 leading-none">+</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 mb-1">Drop your files here</span>
                  <span className="text-sm text-gray-500">
                    <span className="text-green-600 font-semibold">Browse Files</span> from your Computer (.XLSX or .CSV)
                  </span>
                </>
              )}
              <input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) parseUploadedFile(f); }}
              />
            </label>

            {bulkError && (
              <p className="text-sm text-red-600 font-medium mb-3 flex items-center gap-1">
                <span>⚠</span> {bulkError}
              </p>
            )}

            <button
              onClick={downloadSampleFile}
              className="flex items-center gap-2 border border-green-600 text-green-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-50 transition-colors mb-6"
            >
              <Download className="h-4 w-4" /> Download Sample File
            </button>

            <div className="flex justify-center gap-4">
              <button
                onClick={closeBulkModal}
                className="px-10 py-2.5 rounded-lg border-2 border-green-600 text-green-700 font-semibold text-sm hover:bg-green-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSave}
                disabled={bulkParsed.length === 0}
                className={`px-10 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  bulkParsed.length > 0 ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
