import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from "../info-tooltip";

interface GapSelectProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: string;
  testId?: string;
}

/**
 * Stepped numeric dropdown (mm) — the Oxworks-style replacement for the gap slider.
 * Structural primitive: knows nothing about gaps specifically, just renders a
 * label (+ optional measuring tooltip) and a Select of min→max stepped options.
 * The current value is always included as an option even if it is off-step, so
 * existing saved designs never lose their value.
 */
export function GapSelect({
  label,
  value,
  onChange,
  min = 0,
  max = 150,
  step = 5,
  tooltip,
  testId = "gap-select",
}: GapSelectProps) {
  const options: number[] = [];
  for (let v = min; v <= max; v += step) options.push(v);
  if (!options.includes(value)) {
    options.push(value);
    options.sort((a, b) => a - b);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <Select value={value.toString()} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger className="h-8 text-xs" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v.toString()}>{v}mm</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
