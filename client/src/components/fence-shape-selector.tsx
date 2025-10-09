import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Square, Triangle, BoxSelect, Box, Settings } from "lucide-react";
import { FenceShape } from "@shared/schema";

interface FenceShapeSelectorProps {
  selected: FenceShape;
  customSides?: number;
  onShapeChange: (shape: FenceShape) => void;
  onCustomSidesChange: (sides: number) => void;
}

export function FenceShapeSelector({
  selected,
  customSides = 3,
  onShapeChange,
  onCustomSidesChange,
}: FenceShapeSelectorProps) {
  const shapes = [
    { id: "inline" as FenceShape, label: "Inline", icon: Square },
    { id: "l-shape" as FenceShape, label: "L Shape", icon: Triangle },
    { id: "u-shape" as FenceShape, label: "U Shape", icon: BoxSelect },
    { id: "enclosed" as FenceShape, label: "Enclosed", icon: Box },
    { id: "custom" as FenceShape, label: "Custom", icon: Settings },
  ];

  return (
    <div className="space-y-4" data-testid="fence-shape-selector">
      <div>
        <h2 className="text-xl font-semibold mb-2">Select Fence Shape</h2>
        <p className="text-sm text-muted-foreground">
          Choose the configuration that matches your pool area
        </p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {shapes.map((shape) => {
          const Icon = shape.icon;
          const isSelected = selected === shape.id;
          
          return (
            <button
              key={shape.id}
              onClick={() => onShapeChange(shape.id)}
              className={`
                relative flex flex-col items-center justify-center gap-3 p-6 rounded-md
                border-2 transition-all duration-200 hover-elevate active-elevate-2
                ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-card-border hover:border-primary/50"
                }
              `}
              data-testid={`shape-${shape.id}`}
            >
              <Icon className="w-8 h-8" />
              <span className="text-sm font-medium">{shape.label}</span>
            </button>
          );
        })}
      </div>

      {selected === "custom" && (
        <div className="bg-card border border-card-border rounded-md p-6 space-y-4">
          <Label htmlFor="custom-sides" className="text-sm font-medium">
            Number of Sides (3-10)
          </Label>
          <div className="flex items-center gap-4">
            <Input
              id="custom-sides"
              type="number"
              min={3}
              max={10}
              value={customSides}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 3 && value <= 10) {
                  onCustomSidesChange(value);
                }
              }}
              className="w-24 font-mono"
              data-testid="input-custom-sides"
            />
            <span className="text-sm text-muted-foreground">
              Configure up to 10 sides for complex layouts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
