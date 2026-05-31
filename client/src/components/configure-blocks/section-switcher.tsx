import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionSwitcherSpan {
  spanId: string;
  length: number;
  name?: string;
}

interface SectionSwitcherProps {
  spans: SectionSwitcherSpan[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  className?: string;
}

/**
 * Left-hand vertical run/section switcher (Oxworks "Run A / Run B / Add Run").
 * Structural primitive — operates only on {spanId, length}; the active section is
 * the one whose accordion is shown beside it. Reused as-is by the Phase-2 wizard.
 */
export function SectionSwitcher({ spans, activeId, onSelect, onAdd, onDelete, className }: SectionSwitcherProps) {
  const canDelete = !!onDelete && spans.length > 1;
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-testid="section-switcher">
      {spans.map((s) => {
        const isActive = s.spanId === activeId;
        return (
          <div
            key={s.spanId}
            className={cn(
              "flex items-stretch gap-1 rounded-md border transition-colors",
              isActive ? "border-primary/40 bg-primary/10" : "border-card-border bg-card",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(s.spanId)}
              className={cn(
                "flex flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm hover-elevate active-elevate-2",
                isActive ? "font-semibold" : "text-muted-foreground",
              )}
              data-testid={`section-switcher-${s.spanId}`}
            >
              <span className="min-w-0 truncate">{s.name?.trim() || `Section ${s.spanId}`}</span>
              <span className="shrink-0 font-mono text-xs">{s.length.toLocaleString()}mm</span>
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete!(s.spanId)}
                className="flex items-center px-2 text-muted-foreground hover:text-destructive hover-elevate active-elevate-2"
                title="Delete section"
                data-testid={`section-switcher-${s.spanId}-delete`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center gap-1 rounded-md border border-dashed border-card-border px-3 py-2 text-xs text-muted-foreground hover-elevate active-elevate-2"
          data-testid="section-switcher-add"
        >
          <Plus className="h-3.5 w-3.5" /> Add Section
        </button>
      )}
    </div>
  );
}
