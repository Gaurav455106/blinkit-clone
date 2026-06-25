import { useState } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  /** Tooltip body text or node */
  content: React.ReactNode;
  /** Optional bold title shown above content */
  title?: string;
  /** Horizontal alignment of the tooltip bubble */
  align?: "left" | "center" | "right";
  /** Icon size class — defaults to h-3.5 w-3.5 */
  iconClass?: string;
}

/**
 * A small Info icon that reveals a tooltip on hover.
 * Usable by any campaign targeting component.
 */
export function InfoTooltip({
  content,
  title,
  align = "center",
  iconClass = "h-3.5 w-3.5",
}: InfoTooltipProps) {
  const [show, setShow] = useState(false);

  const alignClass =
    align === "left"
      ? "left-0"
      : align === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info className={`${iconClass} text-gray-400 hover:text-gray-600 cursor-default`} />
      {show && (
        <div
          className={`absolute top-full ${alignClass} mt-2 w-72 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-xl z-50 text-left`}
        >
          {title && <p className="font-semibold mb-1">{title}</p>}
          <p className="leading-relaxed text-gray-100">{content}</p>
        </div>
      )}
    </span>
  );
}
