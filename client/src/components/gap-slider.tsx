import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface GapSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  testId?: string;
}

export function GapSlider({
  value,
  onChange,
  min = 30,
  max = 80,
  label,
  testId = "gap-slider",
}: GapSliderProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleChange = (values: number[]) => {
    const newValue = values[0];
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono font-semibold text-primary">
            {localValue}
          </span>
          <span className="text-sm text-muted-foreground">mm</span>
        </div>
      </div>
      
      <div className="relative pt-2">
        <Slider
          value={[localValue]}
          onValueChange={handleChange}
          min={min}
          max={max}
          step={1}
          className="w-full"
          data-testid={`${testId}-input`}
        />
        <div className="flex justify-between mt-2">
          <span className="text-xs text-muted-foreground font-mono">{min}mm</span>
          <span className="text-xs text-muted-foreground font-mono">{max}mm</span>
        </div>
      </div>
    </div>
  );
}
