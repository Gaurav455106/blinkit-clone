interface BidInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Show red border + prefix when true */
  hasError?: boolean;
  /** Grey out and block interaction */
  disabled?: boolean;
  /** Text size: "sm" for keyword rows (xs), "md" for category rows (sm). Default "sm" */
  size?: "sm" | "md";
}

/**
 * A ₹-prefixed numeric bid input.
 * Reusable for keyword exact/smart bids, category CPM bids, and any future
 * campaign type that needs a rupee-denominated input.
 */
export function BidInput({
  value,
  onChange,
  placeholder = "Enter amount",
  hasError = false,
  disabled = false,
  size = "sm",
}: BidInputProps) {
  const textClass = size === "md" ? "text-sm" : "text-xs";
  const pyClass   = size === "md" ? "py-2"    : "py-1.5";

  return (
    <div
      className={`flex items-center border rounded-md overflow-hidden bg-white transition-opacity ${
        disabled ? "opacity-50 pointer-events-none" : ""
      } ${hasError ? "border-red-400" : "border-gray-200"}`}
    >
      <span
        className={`px-2 ${textClass} border-r bg-gray-50 ${
          hasError ? "text-red-400 border-red-300" : "text-gray-500 border-gray-200"
        }`}
      >
        ₹
      </span>
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 px-2 ${pyClass} ${textClass} outline-none bg-white w-0 min-w-0`}
      />
    </div>
  );
}
