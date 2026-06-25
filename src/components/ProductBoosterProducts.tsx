import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSim } from "@/context/SimContext";
import { Upload, ChevronDown, Search, Star, Inbox, Package } from "lucide-react";

interface ProductBoosterProductsProps {
  onProductsValid?: (valid: boolean) => void;
}

function variantLabel(name: string, mrp: number): string {
  const sizeMatch = name.match(/(\d+\s*ml|\d+\s*g|\d+\s*kg|\d+\s*L)/i);
  if (sizeMatch) return sizeMatch[0];
  if (mrp <= 200) return "30 ml";
  if (mrp <= 500) return "50 ml";
  return "100 ml";
}

export function ProductBoosterProducts({ onProductsValid }: ProductBoosterProductsProps) {
  const { scenario, cmPitch } = useSim();

  // manualIds = products added manually via left dropdown (persisted)
  const [manualIds, setManualIds] = useLocalStorage<string[]>("sim_added_skus", []);
  // selectedIds = products checked in right panel to run ads (persisted)
  const [selectedIds, setSelectedIds] = useLocalStorage<string[]>("sim_selected_skus", []);
  const [, setStrategy] = useLocalStorage<"hero" | "top3" | "all" | null>("sim_sku_strategy", null);

  const [productDropOpen, setProductDropOpen] = useState(false);
  const [brandDropOpen, setBrandDropOpen] = useState(false);
  const [catDropOpen, setCatDropOpen] = useState(false);

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // filterIds = products added via brand+category filters (NOT persisted — clears on unmount)
  const [filterIds, setFilterIds] = useState<string[]>([]);
  const [rightSearch, setRightSearch] = useState("");

  const productRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);

  // Combined right-panel pool (manual + filter, deduplicated)
  const allAddedIds = [...new Set([...manualIds, ...filterIds])];

  useEffect(() => { onProductsValid?.(selectedIds.length > 0); }, [selectedIds, onProductsValid]);

  // Recompute filter products whenever brand/category selection changes
  useEffect(() => {
    if (!scenario) return;
    const { profile: p } = scenario;
    const approved = cmPitch?.approvedSKUs ?? p.skus.map((s) => s.id);
    const approvedList = p.skus.filter((s) => approved.includes(s.id));
    const cats = p.relevantCategories?.length > 0 ? p.relevantCategories : ["Top Performers", "Mid Tier", "Long Tail"];
    const catOf = (id: string) => {
      const idx = approvedList.findIndex((s) => s.id === id);
      return cats[idx % cats.length];
    };

    // Both brand AND category must be selected
    if (selectedBrands.length === 0 || selectedCategories.length === 0) {
      setFilterIds([]);
      return;
    }

    const matched = approvedList
      .filter((s) => selectedBrands.includes(p.name) && selectedCategories.includes(catOf(s.id)))
      .map((s) => s.id);
    setFilterIds(matched);
  }, [selectedBrands, selectedCategories, scenario, cmPitch]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) setProductDropOpen(false);
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) setBrandDropOpen(false);
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!scenario) return null;
  const { profile } = scenario;
  const approvedIds = cmPitch?.approvedSKUs ?? profile.skus.map((s) => s.id);
  const approvedSkus = profile.skus.filter((s) => approvedIds.includes(s.id));

  const allCategories: string[] =
    profile.relevantCategories?.length > 0
      ? profile.relevantCategories
      : ["Top Performers", "Mid Tier", "Long Tail"];

  const allBrands = [profile.name];

  // Right panel: union of manual + filter
  const addedSkus = profile.skus.filter((s) => allAddedIds.includes(s.id));
  const filteredRight = addedSkus.filter((s) =>
    !rightSearch.trim() || s.name.toLowerCase().includes(rightSearch.toLowerCase())
  );

  // ── Manual dropdown ──
  const toggleManual = (id: string) => {
    setManualIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    if (manualIds.includes(id)) setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const selectAllManual = () => {
    const allIds = approvedSkus.map((s) => s.id);
    const allAdded = allIds.every((id) => manualIds.includes(id));
    if (allAdded) { setManualIds([]); setSelectedIds([]); }
    else setManualIds(allIds);
  };

  const handleBulkUpload = () => {
    const ids = approvedSkus.map((s) => s.id);
    setManualIds(ids);
    setSelectedIds(ids);
    setStrategy("all");
  };

  // ── Brand multi-select ──
  const toggleBrand = (brand: string) =>
    setSelectedBrands((prev) => prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]);

  const selectAllBrands = () =>
    setSelectedBrands((prev) => prev.length === allBrands.length ? [] : [...allBrands]);

  // ── Category multi-select ──
  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);

  const selectAllCategories = () =>
    setSelectedCategories((prev) => prev.length === allCategories.length ? [] : [...allCategories]);

  // ── Right panel checkboxes ──
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setStrategy(null);
  };

  const allAddedSelected = addedSkus.length > 0 && addedSkus.every((s) => selectedIds.includes(s.id));
  const toggleAllSelected = () => {
    if (allAddedSelected) setSelectedIds([]);
    else setSelectedIds(addedSkus.map((s) => s.id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Select campaign products</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Choose your campaign products using filters, search, or bulk upload</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* ── Left panel ── */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* Enter products manually */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="font-semibold text-sm text-foreground mb-0.5">Enter products manually</div>
            <div className="text-xs text-muted-foreground mb-3">Find and select your products manually</div>
            <div className="flex gap-2 items-start">
              <div className="flex-1 relative" ref={productRef}>
                <div
                  className={`w-full border-2 rounded-md px-3 py-2 cursor-pointer flex items-center justify-between bg-white transition-colors ${
                    productDropOpen ? "border-green-500" : "border-gray-200 hover:border-green-400"
                  }`}
                  onClick={() => setProductDropOpen((v) => !v)}
                >
                  <span className="text-sm text-muted-foreground">
                    {manualIds.length === 0 ? "Select products" : `${manualIds.length} product${manualIds.length > 1 ? "s" : ""} added`}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${productDropOpen ? "rotate-180" : ""}`} />
                </div>
                {productDropOpen && (
                  <div
                    className="absolute top-full left-0 mt-1 w-full border border-gray-200 rounded-md bg-white shadow-lg z-20"
                    style={{ maxHeight: "260px", overflowY: "auto" }}
                  >
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                      onClick={selectAllManual}
                    >
                      <Checkbox checked={approvedSkus.every((s) => manualIds.includes(s.id))} className="h-4 w-4 pointer-events-none" />
                      <span className="text-sm font-medium text-gray-700">Select All</span>
                    </div>
                    {approvedSkus.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${manualIds.includes(s.id) ? "bg-green-50/50" : ""}`}
                        onClick={() => toggleManual(s.id)}
                      >
                        <Checkbox checked={manualIds.includes(s.id)} className="h-4 w-4 mt-0.5 pointer-events-none shrink-0" />
                        <span className="text-sm text-gray-700 leading-snug">{s.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleBulkUpload}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shrink-0 leading-tight"
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span>Bulk<br />Upload</span>
              </button>
            </div>
          </div>

          {/* Choose products via filters */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="font-semibold text-sm text-foreground mb-0.5">Choose products</div>
            <div className="text-xs text-muted-foreground mb-3">Select products from the brand and category filters</div>
            <div className="flex gap-3">

              {/* Select brands */}
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground mb-1">Select brands</div>
                <div className="relative" ref={brandRef}>
                  <div
                    className={`w-full border-2 rounded-md px-3 py-2 cursor-pointer flex items-center justify-between bg-white transition-colors ${
                      brandDropOpen ? "border-green-500" : "border-gray-200 hover:border-green-400"
                    }`}
                    onClick={() => setBrandDropOpen((v) => !v)}
                  >
                    <span className="text-sm text-muted-foreground truncate">
                      {selectedBrands.length === 0 ? "Select from brands" : `${selectedBrands.length} Brand${selectedBrands.length > 1 ? "s" : ""} Selected`}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${brandDropOpen ? "rotate-180" : ""}`} />
                  </div>
                  {brandDropOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full border border-gray-200 rounded-md bg-white shadow-md z-20" style={{ maxHeight: "240px", overflowY: "auto" }}>
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                        onClick={selectAllBrands}
                      >
                        <Checkbox checked={selectedBrands.length === allBrands.length} className="h-4 w-4 pointer-events-none" />
                        <span className="text-sm font-medium text-gray-700">Select All</span>
                      </div>
                      {allBrands.map((brand) => (
                        <div
                          key={brand}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${selectedBrands.includes(brand) ? "bg-green-50/40" : ""}`}
                          onClick={() => toggleBrand(brand)}
                        >
                          <Checkbox checked={selectedBrands.includes(brand)} className="h-4 w-4 pointer-events-none shrink-0" />
                          <span className="text-sm text-gray-700">{brand}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Select categories */}
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground mb-1">Select categories</div>
                <div className="relative" ref={catRef}>
                  <div
                    className={`w-full border-2 rounded-md px-3 py-2 cursor-pointer flex items-center justify-between bg-white transition-colors ${
                      catDropOpen ? "border-green-500" : "border-gray-200 hover:border-green-400"
                    }`}
                    onClick={() => setCatDropOpen((v) => !v)}
                  >
                    <span className="text-sm text-muted-foreground truncate">
                      {selectedCategories.length === 0 ? "Select from categories" : `${selectedCategories.length} Categor${selectedCategories.length > 1 ? "ies" : "y"} Selected`}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${catDropOpen ? "rotate-180" : ""}`} />
                  </div>
                  {catDropOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full border border-gray-200 rounded-md bg-white shadow-md z-20" style={{ maxHeight: "240px", overflowY: "auto" }}>
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                        onClick={selectAllCategories}
                      >
                        <Checkbox checked={selectedCategories.length === allCategories.length} className="h-4 w-4 pointer-events-none" />
                        <span className="text-sm font-medium text-gray-700">Select All</span>
                      </div>
                      {allCategories.map((cat) => (
                        <div
                          key={cat}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${selectedCategories.includes(cat) ? "bg-green-50/40" : ""}`}
                          onClick={() => toggleCategory(cat)}
                        >
                          <Checkbox checked={selectedCategories.includes(cat)} className="h-4 w-4 pointer-events-none shrink-0" />
                          <span className="text-sm text-gray-700">{cat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {selectedIds.length === 0 && (
            <p className="text-sm text-red-500 font-medium">Please select at least 1 product to continue</p>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="w-[480px] shrink-0 border border-gray-200 rounded-lg flex flex-col overflow-hidden" style={{ minHeight: "400px" }}>
          <div className="px-4 pt-4 pb-2">
            <div className="font-semibold text-sm text-foreground">Selected products</div>
            <div className="text-xs text-muted-foreground">Your target products will appear here</div>
          </div>

          <div className="border-t border-b border-gray-100 px-3 py-2 flex items-center gap-3 bg-white">
            <Checkbox
              checked={allAddedSelected && addedSkus.length > 0}
              onCheckedChange={toggleAllSelected}
              className="h-4 w-4 shrink-0"
            />
            <div className="w-4 shrink-0" />
            <div className="w-8 shrink-0" />
            <span className="text-xs font-semibold text-gray-500 flex-1">Product Name</span>
            <span className="text-xs font-semibold text-gray-500 w-20 text-right shrink-0">Variants</span>
          </div>

          {addedSkus.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 border border-gray-200 rounded-md px-2 py-1.5 bg-gray-50">
                <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <input
                  value={rightSearch}
                  onChange={(e) => setRightSearch(e.target.value)}
                  placeholder="Search amongst the added products"
                  className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                />
              </div>
            </div>
          )}

          {addedSkus.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
              <Inbox className="h-12 w-12 text-gray-300 mb-3" />
              <div className="text-sm font-medium text-gray-500 mb-1">No products yet!</div>
              <div className="text-xs text-gray-400">Select a brand and category to add products, or manually select from the dropdown</div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredRight.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-3 border-b border-gray-50 hover:bg-gray-50/60">
                  <Checkbox
                    checked={selectedIds.includes(s.id)}
                    onCheckedChange={() => toggleSelected(s.id)}
                    className="h-4 w-4 shrink-0"
                  />
                  <Star className="h-4 w-4 text-gray-300 shrink-0" />
                  <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-gray-300" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium flex-1 leading-snug">{s.name}</span>
                  <div className="border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-600 shrink-0 whitespace-nowrap">
                    {variantLabel(s.name, s.mrp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
