import { inFmt } from "@/lib/targetingUtils";

interface BidRangeBoxProps {
  lo: number;
  hi: number;
  /**
   * "gray"  — subtle box used inside keyword rows (default)
   * "blue"  — blue pill used in category targeting rows
   */
  variant?: "gray" | "blue";
  label?: string;
}

/**
 * Displays a suggested bid range pill.
 * Reusable for keyword exact-match, smart-match, and category CPM sections
 * across any campaign type.
 */
export function BidRangeBox({ lo, hi, variant = "gray", label = "Suggested top bid range" }: BidRangeBoxProps) {
  if (variant === "blue") {
    return (
      <div className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-2 rounded-md text-center">
        ₹{inFmt(lo)} – ₹{inFmt(hi)}
      </div>
    );
  }

  return (
    <div className="mt-1 text-center bg-gray-50 border border-gray-100 rounded px-1 py-1">
      <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
      <div className="text-xs font-semibold text-gray-700">₹{inFmt(lo)} – ₹{inFmt(hi)}</div>
    </div>
  );
}
