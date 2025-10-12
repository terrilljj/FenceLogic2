import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

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
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value);
    setInputValue(value.toString());
  }, [value]);

  const handleSliderChange = (values: number[]) => {
    const newValue = values[0];
    setLocalValue(newValue);
    setInputValue(newValue.toString());
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setInputValue(input);

    const parsed = parseInt(input);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      setLocalValue(clamped);
      onChange(clamped);
    }
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputValue);
    if (isNaN(parsed)) {
      setInputValue(localValue.toString());
    } else {
      const clamped = Math.max(min, Math.min(max, parsed));
      setInputValue(clamped.toString());
      setLocalValue(clamped);
      onChange(clamped);
    }
  };

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="w-16 h-8 text-sm font-mono text-right pr-1"
            data-testid={`${testId}-text-input`}
          />
          <span className="text-sm text-muted-foreground">mm</span>
        </div>
      </div>
      
      <div className="relative pt-2">
        <Slider
          value={[localValue]}
          onValueChange={handleSliderChange}
          min={min}
          max={max}
          step={1}
          className="w-full"
          data-testid={`${testId}-slider`}
        />
        <div className="flex justify-between mt-2">
          <span className="text-xs text-muted-foreground font-mono">{min}mm</span>
          <span className="text-xs text-muted-foreground font-mono">{max}mm</span>
        </div>
      </div>
    </div>
  );
}
