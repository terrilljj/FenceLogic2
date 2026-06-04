import { useEffect, useState } from "react";
import { Box, ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  STYLE_OPTIONS, stylesForUse, styleImage, styleFullLabel, styleUse, type StyleUse, type StyleOption,
} from "@/lib/style-attachments";

function Thumb({ variant, className }: { variant: string; className?: string }) {
  const img = styleImage(variant);
  return img
    ? <img src={img} alt="" className={cn("object-contain", className)} />
    : <Box className={cn("text-muted-foreground", className)} strokeWidth={1.25} />;
}

interface Props {
  value: string;                       // current variant
  onChange: (variant: string) => void;
  onOpenField?: () => void;            // tell parent the style field is active (drives Joe)
  className?: string;
}

/**
 * Two-level style picker: first Pool Fence vs Balustrade (so a bal style can't be picked
 * onto a pool run by mistake), then the styles for that application as LARGE photo cards.
 */
export function StylePicker({ value, onChange, onOpenField, className }: Props) {
  const [open, setOpen] = useState(false);
  const [use, setUse] = useState<StyleUse>(styleUse(value));

  // When reopened, start on the current selection's application.
  useEffect(() => { if (open) setUse(styleUse(value)); }, [open, value]);

  const list = stylesForUse(use);
  const glass = list.filter((s) => s.group === "glass");
  const alu = list.filter((s) => s.group === "aluminium");

  const Card = ({ s }: { s: StyleOption }) => {
    const active = s.id === value;
    return (
      <button
        type="button"
        onClick={() => { onChange(s.id); onOpenField?.(); setOpen(false); }}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-lg border text-left hover-elevate active-elevate-2",
          active ? "border-primary ring-1 ring-primary" : "border-card-border",
        )}
        data-testid={`style-opt-${s.id}`}
      >
        {active && (
          <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
        <div className="flex h-24 w-full items-center justify-center bg-muted/40 p-1">
          <Thumb variant={s.id} className="h-full w-full" />
        </div>
        <span className="px-2 py-1.5 text-xs font-medium leading-tight">{s.label}</span>
      </button>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => { setOpen(o); if (o) onOpenField?.(); }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex h-11 min-w-[160px] items-center justify-between gap-2 rounded-md border border-card-border px-2 hover-elevate active-elevate-2",
            className,
          )}
          data-testid="style-trigger"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Thumb variant={value} className="h-8 w-8 shrink-0" />
            <span className="truncate text-sm font-medium">{styleFullLabel(value)}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-3" onClick={(e) => e.stopPropagation()}>
        {/* Layer 1 — application */}
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {(["pool", "balustrade"] as StyleUse[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUse(u)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
                use === u ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`style-use-${u}`}
            >
              {u === "pool" ? "Pool Fence" : "Balustrade"}
            </button>
          ))}
        </div>

        {/* Layer 2 — styles for the chosen application */}
        {[["Glass", glass], ["Aluminium", alu]].map(([title, group]) => (
          (group as StyleOption[]).length > 0 && (
            <div key={title as string} className="mb-3 last:mb-0">
              <p className="px-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title as string}</p>
              <div className="grid grid-cols-2 gap-2">
                {(group as StyleOption[]).map((s) => <Card key={s.id} s={s} />)}
              </div>
            </div>
          )
        ))}
      </PopoverContent>
    </Popover>
  );
}
