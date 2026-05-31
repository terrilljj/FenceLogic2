import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface Tip {
  title: string;
  body: string;
}

interface TipsPanelProps {
  title?: string;
  tips: Tip[];
  footnote?: string;
}

/**
 * Oxworks "Things to consider" help panel. Factual measuring guidance — not
 * fabricated installer-voice. Sits beside Step 1 inputs (stacks under on mobile).
 */
export function TipsPanel({ title = "Things to consider", tips, footnote }: TipsPanelProps) {
  return (
    <Card className="h-full border-card-border bg-muted/30 p-4" data-testid="tips-panel">
      <div className="mb-3 flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ul className="space-y-3">
        {tips.map((t, i) => (
          <li key={i}>
            <p className="text-xs font-semibold text-foreground">{t.title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.body}</p>
          </li>
        ))}
      </ul>
      {footnote && (
        <p className="mt-4 border-t border-card-border pt-3 text-[11px] text-muted-foreground">{footnote}</p>
      )}
    </Card>
  );
}
