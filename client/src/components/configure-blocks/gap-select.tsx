import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "../info-tooltip";

interface GapSelectProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Stepper button increment. End gaps use 1mm (honoured exactly by the layout);
   *  the mid gap passes its ACHIEVABLE increment (50mm ÷ number of mid gaps),
   *  because panels sit on a 50mm grid. */
  step?: number;
  tooltip?: string;
  testId?: string;
}

/** Display helper: whole numbers stay whole ("83"), fractional gaps show one decimal ("38.5"). */
function formatMm(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Free-entry gap input (mm) with up/down steppers — owner-corrected 2026-06-03.
 * Typing accepts any value inside [min, max] (NOT restricted to 5mm increments);
 * the +/- buttons nudge by `step`. The field shows the value passed in — for the
 * mid gap that is the ACTUAL achieved gap, so what you read is what gets built.
 * While the field has focus the user's keystrokes are never overwritten; the
 * display re-syncs to the achieved value on blur.
 */
export function GapSelect({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  tooltip,
  testId = "gap-select",
}: GapSelectProps) {
  const [text, setText] = useState(formatMm(value));
  const [focused, setFocused] = useState(false);

  // Sync the display to the (possibly solver-adjusted) value — but never while the
  // user is typing in the field.
  useEffect(() => {
    if (!focused) setText(formatMm(value));
  }, [value, focused]);

  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n * 10) / 10));

  const handleType = (raw: string) => {
    setText(raw);
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) onChange(clamp(n));
  };

  const handleBlur = () => {
    setFocused(false);
    const n = parseFloat(text);
    const committed = Number.isNaN(n) ? clamp(0) : clamp(n);
    onChange(committed);
    setText(formatMm(committed));
  };

  const nudge = (dir: 1 | -1) => {
    const current = Number.isNaN(parseFloat(text)) ? value : parseFloat(text);
    const next = clamp(current + dir * step);
    onChange(next);
    setText(formatMm(next));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <div className="flex h-8 items-stretch overflow-hidden rounded-md border border-input bg-background">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={value <= min}
          className="flex w-8 shrink-0 items-center justify-center border-r border-input text-muted-foreground hover-elevate active-elevate-2 disabled:opacity-40"
          data-testid={`${testId}-down`}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            type="number"
            inputMode="decimal"
            value={text}
            min={min}
            max={max}
            onFocus={() => setFocused(true)}
            onChange={(e) => handleType(e.target.value)}
            onBlur={handleBlur}
            className="h-full w-full bg-transparent pr-8 text-center text-xs font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            data-testid={testId}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            mm
          </span>
        </div>
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={value >= max}
          className="flex w-8 shrink-0 items-center justify-center border-l border-input text-muted-foreground hover-elevate active-elevate-2 disabled:opacity-40"
          data-testid={`${testId}-up`}
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
