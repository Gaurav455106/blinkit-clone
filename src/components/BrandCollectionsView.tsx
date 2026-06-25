import { useState } from "react";
import { Search, Pencil, Download, ArrowLeft } from "lucide-react";
import { EditCollectionDialog } from "./EditCollectionDialog";

export interface BrandCollection {
  id: string;
  name: string;
  type: "DYNAMIC" | "MANUAL";
  productCount: number;
  createdBy: string;
  createdOn: string;
}

interface Props {
  collections: BrandCollection[];
  onBack?: () => void;
  onUpdateCollection?: (updated: BrandCollection) => void;
}

export function BrandCollectionsView({ collections, onBack, onUpdateCollection }: Props) {
  const [search, setSearch] = useState("");
  const [editingCollection, setEditingCollection] = useState<BrandCollection | null>(null);

  const filtered = collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
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
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Brand Collections</h1>
        <button className="flex items-center gap-2 border border-green-600 text-green-600 text-sm font-medium px-4 py-2 rounded-md hover:bg-green-50 transition-colors">
          <Download className="h-4 w-4" />
          Link Performance
        </button>
      </div>

      <div className="px-8 py-6 max-w-5xl">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search for brand collections"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
          />
        </div>

        {/* Collections list */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-sm text-gray-400">
              {collections.length === 0
                ? "No collections yet. Create one from the Listing Spotlight campaign."
                : "No collections match your search."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((coll) => (
              <div key={coll.id} className="bg-white border border-gray-200 rounded-lg px-6 py-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-base font-bold text-gray-900">{coll.name}</span>
                    <span className="text-sm text-gray-500">({coll.productCount} products)</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded text-white ${coll.type === "DYNAMIC" ? "bg-green-700" : "bg-blue-600"}`}>
                      {coll.type}
                    </span>
                  </div>
                  <button
                    onClick={() => setEditingCollection(coll)}
                    className="flex items-center gap-1.5 border border-green-600 text-green-600 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-green-50 transition-colors shrink-0 ml-4"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-4 max-w-xs">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Created by</p>
                    <p className="text-sm font-semibold text-gray-800">{coll.createdBy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Created on</p>
                    <p className="text-sm font-semibold text-gray-800">{coll.createdOn}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      {editingCollection && (
        <EditCollectionDialog
          collection={editingCollection}
          onClose={() => setEditingCollection(null)}
          onUpdate={(updated) => {
            onUpdateCollection?.(updated);
            setEditingCollection(null);
          }}
        />
      )}
    </div>
  );
}
