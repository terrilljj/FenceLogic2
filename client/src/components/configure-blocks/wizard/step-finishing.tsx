import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpanConfig } from "@shared/schema";
import { cn } from "@/lib/utils";

type Mounting = "base-plate" | "core-drilled" | "side-mounted";
type Finish = "polished" | "satin" | "black" | "white";

const MOUNTINGS: { value: Mounting; label: string }[] = [
  { value: "base-plate", label: "Base Plate" },
  { value: "core-drilled", label: "Core Drilled" },
  { value: "side-mounted", label: "Side Mounted" },
];
const FINISHES: { value: Finish; label: string }[] = [
  { value: "polished", label: "Polished" },
  { value: "satin", label: "Satin" },
  { value: "black", label: "Black" },
  { value: "white", label: "White" },
];

interface FinishCardProps {
  title: string;
  mounting: Mounting;
  finish: Finish;
  onMounting: (v: Mounting) => void;
  onFinish: (v: Finish) => void;
  isActive?: boolean;
  onSelect?: () => void;
  testId: string;
}

function FinishCard({ title, mounting, finish, onMounting, onFinish, isActive, onSelect, testId }: FinishCardProps) {
  return (
    <Card className={cn("overflow-hidden transition-colors", isActive && "ring-2 ring-primary")} data-testid={testId}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center justify-between border-b border-card-border px-4 py-2 text-left hover-elevate active-elevate-2",
          isActive ? "bg-primary/10" : "bg-muted/50",
        )}
        data-testid={`${testId}-select`}
      >
        <h4 className="text-sm font-semibold">{title}</h4>
        {onSelect && <span className="text-[11px] text-muted-foreground">{isActive ? "Shown above" : "Show"}</span>}
      </button>
      <div className="grid gap-4 p-4 sm:grid-cols-[110px_1fr] sm:items-start">
        {/* Placeholder product-image tile — real storefront images land in Phase 3. */}
        <div className="mx-auto flex aspect-square w-full max-w-[110px] items-center justify-center rounded-md bg-muted px-2 text-center text-[10px] leading-tight text-muted-foreground">
          Spigot image<br />coming soon
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mounting</Label>
            <Select value={mounting} onValueChange={(v) => onMounting(v as Mounting)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOUNTINGS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Finish</Label>
            <Select value={finish} onValueChange={(v) => onFinish(v as Finish)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FINISHES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface StepFinishingProps {
  spans: SpanConfig[];
  onUpdateSpan: (spanId: string, updates: Partial<SpanConfig>) => void;
  /** The section whose mini render is shown above; clicking a card selects it. */
  activeId?: string;
  onSelect?: (spanId: string) => void;
}

/**
 * Step 3 — Finishing touches. spigotMounting/spigotColor are per-span in the
 * schema (frozen), so the design-wide feel is delivered by an "Apply to all
 * sections" control that fans a write across every span. No new fields invented.
 */
export function StepFinishing({ spans, onUpdateSpan, activeId, onSelect }: StepFinishingProps) {
  if (spans.length === 0) return null;
  const multi = spans.length > 1;
  const first = spans[0];
  const applyAll = (updates: Partial<SpanConfig>) => spans.forEach((s) => onUpdateSpan(s.spanId, updates));

  return (
    <div className="space-y-4" data-testid="step-finishing">
      {multi && (
        <Card className="flex flex-col justify-between gap-3 border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <div>
            <h4 className="text-sm font-semibold">Apply to all sections</h4>
            <p className="text-xs text-muted-foreground">Set one mounting &amp; finish across every section at once.</p>
          </div>
          <div className="flex gap-2">
            <Select value={first.spigotMounting || "base-plate"} onValueChange={(v) => applyAll({ spigotMounting: v as Mounting })}>
              <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{MOUNTINGS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={first.spigotColor || "polished"} onValueChange={(v) => applyAll({ spigotColor: v as Finish })}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{FINISHES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {spans.map((s) => (
          <FinishCard
            key={s.spanId}
            title={multi ? `${s.name?.trim() || `Section ${s.spanId}`} — Spigots` : "Spigots"}
            mounting={(s.spigotMounting || "base-plate") as Mounting}
            finish={(s.spigotColor || "polished") as Finish}
            onMounting={(v) => onUpdateSpan(s.spanId, { spigotMounting: v })}
            onFinish={(v) => onUpdateSpan(s.spanId, { spigotColor: v })}
            isActive={multi && activeId === s.spanId}
            onSelect={multi && onSelect ? () => onSelect(s.spanId) : undefined}
            testId={`finish-${s.spanId}`}
          />
        ))}
      </div>
    </div>
  );
}
