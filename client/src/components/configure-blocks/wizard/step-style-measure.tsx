import { Package, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FenceShapeSelector } from "@/components/fence-shape-selector";
import { FenceDesign, FenceShape, SpanConfig, spanVariant } from "@shared/schema";
import { SectionStyleCard } from "./section-style-card";

interface StepStyleMeasureProps {
  design: FenceDesign;
  productLabel: string;
  onChangeProduct: () => void;
  onDesignNameChange: (name: string) => void;
  onShapeChange: (shape: FenceShape) => void;
  onCustomSidesChange: (sides: number) => void;
  onSpanLengthChange: (spanId: string, length: number) => void;
  onSpanNameChange: (spanId: string, name: string) => void;
  onSpanStyleChange: (spanId: string, variant: string) => void;
  onSpanUpdate: (spanId: string, patch: Partial<SpanConfig>) => void;
  onAddSection: () => void;
  onDeleteSection: (spanId: string) => void;
}

/**
 * Step 1 — Style & Measure. Design name + product + shape cards (reuses the
 * existing FenceShapeSelector) + per-section length inputs. Responsive.
 */
export function StepStyleMeasure({
  design,
  productLabel,
  onChangeProduct,
  onDesignNameChange,
  onShapeChange,
  onCustomSidesChange,
  onSpanLengthChange,
  onSpanNameChange,
  onSpanStyleChange,
  onSpanUpdate,
  onAddSection,
  onDeleteSection,
}: StepStyleMeasureProps) {
  const canDelete = design.spans.length > 1;
  return (
    <div className="space-y-6" data-testid="step-style-measure">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="design-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Design Name</Label>
          <Input
            id="design-name"
            value={design.name}
            onChange={(e) => onDesignNameChange(e.target.value)}
            placeholder="Enter design name"
            className="h-10 font-semibold"
            data-testid="input-design-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</Label>
          <button
            type="button"
            onClick={onChangeProduct}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 text-sm font-medium hover-elevate active-elevate-2"
            data-testid="button-change-product"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Package className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{productLabel}</span>
            </span>
            <span className="shrink-0 text-xs text-primary">Change</span>
          </button>
        </div>
      </div>

      <FenceShapeSelector
        selected={design.shape}
        customSides={design.customSides}
        onShapeChange={onShapeChange}
        onCustomSidesChange={onCustomSidesChange}
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Sections</h3>
        <p className="text-xs text-muted-foreground">Set each section's length, style and how it attaches. A single fence can mix styles (e.g. glass spigots on one run, BARR on another).</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {design.spans.map((span) => (
            <SectionStyleCard
              key={span.spanId}
              span={span}
              variant={spanVariant(design, span)}
              canDelete={canDelete}
              onNameChange={(name) => onSpanNameChange(span.spanId, name)}
              onLengthChange={(length) => onSpanLengthChange(span.spanId, length)}
              onStyleChange={(variant) => onSpanStyleChange(span.spanId, variant)}
              onAttachmentChange={(patch) => onSpanUpdate(span.spanId, patch)}
              onDelete={() => onDeleteSection(span.spanId)}
            />
          ))}
        </div>
        {design.spans.length < 10 && (
          <Button variant="outline" size="sm" onClick={onAddSection} data-testid="step1-add-section">
            <Plus className="mr-1 h-4 w-4" /> Add section
          </Button>
        )}
      </div>
    </div>
  );
}
