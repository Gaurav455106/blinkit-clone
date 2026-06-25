import { useState, useRef, useEffect } from "react";
import { X, CheckCircle2, XCircle, ChevronDown, Star } from "lucide-react";
import { useSim } from "@/context/SimContext";

const GUIDELINES_PDF =
  "https://cdn-brands.blinkit.com/banners/1773739886011__Listing_Spotlight_Guidelines.pdf";

const REQ_W = 208;
const REQ_H = 520;
const MAX_SIZE_KB = 180;
const SAFE_W = 160;
const SAFE_H = 372;

const SORT_OPTIONS = [
  "Relevance",
  "Price: Low to High",
  "Price: High to Low",
  "Best Sellers",
  "New Arrivals",
];

// Extract size/weight variant from SKU name (e.g. "150g", "500 ml")
function extractVariant(name: string, mrp: number): string {
  const m = name.match(/\d+\s*(?:g|ml|L|kg|oz|gm)\b/i);
  return m ? m[0] : `₹${mrp}`;
}

type CollectionMode = "existing" | "filter" | "manual";

interface Checks {
  sizeOk: boolean | null;
  dimsOk: boolean | null;
  imgW: number;
  imgH: number;
}

export interface BrandCollectionPayload {
  name: string;
  type: "DYNAMIC" | "MANUAL";
  productCount: number;
}

interface Props {
  onProductsValid?: (v: boolean) => void;
  onCollectionCreated?: (coll: BrandCollectionPayload) => void;
}

