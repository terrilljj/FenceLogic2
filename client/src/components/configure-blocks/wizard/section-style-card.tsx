import { useState } from "react";
import {
  CircleDot, Square, PanelRight, PanelLeft, PanelTop, ArrowDownToLine, Box, TreePine, Wrench, Trash2, ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SpanConfig } from "@shared/schema";
import { STYLE_OPTIONS, styleLabel, styleImage, attachmentConfigFor, type AttachmentIcon } from "@/lib/style-attachments";
import { IconOptionPicker } from "../hardware-card";

const ATTACH_ICON: Record<AttachmentIcon, JSX.Element> = {
  "core-drill": <CircleDot className="h-5 w-5" />,
  "base-plate": <Square className="h-5 w-5" />,
  "side-mount": <PanelLeft className="h-5 w-5" />,
  "deck": <PanelTop className="h-5 w-5" />,
  "face": <PanelRight className="h-5 w-5" />,
  "in-ground": <ArrowDownToLine className="h-5 w-5" />,
  "concrete": <Box className="h-5 w-5" />,
  "timber": <TreePine className="h-5 w-5" />,
  "steel": <Wrench className="h-5 w-5" />,
};

function StyleThumb({ variant, className }: { variant: string; className?: string }) {
  const img = styleImage(variant);
  return img
    ? <img src={img} alt="" className={cn("object-contain", className)} />
    : <Box className={cn("text-muted-foreground", className)} />;
}

interface Props {
  span: SpanConfig;
  variant: string;                 // resolved variant for this section
  canDelete: boolean;
  onNameChange: (name: string) => void;
  onLengthChange: (length: number) => void;
  onStyleChange: (variant: string) => void;
  onAttachmentChange: (patch: Partial<SpanConfig>) => void;
  onDelete: () => void;
}

export function SectionStyleCard({ span, variant, canDelete, onNameChange, onLengthChange, onStyleChange, onAttachmentChange, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const attach = attachmentConfigFor(variant);
  const glass = STYLE_OPTIONS.filter((s) => s.group === "glass");
  const alu = STYLE_OPTIONS.filter((s) => s.group === "aluminium");

  return (
    <div className="space-y-2.5 rounded-md border border-card-border p-3" data-testid={`section-card-${span.spanId}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">Section {span.spanId}</Label>
        {canDelete && (
          <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive" title="Delete section" data-testid={`step1-delete-${span.spanId}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Input value={span.name ?? ""} placeholder="Name (optional)" onChange={(e) => onNameChange(e.target.value)} className="h-9 text-sm" data-testid={`name-${span.spanId}`} />

      <div className="flex items-center gap-1">
        <Input type="number" value={span.length} min={0} max={30000} step={100} onChange={(e) => onLengthChange(parseInt(e.target.value) || 0)} className="h-9" data-testid={`length-${span.spanId}`} />
        <span className="text-xs text-muted-foreground">mm</span>
      </div>

      {/* Style — opens a grouped icon grid */}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Style</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-card-border px-2 hover-elevate active-elevate-2" data-testid={`style-${span.spanId}`}>
              <span className="flex min-w-0 items-center gap-2">
                <StyleThumb variant={variant} className="h-8 w-8 shrink-0" />
                <span className="truncate text-sm font-medium">{styleLabel(variant)}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            {[["Glass", glass], ["Aluminium", alu]].map(([title, list]) => (
              <div key={title as string} className="mb-1.5 last:mb-0">
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title as string}</p>
                <div className="grid grid-cols-2 gap-1">
                  {(list as typeof STYLE_OPTIONS).map((s) => {
                    const active = s.id === variant;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { onStyleChange(s.id); setOpen(false); }}
                        className={cn("flex items-center gap-1.5 rounded-md border p-1.5 text-left hover-elevate active-elevate-2", active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-card-border")}
                        data-testid={`style-opt-${span.spanId}-${s.id}`}
                      >
                        <StyleThumb variant={s.id} className="h-8 w-8 shrink-0" />
                        <span className="text-[11px] font-medium leading-tight">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Attachment — driven by the chosen style */}
      {attach && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Attachment</Label>
          <IconOptionPicker
            spanId={span.spanId}
            idPrefix="attach"
            value={attach.current(span) ?? attach.options[0].value}
            onSelect={(v) => onAttachmentChange(attach.write(v))}
            columns={attach.options.length >= 4 ? 4 : attach.options.length === 3 ? 3 : 2}
            options={attach.options.map((o) => ({ value: o.value, label: o.label, blurb: o.blurb, icon: ATTACH_ICON[o.icon] }))}
          />
        </div>
      )}
    </div>
  );
}
