import { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Info } from "lucide-react";
import { useSim } from "@/context/SimContext";
import { BrandCollection } from "./BrandCollectionsView";

function extractVariant(name: string, mrp: number): string {
  const m = name.match(/\d+\s*(?:g|ml|L|kg|oz|gm|x\s*\d+\s*(?:ml|g))\b/i);
  return m ? m[0] : `₹${mrp}`;
}

function MultiSelect({
  value, onChange, placeholder, options, countLabel,
}: {
  value: string[]; onChange: (v: string[]) => void;
  placeholder: string; options: string[]; countLabel: string;
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
        onClick={() => setOpen((p) => !p)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <span className={value.length === 0 ? "text-gray-400" : "text-gray-800"}>{display}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
      </button>
      {open && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map((o) => (
            <li key={o} onClick={() => toggle(o)}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
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

function SingleSelect({
  value, onChange, placeholder, options,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white text-gray-800 pr-8 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

const SORT_OPTIONS = ["Relevance", "Price: Low to High", "Price: High to Low", "Best Sellers", "New Arrivals"];

interface Props {
  collection: BrandCollection;
  onClose: () => void;
  onUpdate: (updated: BrandCollection) => void;
}

export function EditCollectionDialog({ collection, onClose, onUpdate }: Props) {
  const { scenario } = useSim();

  const BRANDS = scenario ? [scenario.profile.name] : [];
  const CATEGORIES = scenario ? [scenario.profile.category, ...scenario.profile.relevantCategories] : [];
  const ALL_PRODUCTS = (scenario?.profile.skus ?? []).map((sku) => ({
    id: sku.id,
    name: sku.name,
    variant: extractVariant(sku.name, sku.mrp),
    mrp: sku.mrp,
  }));

  const [displayName, setDisplayName] = useState(collection.name);
  const [brands, setBrands] = useState<string[]>(BRANDS.slice(0, 1));
  const [categories, setCategories] = useState<string[]>(CATEGORIES.slice(0, 1));
  const [subCat, setSubCat] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [boostInput, setBoostInput] = useState("");

  // Preview: show products when brand + category selected
  const previewProducts = brands.length > 0 && categories.length > 0 ? ALL_PRODUCTS : [];

  const handleUpdate = () => {
    onUpdate({
      ...collection,
      name: displayName.trim() || collection.name,
      productCount: previewProducts.length,
    });
    onClose();
  };

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">Edit brand collection</h2>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── Left: Form ── */}
          <div className="flex-1 overflow-y-auto px-6 py-3">
            <div className="divide-y divide-gray-100">
              {/* Collection display name */}
              <div className="flex items-start gap-4 py-3">
                <div className="w-40 shrink-0 pt-1">
                  <p className="text-xs font-semibold text-gray-800">Collection display name</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Upto 29 Characters</p>
                </div>
                <input
                  type="text"
                  value={displayName}
                  maxLength={29}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Select Brands */}
              <div className="flex items-center gap-4 py-3">
                <p className="w-40 shrink-0 text-xs font-semibold text-gray-800">Select Brands</p>
                <div className="flex-1">
                  <MultiSelect value={brands} onChange={setBrands} placeholder="Select brands" options={BRANDS} countLabel="Brands" />
                </div>
              </div>

              {/* Select Categories */}
              <div className="flex items-center gap-4 py-3">
                <p className="w-40 shrink-0 text-xs font-semibold text-gray-800">Select Categories</p>
                <div className="flex-1">
                  <MultiSelect value={categories} onChange={setCategories} placeholder="Select categories" options={CATEGORIES} countLabel="Categories" />
                </div>
              </div>

              {/* Select sub-categories */}
              <div className="flex items-center gap-4 py-3">
                <p className="w-40 shrink-0 text-xs font-semibold text-gray-800">Select sub-categories</p>
                <div className="flex-1">
                  <SingleSelect value={subCat} onChange={setSubCat} placeholder="Select sub-categories" options={CATEGORIES.filter((c) => !categories.includes(c))} />
                </div>
              </div>

              {/* Sort by */}
              <div className="flex items-center gap-4 py-3">
                <p className="w-40 shrink-0 text-xs font-semibold text-gray-800">Sort by</p>
                <div className="flex-1">
                  <SingleSelect value={sortBy} onChange={setSortBy} placeholder="Select an Option" options={SORT_OPTIONS} />
                </div>
              </div>

              {/* Boost Products */}
              <div className="flex items-start gap-4 py-3">
                <div className="w-40 shrink-0 pt-1">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-gray-800">Boost Products</p>
                    <Info className="h-3 w-3 text-gray-400" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Select up to 25 products</p>
                </div>
                <input
                  type="text"
                  value={boostInput}
                  onChange={(e) => setBoostInput(e.target.value)}
                  placeholder="Select Products"
                  className="flex-1 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* ── Right: Preview ── */}
          <div className="w-56 shrink-0 bg-gray-50 border-l border-gray-100 flex flex-col">
            <div className="px-3 py-2.5 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-700">Collections Preview</p>
            </div>

            <div className="flex-1 p-3 space-y-2 overflow-y-auto">
              {previewProducts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center pt-6">Select a brand and category to preview</p>
              ) : (
                previewProducts.map((p) => (
                  <div key={p.id} className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="h-16 w-full bg-gray-100 rounded flex items-center justify-center mb-2">
                      <div className="text-center">
                        <div className="text-lg">📦</div>
                        <div className="text-[8px] text-gray-400 leading-tight mt-0.5">{p.name.split(" ").slice(0, 2).join(" ")}</div>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-900 leading-snug">{p.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">₹{p.mrp}</p>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 space-y-2 shrink-0">
              <div className="flex items-start gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-2">
                <Info className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-500 leading-snug">Preview is based on the products available in Gurugram</p>
              </div>
              <button
                onClick={handleUpdate}
                className="w-full bg-green-700 hover:bg-green-800 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
              >
                Update Collection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
