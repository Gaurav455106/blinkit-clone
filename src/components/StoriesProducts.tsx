import { useEffect, useMemo, useRef, useState } from "react";
import { useSim } from "@/context/SimContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Check, Upload, X } from "lucide-react";

interface Props {
  onProductsValid?: (v: boolean) => void;
  showErrors?: boolean;
}

type StoryVariant = "single_product" | "collection" | null;
type CollTab = "existing" | "create";

// ── Background swatches (single product) ─────────────────────────────────────
const BG_OPTIONS = [
  { id: 0,  bg: "radial-gradient(ellipse at center, #6baed6 0%, #2171b5 100%)",  sunburst: true  },
  { id: 1,  bg: "radial-gradient(ellipse at center, #9e6bc4 0%, #54278f 100%)",  sunburst: true  },
  { id: 2,  bg: "radial-gradient(ellipse at center, #f7c948 0%, #cc9900 100%)",  sunburst: true  },
  { id: 3,  bg: "radial-gradient(ellipse at center, #f26b6b 0%, #cb2020 100%)",  sunburst: true  },
  { id: 4,  bg: "radial-gradient(ellipse at center, #f472b6 0%, #be185d 100%)",  sunburst: true  },
  { id: 5,  bg: "radial-gradient(ellipse at center, #fb923c 0%, #c2410c 100%)",  sunburst: true  },
  { id: 6,  bg: "radial-gradient(ellipse at center, #c084fc 0%, #7e22ce 100%)",  sunburst: true  },
  { id: 7,  bg: "radial-gradient(ellipse at center, #fca5a5 0%, #ef4444 100%)",  sunburst: false },
  { id: 8,  bg: "radial-gradient(ellipse at center, #2dd4bf 0%, #0f766e 100%)",  sunburst: true  },
  { id: 9,  bg: "radial-gradient(ellipse at center, #7dd3fc 0%, #0284c7 100%)",  sunburst: true  },
  { id: 10, bg: "radial-gradient(ellipse at center, #d4b896 0%, #92400e 100%)",  sunburst: false },
  { id: 11, bg: "radial-gradient(ellipse at center, #fdba74 0%, #c2602a 100%)",  sunburst: false },
  { id: 12, bg: "linear-gradient(135deg, #818cf8 0%, #4338ca 100%)",             sunburst: false },
  { id: 13, bg: "linear-gradient(135deg, #d6cfc7 0%, #9c8b7e 100%)",             sunburst: false },
  { id: 14, bg: "linear-gradient(135deg, #c4b5fd 0%, #7c3aed 100%)",             sunburst: false },
  { id: 15, bg: "linear-gradient(135deg, #f9a8d4 0%, #db2777 100%)",             sunburst: false },
  { id: 16, bg: "linear-gradient(135deg, #fca5a5 0%, #dc2626 100%)",             sunburst: false },
  { id: 17, bg: "linear-gradient(135deg, #fdba74 0%, #f97316 100%)",             sunburst: false },
  { id: 18, bg: "linear-gradient(135deg, #84cc16 0%, #365314 100%)",             sunburst: false },
];

const BG_SOLID: Record<number, string> = {
  0:"#2171b5",1:"#54278f",2:"#cc9900",3:"#cb2020",4:"#be185d",5:"#c2410c",
  6:"#7e22ce",7:"#ef4444",8:"#0f766e",9:"#0284c7",10:"#92400e",11:"#c2602a",
  12:"#4338ca",13:"#9c8b7e",14:"#7c3aed",15:"#db2777",16:"#dc2626",17:"#f97316",18:"#365314",
};

