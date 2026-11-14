// A box for whole numbers (units, rupees). A plain controlled <input type="number">
// showing 0 keeps that 0 when you type, so "59" becomes "059". This box keeps what
// you type as text, drops leading zeros and anything that isn't a digit, and selects
// its contents on focus so typing replaces the old number.

import { useState, type InputHTMLAttributes } from "react";

/** Digits only, without leading zeros ("059" → "59", "00" → "0", "" stays ""). */
export function cleanDigits(text: string): string {
  return text.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number;
  onValueChange: (next: number) => void;
};

export function WholeNumberInput({ value, onValueChange, onFocus, onBlur, ...rest }: Props) {
  // While the box is being edited it shows what was typed (it may be empty);
  // otherwise it shows the stored number.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.max(0, Math.round(value || 0)));
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={shown}
      onFocus={(e) => { e.currentTarget.select(); onFocus?.(e); }}
      onChange={(e) => {
        const digits = cleanDigits(e.target.value);
        setDraft(digits);
        onValueChange(digits === "" ? 0 : Number(digits));
      }}
      onBlur={(e) => { setDraft(null); onBlur?.(e); }}
    />
  );
}
