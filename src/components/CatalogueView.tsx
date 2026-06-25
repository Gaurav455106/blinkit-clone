import { useState } from "react";
import { Search, ChevronDown, MoreVertical, Plus, ArrowLeft } from "lucide-react";
import { useSim } from "@/context/SimContext";

// Generate a fake but stable UPC from a string seed
function seedUPC(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const base = (890_801_924_0000 + (hash % 10_000_000)).toString().slice(0, 13);
  return base.padEnd(13, "0");
}

// Generate a stable 6-digit product ID
function seedProductId(seed: string, offset: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return 700000 + (hash % 30000) + offset;
}

type CatalogueTab = "Requests" | "Products";

export function CatalogueView({ onBack }: { onBack?: () => void }) {
  const { scenario, student } = useSim();
  const [tab, setTab] = useState<CatalogueTab>("Products");
  const [brandFilter, setBrandFilter] = useState("All brands");
  const [search, setSearch] = useState("");

  const skus = scenario?.profile.skus ?? [];
  const brandName = scenario?.profile.name ?? "Brand";

  const products = skus.map((sku, i) => ({
    productId: seedProductId(sku.id, i * 137),
    upc: seedUPC(sku.id),
    name: sku.name,
    size: sku.name.match(/\d+\s*(?:g|ml|L|kg|oz|gm|x\s*\d+\s*ml)\b/i)?.[0] ?? "",
    brand: brandName,
    status: "Enabled" as const,
  }));

  const filtered = products.filter(
    (p) =>
      (brandFilter === "All brands" || p.brand === brandFilter) &&
      (search === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        String(p.productId).includes(search) ||
        p.upc.includes(search))
  );

  return (
    <div className="flex-1 bg-gray-50 min-h-screen">
      {/* Back bar */}
      {onBack && (
        <div className="bg-white border-b border-gray-100 px-8 py-2">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to campaign
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <h1 className="text-xl font-bold text-gray-900">Catalogue</h1>
      </div>

      <div className="px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 mb-5">
          {(["Requests", "Products"] as CatalogueTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-green-600 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Requests" ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-sm text-gray-400">No requests found.</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-4">
              {/* Brand filter */}
              <div className="relative">
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="appearance-none border border-gray-200 rounded-md pl-3 pr-8 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option>All brands</option>
                  <option>{brandName}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by request name, id and upc"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-md pl-9 pr-4 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <button className="ml-auto flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors">
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-white">
                    <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">Product ID</th>
                    <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">UPC</th>
                    <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">Product Name</th>
                    <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">Image</th>
                    <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">Brand</th>
                    <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">Status</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.productId} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-green-600 font-semibold">{p.productId}</span>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{p.upc}</td>
                      <td className="px-5 py-4">
                        <p className="text-gray-800 font-medium leading-snug">{p.name}</p>
                        {p.size && <p className="text-xs text-gray-400 mt-0.5">{p.size}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-10 w-10 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 text-center leading-tight px-0.5">
                          {p.brand.split(" ")[0]}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{p.brand}</td>
                      <td className="px-5 py-4">
                        <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded">
                          Enabled
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