// ── Upload drop zone ──────────────────────────────────────────────────────────
function UploadZone({ onFile, preview }: { onFile?: (url: string) => void; preview?: string | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    onFile?.(url);
  };

  return (
    <label
      className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl cursor-pointer transition-colors py-8 ${
        drag ? "border-green-500 bg-green-50" : preview ? "border-green-400 bg-green-50/30" : "border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50/20"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
    >
      {preview ? (
        <img src={preview} alt="preview" className="max-h-28 max-w-full object-contain rounded" />
      ) : (
        <>
          <div className="h-10 w-10 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center mb-3">
            <span className="text-2xl text-gray-400 leading-none">+</span>
          </div>
          <span className="text-sm font-semibold text-gray-700 mb-1">Drop your files here</span>
          <span className="text-sm text-gray-500">
            <span className="text-green-600 font-semibold">Browse Files</span> from your Computer
          </span>
        </>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </label>
  );
}

// ── Simple product bottle placeholder ────────────────────────────────────────
function ProductBottle({ large }: { large?: boolean }) {
  const w = large ? 40 : 24; const h = large ? 72 : 40;
  return (
    <svg width={w} height={h} viewBox="0 0 40 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="13" y="0" width="14" height="8" rx="2" fill="rgba(255,255,255,0.7)" />
      <rect x="16" y="8" width="8" height="6" fill="rgba(255,255,255,0.5)" />
      <rect x="6" y="14" width="28" height="52" rx="4" fill="rgba(255,255,255,0.85)" />
      <rect x="10" y="22" width="20" height="28" rx="2" fill="rgba(255,255,255,0.4)" />
      <ellipse cx="20" cy="36" rx="7" ry="9" fill="rgba(180,180,180,0.3)" />
    </svg>
  );
}

// ── Variant chip label ────────────────────────────────────────────────────────
function variantLabel(name: string): string {
  const m = name.match(/(\d+\s*(?:ml|g|kg|l|L|mg|oz|pack|pcs|pc|unit))/i);
  return m ? m[1] : "1 unit";
}

// ── Main component ────────────────────────────────────────────────────────────
export function StoriesProducts({ onProductsValid, showErrors = false }: Props) {
  const { scenario } = useSim();

  // Variant
  const [variant, setVariant] = useLocalStorage<StoryVariant>("sim_story_variant", null);

  // Single product
  const [selectedSku, setSelectedSku] = useLocalStorage<string | null>("sim_story_sku", null);
  const [selectedBg, setSelectedBg] = useLocalStorage<number | null>("sim_story_bg", null);
  const [brandNameSingle, setBrandNameSingle] = useLocalStorage<string>("sim_story_brand_name", "");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Collection
  const [collTab, setCollTab] = useLocalStorage<CollTab>("sim_story_coll_tab", "existing");
  const [selectedExisting, setSelectedExisting] = useLocalStorage<string[]>("sim_story_existing_colls", []);
  const [existingSearch, setExistingSearch] = useState("");
  const [existingFocused, setExistingFocused] = useState(false);
  const [collDisplayName, setCollDisplayName] = useLocalStorage<string>("sim_story_coll_name", "");
  const [collBrand, setCollBrand] = useLocalStorage<string>("sim_story_coll_brand", "");
  const [collCategory, setCollCategory] = useLocalStorage<string>("sim_story_coll_cat", "");
  const [collCreated, setCollCreated] = useLocalStorage<boolean>("sim_story_coll_created", false);

  // Collection ad creative
  const [keyImageUrl, setKeyImageUrl] = useState<string | null>(null);
  const [overlayLogoUrl, setOverlayLogoUrl] = useState<string | null>(null);
  const [brandLogoType, setBrandLogoType] = useLocalStorage<"upload" | "default">("sim_story_logo_type", "upload");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [collBrandName, setCollBrandName] = useLocalStorage<string>("sim_story_coll_brand_name", "");

  const profile = scenario?.profile;
  const skus = profile?.skus ?? [];
  const selectedSkuObj = skus.find((s) => s.id === selectedSku) ?? null;

  // Existing collections derived from scenario
  const existingCollections = useMemo(() => {
    if (!profile) return [];
    return [
      { id: "ec-0", name: `${profile.name} – Top Sellers`,   skuSlice: [0, 3] },
      { id: "ec-1", name: `${profile.category} Essentials`,  skuSlice: [1, 4] },
      { id: "ec-2", name: `${profile.name} – New Arrivals`,  skuSlice: [0, 2] },
      { id: "ec-3", name: `${profile.name} – Bestsellers`,   skuSlice: [2, 5] },
    ];
  }, [profile?.name, profile?.category]);

  const previewSkus = useMemo(() => {
    if (collTab === "existing" && selectedExisting.length > 0) {
      const coll = existingCollections.find((c) => selectedExisting.includes(c.id));
      if (coll) return skus.slice(...(coll.skuSlice as [number, number]));
    }
    if (collTab === "create" && collBrand && collCategory) return skus.slice(0, 4);
    return [];
  }, [collTab, selectedExisting, collBrand, collCategory, skus, existingCollections]);

  const filteredCollections = existingCollections.filter(
    (c) => c.name.toLowerCase().includes(existingSearch.toLowerCase()) && !selectedExisting.includes(c.id)
  );

  const collectionValid =
    (collTab === "existing" && selectedExisting.length > 0) ||
    (collTab === "create" && collCreated);

  const isValid =
    variant === "single_product" ? (!!selectedSku && selectedBg !== null) :
    variant === "collection" ? collectionValid :
    false;

  useEffect(() => { onProductsValid?.(isValid); }, [isValid]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dropdownOpen]);

  if (!profile) return null;

  const bgColor = selectedBg !== null ? BG_SOLID[selectedBg] : "#e5e7eb";

  return (
    <div className="space-y-4">

      {/* ── Variant selection card ── */}
      <div className="border border-border rounded-lg bg-card p-6 space-y-5">
        <h2 className="text-base font-semibold text-foreground">What do you want to promote through the story?</h2>

        {/* Single product */}
        <div>
          <div className="flex items-start gap-3 cursor-pointer"
            onClick={() => { setVariant("single_product"); setSelectedSku(null); }}>
            <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${variant === "single_product" ? "border-green-600 bg-green-600" : "border-gray-300"}`}>
              {variant === "single_product" && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Single product</p>
              <p className="text-sm text-muted-foreground">Select a newly launched or popular product</p>
            </div>
          </div>

          {variant === "single_product" && (
            <div className="mt-4 ml-8 max-w-lg" ref={dropdownRef}>
              <label className="text-xs font-semibold text-foreground block mb-1.5">Select Product</label>
              <div className="w-full border border-border rounded-md px-3 py-2.5 flex items-center justify-between cursor-pointer hover:border-green-500 bg-white transition-colors"
                onClick={() => setDropdownOpen((v) => !v)}>
                <span className={`text-sm ${selectedSkuObj ? "text-foreground" : "text-muted-foreground"}`}>
                  {selectedSkuObj ? selectedSkuObj.name : "Select from a list of products"}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </div>
              {dropdownOpen && (
                <div className="mt-1 border border-border rounded-md bg-white shadow-md max-h-56 overflow-y-auto z-10 relative">
                  {skus.map((sku) => (
                    <div key={sku.id}
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/40 text-sm ${selectedSku === sku.id ? "bg-green-50 text-green-700 font-medium" : "text-foreground"}`}
                      onClick={() => { setSelectedSku(sku.id); setDropdownOpen(false); }}>
                      {selectedSku === sku.id && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                      <span className={selectedSku === sku.id ? "" : "ml-5"}>{sku.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {showErrors && !selectedSku && <p className="text-xs text-red-500 mt-1.5">*Please select a product to continue</p>}
            </div>
          )}
        </div>

        {/* Collection of products */}
        <div>
          <div className="flex items-start gap-3 cursor-pointer"
            onClick={() => setVariant("collection")}>
            <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${variant === "collection" ? "border-green-600 bg-green-600" : "border-gray-300"}`}>
              {variant === "collection" && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Collection of products</p>
              <p className="text-sm text-muted-foreground">Select a range of popular or recently launched products</p>
            </div>
          </div>

          {/* Collection tabs */}
          {variant === "collection" && (
            <div className="mt-4 ml-0 space-y-4">
              {/* Tab bar */}
              <div className="flex border-b border-border">
                {(["existing", "create"] as CollTab[]).map((tab) => (
                  <button key={tab} type="button"
                    onClick={() => setCollTab(tab)}
                    className={`px-4 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      collTab === tab ? "border-green-600 text-green-600" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}>
                    {tab === "existing" ? "Select from existing collections" : "Create new collection"}
                  </button>
                ))}
              </div>

              {/* ── Select from existing collections ── */}
              {collTab === "existing" && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Left */}
                  <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Select from existing collections</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Find and select your products manually or by entering product IDs</p>
                    </div>
                    {/* Chip input */}
                    <div className="min-h-[40px] w-full border border-gray-200 rounded-md px-3 py-1.5 flex flex-wrap gap-1.5 items-center bg-white">
                      {selectedExisting.map((id) => {
                        const c = existingCollections.find((x) => x.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-medium rounded px-2 py-1 shrink-0">
                            {c?.name ?? id}
                            <button type="button" onClick={() => setSelectedExisting((prev) => prev.filter((x) => x !== id))}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                      <input
                        value={existingSearch}
                        onChange={(e) => setExistingSearch(e.target.value)}
                        onFocus={() => setExistingFocused(true)}
                        onBlur={() => setTimeout(() => setExistingFocused(false), 150)}
                        placeholder={selectedExisting.length === 0 ? "Search from existing brand collections" : ""}
                        className="flex-1 min-w-[140px] text-sm outline-none bg-transparent text-muted-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    {/* Dropdown results — only when focused or searching */}
                    {(existingFocused || existingSearch) && (
                      <div className="border border-border rounded-md bg-white shadow-sm max-h-40 overflow-y-auto">
                        {filteredCollections.length > 0 ? filteredCollections.map((c) => (
                          <div key={c.id}
                            className="px-3 py-2 text-sm text-foreground hover:bg-muted/40 cursor-pointer"
                            onClick={() => { setSelectedExisting((prev) => [...prev, c.id]); setExistingSearch(""); }}>
                            {c.name}
                          </div>
                        )) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No collections found</div>
                        )}
                      </div>
                    )}
                    {showErrors && selectedExisting.length === 0 && <p className="text-xs text-red-500">*Please select at least one collection</p>}
                  </div>

                  {/* Right: Collection preview */}
                  <CollectionPreview skus={previewSkus.map((s) => ({ name: s.name, variant: variantLabel(s.name) }))} />
                </div>
              )}

              {/* ── Create new collection ── */}
              {collTab === "create" && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Left */}
                  <div className="space-y-3">
                    {/* Display name */}
                    <div className="border border-border rounded-lg p-4 bg-card">
                      <p className="text-sm font-semibold text-foreground mb-2">Collection display name</p>
                      <input
                        type="text"
                        value={collDisplayName}
                        onChange={(e) => { setCollDisplayName(e.target.value); setCollCreated(false); }}
                        placeholder="Enter Collection Name"
                        className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
                      />
                    </div>

                    {/* Add products */}
                    <div className="border border-border rounded-lg p-4 bg-card space-y-3">
                      <p className="text-sm font-semibold text-foreground">Add products</p>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField label="Select brand" value={collBrand} onChange={(v) => { setCollBrand(v); setCollCreated(false); }}
                          options={[profile.name]} />
                        <SelectField label="Select Categories" value={collCategory} onChange={(v) => { setCollCategory(v); setCollCreated(false); }}
                          options={profile.relevantCategories ?? [profile.category]} />
                        <SelectField label="Select sub-categories" value="" onChange={() => {}}
                          options={["All sub-categories"]} />
                        <SelectField label="Sort products by" value="" onChange={() => {}}
                          options={["Relevance", "Price: Low to High", "Price: High to Low", "Newest"]} />
                      </div>
                      <button
                        type="button"
                        disabled={!collDisplayName.trim() || !collBrand || !collCategory}
                        onClick={() => setCollCreated(true)}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                          collDisplayName.trim() && collBrand && collCategory
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}>
                        {collCreated ? "✓ Collection Created" : "Create Collection"}
                      </button>
                    </div>
                  </div>

                  {/* Right: preview */}
                  <CollectionPreview skus={previewSkus.map((s) => ({ name: s.name, variant: variantLabel(s.name) }))} />
                </div>
              )}
            </div>
          )}
        </div>

        {showErrors && !variant && (
          <p className="text-xs text-red-500 font-medium">*Please select one the asset variant to continue</p>
        )}
      </div>

      {/* ── Single product: Ad Creative ── */}
      {variant === "single_product" && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 680 }}>
              <div>
                <p className="text-sm font-semibold text-foreground">Ad creative</p>
                <p className="text-xs text-muted-foreground mt-0.5">Choose how your ad will be displayed</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">Select a background image</p>
                <div className="grid grid-cols-6 gap-2">
                  {BG_OPTIONS.map((opt) => {
                    const sel = selectedBg === opt.id;
                    return (
                      <button key={opt.id} type="button" onClick={() => setSelectedBg(opt.id)}
                        className={`relative h-[78px] w-full rounded-lg overflow-hidden border-2 transition-all ${sel ? "border-green-600 scale-105 shadow-md" : "border-transparent hover:border-gray-300"}`}
                        style={{ background: opt.bg }}>
                        {opt.sunburst && <div className="absolute inset-0 opacity-20" style={{ background: "repeating-conic-gradient(rgba(255,255,255,0.15) 0deg 10deg, transparent 10deg 20deg)" }} />}
                        {sel && <div className="absolute inset-0 flex items-center justify-center"><div className="h-6 w-6 rounded-full bg-white/90 flex items-center justify-center"><Check className="h-3.5 w-3.5 text-green-600" /></div></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1.5">Brand Name</label>
                <input type="text" maxLength={14} value={brandNameSingle} onChange={(e) => setBrandNameSingle(e.target.value)}
                  placeholder="Input text"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-green-500 bg-white" />
                <p className="text-xs text-muted-foreground mt-1">({brandNameSingle.length}/14 characters)</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Text formatting</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li className="text-xs text-muted-foreground">Use only english</li>
                  <li className="text-xs text-muted-foreground">Use sentence casing</li>
                </ul>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Ad creative</p>
                <p className="text-xs text-muted-foreground mt-0.5">Choose how your ad will be displayed</p>
              </div>
              <div className="flex items-center justify-between rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                <p className="text-xs text-blue-700">Follow the creative guidelines for quick approval</p>
                <a href="https://cdn-brands.blinkit.com/banners/1779444585181__Story_1.pdf" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-semibold whitespace-nowrap ml-2 hover:underline">View creative guidelines ▶</a>
              </div>
              <div className="flex gap-6 items-start">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-[120px] h-[120px] rounded-xl overflow-hidden relative flex flex-col items-center border-2 border-blue-400 shrink-0"
                    style={{ background: selectedBg !== null ? BG_OPTIONS[selectedBg].bg : "#e5e7eb" }}>
                    {selectedBg !== null && BG_OPTIONS[selectedBg].sunburst && (
                      <div className="absolute inset-0 opacity-20" style={{ background: "repeating-conic-gradient(rgba(255,255,255,0.15) 0deg 10deg, transparent 10deg 20deg)" }} />
                    )}
                    <div className="relative z-10 mt-2 px-2 py-0.5 rounded-sm text-[9px] font-bold text-white" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>Featured</div>
                    <div className="relative z-10 flex-1 flex items-center justify-center px-2">
                      <p className="text-[11px] font-bold text-white text-center leading-tight drop-shadow">{brandNameSingle || "brand name"}</p>
                    </div>
                    <div className="relative z-10 mb-1 flex items-end justify-center h-10"><ProductBottle /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">Thumbnail Preview</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-[140px] rounded-lg overflow-hidden border border-border bg-white shrink-0">
                    <div className="w-full h-[120px] relative flex items-center justify-center" style={{ background: selectedBg !== null ? BG_OPTIONS[selectedBg].bg : "#f3f4f6" }}>
                      {selectedBg !== null && BG_OPTIONS[selectedBg].sunburst && (
                        <div className="absolute inset-0 opacity-20" style={{ background: "repeating-conic-gradient(rgba(255,255,255,0.15) 0deg 10deg, transparent 10deg 20deg)" }} />
                      )}
                      <div className="relative z-10"><ProductBottle large /></div>
                      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                        <div className="h-5 w-5 rounded-full bg-black/40 flex items-center justify-center"><span className="text-white text-[8px]">↓</span></div>
                        <div className="h-5 w-5 rounded-full bg-black/40 flex items-center justify-center"><span className="text-white text-[8px]">⤴</span></div>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] font-semibold text-foreground leading-tight line-clamp-3">{selectedSkuObj?.name ?? "Product name"}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Product page preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Collection: Ad Creative ── */}
      {variant === "collection" && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-border">
            {/* Left: uploads + brand name */}
            <div className="p-6 space-y-6 overflow-y-auto" style={{ maxHeight: 700 }}>
              <p className="text-base font-semibold text-foreground">Ad Creative</p>

              {/* Key image */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Key image</p>
                  <p className="text-xs text-muted-foreground">Upload the ad creative you want to display in the ad</p>
                </div>
                <UploadZone onFile={setKeyImageUrl} preview={keyImageUrl} />
                <ul className="space-y-0.5">
                  <li className="text-xs text-muted-foreground">• Dimensions: <strong>1160 x 800 px</strong></li>
                  <li className="text-xs text-muted-foreground">• The visual should be a composition of 2 OR 3 Product Images or a visual of the brand ambassador with the product in focus.</li>
                  <li className="text-xs text-muted-foreground">• File size: Under <strong>200 KB</strong></li>
                </ul>
              </div>

              {/* Overlay brand logo */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Overlay brand logo</p>
                  <p className="text-xs text-muted-foreground">Upload a transparent brand logo</p>
                </div>
                <UploadZone onFile={setOverlayLogoUrl} preview={overlayLogoUrl} />
                <ul className="space-y-0.5">
                  <li className="text-xs text-muted-foreground">• Dimensions: <strong>1120 x 364 px</strong></li>
                  <li className="text-xs text-muted-foreground">• The visual should have a transparent background</li>
                  <li className="text-xs text-muted-foreground">• File size: Under <strong>200 KB</strong></li>
                </ul>
              </div>

              {/* Brand Logo */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Brand Logo</p>
                  <p className="text-xs text-muted-foreground">Upload the ad creative you want to display in the ad</p>
                </div>
                <div className="space-y-2">
                  {(["upload", "default"] as const).map((type) => (
                    <div key={type} className="flex items-center gap-2 cursor-pointer" onClick={() => setBrandLogoType(type)}>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${brandLogoType === type ? "border-green-600 bg-green-600" : "border-gray-300"}`}>
                        {brandLogoType === type && <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <span className="text-sm text-foreground">{type === "upload" ? "Upload a logo" : "Use default brand logo"}</span>
                    </div>
                  ))}
                </div>
                {brandLogoType === "upload" && (
                  <>
                    <UploadZone onFile={setBrandLogoUrl} preview={brandLogoUrl} />
                    <ul className="space-y-0.5">
                      <li className="text-xs text-muted-foreground">• Dimensions: <strong>268 x 268 px</strong></li>
                      <li className="text-xs text-muted-foreground">• File size: Under <strong>200 KB</strong></li>
                    </ul>
                  </>
                )}
              </div>

              {/* Brand Name */}
              <div className="border border-border rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">Brand Name</p>
                <input type="text" maxLength={29} value={collBrandName} onChange={(e) => setCollBrandName(e.target.value)}
                  placeholder="Heading"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-green-500 bg-white" />
                <p className="text-xs text-muted-foreground">{collBrandName.length}/29 characters</p>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Text formatting</p>
                  <ul className="space-y-0.5">
                    <li className="text-xs text-muted-foreground">• Use only english</li>
                    <li className="text-xs text-muted-foreground">• Use sentence casing</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right: Ad preview */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Ad preview</p>
                <p className="text-xs text-muted-foreground mt-0.5">This is how the story will appear</p>
              </div>
              <div className="flex items-center justify-between rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                <p className="text-xs text-blue-700">Follow the creative guidelines for quick approval</p>
                <a href="https://cdn-brands.blinkit.com/banners/1779444585181__Story_1.pdf" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-semibold whitespace-nowrap ml-2 hover:underline">View creative guidelines ▶</a>
              </div>

              <div className="flex gap-4 items-start">
                {/* Thumbnail */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-[110px] h-[140px] rounded-2xl border-2 border-blue-400 bg-gray-200 relative overflow-hidden flex flex-col">
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white bg-red-500">Featured</div>
                    {keyImageUrl
                      ? <img src={keyImageUrl} alt="key" className="absolute inset-0 w-full h-full object-cover" />
                      : <div className="flex-1 flex items-center justify-center"><span className="text-xs text-gray-500 text-center px-2">Key Image</span></div>
                    }
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                      <div className="bg-white/80 rounded-full px-3 py-0.5 text-[8px] text-gray-600 font-medium">
                        {overlayLogoUrl ? <img src={overlayLogoUrl} alt="logo" className="h-4" /> : "Overlay brand logo"}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Thumbnail Preview</p>
                </div>

                {/* Product page */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-[150px] rounded-2xl border border-border bg-white overflow-hidden shadow-sm">
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-white">
                      <span className="text-[8px] text-gray-600 font-medium">5:13 PM</span>
                      <div className="flex gap-0.5 items-center">
                        {["⏰","🔔","📶"].map((i) => <span key={i} className="text-[7px]">{i}</span>)}
                      </div>
                    </div>
                    {/* Action icons */}
                    <div className="flex justify-between items-center px-3 pb-1">
                      <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center"><span className="text-[8px]">↓</span></div>
                      <div className="flex gap-1">
                        <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center"><span className="text-[8px]">🔍</span></div>
                        <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center"><span className="text-[8px]">⤴</span></div>
                      </div>
                    </div>
                    {/* Key image area */}
                    <div className="mx-2 rounded-lg bg-gray-300 overflow-hidden" style={{ height: 80 }}>
                      {keyImageUrl
                        ? <img src={keyImageUrl} alt="key" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><span className="text-[9px] text-gray-500">Key Image</span></div>
                      }
                    </div>
                    {/* Brand logo + name */}
                    <div className="flex flex-col items-center py-2 gap-1">
                      <div className="h-8 w-8 rounded-full bg-gray-200 border border-gray-300 overflow-hidden flex items-center justify-center">
                        {brandLogoUrl
                          ? <img src={brandLogoUrl} alt="logo" className="w-full h-full object-cover" />
                          : <span className="text-[8px] text-gray-400">Logo</span>
                        }
                      </div>
                      <span className="text-[9px] text-gray-500">{collBrandName || "Brand name goes here"}</span>
                    </div>
                    {/* Product cards */}
                    <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                      {[0,1,2].map((i) => (
                        <div key={i} className="border border-gray-200 rounded p-1 flex flex-col items-center gap-0.5">
                          <div className="w-full h-6 bg-gray-100 rounded" />
                          <button className="w-full text-[7px] border border-gray-300 rounded text-gray-500 py-px">ADD</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Product page preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Collection preview table ──────────────────────────────────────────────────
function CollectionPreview({ skus }: { skus: { name: string; variant: string }[] }) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr_120px] px-4 py-2.5 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold text-foreground">Product Name</span>
        <span className="text-xs font-semibold text-foreground">Variants</span>
      </div>
      {skus.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="h-14 w-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mb-3">
            <span className="text-2xl">📥</span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">No products yet!</p>
          <p className="text-xs text-gray-400">Select brand and category filters to add products or manually select PIDs below</p>
        </div>
      ) : (
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {skus.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px] items-center px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded border border-border bg-muted/30 shrink-0 flex items-center justify-center">
                  <span className="text-[8px] text-muted-foreground">IMG</span>
                </div>
                <span className="text-xs text-foreground leading-tight line-clamp-2">{s.name}</span>
              </div>
              <div>
                <span className="inline-block border border-gray-300 rounded px-2 py-0.5 text-xs text-foreground">{s.variant}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Generic select dropdown ───────────────────────────────────────────────────
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground block mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white appearance-none outline-none focus:border-green-500 pr-8"
        >
          <option value="">{label}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}
