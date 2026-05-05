import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CollectionMode = "existing" | "filters" | "manual";

export function CampaignCollection() {
  const [mode, setMode] = useState<CollectionMode>("existing");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Select campaign collection</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          This is the collection of products you want to promote through this campaign
        </p>
      </div>

      {/* Option 1: Select from existing collections */}
      <div
        onClick={() => setMode("existing")}
        className={`rounded-lg border p-5 cursor-pointer transition-all ${
          mode === "existing" ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
            mode === "existing" ? "border-primary" : "border-muted-foreground"
          }`}>
            {mode === "existing" && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Select from existing collections</h3>
            <p className="text-xs text-muted-foreground">Get products from your existing collection</p>
          </div>
        </div>
        {mode === "existing" && (
          <div className="mt-4 ml-7">
            <Input placeholder="Search from existing brand collections" className="w-full" />
          </div>
        )}
      </div>

      {/* Option 2: Create collection via filters */}
      <div
        onClick={() => setMode("filters")}
        className={`rounded-lg border p-5 cursor-pointer transition-all ${
          mode === "filters" ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
            mode === "filters" ? "border-primary" : "border-muted-foreground"
          }`}>
            {mode === "filters" && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Create collection via filters</h3>
            <p className="text-xs text-muted-foreground">Select products from the brand and category filters</p>
          </div>
        </div>
        {mode === "filters" && (
          <div className="mt-4 ml-7 space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground">Collection display name</label>
              <Input placeholder="Enter Collection Name" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Select brand</label>
                <Select>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select from a list of brands" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand1">Brand 1</SelectItem>
                    <SelectItem value="brand2">Brand 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Select category</label>
                <Select>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cat1">Category 1</SelectItem>
                    <SelectItem value="cat2">Category 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Select sub-categories</label>
                <Select>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select sub-categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sub1">Sub-category 1</SelectItem>
                    <SelectItem value="sub2">Sub-category 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Sort products by</label>
                <Select>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select an Option" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Option 3: Create collection manually */}
      <div
        onClick={() => setMode("manual")}
        className={`rounded-lg border p-5 cursor-pointer transition-all ${
          mode === "manual" ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
            mode === "manual" ? "border-primary" : "border-muted-foreground"
          }`}>
            {mode === "manual" && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Create collection manually</h3>
            <p className="text-xs text-muted-foreground">Select up to 5 products manually</p>
          </div>
        </div>
        {mode === "manual" && (
          <div className="mt-4 ml-7 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Collection display name</label>
                <Input placeholder="Enter Collection Name" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Sort products by</label>
                <Select>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select an Option" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Select products</label>
              <Select>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select from a list of products" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="p1">Product 1</SelectItem>
                  <SelectItem value="p2">Product 2</SelectItem>
                  <SelectItem value="p3">Product 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
