import { useState } from "react";
import { Package, Plus, Scissors } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FenceShapeSelector } from "@/components/fence-shape-selector";
import { FenceDesign, FenceShape, SpanConfig, spanVariant } from "@shared/schema";
import { SectionRow } from "./section-row";
import { TipsPanel } from "./tips-panel";
import { joeStep1Tips } from "./step1-joe";

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
 * Step 1 — Style & Measure. Each section is a selectable ROW; selecting a row (or touching
 * one of its fields) drives Joe's pane on the right with contextual help. A single fence can
 * mix styles + attachments per section — Joe explains when a run must be split.
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
  const [selectedId, setSelectedId] = useState<string | null>(design.spans[0]?.spanId ?? null);
  const [activeField, setActiveField] = useState<string | null>(null);

  const selectedSpan = design.spans.find((s) => s.spanId === selectedId) ?? null;
  const selectedVariant = selectedSpan ? spanVariant(design, selectedSpan) : null;
  const tips = joeStep1Tips(selectedVariant, activeField);

  const select = (spanId: string, field: string | null) => {
    setSelectedId(spanId);
    setActiveField(field);
  };

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

      {/* Sections (rows) + Joe pane */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Sections</h3>
        <p className="text-xs text-muted-foreground">
          One section = one continuous run of the <strong>same style</strong> on the <strong>same surface</strong>. Tap a row to set it up — Joe guides each choice.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="space-y-2.5">
          {design.spans.map((span, i) => (
            <SectionRow
              key={span.spanId}
              index={i + 1}
              span={span}
              variant={spanVariant(design, span)}
              selected={span.spanId === selectedId}
              canDelete={canDelete}
              onSelect={(field) => select(span.spanId, field)}
              onNameChange={(name) => onSpanNameChange(span.spanId, name)}
              onLengthChange={(length) => onSpanLengthChange(span.spanId, length)}
              onStyleChange={(variant) => onSpanStyleChange(span.spanId, variant)}
              onAttachmentChange={(patch) => onSpanUpdate(span.spanId, patch)}
              onDelete={() => onDeleteSection(span.spanId)}
            />
          ))}

          {/* Mixed-run explainer */}
          <div className="flex items-start gap-2 rounded-md border border-dashed border-card-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              <strong className="text-foreground">Run changes style or surface?</strong> Split it. A run that's part glass-on-concrete and part aluminium-on-garden — or that crosses from deck onto concrete — is two sections, even if it's one straight line.
            </p>
          </div>

          {design.spans.length < 10 && (
            <Button variant="outline" size="sm" onClick={onAddSection} data-testid="step1-add-section">
              <Plus className="mr-1 h-4 w-4" /> Add section
            </Button>
          )}
        </div>

        {/* Joe — reacts to the selected row + active field */}
        <div className="lg:sticky lg:top-4">
          <TipsPanel tips={tips} />
        </div>
      </div>
    </div>
  );
}