// ── Select helper ────────────────────────────────────────────────────────────
function Select({
  value, onChange, placeholder, options, disabled = false,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[]; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm appearance-none bg-white text-gray-700 pr-8 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ── Generic multi-select dropdown ─────────────────────────────────────────────
function MultiSelect({
  value, onChange, placeholder, options, countLabel, disabled = false,
}: {
  value: string[]; onChange: (v: string[]) => void;
  placeholder: string; options: string[]; countLabel: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);

  const display = value.length === 0 ? placeholder : `${value.length} ${countLabel} Selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-left flex items-center justify-between bg-white disabled:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <span className={value.length === 0 ? "text-gray-400" : "text-gray-700"}>{display}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
      </button>
      {open && !disabled && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {options.map((o) => (
            <li key={o} onClick={() => toggle(o)}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" readOnly checked={value.includes(o)}
                className="accent-green-600 h-4 w-4 shrink-0 pointer-events-none" />
              <span className="text-sm text-gray-700">{o}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── ProductMultiSelect — dropdown style, up to 5 items ───────────────────────
function ProductMultiSelect({
  value, onChange, disabled = false, products,
}: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; products: { id: string; name: string; variants: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) => {
    onChange(
      value.includes(id)
        ? value.filter((x) => x !== id)
        : value.length < 5 ? [...value, id] : value
    );
  };

  const label = value.length === 0
    ? "Select from a list of products"
    : products.filter((p) => value.includes(p.id)).map((p) => p.name).join(", ");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-left flex items-center justify-between bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <span className={`truncate ${value.length === 0 ? "text-gray-400" : "text-gray-700"}`}>{label}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
      </button>

      {open && !disabled && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {products.map((p) => {
            const checked = value.includes(p.id);
            const maxed = !checked && value.length >= 5;
            return (
              <li key={p.id}
                onClick={() => !maxed && toggle(p.id)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${maxed ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}`}>
                <input type="checkbox" readOnly checked={checked}
                  className="accent-green-600 h-4 w-4 shrink-0 pointer-events-none" />
                <div>
                  <p className="text-sm text-gray-800 leading-tight">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.variants}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ListingSpotlightProducts({ onProductsValid, onCollectionCreated }: Props) {
  const { scenario } = useSim();

  // ── Derive brands, categories, products from scenario brief ──
  const BRANDS = scenario ? [scenario.profile.name] : [];
  const CATEGORIES = scenario
    ? [scenario.profile.category, ...scenario.profile.relevantCategories]
    : [];
  const BRIEF_PRODUCTS = (scenario?.profile.skus ?? []).map((sku) => ({
    id: sku.id,
    name: sku.name,
    variants: extractVariant(sku.name, sku.mrp),
  }));
  const EXISTING_COLLECTIONS = scenario
    ? [
        `${scenario.profile.name} – Top Sellers`,
        `${scenario.profile.category} Essentials`,
        `${scenario.profile.name} – New Arrivals`,
        `${scenario.profile.name} – Bestsellers`,
      ]
    : [];

  // ── Ad creative state ──
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showError, setShowError] = useState(false);
  const [checks, setChecks] = useState<Checks>({ sizeOk: null, dimsOk: null, imgW: 0, imgH: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Collection state ──
  const [mode, setMode] = useState<CollectionMode>("existing");
  const [existingSearch, setExistingSearch] = useState("");
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  const [filterName, setFilterName] = useState("");
  const [filterBrands, setFilterBrands] = useState<string[]>([]);
  const [filterCats, setFilterCats] = useState<string[]>([]);
  const [filterSubCat, setFilterSubCat] = useState("");
  const [filterSort, setFilterSort] = useState("");

  const [manualName, setManualName] = useState("");
  const [manualSort, setManualSort] = useState("");
  const [manualProducts, setManualProducts] = useState<string[]>([]);
  const [showCollectionError, setShowCollectionError] = useState(false);

  // collectionCreated = user clicked "Create Collection"; resets when inputs change
  const [collectionCreated, setCollectionCreated] = useState(false);

  // ── Button enable conditions ──
  const filterReady = filterBrands.length > 0 && filterCats.length > 0;
  const manualReady = !!manualName && manualProducts.length > 0;

  // ── Derived: is collection valid? ──
  const collectionValid =
    (mode === "existing" && selectedCollections.length > 0) ||
    (mode === "filter" && collectionCreated && filterReady) ||
    (mode === "manual" && collectionCreated && manualReady);

  // ── Preview products — live as filters change; Next gated by collectionCreated ──
  const previewProducts =
    mode === "existing" && selectedCollections.length > 0
      ? BRIEF_PRODUCTS.slice(0, 3)
      : mode === "filter" && filterReady
      ? BRIEF_PRODUCTS // brand selected = show all brief SKUs
      : mode === "manual" && manualProducts.length > 0
      ? BRIEF_PRODUCTS.filter((p) => manualProducts.includes(p.id))
      : [];

  useEffect(() => {
    onProductsValid?.(!!uploadedFile && collectionValid);
  }, [uploadedFile, collectionValid]);

  // ── File handlers ──
  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const sizeOk = file.size <= MAX_SIZE_KB * 1024;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      setChecks({ sizeOk, dimsOk: img.naturalWidth === REQ_W && img.naturalHeight === REQ_H, imgW: img.naturalWidth, imgH: img.naturalHeight });
    img.src = url;
    setUploadedFile(file);
    setPreviewUrl(url);
    setShowError(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setChecks({ sizeOk: null, dimsOk: null, imgW: 0, imgH: 0 });
    setShowError(true);
  };

  // Safe-zone overlay
  const previewContainerH = 300;
  const renderedW = (REQ_W / REQ_H) * previewContainerH;
  const safeRenderedW = (SAFE_W / REQ_W) * renderedW;
  const safeRenderedH = (SAFE_H / REQ_H) * previewContainerH;
  const safeTop = (previewContainerH - safeRenderedH) / 2;

  const filteredCollections = EXISTING_COLLECTIONS.filter((c) =>
    c.toLowerCase().includes(existingSearch.toLowerCase())
  );

  const toggleManualProduct = (id: string) => {
    setManualProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Card 1: Ad creative + Ad preview ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex gap-8">
          {/* Left */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900">Ad creative</h3>
            <p className="text-sm text-gray-500 mt-0.5 mb-4">Upload the ad creative you want to display in the ad</p>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-gray-300"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {uploadedFile ? (
                <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                  <img src={previewUrl!} alt="uploaded" className="max-h-40 mx-auto rounded shadow-sm" />
                  <button onClick={handleRemove}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                    <X className="h-3 w-3" />
                  </button>
                  <p className="text-xs text-gray-500 mt-2">{uploadedFile.name}</p>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl text-gray-400 leading-none">+</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Drop your files here</p>
                  <p className="text-sm mt-1">
                    <span className="text-green-600 font-medium">Browse Files</span>
                    <span className="text-gray-500"> from your Computer</span>
                  </p>
                </>
              )}
            </div>

            {uploadedFile && (
              <div className="mt-4 space-y-2">
                <CheckRow ok={checks.sizeOk}
                  pass={`File size OK (${(uploadedFile.size / 1024).toFixed(1)} kB ≤ ${MAX_SIZE_KB} kB)`}
                  fail={`File too large (${(uploadedFile.size / 1024).toFixed(1)} kB — max ${MAX_SIZE_KB} kB)`} />
                <CheckRow ok={checks.dimsOk}
                  pass={`Dimensions OK (${checks.imgW}×${checks.imgH} px)`}
                  fail={`Wrong dimensions (${checks.imgW}×${checks.imgH} px — required ${REQ_W}×${REQ_H} px)`} />
              </div>
            )}

            <div className="mt-5">
              <p className="text-sm font-semibold text-gray-800">Banner guidelines for quick approval</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
                <li>Dimension: {REQ_W}×{REQ_H} px | max file size: {MAX_SIZE_KB}kB | Min font size: 12px</li>
                <li>Safe Content Area: {SAFE_W} × {SAFE_H} px</li>
                <li>Use plain backgrounds or soft textures in padding areas</li>
                <li>Use english only</li>
                <li>No price callouts and T&amp;Cs</li>
                <li>Make sure all important elements in the image are kept within the safe area</li>
              </ul>
            </div>
            {showError && <p className="text-sm text-red-500 mt-3 font-medium">Please upload an image to continue</p>}
          </div>

          {/* Right */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900">Ad preview</h3>
            <p className="text-sm text-gray-500 mt-0.5 mb-4">Ensure that the creative falls within the safe area</p>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center justify-between mb-4">
              <span className="text-sm text-blue-800">Follow the creative guidelines for quick approval</span>
              <a href={GUIDELINES_PDF} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 font-medium whitespace-nowrap ml-4 hover:underline">
                View creative guidelines ▶
              </a>
            </div>

            {/* Outer white container matching screenshot */}
            <div className="border border-gray-200 rounded-xl bg-white flex items-center justify-center overflow-hidden relative"
              style={{ height: previewContainerH + 40 }}>
              {previewUrl ? (
                /* When image uploaded — show it with safe zone overlay */
                <div className="relative flex items-center justify-center h-full">
                  <img src={previewUrl} alt="Ad preview" className="max-h-full max-w-full object-contain" />
                  <div style={{
                    position: "absolute", width: safeRenderedW, height: safeRenderedH,
                    left: `calc(50% - ${safeRenderedW / 2}px)`, top: (previewContainerH + 40 - safeRenderedH) / 2,
                    border: "2px dashed rgba(34,197,94,0.8)", borderRadius: 2, pointerEvents: "none",
                  }}>
                    <span style={{
                      position: "absolute", top: -18, left: 0, fontSize: 9,
                      color: "rgba(34,197,94,0.9)", background: "rgba(255,255,255,0.8)",
                      padding: "1px 4px", borderRadius: 2, whiteSpace: "nowrap",
                    }}>Safe zone ({SAFE_W}×{SAFE_H} px)</span>
                  </div>
                </div>
              ) : (
                /* Empty state — portrait banner placeholder centered */
                <div
                  className="bg-gray-100 rounded-md flex items-center justify-center"
                  style={{ width: Math.round((REQ_W / REQ_H) * previewContainerH), height: previewContainerH }}
                >
                  <p className="text-sm text-gray-400 text-center px-4 leading-relaxed">
                    Your ad preview will be<br />generated here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 2: Select campaign collection ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900">Select campaign collection</h3>
        <p className="text-sm text-gray-500 mt-0.5 mb-5">
          This is the collection of products you want to promote through this campaign
        </p>

        <div className="flex gap-6">
          {/* Left: options — all always expanded */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Option 1 — Existing */}
            <div onClick={() => setMode("existing")} className={`border rounded-lg p-4 transition-colors cursor-pointer ${mode === "existing" ? "border-gray-200 bg-green-50/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${mode === "existing" ? "border-green-500 bg-green-500" : "border-gray-400"}`}>
                  {mode === "existing" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Select from existing collections</p>
                  <p className="text-xs text-gray-500">Get products from your existing collection</p>
                </div>
              </label>

              <div className="mt-3 relative">
                {/* Input area with chips */}
                <div
                  className={`min-h-[40px] w-full border border-gray-200 rounded-md px-3 py-1.5 flex flex-wrap gap-1.5 items-center focus-within:ring-1 focus-within:ring-green-500 ${mode !== "existing" ? "bg-gray-50" : "bg-white"}`}
                  onClick={() => mode === "existing" && document.getElementById("existing-search-input")?.focus()}
                >
                  {/* Selected chips */}
                  {selectedCollections.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-medium rounded px-2 py-1 shrink-0">
                      {c}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedCollections((prev) => prev.filter((x) => x !== c)); }}
                        className="hover:text-green-200 leading-none"
                      >×</button>
                    </span>
                  ))}
                  {/* Search input */}
                  <input
                    id="existing-search-input"
                    type="text"
                    placeholder={selectedCollections.length === 0 ? "Search from existing brand collections" : ""}
                    value={existingSearch}
                    disabled={mode !== "existing"}
                    onChange={(e) => setExistingSearch(e.target.value)}
                    className="flex-1 min-w-[120px] text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400 disabled:cursor-not-allowed py-0.5"
                  />
                </div>
                {/* Dropdown */}
                {mode === "existing" && existingSearch && filteredCollections.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-md max-h-48 overflow-y-auto">
                    {filteredCollections
                      .filter((c) => !selectedCollections.includes(c))
                      .map((c) => (
                        <li key={c}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-green-50 text-gray-700"
                          onClick={() => { setSelectedCollections((prev) => [...prev, c]); setExistingSearch(""); }}>
                          {c}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Option 2 — Filter */}
            <div onClick={() => setMode("filter")} className={`border rounded-lg p-4 transition-colors cursor-pointer ${mode === "filter" ? "border-gray-200 bg-green-50/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${mode === "filter" ? "border-green-500 bg-green-500" : "border-gray-400"}`}>
                  {mode === "filter" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Create collection via filters</p>
                  <p className="text-xs text-gray-500">Select products from the brand and category filters</p>
                </div>
              </label>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Collection display name</label>
                  <input type="text" placeholder="Enter Collection Name" value={filterName}
                    disabled={mode !== "filter"}
                    onChange={(e) => { setFilterName(e.target.value); setCollectionCreated(false); }}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Select brand</label>
                    <MultiSelect value={filterBrands}
                      onChange={(v) => { setFilterBrands(v); setCollectionCreated(false); }}
                      placeholder="Select from a list of brands" options={BRANDS}
                      countLabel="Brands" disabled={mode !== "filter"} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Select category</label>
                    <MultiSelect value={filterCats}
                      onChange={(v) => { setFilterCats(v); setFilterSubCat(""); setCollectionCreated(false); }}
                      placeholder="Select categories" options={CATEGORIES}
                      countLabel="Categories" disabled={mode !== "filter"} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Select sub-categories</label>
                    <Select value={filterSubCat} onChange={setFilterSubCat} placeholder="Select sub-categories"
                      options={filterCats.length > 0 ? CATEGORIES.filter((c) => !filterCats.includes(c)) : []} disabled={mode !== "filter"} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Sort products by</label>
                    <Select value={filterSort} onChange={setFilterSort} placeholder="Select an Option" options={SORT_OPTIONS} disabled={mode !== "filter"} />
                  </div>
                </div>
                {mode === "filter" && (
                  <button
                    disabled={!filterReady}
                    onClick={() => {
                      setCollectionCreated(true);
                      const name = filterName || `${filterBrands.join(", ")} – ${filterCats.join(", ")} Collection`;
                      onCollectionCreated?.({ name, type: "DYNAMIC", productCount: BRIEF_PRODUCTS.length });
                    }}
                    className={`mt-2 px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                      filterReady
                        ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                        : "bg-gray-300 text-white cursor-not-allowed"
                    }`}
                  >
                    Create Collection
                  </button>
                )}
              </div>
            </div>

            {/* Option 3 — Manual */}
            <div onClick={() => setMode("manual")} className={`border rounded-lg p-4 transition-colors cursor-pointer ${mode === "manual" ? "border-gray-200 bg-green-50/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${mode === "manual" ? "border-green-500 bg-green-500" : "border-gray-400"}`}>
                  {mode === "manual" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Create collection manually</p>
                  <p className="text-xs text-gray-500">Select up to 5 products manually</p>
                </div>
              </label>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Collection display name</label>
                    <input type="text" placeholder="Enter Collection Name" value={manualName}
                      disabled={mode !== "manual"}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Sort products by</label>
                    <Select value={manualSort} onChange={setManualSort} placeholder="Select an Option" options={SORT_OPTIONS} disabled={mode !== "manual"} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Select products</label>
                  <ProductMultiSelect
                    value={manualProducts}
                    onChange={(v) => { setManualProducts(v); setCollectionCreated(false); }}
                    disabled={mode !== "manual"}
                    products={BRIEF_PRODUCTS}
                  />
                </div>
                {mode === "manual" && (
                  <button
                    disabled={!manualReady}
                    onClick={() => {
                      setCollectionCreated(true);
                      onCollectionCreated?.({ name: manualName, type: "MANUAL", productCount: manualProducts.length });
                    }}
                    className={`mt-2 px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                      manualReady
                        ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                        : "bg-gray-300 text-white cursor-not-allowed"
                    }`}
                  >
                    Create Collection
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Collection preview */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900">Collection preview</h3>
            <p className="text-sm text-gray-500 mt-0.5 mb-4">
              Add products from a brand and category to create a collection
            </p>

            <div className="border border-gray-100 rounded-lg overflow-hidden bg-green-50/20">
              {/* Table header */}
              <div className="flex bg-gray-50/80 border-b border-gray-200">
                <div className="flex-1 px-4 py-3 text-sm font-semibold text-gray-500 pl-16">Product Name</div>
                <div className="w-40 px-4 py-3 text-sm font-semibold text-gray-500 shrink-0">Variants</div>
              </div>

              {previewProducts.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {previewProducts.map((p) => (
                    <div key={p.id} className="flex items-center px-4 py-3 gap-3">
                      {/* Star */}
                      <Star className="h-5 w-5 text-gray-300 shrink-0" />
                      {/* Thumbnail */}
                      <div className="h-12 w-12 rounded border border-gray-200 bg-gray-100 shrink-0 flex items-center justify-center overflow-hidden">
                        <span className="text-[10px] text-gray-400 text-center leading-tight px-1">{p.name.split(" ").slice(0, 2).join(" ")}</span>
                      </div>
                      {/* Name */}
                      <p className="flex-1 text-sm text-gray-800 leading-snug">{p.name}</p>
                      {/* Variant pill */}
                      <div className="w-40 shrink-0">
                        <span className="inline-block border border-gray-300 rounded-full px-3 py-1 text-xs text-gray-600">
                          {p.variants.split(", ")[0]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  {/* Inbox tray illustration matching platform */}
                  <svg width="80" height="60" viewBox="0 0 80 60" fill="none" className="mb-4 text-gray-300">
                    {/* horizontal doc lines left */}
                    <line x1="4" y1="22" x2="18" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    <line x1="4" y1="29" x2="16" y2="29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    <line x1="4" y1="36" x2="18" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    {/* horizontal doc lines right */}
                    <line x1="62" y1="22" x2="76" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    <line x1="64" y1="29" x2="76" y2="29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    <line x1="62" y1="36" x2="76" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    {/* spark lines top */}
                    <line x1="40" y1="2" x2="40" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="33" y1="5" x2="36" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="47" y1="5" x2="44" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    {/* tray body */}
                    <rect x="22" y="28" width="36" height="24" rx="2" stroke="currentColor" strokeWidth="2" fill="white"/>
                    {/* tray divider / lip */}
                    <path d="M22 40 h10 l3 6 h10 l3-6 h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  <p className="text-base font-medium text-gray-400 mb-1">No products yet!</p>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                    Select brand and category filters to add products or manually select PIDs below
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {showCollectionError && !collectionValid && (
          <p className="text-sm text-red-500 mt-4 font-medium">Brand collection is required</p>
        )}
      </div>
    </div>
  );
}

function CheckRow({ ok, pass, fail }: { ok: boolean | null; pass: string; fail: string }) {
  if (ok === null) return null;
  return (
    <div className={`flex items-center gap-2 text-sm ${ok ? "text-green-700" : "text-red-600"}`}>
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
      <span>{ok ? pass : fail}</span>
    </div>
  );
}
