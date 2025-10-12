import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/info-tooltip";

interface NumericInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  testId?: string;
  tooltip?: string;
}

export function NumericInput({
  label,
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 10,
  unit = "mm",
  testId = "numeric-input",
  tooltip,
}: NumericInputProps) {
  const handleIncrement = () => {
    const newValue = Math.min(value + step, max);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(value - step, min);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || min;
    onChange(Math.max(min, Math.min(max, newValue)));
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleDecrement}
          disabled={value <= min}
          data-testid={`${testId}-decrement`}
        >
          <Minus className="w-4 h-4" />
        </Button>
        
        <div className="relative flex-1">
          <Input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            className="font-mono text-center pr-12"
            data-testid={`${testId}-input`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            {unit}
          </span>
        </div>
        
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleIncrement}
          disabled={value >= max}
          data-testid={`${testId}-increment`}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
