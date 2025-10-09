import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FenceShape } from "@shared/schema";

interface FenceShapeSelectorProps {
  selected: FenceShape;
  customSides?: number;
  onShapeChange: (shape: FenceShape) => void;
  onCustomSidesChange: (sides: number) => void;
}

// Custom SVG icons for fence shapes
const InlineIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const LShapeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 6 8 L 6 24 L 26 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const UShapeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 6 8 L 6 24 L 26 24 L 26 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const EnclosedIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="20" height="20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const CustomIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="8" y1="7" x2="24" y2="7" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    <line x1="8" y1="12.5" x2="24" y2="12.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    <line x1="8" y1="18" x2="24" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    <line x1="8" y1="23.5" x2="24" y2="23.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    <line x1="8" y1="29" x2="24" y2="29" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export function FenceShapeSelector({
  selected,
  customSides = 3,
  onShapeChange,
  onCustomSidesChange,
}: FenceShapeSelectorProps) {
  const shapes = [
    { id: "inline" as FenceShape, label: "Inline", icon: InlineIcon },
    { id: "l-shape" as FenceShape, label: "L Shape", icon: LShapeIcon },
    { id: "u-shape" as FenceShape, label: "U Shape", icon: UShapeIcon },
    { id: "enclosed" as FenceShape, label: "Enclosed", icon: EnclosedIcon },
    { id: "custom" as FenceShape, label: "Custom", icon: CustomIcon },
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
              data-testid={`shape-option-${shape.id}`}
            >
              <Icon />
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
