import {
  CircleDot, Square, PanelRight, PanelLeft, PanelTop, ArrowDownToLine, Box, TreePine, Wrench, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SpanConfig } from "@shared/schema";
import { attachmentConfigFor, type AttachmentIcon } from "@/lib/style-attachments";
import { IconOptionPicker } from "../hardware-card";
import { StylePicker } from "./style-picker";

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

interface Props {
  index: number;                   // 1-based display number
  span: SpanConfig;
  variant: string;                 // resolved variant for this section
  selected: boolean;
  canDelete: boolean;
  onSelect: (field: string | null) => void;   // select the row, optionally focusing a field for Joe
  onNameChange: (name: string) => void;
  onLengthChange: (length: number) => void;
  onStyleChange: (variant: string) => void;
  onAttachmentChange: (patch: Partial<SpanConfig>) => void;
  onDelete: () => void;
}

/**
 * One section as a selectable ROW. Clicking the row (or any of its controls) selects it
 * with a bold outline and tells the parent which field is active, so Joe's pane updates.
 * Visual-first: style photo + distinct attachment icons; help text lives in Joe's pane.
 */
export function SectionRow({
  index, span, variant, selected, canDelete,
  onSelect, onNameChange, onLengthChange, onStyleChange, onAttachmentChange, onDelete,
}: Props) {
  const attach = attachmentConfigFor(variant);
  const currentAttach = attach ? (attach.current(span) ?? attach.options[0].value) : undefined;

  return (
    <div
      onClick={() => onSelect(null)}
      className={cn(
        "rounded-lg border bg-card p-3 transition-shadow",
        selected ? "border-primary ring-2 ring-primary shadow-sm" : "border-card-border hover-elevate",
      )}
      data-testid={`section-row-${span.spanId}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Number badge */}
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}>
          {index}
        </div>

        {/* Name + length */}
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <Input
            value={span.name ?? ""}
            placeholder={`Section ${index}`}
            onChange={(e) => onNameChange(e.target.value)}
            onFocus={() => onSelect(null)}
            className="h-9 text-sm"
            data-testid={`name-${span.spanId}`}
          />
          <div className="flex shrink-0 items-center gap-1">
            <Input
              type="number" value={span.length} min={0} max={30000} step={100}
              onChange={(e) => onLengthChange(parseInt(e.target.value) || 0)}
              onFocus={() => onSelect(null)}
              className="h-9 w-24"
              data-testid={`length-${span.spanId}`}
            />
            <span className="text-xs text-muted-foreground">mm</span>
          </div>
        </div>

        {/* Style chip → two-level picker (Pool/Balustrade → style) */}
        <StylePicker
          value={variant}
          onChange={onStyleChange}
          onOpenField={() => onSelect("style")}
        />

        {/* Attachment icons (style-dependent) */}
        {attach && (
          <div className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
            <IconOptionPicker
              spanId={span.spanId}
              idPrefix="attach"
              value={currentAttach!}
              onSelect={(v) => { onAttachmentChange(attach.write(v)); onSelect(`attach:${v}`); }}
              columns={attach.options.length >= 4 ? 4 : attach.options.length === 3 ? 3 : 2}
              options={attach.options.map((o) => ({ value: o.value, label: o.label, blurb: o.blurb, icon: ATTACH_ICON[o.icon] }))}
            />
          </div>
        )}

        {/* Delete */}
        {canDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            title="Delete section"
            data-testid={`step1-delete-${span.spanId}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
