import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Package } from "lucide-react";

export function ProductBoosterProducts() {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const categories = ["Dog Needs", "Cat Needs", "Fish & Aquatics", "Bird Supplies", "Small Pet Supplies"];

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div className="flex gap-6 max-w-6xl">
      {/* Left side */}
      <div className="flex-1 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Select campaign products</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose your campaign products using filters, search, or bulk upload
          </p>
        </div>

        {/* Enter products manually */}
        <div className="rounded-lg border border-border p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Enter products manually</h3>
            <p className="text-xs text-muted-foreground">Find and select your products manually</p>
          </div>
          <div className="flex gap-3 items-center">
            <Select>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p1">Product 1</SelectItem>
                <SelectItem value="p2">Product 2</SelectItem>
                <SelectItem value="p3">Product 3</SelectItem>
              </SelectContent>
            </Select>
            <Button className="shrink-0 gap-2">
              <Download className="h-4 w-4" />
              Bulk Upload
            </Button>
          </div>
        </div>

        {/* Choose products via filters */}
        <div className="rounded-lg border border-border p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Choose products</h3>
            <p className="text-xs text-muted-foreground">Select products from the brand and category filters</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground">Select brands</label>
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={selectedBrands.length > 0 ? `${selectedBrands.length} Brands Selected` : "Select brands"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand1">Brand 1</SelectItem>
                  <SelectItem value="brand2">Brand 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <label className="text-xs font-semibold text-foreground">Select categories</label>
              <div
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className={`mt-1 flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer ${
                  showCategoryDropdown ? "border-primary" : "border-input"
                }`}
              >
                <span className="text-muted-foreground">
                  {selectedCategories.length > 0
                    ? `${selectedCategories.length} selected`
                    : "Select from categories"}
                </span>
                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {showCategoryDropdown && (
                <div className="absolute z-10 top-full left-0 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 border-b border-border">
                    <Checkbox
                      checked={selectedCategories.length === categories.length}
                      onCheckedChange={() => {
                        if (selectedCategories.length === categories.length) {
                          setSelectedCategories([]);
                        } else {
                          setSelectedCategories([...categories]);
                        }
                      }}
                    />
                    <span className="text-sm">Select All</span>
                  </div>
                  {categories.map((cat) => (
                    <div key={cat} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
                      <Checkbox
                        checked={selectedCategories.includes(cat)}
                        onCheckedChange={() => toggleCategory(cat)}
                      />
                      <span className="text-sm">{cat}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Selected products */}
      <div className="w-[420px] shrink-0">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 min-h-[400px] flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Selected products</h3>
            <p className="text-xs text-muted-foreground">Your target products will appear here</p>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-3 px-2 py-2 border-b border-border text-xs font-medium text-muted-foreground">
            <Checkbox disabled />
            <div className="w-6 h-6 rounded bg-muted" />
            <span className="flex-1">Product Name</span>
            <span className="w-20 text-right">Variants</span>
          </div>

          {/* Empty state */}
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No products yet!</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Select brand and category filters to add products or manually select PIDs below
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
